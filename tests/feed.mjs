import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,deps={}){const code=ts.transpile(readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS});const m={exports:{}};new Function('module','exports','require',code)(m,m.exports,id=>Object.hasOwn(deps,id)?deps[id]:require(id));return m.exports}
const c=load('lib/post-contracts.ts');const now=Date.parse('2026-10-10T12:00:00Z');
assert.equal(c.hotScore(8,'2026-10-10T10:00:00Z',now),1);
assert.ok(c.hotScore(8,'2026-10-10T11:00:00Z',now)>1);
assert.equal(c.imageRatio(400,1000),.8);assert.equal(c.imageRatio(1200,800),1.5);
assert.equal(c.relativeTime('2026-10-10T09:00:00Z',now),'3h');assert.equal(c.relativeTime('2026-10-10T11:59:45Z',now),'now');
const mock=load('lib/mock-posts.ts',{'server-only':{},'./post-contracts':c});
const first=mock.mockList('tester','hot',null,12);assert.equal(first.posts.length,12);
mock.mockAction('tester',first.posts[0].id,'ha');const second=mock.mockList('tester','hot',first.nextCursor,12);assert.equal(second.posts.length,12);assert.equal(new Set([...first.posts,...second.posts].map(p=>p.id)).size,24);
assert.throws(()=>mock.mockList('another-user','hot',first.nextCursor,12));
const third=mock.mockList('tester','hot',second.nextCursor,12);assert.equal(third.posts.length,6);assert.equal(third.nextCursor,null);
assert.throws(()=>mock.mockAction('tester','mock-2','delete'));mock.mockAction('tester','mock-1','delete');assert.equal(mock.mockList('tester','new',null,12).posts.some(p=>p.id==='mock-1'),false);
console.log('PASS Hot score, image crop ratio, relative times, stable mock cursors, account isolation and author-only deletion');
