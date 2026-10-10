import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(file, dependencies = {}) {
  const code = ts.transpile(readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS });
  const testModule = { exports: {} };
  new Function('module', 'exports', 'require', code)(testModule, testModule.exports, id => dependencies[id] || {});
  return testModule.exports;
}
const validation = load('lib/humor-validation.ts');
const { namesFrom } = load('lib/profile-validation.ts');
assert.deepEqual(namesFrom({ firstName: ' Sam ', lastName: '李' }), { first_name: 'Sam', last_name: '李' });
for (const value of [null, {}, { firstName: '', lastName: 'x' }, { firstName: 'x', lastName: 12 }, { firstName: 'x'.repeat(81), lastName: 'x' }, { firstName: 'a\n', lastName: 'x\u0000' }]) assert.throws(() => namesFrom(value));
const gemini = load('lib/gemini.ts', { '@/lib/humor-validation': validation });
const fetchOriginal = globalThis.fetch;
const keyOriginal = process.env.GEMINI_API_KEY;
const modelOriginal = process.env.GEMINI_MODEL;
process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'gemini-test';
let payload;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.ok(!url.includes('test-key'));
    payload = JSON.parse(options.body);
    assert.equal(payload.systemInstruction.parts[0].text, gemini.SYSTEM_PROMPT);
    assert.equal(payload.contents[0].parts[0].text, gemini.USER_PROMPT);
    assert.equal(payload.contents[0].parts[1].inlineData.mimeType, 'image/png');
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'ignored internal thought' }, { text: JSON.stringify({ description: 'A coffee on a desk.', captions: ['One', 'Two', 'Three', 'Four'] }) }] } }], usageMetadata: { promptTokenCount: 20 } });
  };
  const result = await gemini.generateCaptions(new Uint8Array([1, 2]), 'image/png');
  assert.deepEqual(result.captions, ['One', 'Two', 'Three', 'Four']);
  assert.equal(result.usage.promptTokenCount, 20);
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  for (const response of [
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] },
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"description":"scene","captions":["a","a","b","c"]}' }] } }] },
  ]) { globalThis.fetch = async () => Response.json(response); await assert.rejects(() => gemini.generateCaptions(new Uint8Array([1]), 'image/png')); }
  globalThis.fetch = async () => new Response('', { status: 429 });
  await assert.rejects(() => gemini.generateCaptions(new Uint8Array([1]), 'image/png'));
  delete process.env.GEMINI_API_KEY; assert.throws(() => gemini.geminiSettings());
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = '../../invalid'; assert.throws(() => gemini.geminiSettings());
} finally {
  globalThis.fetch = fetchOriginal;
  if (keyOriginal === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = keyOriginal;
  if (modelOriginal === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = modelOriginal;
}
console.log('PASS names, Gemini image request, persisted prompt parity, usage, blocked/truncated/malformed/duplicate output and missing configuration');
