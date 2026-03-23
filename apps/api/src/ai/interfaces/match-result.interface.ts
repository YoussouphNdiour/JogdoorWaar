export interface MatchResult {
  /** Score hybride normalisé 0–100 (60 % vectoriel + 40 % LLM) */
  score: number;
  /** Points forts du candidat pour cette offre */
  strengths: string[];
  /** Lacunes ou compétences manquantes */
  gaps: string[];
  /** Recommandation courte (1–2 phrases) */
  recommendation: string;
  /** Score vectoriel brut 0–1 */
  vectorScore: number;
  /** Score LLM brut 0–100 */
  llmScore: number;
}
