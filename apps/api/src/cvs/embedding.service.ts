import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/** Maximum character count sent to the embedding API. */
const MAX_CHARS = 8_000;
/** Embedding model identifier — must remain exact. */
const EMBEDDING_MODEL = 'text-embedding-3-small';
/** Dimensions produced by text-embedding-3-small. */
const EMBEDDING_DIMENSIONS = 1536;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Generates a 1536-dimensional embedding vector for the given text.
   * The text is truncated to MAX_CHARS before being sent to the API.
   *
   * @param text  Raw text to embed (e.g. extracted CV content)
   * @returns     Float array of length 1536
   */
  async embed(text: string): Promise<number[]> {
    const truncated = text.slice(0, MAX_CHARS);

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const vector = response.data[0]?.embedding;

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
      this.logger.error('OpenAI embedding failed', err);
      throw new InternalServerErrorException(
        "Impossible de générer l'embedding du CV. Veuillez réessayer.",
      );
    }
  }
}
