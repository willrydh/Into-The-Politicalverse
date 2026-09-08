import dashboard from "./dashboard.html";
import dashboardScript from "./dashboard.js";
import { INSIGHT_EVENTS, insightPath, insightDevice, insightDimensions, insightSource } from "../../../lib/insights";

const encoder = new TextEncoder();
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const COOKIE = "__Host-pv_admin";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" } });
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
const digest = async (value: string) => hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
const sameOrigin = (r: Request, env: Env) => r.headers.get("Origin") === env.SITE_ORIGIN;
const nowSeconds = () => Math.floor(Date.now() / 1000);

function html(body: string, status = 200) {
  return new Response(body, { status, headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  } });
}

function login(message = "", status = 200) {
  return html(`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Logga in · Politicalverse</title><style>html{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0f1922;color:#f5f7f8;font:16px system-ui;min-height:100svh;display:grid;place-items:center;padding:24px}main{width:min(100%,400px)}img{width:50px;height:50px}h1{font-size:30px;margin:24px 0 8px}p{color:#aebdca;line-height:1.6}label{display:block;margin:24px 0 8px}input,button{font:inherit;width:100%;min-height:48px;border-radius:8px;border:1px solid #4c5f6c;padding:12px;background:#172a37;color:white}button{margin-top:28px;background:#f3f6f7;color:#122a38;font-weight:650;cursor:pointer}a{color:#afcfe2}input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #a7cada;outline-offset:3px}.error{color:#ffbeb8}</style><main><img src="/brand/crown-2026/politicalverse-app-icon-180.png" alt="Politicalverse"><h1>Politicalverse Insikter</h1><p>Besök, beteende och teknisk kvalitet.</p>${message ? `<p role="alert" class="error">${message}</p>` : ""}<form method="post" action="/admin/login"><label for="username">Användarnamn</label><input id="username" name="username" autocomplete="username" required maxlength="80"><label for="password">Lösenord</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200"><button>Logga in</button></form><p><a href="/">Till sajten</a></p></main></html>`, status);
}

async function passwordMatches(password: string, stored: string) {
  const [iterations, salt, expected] = stored.split(":");
  if (iterations !== "100000" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{64}$/.test(expected ?? "")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(salt.match(/../g)!, x => parseInt(x,16)), iterations: 100000, hash: "SHA-256" }, key, 256);
  return crypto.subtle.timingSafeEqual(actual, Uint8Array.from(expected.match(/../g)!, x => parseInt(x,16)));
}

async function session(r: Request, env: Env) {
  const token = (r.headers.get("Cookie") ?? "").split(";").map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await digest(token);
  return await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires>?").bind(tokenHash, nowSeconds()).first() ? tokenHash : null;
}

