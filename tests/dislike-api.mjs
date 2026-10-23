import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,deps={}){const m={exports:{}};new Function('module','exports','require',ts.transpile(readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS}))(m,m.exports,id=>Object.hasOwn(deps,id)?deps[id]:require(id));return m.exports;}
class StudioError extends Error{constructor(message,status=400){super(message);this.status=status}}
const failure=e=>Response.json({error:e.message},{status:e instanceof StudioError?e.status:503});
let authError,missing=false,rpcCalls=[];
const owner='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002',key='00000000-0000-4000-8000-000000000003';
const {POST}=load('app/api/posts/[id]/dislike/route.ts',{
 '@/lib/posts-server':{postsContext:async()=>{if(authError)throw authError;return{user:{id:owner},mock:false,admin:{rpc:async(name,args)=>{rpcCalls.push({name,args});return{data:{haCount:0,viewerHasHa:false,viewerHasDisliked:true}}}}}},activePost:async()=>{if(missing)throw new StudioError('Post not found.',404)}},
 '@/lib/humor-validation':load('lib/humor-validation.ts'),
 '@/lib/create-contracts':load('lib/create-contracts.ts'),
 '@/lib/studio-server':{StudioError,readJson:async req=>req.json()},
 '@/lib/member-feature-server':{featureFailure:failure},
 '@/lib/mock-posts':{mockAction:()=>{throw Error('Live request reached mock')}},
});
const request=(body={requestKey:key},origin='https://humor.test')=>new Request(`https://humor.test/api/posts/${id}/dislike`,{method:'POST',headers:{Host:'humor.test',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const run=async(req=request())=>POST(req,{params:Promise.resolve({id})});
assert.equal((await run(request(undefined,'https://evil.test'))).status,403);
authError=new StudioError('Sign in with Google to continue.',401);assert.equal((await run()).status,401);
authError=new StudioError('Complete your Profile first.',403);assert.equal((await run()).status,403);authError=null;
assert.equal((await run(request({requestKey:'bad'}))).status,400);
missing=true;assert.equal((await run()).status,404);missing=false;assert.equal(rpcCalls.length,0);
const response=await run(request({requestKey:key,owner:'attacker',reaction:1}));assert.equal(response.status,200);
assert.deepEqual(await response.json(),{haCount:0,viewerHasHa:false,viewerHasDisliked:true});
assert.deepEqual(rpcCalls,[{name:'toggle_humor_reaction',args:{post_id:id,owner,request_key:key,reaction:-1}}]);
console.log('PASS Dislike endpoint enforces same-origin, Google/member guard, completed profile, UUID request key, active post and server-owned identity/reaction');
