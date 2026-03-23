import { Injectable, Logger, BadRequestException } from '@nestjs/common';
// pdf-parse uses CommonJS default export; typed via @types/pdf-parse or inline cast
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
) => Promise<{ text: string; numpages: number }>;

@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);

  /**
   * Extracts raw text content from a PDF buffer.
   * Throws BadRequestException when the buffer cannot be parsed as a valid PDF.
   */
  async extract(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      const text = data.text.trim();

      if (!text) {
        throw new BadRequestException(
          'Le PDF ne contient pas de texte lisible (PDF scanné ou vide).',
        );
      }

      this.logger.debug(
        `PDF extrait : ${data.numpages} page(s), ${text.length} caractères`,
      );

      return text;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Échec extraction PDF', err);
      throw new BadRequestException(
        'Impossible de lire le fichier PDF. Vérifiez que le fichier est valide.',
      );
    }
  }
}
