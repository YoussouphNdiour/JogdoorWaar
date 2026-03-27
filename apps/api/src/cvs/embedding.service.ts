import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Maximum character count sent to the embedding API. */
const MAX_CHARS = 8_000;
/** Embedding model identifier — Voyage AI voyage-3-lite. */
const EMBEDDING_MODEL = 'voyage-3-lite';
/** Dimensions produced by voyage-3-lite. */
const EMBEDDING_DIMENSIONS = 512;
/** Voyage AI embedding endpoint. */
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('VOYAGE_API_KEY');
  }

  /**
   * Generates a 512-dimensional embedding vector for the given text.
   * Uses Voyage AI voyage-3-lite (50M tokens/month free tier).
   * The text is truncated to MAX_CHARS before being sent to the API.
   *
   * @param text  Raw text to embed (e.g. extracted CV content)
   * @returns     Float array of length 512
   */
  async embed(text: string): Promise<number[]> {
    const truncated = text.slice(0, MAX_CHARS);

    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: [truncated],
          input_type: 'document',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Voyage AI error ${response.status}: ${body}`);
      }

      const json = (await response.json()) as {
        data: { embedding: number[] }[];
      };

      const vector = json.data[0]?.embedding;

      if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding dimensions: ${vector?.length ?? 0}`,
        );
      }

      this.logger.debug(
        `Embedding généré (${vector.length} dims, ${truncated.length} chars)`,
      );

      return vector;
    } catch (err) {
      this.logger.error('Voyage AI embedding failed', err);
      throw new InternalServerErrorException(
        "Impossible de générer l'embedding du CV. Veuillez réessayer.",
      );
    }
  }
}
