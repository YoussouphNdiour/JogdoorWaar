export interface CvAnalysis {
  cvId: string;
  detectedSkills: string[];
  detectedJobTypes: string[];
  sectorFit: string[];
  /** Score global sur 100 estimé par Claude */
  globalScore: number;
  /** Points forts identifiés */
  strengths: string[];
  /** Lacunes ou axes d'amélioration */
  gaps: string[];
  /** Recommandation synthétique */
  recommendation: string;
}
