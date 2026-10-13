import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

let supabaseClient: SupabaseClient | null = null;
const BUCKET_NAME = 'zovo-attachments';

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export interface StoredAttachmentResult {
  storagePath: string;
  isRemote: boolean;
  publicUrl?: string;
}

/**
 * Uploads an attachment either to Supabase Storage (if configured) or local disk.
 */
export async function uploadAttachmentFile(
  userId: string,
  fileId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<StoredAttachmentResult> {
  const client = getSupabaseClient();
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

  if (client) {
    // Structure: users/{userId}/attachments/{fileId}-{filename}
    const remotePath = `users/${userId}/attachments/${fileId}-${safeName}`;
    const { error } = await client.storage
      .from(BUCKET_NAME)
      .upload(remotePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      throw new Error(`Failed to upload file to Supabase storage: ${error.message}`);
    }

    return {
      storagePath: remotePath,
      isRemote: true,
    };
  }

  // Local fallback
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const localFilename = `${Date.now()}-${fileId}-${safeName}`;
  const localFilePath = path.join(UPLOADS_DIR, localFilename);
  fs.writeFileSync(localFilePath, buffer);

  return {
    storagePath: localFilePath,
    isRemote: false,
  };
}

/**
 * Retrieves the raw buffer of an attachment verifying user isolation.
 */
export async function getAttachmentFileBuffer(
  userId: string,
  storagePath: string
): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  const client = getSupabaseClient();

  if (client && !storagePath.startsWith('/') && !storagePath.includes('\\')) {
    // Path must belong to user (users/{userId}/attachments/...)
    const expectedPrefix = `users/${userId}/attachments/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      console.warn(`Unauthorized storage access attempt by user ${userId} for path ${storagePath}`);
      return null;
    }

    const { data, error } = await client.storage.from(BUCKET_NAME).download(storagePath);
    if (error || !data) {
      console.error('Supabase Storage download error:', error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: data.type,
    };
  }

  // Local filesystem fallback
  if (fs.existsSync(storagePath)) {
    const buffer = fs.readFileSync(storagePath);
    return { buffer };
  }

  return null;
}

/**
 * Deletes an attachment file from Supabase Storage or local fallback with user isolation.
 */
export async function deleteAttachmentFile(userId: string, storagePath: string): Promise<boolean> {
  const client = getSupabaseClient();

  if (client && !storagePath.startsWith('/') && !storagePath.includes('\\')) {
    const expectedPrefix = `users/${userId}/attachments/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      console.warn(`Unauthorized storage delete attempt by user ${userId} for path ${storagePath}`);
      return false;
    }

    const { error } = await client.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) {
      console.error('Supabase Storage delete error:', error);
      return false;
    }
    return true;
  }

  // Local fallback
  try {
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
    return true;
  } catch (err) {
    console.error('Local file delete error:', err);
    return false;
  }
}
