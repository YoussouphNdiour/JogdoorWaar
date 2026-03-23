# AI.md — IA Matching + Bot WhatsApp Jog Door Waar

## 1. SCORE DE MATCHING

Score hybride : **60% vectoriel + 40% LLM Claude**.

```typescript
// src/ai/matching.service.ts
async computeMatchScore(userId: string, jobId: string): Promise<MatchResult> {
  const [profile, job] = await Promise.all([
    this.prisma.userProfile.findUnique({ where: { userId }, include: { user: { include: { cvs: { where: { isDefault: true }, take: 1 } } } } }),
    this.prisma.job.findUnique({ where: { id: jobId } }),
  ]);

  // Score vectoriel pgvector (CV par défaut vs offre)
  const vectorScore = await this.prisma.$queryRaw<[{score: number}]>`
    SELECT 1 - (
      (SELECT embedding FROM "UserCV" WHERE "userId" = ${userId} AND "isDefault" = true LIMIT 1)
      <=> (SELECT embedding FROM jobs WHERE id = ${jobId})
    ) AS score
  `;

  // Score LLM
  const llm = await this.anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: `Expert RH. Analyse compatibilité candidat/offre. JSON uniquement:
    {"score":0-100,"strengths":["..."],"gaps":["..."],"recommendation":"..."}`,
    messages: [{ role: 'user', content:
      `PROFIL: ${JSON.stringify({ skills: profile?.skills, jobTitles: profile?.targetJobTitles, exp: profile?.yearsOfExperience })}
       OFFRE: ${JSON.stringify({ title: job?.title, skills: job?.requiredSkills, exp: job?.yearsExperienceMin })}` }]
  });

  const llmResult = JSON.parse(llm.content[0].text);
  const finalScore = Math.round((vectorScore[0]?.score ?? 0.5) * 100 * 0.6 + llmResult.score * 0.4);

  await this.prisma.matchScore.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: { userId, jobId, score: finalScore / 100, reasoning: llmResult.recommendation },
    update: { score: finalScore / 100, reasoning: llmResult.recommendation },
  });

  await this.logAiUsage(userId, 'MATCHING', llm.usage);
  return { score: finalScore, ...llmResult };
}
```

## 2. RÉSUMÉ AUTOMATIQUE DES OFFRES

```typescript
async summarizeJob(jobId: string, description: string): Promise<string> {
  const cached = await this.redis.get(`summary:${jobId}`);
  if (cached) return cached;

  const response = await this.anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: `Résume cette offre en 3-4 bullet points MAX. Format: • point court.
    Priorité: salaire, type contrat, expérience requise, compétences clés. Max 150 mots. Français.`,
    messages: [{ role: 'user', content: description }]
  });

  const summary = response.content[0].text;
  await this.redis.setex(`summary:${jobId}`, 86400, summary); // cache 24h
  return summary;
}
```

## 3. SÉLECTION INTELLIGENTE DE CV

