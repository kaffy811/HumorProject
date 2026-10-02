import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpile(readFileSync('lib/humor-validation.ts','utf8'),{module:ts.ModuleKind.CommonJS});
const testModule={exports:{}};new Function('module','exports',code)(testModule,testModule.exports);
const {imageType,captionsFrom,sameOrigin}=testModule.exports;
assert.equal(imageType(new Uint8Array([255,216,255])), 'image/jpeg');
assert.equal(imageType(new Uint8Array([137,80,78,71,13,10,26,10])), 'image/png');
assert.equal(imageType(Buffer.from('RIFF0000WEBP')), 'image/webp');
assert.equal(imageType(Buffer.from('<svg>')), null);
assert.deepEqual(captionsFrom({captions:['a','b','c','d']}),['a','b','c','d']);
for(const captions of [[],['a','a','b','c'],['a','b','c',''],['a','b','c','x'.repeat(241)]])assert.throws(()=>captionsFrom({captions}));
console.log('PASS image signatures and malformed caption responses');

assert.equal(sameOrigin(new Request('http://localhost:3005',{headers:{host:'127.0.0.1:3005',origin:'http://127.0.0.1:3005'}})),true);
assert.equal(sameOrigin(new Request('https://app.example',{headers:{host:'app.example',origin:'https://attacker.example'}})),false);
assert.equal(sameOrigin(new Request('https://app.example',{headers:{host:'app.example'}})),false);
