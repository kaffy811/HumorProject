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

for (const route of ['profile','studio','feed']) {
 const response=await fetch(`${base}/${route}`,{redirect:'manual'});
 assert.equal(response.status,307,`${route} must redirect an anonymous visitor`);
 assert.match(response.headers.get('location') || '', /\/login$/);
}
for (const [route, method] of [['profile','PATCH'],['profile/avatar','POST']]) {
 const response=await fetch(`${base}/api/${route}`,{method,headers:{Origin:new URL(base).origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,401);
 const foreign=await fetch(`${base}/api/${route}`,{method,headers:{Origin:'https://attacker.example'}});
 assert.equal(foreign.status,403);
}
console.log('PASS protected Profile/Studio/Feed redirects, anonymous profile/avatar denial, profile cross-origin denial');
