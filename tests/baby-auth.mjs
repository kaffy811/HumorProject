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
const { profileComplete } = load('lib/profile-complete.ts');
const complete = { first_name:'Sam',last_name:'Jones',username:'sam_j',avatar_path:'sam/photo.png' };
assert.equal(profileComplete(complete),true);
for (const field of Object.keys(complete)) assert.equal(profileComplete({...complete,[field]:null}),false);
const { profileFieldsFrom } = load('lib/profile-validation.ts');
assert.deepEqual(profileFieldsFrom({firstName:'Sam',lastName:'Jones',username:' SAM_J '}),{first_name:'Sam',last_name:'Jones',username:'sam_j'});
for (const username of ['', 'ab', 'a'.repeat(25), 'sam j', 'sam/j', '<script>', '你好']) assert.throws(()=>profileFieldsFrom({firstName:'Sam',lastName:'Jones',username}));
const { babyReducer: act, babyView: view, initialBaby: start, POKE_POSES, BUBBLE_LINES, TICKER_JOKES, GREETING } = load('lib/baby-machine.ts');
assert.equal(BUBBLE_LINES.length,12); assert.equal(TICKER_JOKES.length,5);
assert.equal(new Set(BUBBLE_LINES).size,12);
assert.equal(BUBBLE_LINES.some(line => TICKER_JOKES.includes(line)),false);
assert.deepEqual(view(start),{pose:'wave',line:GREETING});
let s=start,last=view(s);
for(let i=0;i<36;i++) {
 s=act(s,{type:'poke',now:1000+i*250});
 const current=view(s);
 assert.equal(current.pose,POKE_POSES[i%POKE_POSES.length]);
 assert.equal(current.line,BUBBLE_LINES[i%12]);
 assert.notEqual(current.pose,last.pose);assert.notEqual(current.line,last.line);last=current;
}
assert.equal(view(act(s,{type:'tick',now:s.until-1})).pose,s.temporary);
s=act(s,{type:'tick',now:s.until});assert.deepEqual(view(s),view(start));
s=act(s,{type:'poke',now:20000});const deadline=s.until;
s=act(s,{type:'poke',now:21000});assert.equal(s.until,29000);
assert.notEqual(view(act(s,{type:'tick',now:deadline})).pose,'wave');
s=act(s,{type:'login'});assert.equal(view(s).pose,'angel');assert.equal(act(s,{type:'poke',now:30000}),s);
s=act(s,{type:'heart'});assert.equal(view(s).pose,'heart');s=act(s,{type:'cancel'});assert.deepEqual(view(s),view(start));
console.log('Google session, Profile, independent poke cycles, eight-second reset and login transition passed.');