```typescript
// src/ai/cv-selector.service.ts
async selectBestCV(userId: string, jobId: string): Promise<CVSelectionResult> {
  const userCVs = await this.prisma.userCV.findMany({ where: { userId } });
  if (userCVs.length === 0) return { recommendation: 'NO_CV', bestCv: null, confidence: 0 };
  if (userCVs.length === 1) return { recommendation: 'USE_EXISTING', bestCv: userCVs[0], confidence: 100 };

  const scores = await Promise.all(userCVs.map(async cv => {
    const res = await this.prisma.$queryRaw<[{score: number}]>`
      SELECT 1 - ((SELECT embedding FROM "UserCV" WHERE id = ${cv.id}) <=> (SELECT embedding FROM jobs WHERE id = ${jobId})) AS score
    `;
    return { cv, score: res[0]?.score ?? 0 };
  }));
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  return {
    recommendation: best.score > 0.80 ? 'USE_EXISTING' : 'GENERATE_ADAPTED',
    bestCv: best.cv,
    confidence: Math.round(best.score * 100),
    allCvs: scores.map(s => ({ cv: s.cv, score: Math.round(s.score * 100) })),
  };
}

async generateAdaptedCV(userId: string, jobId: string, baseCvId: string): Promise<AdaptedCVResult> {
  const [job, baseCv] = await Promise.all([
    this.prisma.job.findUnique({ where: { id: jobId } }),
    this.prisma.userCV.findUnique({ where: { id: baseCvId } }),
  ]);

  const response = await this.anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `Expert CV. Optimise ce CV pour l'offre. RÈGLES STRICTES:
    - Ne JAMAIS inventer compétences/expériences absentes du CV original
    - Réorganiser et reformuler pour mettre en avant l'adéquation
    - Adapter titre et résumé professionnel uniquement
    JSON: {"modifications":["..."],"newCvText":"...","newCvName":"..."}`,
    messages: [{ role: 'user', content:
      `CV ORIGINAL:\n${baseCv!.textContent}\n\nOFFRE:\nPoste: ${job!.title}\nSkills: ${job!.requiredSkills.join(', ')}\nDesc: ${job!.descriptionShort}` }]
  });

  const result = JSON.parse(response.content[0].text);
  const pdfBuffer = await this.pdfGeneratorService.generateFromText(result.newCvText);
  const fileUrl = await this.storageService.upload(`cvs/${userId}/generated_${Date.now()}.pdf`, pdfBuffer);
  const embedding = await this.embeddingService.embed(result.newCvText);

  const newCv = await this.prisma.userCV.create({
    data: {
      userId, name: result.newCvName, label: result.newCvName.substring(0, 24),
      fileUrl, fileName: `cv_adapte_${Date.now()}.pdf`,
      textContent: result.newCvText, isGenerated: true, parentCvId: baseCvId,
      embedding, detectedSkills: baseCv!.detectedSkills, sectorFit: baseCv!.sectorFit,
    }
  });

  await this.logAiUsage(userId, 'CV_GENERATION', response.usage);
  return { newCv, modifications: result.modifications, baseCvName: baseCv!.name };
}
```

## 4. GÉNÉRATION LETTRE DE MOTIVATION (PREMIUM)

```typescript
async generateCoverLetter(userId: string, jobId: string, cvId?: string): Promise<string> {
  await this.checkPremiumAccess(userId, 'COVER_LETTER');
  const cv = cvId
    ? await this.prisma.userCV.findUnique({ where: { id: cvId } })
    : await this.prisma.userCV.findFirst({ where: { userId, isDefault: true } });
  const job = await this.prisma.job.findUnique({ where: { id: jobId } });

  const response = await this.anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: `Expert lettres de motivation professionnelles. Règles:
    - Ton professionnel mais humain
    - Max 4 paragraphes
    - Éléments SPÉCIFIQUES de l'offre (jamais générique)
    - Éviter "Je suis très motivé" et autres formules creuses
    - Terminer par invitation à entretien
    - En français`,
    messages: [{ role: 'user', content:
      `CV:\n${cv?.textContent ?? 'Non fourni'}\n\nOFFRE: ${job?.title} chez ${job?.company}\n${job?.descriptionShort}` }]
  });

  await this.logAiUsage(userId, 'COVER_LETTER', response.usage);
  return response.content[0].text;
}
```

## 5. COACH ENTRETIEN (PREMIUM)

```typescript
async generateInterviewKit(userId: string, jobId: string): Promise<InterviewKit> {
  await this.checkPremiumAccess(userId, 'INTERVIEW_COACH');
  const [job, profile] = await Promise.all([
    this.prisma.job.findUnique({ where: { id: jobId } }),
    this.prisma.userProfile.findUnique({ where: { userId } }),
  ]);

  const response = await this.anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `Coach entretien. JSON:
    {"technicalQuestions":[{"q":"...","hint":"..."}],
     "behavioralQuestions":[{"q":"...","star":"..."}],
     "questionsToAsk":["..."],
     "salaryNegotiation":"..."}`,
    messages: [{ role: 'user', content: `Offre: ${JSON.stringify(job)}\nProfil: ${JSON.stringify(profile)}` }]
  });

  await this.logAiUsage(userId, 'INTERVIEW_COACH', response.usage);
  return JSON.parse(response.content[0].text);
}
```

