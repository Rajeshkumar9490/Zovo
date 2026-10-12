import { DocumentRow, MessageRow } from '../db/types.js';
import { GroundingSource } from '../../src/types.js';
// Conservative character estimate: budget approximately 16k tokens for recent text.
export function selectHistory(messages: MessageRow[], maxCharacters = 48000) {
  const recent: MessageRow[] = [];
  let size = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const cost = message.content.length + message.attachments.length;
    if (recent.length > 0 && size + cost > maxCharacters) break;
    recent.unshift(message); size += cost;
  }
  const omitted = messages.slice(0, messages.length - recent.length);
  // Earlier user excerpts preserve exact details without pretending to be a full semantic summary.
  const excerpts: string[] = [];
  let budget = 12000;
  for (let i = omitted.length - 1; i >= 0; i--) {
    if (omitted[i].role !== 'user') continue;
    const text = omitted[i].content.slice(0, Math.min(2000, budget));
    if (text) { excerpts.unshift(text); budget -= text.length; }
    if (budget <= 0) break;
  }
  return { recent, earlierContext: excerpts.join('\n---\n'), omittedCount: omitted.length, earlierContextPartial: omitted.some(m => m.role === 'user' && m.content.length > 2000) || budget <= 0 };
}
export function retrieveKnowledge(documents: DocumentRow[], query: string) {
  const stop = new Set(['the','from','with','this','that','what','give','only','json','document','project','about','and','for','please']);
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter(t => t.length > 2 && !stop.has(t));
  const ranked: { text: string; score: number; document: DocumentRow; page?: number; index: number }[] = [];
  for (const document of documents) {
    let chunks: any[];
    try { chunks = JSON.parse(document.chunks); } catch { continue; }
    chunks.forEach((chunk, index) => {
      const text = typeof chunk === 'string' ? chunk : chunk.text;
      if (typeof text !== 'string') return;
      const haystack = (document.filename + '\n' + text).toLowerCase();
      const score = terms.reduce((sum,t) => sum + (haystack.includes(t) ? 1 : 0), 0);
      if (score > 0) ranked.push({ text, score, document, page: chunk.page, index });
    });
  }
  const selected = ranked.sort((a,b) => b.score-a.score).slice(0,6);
  const sources: GroundingSource[] = selected.map((c,i) => ({ uri: '', kind: 'document', documentId:c.document.id, page:c.page, title:`[D${i+1}] ${c.document.filename}${c.page ? `, page ${c.page}` : ''}`, snippet:c.text.slice(0,180) }));
  const context = selected.map((c,i) => `[D${i+1}] ${c.document.filename}${c.page ? `, page ${c.page}` : ''}:\n${c.text}`).join('\n\n');
  return { context, sources };
}