async function limited(r: Request, env: Env, category: string, limit: number, seconds: number) {
  const now = nowSeconds();
  // IP is used transiently for abuse prevention. Only an expiring keyed digest
  // is persisted, in a separate security table; never in visit statistics.
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const id = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${category}:${r.headers.get("CF-Connecting-IP") ?? "unknown"}`)));
  const row = await env.DB.prepare("INSERT INTO auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count").bind(id, now+seconds,now,now).first<{count:number}>();
  return !row || row.count > limit;
}

async function boundedText(r: Request, maximum: number) {
  const reader=r.body?.getReader(); if(!reader)return null;
  let size=0; const chunks:Uint8Array[]=[];
  for(;;){ const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; if(size>maximum){await reader.cancel();return null;} chunks.push(value); }
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return new TextDecoder().decode(data);
}

async function boundedJson(r: Request) {
  if (!r.headers.get("content-type")?.startsWith("application/json")) return null;
  const body=await boundedText(r,4096);if(body===null)return null;
  try {const parsed:unknown=JSON.parse(body);return parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed as Record<string,unknown> : null;}catch{return null;}
}

async function collect(r: Request, env: Env) {
  if(!sameOrigin(r,env))return json({error:"origin"},403);
  if(await session(r,env))return new Response(null,{status:204});
  if(/bot|crawler|spider|headless/i.test(r.headers.get("User-Agent")??""))return new Response(null,{status:204});
  if(await limited(r,env,"collect",240,60))return json({error:"rate_limit"},429);
  const b=await boundedJson(r);
  if(!b || b.consent!==true || typeof b.visit!=="string" || !UUID.test(b.visit))return json({error:"invalid_event"},400);
  const now=nowSeconds(), path=insightPath(typeof b.path==="string"?b.path:"");
  if(b.kind==="heartbeat" || b.kind==="leave"){
    const elapsed=typeof b.elapsed==="number" && Number.isFinite(b.elapsed)?Math.min(45000,Math.max(0,Math.round(b.elapsed))):0;
    await env.DB.prepare("UPDATE visits SET last_seen=?,active_until=?,engaged_ms=engaged_ms+? WHERE id=? AND current_path=?").bind(now,b.kind==="leave"?now:now+90,elapsed,b.visit,path).run();
    return new Response(null,{status:204});
  }
  if(typeof b.kind!=="string" || !INSIGHT_EVENTS.some(x=>x===b.kind) || typeof b.id!=="string" || !UUID.test(b.id))return json({error:"invalid_event"},400);
  const previous=typeof b.previous==="string" && b.previous?insightPath(b.previous):"";
  const labels=["pocketpolitics.io","val.se","historik.val.se","valresultat.svt.se","scb.se","other","50","90","active"];
  const label=typeof b.label==="string" && labels.includes(b.label)?b.label:"";
  const value=typeof b.value==="number" && Number.isFinite(b.value)?Math.min(120000,Math.max(0,b.value)):0;
  const event=env.DB.prepare("INSERT OR IGNORE INTO events(id,occurred,day,kind,path,previous_path,visit,label,value) VALUES(?,?,?,?,?,?,?,?,?)").bind(b.id,now,new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Stockholm"}),b.kind,path,previous,b.visit,label,value);
  const {device,browser,os}=insightDevice(r.headers.get("User-Agent")??"");
  const source=typeof b.source==="string" && ["direct","other","google.com","google.se","bing.com","duckduckgo.com","reddit.com","facebook.com","instagram.com","linkedin.com","t.co","pocketpolitics.io","reddit","facebook","instagram","linkedin","pocketpolitics","newsletter"].includes(b.source)?b.source:insightSource(typeof b.referrer==="string"?b.referrer:"");
  const campaign=typeof b.campaign==="string" && ["launch","lansering","election2026","val2026"].includes(b.campaign)?b.campaign:"";
  const visit=env.DB.prepare("INSERT INTO visits(id,first_seen,last_seen,active_until,entry_path,current_path,source,campaign,device,browser,os,viewport,screen,locale,mode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,active_until=excluded.active_until,current_path=excluded.current_path,viewport=excluded.viewport").bind(b.visit,now,now,now+90,path,path,source,campaign,device,browser,os,insightDimensions(b.viewport),insightDimensions(b.screen),path.startsWith("/en/")?"en":"sv",b.mode==="standalone"?"pwa":"browser");
  await env.DB.batch([event,visit]);
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
}

async function report(url: URL, env: Env) {
  const requested=Number(url.searchParams.get("days")??7),days=[1,7,30,90].includes(requested)?requested:7;
  const now=nowSeconds(), since=now-days*86400, prior=since-days*86400;
  const statements=[
    env.DB.prepare("SELECT COUNT(*) visits,COALESCE(SUM(engaged_ms),0) engaged_ms FROM visits WHERE first_seen>=?").bind(since),
    env.DB.prepare("SELECT COUNT(*) pageviews,COUNT(DISTINCT visit) visits FROM events WHERE kind='page' AND occurred>=?").bind(since),
    env.DB.prepare("SELECT COUNT(*) pageviews,COUNT(DISTINCT visit) visits FROM events WHERE kind='page' AND occurred>=? AND occurred<?").bind(prior,since),
    env.DB.prepare("SELECT day,COUNT(*) pageviews,COUNT(DISTINCT visit) visits FROM events WHERE kind='page' AND occurred>=? GROUP BY day ORDER BY day").bind(since),
    env.DB.prepare("SELECT path,COUNT(*) pageviews,COUNT(DISTINCT visit) visits FROM events WHERE kind='page' AND occurred>=? GROUP BY path ORDER BY pageviews DESC LIMIT 60").bind(since),
    env.DB.prepare("SELECT previous_path,path,COUNT(*) transitions FROM events WHERE kind='page' AND occurred>=? AND previous_path<>'' AND previous_path<>path GROUP BY previous_path,path ORDER BY transitions DESC LIMIT 30").bind(since),
    env.DB.prepare("SELECT entry_path path,COUNT(*) visits FROM visits WHERE first_seen>=? GROUP BY entry_path ORDER BY visits DESC LIMIT 30").bind(since),
    env.DB.prepare("SELECT current_path path,COUNT(*) visits FROM visits WHERE first_seen>=? AND last_seen<? GROUP BY current_path ORDER BY visits DESC LIMIT 30").bind(since,now-1800),
    env.DB.prepare("SELECT source,campaign,COUNT(*) visits FROM visits WHERE first_seen>=? GROUP BY source,campaign ORDER BY visits DESC LIMIT 30").bind(since),
    env.DB.prepare("SELECT device,browser,os,mode,COUNT(*) visits FROM visits WHERE first_seen>=? GROUP BY device,browser,os,mode ORDER BY visits DESC LIMIT 60").bind(since),
    env.DB.prepare("SELECT viewport,screen,COUNT(*) visits FROM visits WHERE first_seen>=? GROUP BY viewport,screen ORDER BY visits DESC LIMIT 50").bind(since),
    env.DB.prepare("SELECT kind,label,path,COUNT(*) events,COUNT(DISTINCT visit) visits FROM events WHERE occurred>=? AND kind NOT IN ('page','LCP','INP','CLS') GROUP BY kind,label,path ORDER BY events DESC LIMIT 60").bind(since),
    env.DB.prepare("SELECT kind,path,value FROM events WHERE occurred>=? AND kind IN ('LCP','INP','CLS') ORDER BY occurred DESC LIMIT 10000").bind(since),
    env.DB.prepare("SELECT MIN(first_seen) since FROM visits"),
  ];
  const result=await env.DB.batch(statements);
  const names=["engagement","totals","previous","daily","pages","transitions","entries","exits","sources","devices","screens","events","performanceSamples","collection"];
  const data:Record<string,unknown>={days,generatedAt:new Date().toISOString(),windowStart:new Date(since*1000).toISOString(),retentionDays:90};
  result.forEach((r,i)=>data[names[i]]=r.results);
  return json(data);
}

async function realtime(env: Env) {
  const now=nowSeconds();
  const result=await env.DB.batch([
    env.DB.prepare("SELECT current_path path,COUNT(*) visitors FROM visits WHERE active_until>? GROUP BY current_path ORDER BY visitors DESC").bind(now),
    env.DB.prepare("SELECT COUNT(*) visitors FROM visits WHERE last_seen>=?").bind(now-1800),
    env.DB.prepare("SELECT device,COUNT(*) visitors FROM visits WHERE active_until>? GROUP BY device ORDER BY visitors DESC").bind(now),
  ]);
  return json({generatedAt:new Date().toISOString(),activeWindowSeconds:90,pages:result[0].results,last30Minutes:result[1].results[0],devices:result[2].results});
}

async function system(env: Env) {
  const endpoints=["/", "/api/forecasts/2026.json", "/api/forecasts/2026-reference.json", "/api/elections/2026/preparation.json", "/api/candidates/index.json"];
  const checks=await Promise.all(endpoints.map(async path=>{
    const start=Date.now();try{const r=await fetch(env.SITE_ORIGIN+path,{method:"HEAD",signal:AbortSignal.timeout(8000),redirect:"manual"});return{path,status:r.status,ok:r.ok,ms:Date.now()-start};}catch{return{path,status:null,ok:false,ms:Date.now()-start};}
  }));
  return json({checkedAt:new Date().toISOString(),checks,analytics:{measurementId:env.GA_MEASUREMENT_ID||null,status:env.GA_MEASUREMENT_ID?"configured":"awaiting_google_login"},scope:"HTTP availability of published resources; not a fresh audit of every upstream source."});
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url=new URL(request.url);
      if(url.origin!==env.SITE_ORIGIN)return json({error:"host"},421);
      if(url.pathname==="/insights/config" && request.method==="GET")return json({exclude:Boolean(await session(request,env)),measurementId:/^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID)?env.GA_MEASUREMENT_ID:null});
      if(url.pathname==="/insights/collect" && request.method==="POST")return await collect(request,env);
      if(!url.pathname.startsWith("/admin"))return json({error:"not_found"},404);
      if(url.pathname==="/admin/login" && request.method==="POST"){
        if(!sameOrigin(request,env))return login("Begäran kunde inte verifieras. Försök från inloggningssidan.",403);
        if(await limited(request,env,"login",10,900))return login("För många försök. Vänta 15 minuter och försök igen.",429);
        if(Number(request.headers.get("content-length")??0)>1024)return login("Ogiltig inloggning.",400);
        const body=await boundedText(request,1024);if(body===null)return login("Ogiltig inloggning.",400);
        const f=new URLSearchParams(body), valid=await passwordMatches(f.get("password")??"",env.ADMIN_PASSWORD_HASH??"");
        if(!valid || f.get("username")!=="admin")return login("Fel användarnamn eller lösenord.",401);
        const token=random();await env.DB.prepare("INSERT INTO admin_sessions(token_hash,expires) VALUES(?,?)").bind(await digest(token),nowSeconds()+28800).run();
        return new Response(null,{status:303,headers:{Location:"/admin/","Set-Cookie":`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`,"Cache-Control":"no-store"}});
      }
      const authenticated=await session(request,env);
      if(!authenticated)return url.pathname==="/admin"||url.pathname==="/admin/"?login():json({error:"authentication_required"},401);
      if(url.pathname==="/admin/logout" && request.method==="POST"){
        if(!sameOrigin(request,env))return json({error:"origin"},403);
        await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(authenticated).run();
        return new Response(null,{status:303,headers:{Location:"/admin/","Set-Cookie":`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`,"Cache-Control":"no-store"}});
      }
      if(request.method!=="GET")return json({error:"method"},405);
      if(url.pathname==="/admin"||url.pathname==="/admin/")return html(dashboard);
      if(url.pathname==="/admin/app.js")return new Response(dashboardScript,{headers:{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
      if(url.pathname==="/admin/api/report")return await report(url,env);
      if(url.pathname==="/admin/api/realtime")return await realtime(env);
      if(url.pathname==="/admin/api/system")return await system(env);
      return json({error:"not_found"},404);
    } catch(error) {
      console.error(JSON.stringify({event:"insights_error",type:error instanceof Error?error.name:"unknown"}));
      return json({error:"temporarily_unavailable"},503);
    }
  },
  async scheduled(_event: ScheduledController, env: Env) {
    const now=nowSeconds();await env.DB.batch([
      env.DB.prepare("DELETE FROM events WHERE occurred<?").bind(now-90*86400),
      env.DB.prepare("DELETE FROM visits WHERE last_seen<?").bind(now-90*86400),
      env.DB.prepare("DELETE FROM admin_sessions WHERE expires<?").bind(now),
      env.DB.prepare("DELETE FROM auth_attempts WHERE expires<?").bind(now),
    ]);
  },
} satisfies ExportedHandler<Env>;