---

## 6. BOT WHATSAPP — MACHINE À ÉTATS

### États

```
IDLE → SELECTING_CV → GENERATING_CV → CONFIRMING_CV
                    ↘                              ↓
                     → (CV existant sélectionné) → GENERATING_COVER_LETTER
                                                   → REVIEWING_COVER_LETTER
                                                   → APPLYING → DONE
```

### Flux complet depuis une alerte

```typescript
// src/whatsapp/whatsapp-bot.service.ts

// ÉTAPE 1 : Notification avec boutons (appelé par alert-dispatcher)
async sendJobAlertWithButtons(user: User, job: Job, matchScore: number): Promise<void> {
  const emoji = matchScore >= 80 ? '🔥' : matchScore >= 60 ? '✅' : '📋';
  await this.sendInteractiveButtons(user.whatsappNumber!, {
    header: `${emoji} Match ${matchScore}% — Nouvelle offre`,
    body: `*${job.title}*\n🏢 ${job.company}\n📍 ${job.city} • ${job.jobType}${job.salaryRaw ? `\n💰 ${job.salaryRaw}` : ''}\n\n${job.descriptionShort ?? ''}`,
    footer: `${job.sourcePlatform.replace('_', ' ')} • Jog Door Waar`,
    buttons: [
      { id: `apply_${job.id}`, title: '✅ Postuler maintenant' },
      { id: `save_${job.id}`, title: '🔖 Sauvegarder' },
      { id: `more_${job.id}`, title: '📖 Voir détails' },
    ]
  });
}

// ÉTAPE 2 : Webhook reçu → router
async processIncomingMessage(payload: WaSenderWebhookPayload): Promise<void> {
  const phone = payload.from;
  const user = await this.findUserByPhone(phone);
  if (!user) { await this.sendMessage(phone, `Créez un compte sur ${process.env.APP_URL}`); return; }

  const session = await this.getOrCreateSession(user.id, phone);
  const buttonId = payload.interactive?.button_reply?.id ?? payload.interactive?.list_reply?.id ?? '';
  const text = payload.text?.body?.toLowerCase().trim() ?? '';

  switch (session.state) {
    case WhatsAppBotState.IDLE:          return this.handleIdle(user, session, buttonId, text);
    case WhatsAppBotState.SELECTING_CV:  return this.handleCVSelection(user, session, buttonId);
    case WhatsAppBotState.CONFIRMING_CV: return this.handleCVConfirmation(user, session, buttonId);
    case WhatsAppBotState.REVIEWING_COVER_LETTER: return this.handleLetterReview(user, session, buttonId);
    default: await this.resetSession(session); await this.sendMessage(phone, '🔄 Session réinitialisée. Tapez *aide*.');
  }
}

// ÉTAPE 3 : Idle → router boutons d'alerte
private async handleIdle(user: User, session: WhatsAppSession, buttonId: string, text: string): Promise<void> {
  const phone = user.whatsappNumber!;
  if (buttonId.startsWith('apply_')) {
    const jobId = buttonId.replace('apply_', '');
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (job) return this.initiateApplication(user, job);
  }
  if (buttonId.startsWith('save_')) {
    const jobId = buttonId.replace('save_', '');
    await this.prisma.savedJob.upsert({ where: { userId_jobId: { userId: user.id, jobId } }, create: { userId: user.id, jobId }, update: {} });
    await this.sendMessage(phone, '🔖 Offre sauvegardée !'); return;
  }
  if (buttonId.startsWith('more_')) {
    await this.sendMessage(phone, `${process.env.APP_URL}/jobs/${buttonId.replace('more_', '')}`); return;
  }
  if (text === 'aide' || text === '?') { await this.sendHelp(phone); return; }
  if (text.includes('mes cv')) { await this.sendCVList(user); return; }
  if (text.includes('mes candidatures')) { await this.sendApplicationsSummary(user); return; }
  await this.sendMessage(phone, `Je n'ai pas compris 😅 Tapez *aide* pour les commandes.`);
}

