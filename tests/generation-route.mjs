import assert from'node:assert/strict';import{readFileSync}from'node:fs';import ts from'typescript';
function load(file,deps={}){const m={exports:{}};new Function('module','exports','require',ts.transpile(readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(m,m.exports,id=>deps[id]||{});return m.exports;}
const contracts=load('lib/create-contracts.ts'),gemini=load('lib/gemini.ts',{'./create-contracts':contracts});
const routes=load('lib/generation-route.ts'),openai=load('lib/openai.ts',{'./gemini':gemini});
const model=(extra={})=>({model_id:'gpt-6-astra',is_active:true,supports_vision:true,max_output_tokens:2048,temperature:null,humor_llm_providers:{slug:'openai'},...extra});
const row=(share,version,m=model(),steps)=>({share,humor_prompt_chains:{prompt_version:version,humor_prompt_chain_steps:steps??[{position:2,system_prompt:'later',user_prompt:'u',output_schema:null,humor_llm_models:m},{position:1,system_prompt:'sys',user_prompt:'Image: [image]\nDirection: {direction}',output_schema:{type:'object'},humor_llm_models:m}]}});
const env={OPENAI_API_KEY:'k',GEMINI_API_KEY:'g'};

// Weighted pick: share 0 never wins; random in [0,1) walks the shares.
const mix=[row(0,'off'),row(80,'main'),row(20,'challenger')];
assert.equal(routes.pickRow(mix,0).humor_prompt_chains.prompt_version,'main');
assert.equal(routes.pickRow(mix,0.79).humor_prompt_chains.prompt_version,'main');
assert.equal(routes.pickRow(mix,0.8).humor_prompt_chains.prompt_version,'challenger');
assert.equal(routes.pickRow(mix,0.9999).humor_prompt_chains.prompt_version,'challenger');
assert.equal(routes.pickRow([row(0,'off')],0.5),null);

// Step 1 (by position) supplies the model and prompts.
const picked=routes.chooseRoute(mix,env,0.1).route;
assert.deepEqual({...picked},{provider:'openai',model:'gpt-6-astra',systemPrompt:'sys',userTemplate:'Image: [image]\nDirection: {direction}',schema:{type:'object'},maxOutputTokens:2048,temperature:null,promptVersion:'main',configured:true});
assert.equal(routes.fillPrompt(picked.userTemplate,'  '),'Image: [image]\nDirection: none');
assert.equal(routes.fillPrompt(picked.userTemplate,'midterms'),'Image: [image]\nDirection: midterms');
assert.equal(routes.chooseRoute([row(100,'t',model({temperature:'0.70'}))],env,0).route.temperature,0.7);

// Anything unusable → built-in prompt, with the reason.
const reason=(r,e=env)=>routes.chooseRoute([r],e,0).reason;
assert.match(reason(row(100,'x',model({is_active:false}))),/inactive/);
assert.match(reason(row(100,'x',model({supports_vision:false}))),/does not accept images/);
assert.match(reason(row(100,'x',model({model_id:'GPT 6'}))),/not a valid model id/);
assert.match(reason(row(100,'x',model({humor_llm_providers:{slug:'anthropic'}}))),/no connector for provider anthropic/);
assert.match(reason(row(100,'x'),{GEMINI_API_KEY:'g'}),/OPENAI_API_KEY is not set/);
assert.match(reason(row(100,'x',model(),[])),/has no steps/);
assert.match(reason(row(100,'x',null)),/has no model/);
assert.match(routes.chooseRoute([],env,0).reason,/no chain has a share/);
assert.equal(routes.chooseRoute([row(100,'g',model({model_id:'gemini-3.8-flash',humor_llm_providers:{slug:'google'}}))],env,0).route.provider,'google');

// Loading: a missing table (preview schema, migration not applied) means built-in.
const failing={from:()=>({select:async()=>({data:null,error:{message:'relation does not exist'}})})};
assert.match((await routes.loadGenerationRoute(failing,env,0)).reason,/mix unavailable/);
const working={from:(t)=>({select:async()=>({data:t==='humor_prompt_chain_mix'?mix:[],error:null})})};
assert.equal((await routes.loadGenerationRoute(working,env,0.95)).route.promptVersion,'challenger');

// OpenAI request: image as a data URL, strict schema, optional settings only when set.
const body=openai.openAIRequest(new Uint8Array([65,66,67]),'image/png','Image: [image]\nDirection: none',{model:'gpt-6-astra',systemPrompt:'sys',schema:{type:'object'},maxOutputTokens:512,temperature:null});
assert.equal(body.messages[0].content,'sys');
assert.equal(body.messages[1].content[1].image_url.url,'data:image/png;base64,QUJD');
assert.deepEqual(body.response_format,{type:'json_schema',json_schema:{name:'captions',strict:true,schema:{type:'object'}}});
assert.equal(body.max_completion_tokens,512);assert.equal('temperature' in body,false);
assert.equal(openai.openAIRequest(new Uint8Array(),'image/png','p',{model:'m',systemPrompt:'s',schema:null,maxOutputTokens:null,temperature:0.5}).response_format.type,'json_object');

// OpenAI call: validated like Gemini, schema rejection retries once in JSON mode, errors surface.
const good={captions:[['A','deadpan'],['B','roast'],['C','pun'],['D','absurd']].map(([caption,style])=>({caption,style}))};
const ok=(content)=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{prompt_tokens:9,completion_tokens:3,total_tokens:12}});
const originalFetch=globalThis.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='sk-test';
const opts={model:'gpt-6-astra',systemPrompt:'sys',schema:{type:'object'},maxOutputTokens:null,temperature:null};
try{
 let sent=[];globalThis.fetch=async(url,o)=>{sent.push({url,o});return ok(good);};
 let result=await openai.generateOpenAICaptions(new Uint8Array([1]),'image/png','p',opts);
 assert.equal(result.captions.length,4);assert.equal(result.captions[0].style,'Deadpan');assert.equal(result.usage.attempts[0].total_tokens,12);
 assert.equal(sent[0].url,'https://api.openai.com/v1/chat/completions');assert.equal(sent[0].o.headers.Authorization,'Bearer sk-test');
 sent=[];globalThis.fetch=async(url,o)=>{sent.push(JSON.parse(o.body));return sent.length===1?Response.json({error:{message:'Invalid schema for response_format'}},{status:400}):ok(good);};
 await openai.generateOpenAICaptions(new Uint8Array([1]),'image/png','p',opts);assert.equal(sent[1].response_format.type,'json_object');
 globalThis.fetch=async()=>ok({captions:good.captions.slice(0,3)});
 await assert.rejects(()=>openai.generateOpenAICaptions(new Uint8Array([1]),'image/png','p',opts),gemini.InvalidCaptions);
 globalThis.fetch=async()=>Response.json({error:{message:'no credits'}},{status:429});
 await assert.rejects(()=>openai.generateOpenAICaptions(new Uint8Array([1]),'image/png','p',opts),/HTTP 429/);
 delete process.env.OPENAI_API_KEY;
 await assert.rejects(()=>openai.generateOpenAICaptions(new Uint8Array([1]),'image/png','p',opts),/key is missing/);
}finally{globalThis.fetch=originalFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
console.log('generation routing: ok');
