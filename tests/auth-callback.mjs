import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const next = require("next/server");
function load(file, dependencies = {}) {
  const mod = { exports: {} };
  new Function("module", "exports", "require", ts.transpile(readFileSync(file, "utf8"), {
    module: ts.ModuleKind.CommonJS,
  }))(mod, mod.exports, id => Object.hasOwn(dependencies, id) ? dependencies[id] : require(id));
  return mod.exports;
}
const returns = load("lib/auth-return.ts");
const profiles = load("lib/profile-complete.ts");
const destinations = load("lib/login-destination.ts", {
  "./profile-complete": profiles, "./auth-return": returns,
});
const google = load("lib/google-session.ts");
const user = { id: "local-user", identities: [{ provider: "google" }], is_anonymous: false };
const claims = { sub: user.id, amr: [{ method: "oauth", timestamp: 10 }] };
const profile = { first_name: "Sam", last_name: "Jones", username: "sam_j", avatar_path: null, onboarded_at: null };
for (const target of [undefined, "/", "/login", "/profile", "/create?welcome=1", "//evil.example", "/%2f%2fevil.example", "/post/../", "/post/%2e%2e/"])
  assert.equal(destinations.loginDestination(profile, target), "/feed");
assert.equal(destinations.loginDestination(null, "/post/123#comments"), "/profile");
assert.equal(destinations.loginDestination(profile, "/post/123?comment=456#comments"), "/post/123?comment=456#comments");

function harness(overrides = {}) {
  const state = { user, claims, profile, exchangeError: null, ...overrides };
  let options;
  let profileReads = 0;
  const db = {
    auth: {
      async exchangeCodeForSession() {
        if (state.exchangeThrows) throw Error("simulated exchange failure");
        options.cookies.setAll([{ name: "test-auth.0", value: "part-one", options: { path: "/", httpOnly: true } }]);
        return { data: {}, error: state.exchangeError };
      },
      async getUser() {
        if (state.refreshBatches) options.cookies.setAll([{ name: "test-auth.0", value: "part-one", options: { path: "/", httpOnly: true } }]);
        return { data: { user: state.user }, error: state.userError };
      },
      async getClaims() {
        if (state.refreshBatches) options.cookies.setAll([{ name: "test-auth.1", value: "part-two", options: { path: "/", httpOnly: true } }]);
        return { data: { claims: state.claims }, error: state.claimsError };
      },
    },
    from() {
      profileReads++;
      return { select() { return { eq() { return { async maybeSingle() {
        return { data: state.profile, error: state.profileError };
      } }; } }; } };
    },
  };
  const deps = {
    "@/lib/preview-profile": { ensurePreviewProfile: async () => {} },
    "@/lib/supabase/schema": { dataSchema: () => "public" },
    "@supabase/ssr": { createServerClient: (_url, _key, value) => { options = value; return db; } },
    "next/server": next,
    "@/lib/supabase/config": { config: () => ({ url: "https://local.invalid", key: "public-fixture" }) },
    "@/lib/login-destination": destinations,
    "./auth-return": returns,
    "@/lib/google-session": google,
    "@/lib/profile-complete": profiles,
  };
  const callback = load("lib/auth-callback.ts", deps).finishAuth;
  const proxy = load("proxy.ts", deps).proxy;
  return { callback, proxy, state, reads: () => profileReads };
}
function request(path, returnTo) {
  const r = new next.NextRequest("https://humor.invalid" + path);
  if (returnTo) r.cookies.set(returns.RETURN_COOKIE, returnTo);
  return r;
}
function location(response) {
  const u = new URL(response.headers.get("location"));
  assert.equal(u.origin, "https://humor.invalid");
  assert.match(response.headers.get("cache-control"), /no-store/);
  return u.pathname + u.search + u.hash;
}
for (const scenario of [
  {},
  { exchangeError: { code: "used-code" } },
  { exchangeThrows: true },
]) {
  const h = harness(scenario);
  const response = await h.callback(request("/auth/callback?code=local-fixture", "/"), "code");
  assert.equal(location(response), "/feed");
}
for (const mode of ["code", "email", "resume"])
  assert.equal(location(await harness().callback(request("/auth/callback"), mode)), "/feed");
for (const value of [null, { ...profile, username: null }, { ...profile, first_name: null }]) {
  const r = await harness({ profile: value }).callback(request("/auth/callback?code=fixture", "/post/123#comments"), "code");
  assert.equal(location(r), "/profile");
  assert.equal(r.cookies.get(returns.RETURN_COOKIE), undefined, "New members retain the incoming post destination until profile setup finishes");
}
const cookieResponse = await harness({ refreshBatches: true }).callback(request("/auth/callback?code=fixture"), "code");
assert.equal(cookieResponse.cookies.get("test-auth.0")?.value, "part-one");
assert.equal(cookieResponse.cookies.get("test-auth.1")?.value, "part-two");
const postResponse = await harness().callback(request("/auth/callback?code=fixture", "/post/123#comments"), "code");
assert.equal(location(postResponse), "/post/123#comments");
assert.equal(postResponse.cookies.get(returns.RETURN_COOKIE)?.value, "");