// ÉTAPE 4 : Initier candidature → afficher CVs
private async initiateApplication(user: User, job: Job): Promise<void> {
  const phone = user.whatsappNumber!;
  const [userCVs, cvSelection] = await Promise.all([
    this.prisma.userCV.findMany({ where: { userId: user.id }, orderBy: { isDefault: 'desc' } }),
    this.cvSelectorService.selectBestCV(user.id, job.id),
  ]);

  if (userCVs.length === 0) {
    await this.sendInteractiveButtons(phone, {
      body: `*${job.title}* chez *${job.company}*\n\nVous n'avez pas de CV. Ajoutez-en un d'abord.`,
      buttons: [{ id: 'upload_cv', title: '📎 Ajouter un CV' }, { id: 'cancel', title: '❌ Annuler' }]
    });
    return;
  }

  await this.updateSession(user.id, phone, WhatsAppBotState.SELECTING_CV, { jobId: job.id, jobTitle: job.title, jobCompany: job.company, cvSuggestion: cvSelection });

  const recommendation = cvSelection.bestCv
    ? `\n\n💡 *IA recommande :* "${cvSelection.bestCv.name}" (${cvSelection.confidence}% match)` : '';

  if (userCVs.length <= 2) {
    await this.sendInteractiveButtons(phone, {
      header: '📋 Choisir un CV',
      body: `*${job.title}* chez *${job.company}*${recommendation}\n\nQuel CV utiliser ?`,
      buttons: [
        ...userCVs.slice(0, 2).map(cv => ({ id: `cv_${cv.id}`, title: (cv.label ?? cv.name).substring(0, 20) })),
        { id: 'generate_cv', title: '🤖 CV adapté IA' },
      ]
    });
  } else {
    await this.sendInteractiveList(phone, {
      header: '📋 Choisir un CV',
      body: `*${job.title}* chez *${job.company}*${recommendation}`,
      buttonText: 'Voir mes CVs',
      sections: [{
        title: 'Mes CVs',
        items: [
          ...userCVs.map(cv => ({ id: `cv_${cv.id}`, title: (cv.label ?? cv.name).substring(0, 24), description: cv.detectedSkills.slice(0, 3).join(', ') })),
          { id: 'generate_cv', title: '🤖 Créer CV adapté', description: 'IA optimise pour cette offre' },
          { id: 'cancel', title: '❌ Annuler', description: '' },
        ]
      }]
    });
  }
}

// ÉTAPE 5 : Sélection CV
private async handleCVSelection(user: User, session: WhatsAppSession, buttonId: string): Promise<void> {
  const phone = user.whatsappNumber!;
  const ctx = session.context as any;
  if (!buttonId || buttonId === 'cancel') { await this.resetSession(session); await this.sendMessage(phone, '❌ Annulé.'); return; }
  if (buttonId === 'upload_cv') { await this.sendMessage(phone, `Ajoutez vos CVs : ${process.env.APP_URL}/profile/cvs`); await this.resetSession(session); return; }

  if (buttonId === 'generate_cv') {
    await this.updateSession(user.id, phone, WhatsAppBotState.GENERATING_CV, ctx);
    await this.sendMessage(phone, '🤖 Génération de votre CV adapté... ⏳ ~30 secondes');
    const defaultCv = await this.prisma.userCV.findFirst({ where: { userId: user.id, isDefault: true } }) ?? await this.prisma.userCV.findFirst({ where: { userId: user.id } });
    try {
      const result = await this.cvSelectorService.generateAdaptedCV(user.id, ctx.jobId, defaultCv!.id);
      const newCtx = { ...ctx, selectedCvId: result.newCv.id, modifications: result.modifications };
      await this.updateSession(user.id, phone, WhatsAppBotState.CONFIRMING_CV, newCtx);
      const modsList = result.modifications.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n');
      await this.sendInteractiveButtons(phone, {
        header: '🤖 CV adapté généré !',
        body: `Modifications apportées à *${result.baseCvName}* :\n\n${modsList}\n\nConfirmer ?`,
        buttons: [{ id: 'confirm_cv', title: '✅ Utiliser ce CV' }, { id: 'edit_on_app', title: '✏️ Modifier sur l\'app' }, { id: 'cancel', title: '❌ Annuler' }]
      });
    } catch { await this.resetSession(session); await this.sendMessage(phone, '❌ Erreur génération. Réessayez depuis l\'app.'); }
    return;
  }

  const cvId = buttonId.replace('cv_', '');
  const selectedCv = await this.prisma.userCV.findFirst({ where: { id: cvId, userId: user.id } });
  if (!selectedCv) { await this.sendMessage(phone, '❌ CV non trouvé.'); return; }

  await this.updateSession(user.id, phone, WhatsAppBotState.GENERATING_COVER_LETTER, { ...ctx, selectedCvId: cvId });
  await this.generateAndSendCoverLetter(user, { ...ctx, selectedCvId: cvId });
}

