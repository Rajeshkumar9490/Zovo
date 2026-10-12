import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateModels, reasoningLevel, withSignal, generateConversationTitle } from '../server/services/gemini.js';
import { extractDocument, chunkDocument } from '../server/services/documents.js';
import { retrieveKnowledge, selectHistory } from '../server/services/context.js';

test('reasoning route never falls back to a lightweight model', () => {
  assert.deepEqual(candidateModels('gemini-3.1-pro-preview'), ['gemini-3.1-pro-preview']);
  assert.deepEqual(candidateModels('gemini-3.7-flash'), ['gemini-3.8-flash', 'gemini-3-flash-preview']);
  assert.equal(reasoningLevel('gemini-3.8-flash', 'Find the probability and verify the constraints'), 'high');
});
test('a hung provider promise is interrupted by cancellation', async () => {
  const controller = new AbortController();
  const pending = withSignal(new Promise<string>(() => {}), controller.signal);
  controller.abort(new Error('cancelled'));
  await assert.rejects(pending, /cancelled/);
});
test('titles require no AI request', async () => {
  assert.equal(await generateConversationTitle('A short test request'), 'A short test request');
});
test('plain-text ingestion preserves the exact file evidence', async () => {
  const pages = await extractDocument(Buffer.from('Launch code MANGO-742; budget 18400'), 'text/plain', 'facts.txt');
  assert.match(pages[0].text, /MANGO-742/);
  assert.match(pages[0].text, /18400/);
});
test('chunker terminates at every boundary and preserves PDF page labels', () => {
  for (const length of [1,149,150,1199,1200,1201,2399,2400,2401,10000]) {
    const chunks = chunkDocument([{ page: 3, text: 'x'.repeat(length) }]);
    assert(chunks.length > 0 && chunks.length < 12);
    assert(chunks.every(c => c.page === 3 && c.text.length <= 1200));
  }
});
test('knowledge retrieval ranks globally and returns page citations', () => {
  const docs = Array.from({length:10}, (_,i) => ({ id:`doc-${i}`, filename:`doc-${i}.pdf`, chunks:JSON.stringify([{page:2,text:i===9?'Nebula release budget 27500':'Unrelated topic'}]) })) as any;
  const result = retrieveKnowledge(docs, 'Nebula release budget');
  assert.equal(result.sources[0].documentId, 'doc-9');
  assert.equal(result.sources[0].page, 2);
  assert.match(result.context, /27500/);
  assert(result.sources.length <= 6);
});
test('history uses a budget and keeps more than twenty short messages', () => {
  const messages = Array.from({length:35}, (_,i)=>({ role:i%2?'assistant':'user', content:`short ${i}`, attachments:'[]' })) as any;
  assert.equal(selectHistory(messages).recent.length,35);
  const compact = selectHistory(messages,100);
  assert(compact.omittedCount > 0);
  assert(compact.earlierContext.includes('short 0'));
});

test('PDF text extraction returns actual page text and number', async () => {
 const stream='BT /F1 12 Tf 50 750 Td (Launch code PDF-842; budget 19200) Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const pages=await extractDocument(Buffer.from(pdf), 'application/pdf','facts.pdf');
 assert.equal(pages[0].page,1);assert.match(pages[0].text,/PDF-842/);assert.match(pages[0].text,/19200/);
});
test('DOCX extraction reads document XML instead of binary ZIP bytes', async () => {
 const {default:JSZip}=await import('jszip');
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Launch code DOCX-513; budget 18400</w:t></w:r></w:p></w:body></w:document>');
 const pages=await extractDocument(await zip.generateAsync({type:'nodebuffer'}), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document','facts.docx');
 assert.match(pages[0].text,/DOCX-513/);assert.match(pages[0].text,/18400/);
});

test('search stays enabled through fallback and reports the actual model', async () => {
 process.env.GEMINI_API_KEY='test-key';
 const {getGeminiClient,streamGeminiChat}=await import('../server/services/gemini.js');
 const ai=getGeminiClient();const original=ai.models.generateContentStream;const calls:any[]=[];const models:string[]=[];
 (ai.models as any).generateContentStream=async (request:any)=>{
  calls.push(request);
  if(calls.length===1)throw Object.assign(new Error('unavailable'),{status:503});
  return (async function*(){yield {text:'Verified answer',candidates:[{finishReason:'STOP',groundingMetadata:{groundingChunks:[{web:{uri:'https://example.com/source',title:'Evidence'}}]}}]};})();
 };
 try{
  let sources:any[]=[];
  await streamGeminiChat({model:'gemini-3.8-flash',messages:[{role:'user',content:'Search for evidence'}],enableSearch:true,onChunk:()=>{},onModel:m=>models.push(m),onSources:s=>sources=s});
  assert.equal(calls.length,2);assert(calls.every(c=>c.config.tools[0].googleSearch));
  assert.deepEqual(models,['gemini-3.8-flash','gemini-3-flash-preview']);assert.equal(sources.length,1);
 }finally{ai.models.generateContentStream=original;}
});
test('partial failed streams never append a different fallback response', async () => {
 const {getGeminiClient,streamGeminiChat}=await import('../server/services/gemini.js');
 const ai=getGeminiClient();const original=ai.models.generateContentStream;let calls=0;let answer='';
 (ai.models as any).generateContentStream=async ()=>{calls++;return(async function*(){yield{text:'partial'};throw Object.assign(new Error('stream failed'),{status:503});})();};
 try{
  await assert.rejects(streamGeminiChat({model:'gemini-3.8-flash',messages:[{role:'user',content:'test'}],onChunk:t=>answer+=t}),/stream failed/);
  assert.equal(calls,1);assert.equal(answer,'partial');
 }finally{ai.models.generateContentStream=original;}
});
test('one generic word does not attach an unrelated document citation', () => {
 const documents=[{id:'nebula',filename:'nebula.txt',chunks:JSON.stringify(['Nebula budget 27500'])}] as any;
 assert.equal(retrieveKnowledge(documents,'Give the launch code and budget from attached Quasar file').sources.length,0);
});
