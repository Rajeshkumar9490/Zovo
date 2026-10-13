export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_DOCUMENT_CHARACTERS = 200000;
export interface DocumentPage { page?: number; text: string }
export async function extractDocument(buffer: Buffer, mimeType: string, filename: string): Promise<DocumentPage[]> {
  let pages: DocumentPage[];
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    // Explicit import makes the native dependency visible to serverless file tracing.
    const canvas = await import('@napi-rs/canvas');
    Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix, Path2D: canvas.Path2D, ImageData: canvas.ImageData });
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      pages = result.pages.map(p => ({ page: p.num, text: p.text }));
    } finally { await parser.destroy(); }
  } else if (filename.toLowerCase().endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    pages = [{ text: result.value }];
  } else if (mimeType.startsWith('text/') || mimeType === 'application/json' || /\.(txt|md|csv|json)$/i.test(filename)) {
    pages = [{ text: buffer.toString('utf8') }];
  } else {
    throw new Error('Unsupported document. Use PDF, DOCX, TXT, MD, CSV or JSON.');
  }
  if (!pages.some(p => p.text.trim())) throw new Error('No readable text was found. For a scanned document, attach the PDF in chat or upload clear page images.');
  if (pages.reduce((sum, p) => sum + p.text.length, 0) > MAX_DOCUMENT_CHARACTERS) throw new Error('This document is too long. Split it into smaller documents.');
  return pages;
}
export function chunkDocument(pages: DocumentPage[], chunkSize = 1200, overlap = 150): { page?: number; text: string }[] {
  const chunks: { page?: number; text: string }[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\r\n/g, '\n').trim();
    for (let start = 0; start < text.length;) {
      const end = Math.min(start + chunkSize, text.length);
      const part = text.slice(start, end).trim();
      if (part) chunks.push({ page: page.page, text: part });
      if (end === text.length) break;
      start = end - overlap;
    }
  }
  return chunks;
}