// ÉTAPE 6 : Confirmation CV généré
private async handleCVConfirmation(user: User, session: WhatsAppSession, buttonId: string): Promise<void> {
  const phone = user.whatsappNumber!;
  const ctx = session.context as any;
  if (buttonId === 'cancel') { await this.resetSession(session); await this.sendMessage(phone, '❌ Annulé.'); return; }
  if (buttonId === 'edit_on_app') { await this.sendMessage(phone, `Modifiez ici : ${process.env.APP_URL}/profile/cvs/${ctx.selectedCvId}`); await this.resetSession(session); return; }
  if (buttonId === 'confirm_cv') {
    await this.updateSession(user.id, phone, WhatsAppBotState.GENERATING_COVER_LETTER, ctx);
    await this.generateAndSendCoverLetter(user, ctx);
  }
}

// ÉTAPE 7 : Générer lettre
private async generateAndSendCoverLetter(user: User, ctx: any): Promise<void> {
  const phone = user.whatsappNumber!;
  await this.sendMessage(phone, '✍️ Génération de votre lettre... ⏳');
  try {
    const letter = await this.aiService.generateCoverLetter(user.id, ctx.jobId, ctx.selectedCvId);
    const preview = letter.substring(0, 800) + (letter.length > 800 ? '\n\n_[...suite dans l\'app]_' : '');
    const newCtx = { ...ctx, coverLetter: letter };
    await this.updateSession(user.id, phone, WhatsAppBotState.REVIEWING_COVER_LETTER, newCtx);
    await this.sendInteractiveButtons(phone, {
      header: '✍️ Lettre générée',
      body: preview,
      footer: 'Confirmez pour postuler',
      buttons: [{ id: 'send_application', title: '🚀 Envoyer candidature' }, { id: 'view_full_app', title: '👁️ Voir entier' }, { id: 'cancel', title: '❌ Annuler' }]
    });
  } catch { await this.sendMessage(phone, '❌ Erreur génération lettre. Essayez depuis l\'app.'); }
}

// ÉTAPE 8 : Envoi final
private async handleLetterReview(user: User, session: WhatsAppSession, buttonId: string): Promise<void> {
  const phone = user.whatsappNumber!;
  const ctx = session.context as any;
  if (buttonId === 'cancel') { await this.resetSession(session); await this.sendMessage(phone, '❌ Annulé.'); return; }
  if (buttonId === 'view_full_app') { await this.sendMessage(phone, `${process.env.APP_URL}/jobs/${ctx.jobId}?apply=1`); await this.resetSession(session); return; }
  if (buttonId === 'send_application') {
    await this.prisma.application.upsert({
      where: { userId_jobId: { userId: user.id, jobId: ctx.jobId } },
      create: { userId: user.id, jobId: ctx.jobId, cvId: ctx.selectedCvId, cvWasGenerated: !!ctx.modifications, cvGenerationLog: ctx.modifications?.join('\n'), status: 'APPLIED', appliedAt: new Date(), appliedVia: 'WHATSAPP', generatedCoverLetter: ctx.coverLetter },
      update: { status: 'APPLIED', appliedAt: new Date(), appliedVia: 'WHATSAPP', cvId: ctx.selectedCvId, generatedCoverLetter: ctx.coverLetter }
    });
    await this.resetSession(session);
    await this.sendMessage(phone, `✅ *Candidature envoyée !*\n\nPoste : *${ctx.jobTitle}*\nEntreprise : *${ctx.jobCompany}*\n\nBonne chance ! 🍀\n\nSuivi : ${process.env.APP_URL}/applications`);
  }
}
```

### Sessions Redis

```typescript
private async updateSession(userId: string, phone: string, state: WhatsAppBotState, context: any): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
  const updated = await this.prisma.whatsAppSession.upsert({
    where: { userId_phone: { userId, phone } },
    create: { userId, phone, state, context, expiresAt },
    update: { state, context, expiresAt, lastMessageAt: new Date() }
  });
  await this.redis.setex(`wa_session:${phone}`, 1860, JSON.stringify(updated));
}

