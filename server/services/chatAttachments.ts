import { db } from '../db/index.js';
import { getAttachmentFileBuffer } from './supabaseStorage.js';
import { extractDocument, MAX_UPLOAD_BYTES } from './documents.js';
export interface AttachmentReference { id?: string; filename?: string; mimeType?: string; size?: number; dataUrl?: string; base64?: string; textContent?: string }
export async function resolveAttachments(refs: AttachmentReference[], userId: string) {
  const resolved: any[] = [];
  let total = 0;
  for (const reference of refs) {
    if (!reference.id) throw new Error('Reattach this file to send it securely.');
    const stored = await db.getAttachment(reference.id, userId);
    if (!stored) throw new Error('Attachment not found or not owned by this account.');
    total += stored.size;
    if (total > MAX_UPLOAD_BYTES) throw new Error('Keep the total attachments in one message under 3 MB.');
    const file = await getAttachmentFileBuffer(userId, stored.storage_path);
    if (!file) throw new Error('The attachment could not be read. Please upload it again.');
    const attachment: any = { id: stored.id, filename: stored.filename, mimeType: stored.mime_type, size: stored.size };
    if (stored.mime_type.startsWith('image/') || stored.mime_type === 'application/pdf') {
      attachment.base64 = file.buffer.toString('base64');
    } else {
      const pages = await extractDocument(file.buffer, stored.mime_type, stored.filename);
      attachment.textContent = pages.map(p => p.text).join('\n\n');
    }
    resolved.push(attachment);
  }
  return resolved;
}
