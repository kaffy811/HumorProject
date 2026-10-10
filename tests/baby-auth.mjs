import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(file, dependencies = {}) {
 const code = ts.transpile(readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS });
 const testModule = { exports: {} };
 new Function('module', 'exports', 'require', code)(testModule, testModule.exports, id => dependencies[id] || {});
 return testModule.exports;
}
const { isGoogleSession } = load('lib/google-session.ts');
const google = { id: 'sam', identities: [{ provider: 'google' }], is_anonymous: false };
const claims = { sub: 'sam', amr: [{ method: 'oauth', timestamp: 10 }] };
assert.equal(isGoogleSession(google, claims), true);
assert.equal(isGoogleSession(google, { ...claims, amr: [...claims.amr, { method: 'token_refresh', timestamp: 20 }, { method: 'totp', timestamp: 30 }] }), true);
for (const [user, jwt] of [[null,claims],[{...google,identities:[{provider:'email'}]},claims],[google,{...claims,sub:'other'}],[google,{sub:'sam'}],[google,{...claims,amr:[{method:'password',timestamp:20}]}],[google,{...claims,amr:[...claims.amr,{method:'password',timestamp:20}]}],[{...google,is_anonymous:true},claims]]) assert.equal(isGoogleSession(user,jwt), false);
const { profileComplete } = load('lib/profile.ts');
const complete = { first_name:'Sam',last_name:'Jones',username:'sam_j',avatar_path:'sam/photo.png' };
assert.equal(profileComplete(complete),true);
for (const field of Object.keys(complete)) assert.equal(profileComplete({...complete,[field]:null}),false);
const { profileFieldsFrom } = load('lib/profile-validation.ts');
assert.deepEqual(profileFieldsFrom({firstName:'Sam',lastName:'Jones',username:' SAM_J '}),{first_name:'Sam',last_name:'Jones',username:'sam_j'});
for (const username of ['', 'ab', 'a'.repeat(25), 'sam j', 'sam/j', '<script>', '你好']) assert.throws(()=>profileFieldsFrom({firstName:'Sam',lastName:'Jones',username}));
const { babyReducer: act, babyView: view, initialBaby: start, tiltFromPoint, BUBBLE_LINES, TICKER_JOKES } = load('lib/baby-machine.ts');
assert.equal(BUBBLE_LINES.length,8); assert.equal(TICKER_JOKES.length,5);
assert.equal(view(start).pose,'smirk');
let s=act(start,{type:'pointer',near:true,leaving:false});assert.equal(view(s).pose,'flirt');assert.equal(view(s).line,'Go on. You know you want to.');
s=act(s,{type:'hover',value:true});assert.equal(view(s).pose,'giggle');
s=act(s,{type:'pointer',near:false,leaving:true});assert.equal(view(s).pose,'cry');
s=act(s,{type:'hover',value:false});assert.equal(view(s).pose,'cry');
s=act(s,{type:'sleep'});assert.equal(view(s).pose,'sleepy');
s=act(s,{type:'wake'});assert.equal(view(s).pose,'smirk');
s=start;
for (const [index,pose] of ['huh','gasp','pout','huh','smug'].entries()) {s=act(s,{type:'poke',now:100+index*250});assert.equal(view(s).pose,pose);}
assert.equal(view(s).line,'Are you done?');
s=act(s,{type:'tick',now:6000});assert.equal(view(s).pose,'smirk');
s=act(s,{type:'poke',now:8000});assert.equal(view(s).pose,'pout'); // old rapid-click window expires
s=act(start,{type:'wink',now:100});assert.equal(view(s).pose,'wink');assert.equal(view(act(s,{type:'pointer',near:true,leaving:false})).pose,'flirt');s=act(s,{type:'tick',now:751});assert.equal(view(s).pose,'smirk');
s=act(s,{type:'login'});assert.equal(view(s).pose,'angel');assert.equal(act(s,{type:'sleep'}),s);
s=act(s,{type:'heart'});assert.equal(view(s).pose,'heart');s=act(s,{type:'cancel'});assert.equal(view(s).pose,'smirk');
assert.deepEqual(tiltFromPoint(0,0,100,100),{x:8,y:-8});assert.deepEqual(tiltFromPoint(1000,1000,100,100),{x:-8,y:8});
console.log('PASS Google-only verified sessions, incomplete-profile gating, username validation, all baby state transitions, event priorities, rapid-poke window and tilt bounds');