private async resetSession(session: WhatsAppSession): Promise<void> {
  await this.prisma.whatsAppSession.update({ where: { id: session.id }, data: { state: 'IDLE', context: null } });
  await this.redis.del(`wa_session:${session.phone}`);
}
```

### Méthodes WaSender

```typescript
private async sendMessage(phone: string, text: string): Promise<void> {
  await fetch('https://api.wasenderapi.com/api/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WASENDER_API_KEY}` },
    body: JSON.stringify({ to: phone, type: 'text', text: { body: text } }),
  });
}

private async sendInteractiveButtons(phone: string, content: { header?: string; body: string; footer?: string; buttons: {id:string;title:string}[] }): Promise<void> {
  await fetch('https://api.wasenderapi.com/api/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WASENDER_API_KEY}` },
    body: JSON.stringify({
      to: phone, type: 'interactive',
      interactive: {
        type: 'button',
        header: content.header ? { type: 'text', text: content.header } : undefined,
        body: { text: content.body },
        footer: content.footer ? { text: content.footer } : undefined,
        action: { buttons: content.buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) }
      }
    }),
  });
}

private async sendInteractiveList(phone: string, content: { header: string; body: string; buttonText: string; sections: {title:string;items:{id:string;title:string;description:string}[]}[] }): Promise<void> {
  await fetch('https://api.wasenderapi.com/api/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WASENDER_API_KEY}` },
    body: JSON.stringify({
      to: phone, type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: content.header },
        body: { text: content.body },
        action: { button: content.buttonText, sections: content.sections.map(s => ({ title: s.title, rows: s.items.map(i => ({ id: i.id, title: i.title, description: i.description })) })) }
      }
    }),
  });
}
```

## 7. CRON ALERTES

```typescript
// src/notifications/alert-dispatcher.service.ts
@Cron('*/15 * * * *')
async dispatchInstantAlerts(): Promise<void> {
  const alerts = await this.prisma.alert.findMany({ where: { isActive: true, frequency: 'INSTANT' }, include: { user: true } });
  for (const alert of alerts) {
    const jobs = await this.findMatchingJobs(alert);
    if (!jobs.length) continue;
    if (alert.notifyByEmail) await this.emailService.sendJobAlert(alert.user, jobs, alert);
    if (alert.notifyByWhatsapp && alert.user.whatsappNumber && alert.user.whatsappVerified) {
      for (const job of jobs.slice(0, 3)) {
        const score = await this.matchingService.computeMatchScore(alert.userId, job.id);
        await this.botService.sendJobAlertWithButtons(alert.user, job, score.score);
        await sleep(1500);
      }
    }
    await this.prisma.alert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date() } });
  }
}

@Cron('0 8 * * *', { timeZone: 'Africa/Dakar' })
async dispatchDailyAlerts(): Promise<void> { /* même logique, frequency: 'DAILY' */ }

@Cron('0 8 * * 1', { timeZone: 'Africa/Dakar' })
async dispatchWeeklyAlerts(): Promise<void> { /* même logique, frequency: 'WEEKLY' */ }
```
