import fs from 'node:fs';
const endpoint=process.env.ZOVO_EVAL_URL;
const token=process.env.ZOVO_EVAL_TOKEN;
if(!endpoint||!token) throw new Error('Set ZOVO_EVAL_URL and ZOVO_EVAL_TOKEN for a synthetic evaluation account.');
const suite=JSON.parse(fs.readFileSync('evals/quality-v1.json','utf8'));
const limit=Number(process.env.ZOVO_EVAL_LIMIT||suite.cases.length);
const results=[];const startedAt=new Date().toISOString();
const destination=process.env.ZOVO_EVAL_OUTPUT||'eval-results.json';
function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));return v;}
for(const item of suite.cases.slice(0,limit)){
 const begin=performance.now();const row={id:item.id,category:item.category,expected:item.expected,pass:false,firstTokenMs:null,answerMs:null,actualModel:null,errors:[],sources:[]};
 try {
  const response=await fetch(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({message:item.prompt,model:'gemini-3.8-flash'}),signal:AbortSignal.timeout(100000)});
  row.httpStatus=response.status;if(!response.ok)throw new Error(await response.text());
  let buffer='';let text='';const reader=response.body.getReader();const decoder=new TextDecoder();
  while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let split;while((split=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,split);buffer=buffer.slice(split+2);const event=block.match(/^event:\s*(.+)$/m)?.[1];const raw=block.match(/^data:\s*(.+)$/m)?.[1];if(!raw)continue;const data=JSON.parse(raw);if(event==='chunk'){row.firstTokenMs??=performance.now()-begin;text+=data.text;}if(event==='model')row.actualModel=data.actualModel;if(event==='error')row.errors.push(data.message);if(event==='complete'){row.answerMs=performance.now()-begin;text=data.content;row.sources=data.sources||[];}}}
  row.answer=text;
  if(row.answerMs===null)throw new Error('No completed answer event.');
  try{row.pass=!row.errors.length&&JSON.stringify(normalize(JSON.parse(text)))===JSON.stringify(normalize(item.expected));}catch{row.errors.push('Output was not valid raw JSON.');}
 } catch(error){row.errors.push(error.message);}
 row.endMs=performance.now()-begin;results.push(row);
 fs.writeFileSync(destination,JSON.stringify({suiteVersion:suite.version,startedAt,results},null,2));
 console.log(JSON.stringify({id:row.id,pass:row.pass,firstTokenMs:row.firstTokenMs,actualModel:row.actualModel,errors:row.errors}));
 if(results.slice(-3).length===3&&results.slice(-3).every(r=>r.answerMs===null)){console.log('Stopping after three delivery failures; fix availability before further evaluation.');break;}
}
