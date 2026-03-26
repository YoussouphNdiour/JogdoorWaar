export const metadata = { title: "Politique de confidentialité — Jog Door Waar" };

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
        Politique de confidentialité
      </h1>
      <p className="text-sm text-gray-500 mb-10">Dernière mise à jour : mars 2026</p>

      <section className="space-y-8 text-base leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">1. Responsable du traitement</h2>
          <p>
            Jog Door Waar est responsable du traitement de vos données personnelles. Contact :
            <a href="mailto:privacy@jogdoorwaar.sn" className="underline text-orange-600 ml-1">privacy@jogdoorwaar.sn</a>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. Données collectées</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Compte</strong> : nom, email, numéro de téléphone (chiffré AES-256)</li>
            <li><strong>CV</strong> : fichiers PDF uploadés, texte extrait, vecteurs d&apos;embeddings</li>
            <li><strong>Activité</strong> : offres consultées, candidatures, alertes configurées</li>
            <li><strong>Paiements</strong> : statut de transaction (pas de numéro de carte)</li>
            <li><strong>WhatsApp</strong> : numéro et messages (chiffrés, supprimables)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. Finalités du traitement</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fourniture du service d&apos;agrégation et de matching d&apos;emploi</li>
            <li>Envoi d&apos;alertes emploi personnalisées (email et WhatsApp)</li>
            <li>Amélioration des algorithmes de matching via IA</li>
            <li>Gestion des abonnements et des paiements</li>
            <li>Prévention des fraudes et sécurité</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Partage des données</h2>
          <p>Vos données ne sont pas vendues. Elles peuvent être partagées avec :</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Anthropic / OpenAI</strong> : analyse de CV et matching (données anonymisées)</li>
            <li><strong>Supabase</strong> : stockage sécurisé des fichiers CV</li>
            <li><strong>Resend</strong> : envoi d&apos;emails transactionnels</li>
            <li><strong>WaSender</strong> : notifications WhatsApp</li>
            <li><strong>Wave / Orange Money / Stripe</strong> : traitement des paiements</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Durée de conservation</h2>
          <p>
            Vos données sont conservées pendant la durée de votre compte + 12 mois. Les CVs
            supprimés sont définitivement effacés sous 30 jours. Les logs d&apos;activité sont
            anonymisés après 90 jours.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Vos droits</h2>
          <p>Vous disposez des droits suivants sur vos données :</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Accès</strong> : télécharger toutes vos données depuis votre profil</li>
            <li><strong>Rectification</strong> : modifier vos informations à tout moment</li>
            <li><strong>Suppression</strong> : supprimer votre compte et toutes vos données</li>
            <li><strong>Portabilité</strong> : exporter vos données en JSON</li>
            <li><strong>Opposition</strong> : désactiver les alertes et communications</li>
          </ul>
          <p className="mt-2">
            Pour exercer ces droits : <a href="mailto:privacy@jogdoorwaar.sn" className="underline text-orange-600">privacy@jogdoorwaar.sn</a>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">7. Cookies</h2>
          <p>
            Nous utilisons uniquement des cookies essentiels (session, authentification) et des
            cookies analytiques anonymisés (PostHog). Aucun cookie publicitaire tiers.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">8. Sécurité</h2>
          <p>
            Les données sensibles (téléphone, WhatsApp) sont chiffrées en AES-256. Les
            communications sont sécurisées via HTTPS/TLS. Les accès sont protégés par JWT
            avec refresh tokens.
          </p>
        </div>
      </section>
    </main>
  );
}