for (const invalid of [
  { user: null },
  { userError: { message: "temporarily unavailable" } },
  { claimsError: { message: "temporarily unavailable" } },
  { claims: { sub: user.id } },
  { claims: { sub: "other", amr: claims.amr } },
  { user: { ...user, identities: [{ provider: "email" }] } },
  { claims: { sub: user.id, amr: [{ method: "password", timestamp: 11 }] } },
]) {
  const h = harness(invalid);
  assert.equal(location(await h.callback(request("/auth/callback?code=fixture"), "code")), "/auth/error?reason=session");
  assert.equal(h.reads(), 0, "Unverified sessions must not read member profiles");
}
const transient = harness({ profileError: { message: "temporarily unavailable" } });
assert.equal(location(await transient.callback(request("/auth/callback?code=fixture"), "code")), "/auth/error?reason=profile");
transient.state.profileError = null;
assert.equal(location(await transient.callback(request("/auth/continue"), "resume")), "/feed");
for (const entry of ["/", "/login"]) {
  const h = harness({ user: null });
  assert.equal(location(await h.proxy(request(entry + "?code=local-fixture&sb_flow_id=local-flow&next=https://evil.example"))), "/auth/callback?code=local-fixture&sb_flow_id=local-flow");
  assert.equal(h.reads(), 0);
  assert.equal(location(await h.proxy(request(entry + "?error=access_denied"))), "/auth/continue");
}
for (const path of ["/", "/feed", "/top", "/create"]) {
  const h = harness({ refreshBatches: true });
  const r = await h.proxy(request(path));
  if (path === "/") assert.equal(location(r), "/feed");
  else assert.equal(r.headers.get("location"), null, "Complete profiles can enter without repeating onboarding");
  assert.equal(r.cookies.get("test-auth.0")?.value, "part-one");
  assert.equal(r.cookies.get("test-auth.1")?.value, "part-two");
}
for (const path of ["/", "/feed", "/top"])
  assert.equal(location(await harness({ profile: null }).proxy(request(path))), "/profile");
assert.equal((await harness({ user: null }).proxy(request("/api/posts"))).status, 401);
assert.equal(location(await harness({ user: null }).proxy(request("/feed"))), "/");
assert.equal(location(await harness({ user: null, userError: { status: 503 } }).proxy(request("/feed"))), "/auth/error?reason=unavailable");
assert.equal((await harness({ user: null, userError: { status: 503 } }).proxy(request("/api/posts"))).status, 503);
assert.equal(location(await harness({ claimsError: { status: 503 } }).proxy(request("/feed"))), "/auth/error?reason=unavailable");
assert.equal(location(await harness({ claims: { sub: "wrong-user" } }).proxy(request("/feed"))), "/auth/error?reason=session");
assert.equal((await harness({ user: null }).proxy(request("/auth/error"))).headers.get("location"), null);
console.log("PASS OAuth codes landing on / or /login reach the callback; verified sessions → Feed/Profile, missing/reused codes recover, invalid identities stay blocked, profile retry, safe post return and cookies survive redirects/refresh batches");

const originalFetch = globalThis.fetch;
const originalLocation = globalThis.location;
const calls = [];
try {
  globalThis.location = { origin: "https://humor.invalid" };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true };
  };
  const start = load("lib/start-google-sign-in.ts", {
    "./auth-return": returns,
    "@/lib/supabase/client": { createClient: () => ({ auth: { signInWithOAuth: async args => {
      calls.push(args);
      return { data: { url: "https://accounts.google.com/local-fixture" }, error: null };
    } } }) },
  }).googleSignInUrl;
  assert.equal(await start(), "https://accounts.google.com/local-fixture");
  assert.deepEqual(JSON.parse(calls[0].init.body), { target: "/feed" });
  assert.equal(calls[1].provider, "google");
  assert.equal(calls[1].options.redirectTo, "https://humor.invalid/auth/callback");
  assert.equal(calls[1].options.skipBrowserRedirect, true);
  const count = calls.length;
  await assert.rejects(() => start("//evil.example"));
  assert.equal(calls.length, count);
  globalThis.fetch = async () => ({ ok: false });
  await assert.rejects(() => start(), /prepare sign-in/);
} finally {
  globalThis.fetch = originalFetch;
  if (originalLocation === undefined) delete globalThis.location;
  else globalThis.location = originalLocation;
}
console.log("PASS landing resets abandoned return state before Google OAuth, exact callback URI and preparation failure stops sign-in");
