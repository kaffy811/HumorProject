import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
class StudioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
let request;
const m = { exports: {} };
new Function(
  "module",
  "exports",
  "require",
  ts.transpile(readFileSync("lib/moderation.ts", "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }),
)(m, m.exports, (id) =>
  id === "server-only"
    ? {}
    : id === "./gemini"
      ? {
          geminiSettings: () => ({
            key: "local-test-key",
            model: "gemini-test",
          }),
        }
      : id === "./studio-server"
        ? { StudioError }
        : null,
);
const { checkCaptionSafety } = m.exports;
const original = globalThis.fetch;
function response(output, finishReason = "STOP") {
  return Response.json({
    candidates: [
      {
        finishReason,
        content: {
          parts: [
            { thought: true, text: "ignored" },
            { text: JSON.stringify(output) },
          ],
        },
      },
    ],
  });
}
try {
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return response({ allowed: true, reason: "A situational roast." });
  };
  assert.equal(
    (await checkCaptionSafety("An expensive coffee. A cheap personality."))
      .allowed,
    true,
  );
  assert.equal(request.options.headers["x-goog-api-key"], "local-test-key");
  assert.ok(!request.url.includes("local-test-key"));
  assert.match(
    JSON.parse(request.options.body).systemInstruction.parts[0].text,
    /untrusted data/,
  );
  for (const result of [
    response({ allowed: false, reason: "Unsafe." }),
    response({ allowed: "true", reason: "Ambiguous." }),
    response({ allowed: true }, "MAX_TOKENS"),
    new Response("", { status: 429 }),
  ]) {
    globalThis.fetch = async () => result;
    await assert.rejects(
      () => checkCaptionSafety("Untrusted text."),
      StudioError,
    );
  }
  console.log(
    "PASS server moderation allows situational captions and fails closed for rejection, malformed approval, truncation and provider errors; no key in URL",
  );
} finally {
  globalThis.fetch = original;
}
