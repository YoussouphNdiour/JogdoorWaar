import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const key = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = this.config.get<string>('SUPABASE_CVS_BUCKET', 'cvs');

    this.supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  /**
   * Uploads a file buffer to Supabase Storage and returns its public URL.
   *
   * @param path      Storage path relative to the bucket root, e.g. `userId/filename.pdf`
   * @param buffer    Raw file bytes
   * @param mimeType  MIME type of the file, e.g. `application/pdf`
   */
  async upload(
    path: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Supabase upload failed [${path}]`, error.message);
      throw new InternalServerErrorException(
        "Échec de l'upload du fichier. Veuillez réessayer.",
      );
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(this.bucket).getPublicUrl(path);

    this.logger.debug(`Fichier uploadé → ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Deletes a file from Supabase Storage.
   *
   * @param path  Storage path relative to the bucket root
   */
  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      this.logger.warn(`Supabase delete failed [${path}]: ${error.message}`);
      // Non-blocking: log the failure but do not throw to avoid cascading errors
    }
  }
}
