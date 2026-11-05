import assert from'node:assert/strict';import{readFileSync}from'node:fs';import ts from'typescript';
function load(file,deps={}){const m={exports:{}};new Function('module','exports','require',ts.transpile(readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(m,m.exports,id=>deps[id]||{});return m.exports;}
const {generateText}=load('lib/chain-text.ts');
const sent=[];const fake=(status,body)=>async(url,init)=>{sent.push({url,body:JSON.parse(init.body),headers:init.headers});return new Response(JSON.stringify(body),{status});};
const base={provider:'google',model:'gemini-x',systemPrompt:'sys',prompt:'Describe',image:{bytes:new Uint8Array([65,66,67]),mime:'image/png'},maxOutputTokens:300,temperature:null};
const env={...process.env};
try{
 process.env.GEMINI_API_KEY='g';process.env.OPENAI_API_KEY='k';
 // Gemini: photo attached, no JSON mode, thoughts dropped.
 let r=await generateText(base,fake(200,{candidates:[{finishReason:'STOP',content:{parts:[{text:'thinking',thought:true},{text:' A cat on Low Steps. '}]}}],usageMetadata:{totalTokenCount:9}}));
 assert.deepEqual(r,{text:'A cat on Low Steps.',usage:{totalTokenCount:9}});
 assert.match(sent[0].url,/models\/gemini-x:generateContent$/);assert.equal(sent[0].body.contents[0].parts[1].inlineData.data,'QUJD');
 assert.equal('responseMimeType' in sent[0].body.generationConfig,false);assert.equal(sent[0].body.generationConfig.maxOutputTokens,300);
 // A text-only step sends no photo.
 sent.length=0;await generateText({...base,image:null},fake(200,{candidates:[{content:{parts:[{text:'ok'}]}}]}));
 assert.equal(sent[0].body.contents[0].parts.length,1);
 // OpenAI: plain completion; photo as a data URL only when the step sees it.
 sent.length=0;r=await generateText({...base,provider:'openai',model:'gpt-x',temperature:0.5},fake(200,{choices:[{message:{content:'Funny bit.'}}],usage:{total_tokens:4}}));
 assert.equal(r.text,'Funny bit.');assert.equal(sent[0].headers.Authorization,'Bearer k');assert.equal('response_format' in sent[0].body,false);
 assert.equal(sent[0].body.messages[1].content[1].image_url.url,'data:image/png;base64,QUJD');assert.equal(sent[0].body.temperature,0.5);
 sent.length=0;await generateText({...base,provider:'openai',image:null},fake(200,{choices:[{message:{content:'x'}}]}));assert.equal(sent[0].body.messages[1].content.length,1);
 // Errors: HTTP status, blocked, empty, missing key.
 await assert.rejects(()=>generateText({...base,provider:'openai'},fake(429,{error:{message:'no credits'}})),/HTTP 429/);
 await assert.rejects(()=>generateText(base,fake(200,{promptFeedback:{blockReason:'SAFETY'}})),/blocked/);
 await assert.rejects(()=>generateText(base,fake(200,{candidates:[{content:{parts:[]}}]})),/no text/);
 delete process.env.GEMINI_API_KEY;await assert.rejects(()=>generateText(base,fake(200,{})),/Gemini API key is missing/);
 console.log('chain text steps: ok');
}finally{process.env=env;}
