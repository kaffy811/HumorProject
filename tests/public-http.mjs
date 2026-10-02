import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3006';
for(const endpoint of ['vote','generate']){
 const response=await fetch(`${base}/api/humor/${endpoint}`,{method:'POST',headers:{Origin:new URL(base).origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,401,`${endpoint} must require authentication`);
}
for(const origin of ['https://attacker.example','null']){
 const response=await fetch(`${base}/api/humor/vote`,{method:'POST',headers:{Origin:origin}});assert.equal(response.status,403);
}
const landing=await fetch(base);assert.equal(landing.status,200);assert.match(await landing.text(),/Life.s a sidequest/);
const login=await fetch(`${base}/login`);assert.equal(login.status,200);assert.match(await login.text(),/Create account/);
console.log('PASS public landing/login, anonymous vote/upload denial, cross-origin denial');
