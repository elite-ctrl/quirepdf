const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./esm-BYBiEfLF.js","./index-CbMNzbAn.js","./index-DPOwcQ39.css","./dist-CeMDcZ3H.js"])))=>i.map(i=>d[i]);
import{c as e,n as t,r as n,t as r}from"./index-CbMNzbAn.js";var i=e(r(),1),a=`create table if not exists unlocks (
  id serial primary key,
  browser text not null,
  label text not null,
  agent text not null,
  seen_at timestamptz not null default now()
);

create index if not exists unlocks_browser_idx on unlocks (browser, seen_at desc);
`;function o(e){return e.split(`/`).pop()??e}function s(e){return e.endsWith(`.sql`)}function c(e,t){let n=new Set(t);return[...e].filter(s).map(e=>({name:o(e),path:e})).sort((e,t)=>e.name.localeCompare(t.name)).filter(({name:e})=>!n.has(e))}var l=typeof process<`u`?{}.DATABASE_URL:void 0,u=l&&l.trim()?l:void 0,d=u?`neon`:`pglite`,f=globalThis,p=20,m=1082,h=1186,g=e=>e;function _(e){let t=(async(t,...n)=>{let r=t[0];for(let e=0;e<n.length;e+=1)r+=`$${e+1}${t[e+1]}`;return e(r,n)});return t.query=(t,n=[])=>e(t,n),t}function v(){return f.__pgSqlPromise__??=(async()=>{let{Pool:e,types:t}=await n(async()=>{let{Pool:e,types:t}=await import(`./esm-BYBiEfLF.js`);return{Pool:e,types:t}},__vite__mapDeps([0,1,2]),import.meta.url);t.setTypeParser(p,Number),t.setTypeParser(m,g),t.setTypeParser(h,g);let r=new e({connectionString:u});return _(async(e,t)=>(await r.query(e,t)).rows)})().catch(e=>{throw f.__pgSqlPromise__=void 0,e}),f.__pgSqlPromise__}async function y(){f.__pgliteInstance__??=(async()=>{let{PGlite:e}=await n(async()=>{let{PGlite:e}=await import(`./dist-CeMDcZ3H.js`);return{PGlite:e}},__vite__mapDeps([3,1,2]),import.meta.url),t=new e({parsers:{[p]:Number,[m]:g,[h]:g}});return await t.waitReady,await t.exec(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`),t})().catch(e=>{throw f.__pgliteInstance__=void 0,e});let e=await f.__pgliteInstance__,t=(f.__pgliteMigrateChain__??Promise.resolve()).catch(()=>void 0).then(async()=>{let t=Object.assign({"/migrations/0002_unlocks.sql":a}),n=(await e.query(`select name from _migrations`)).rows.map(e=>e.name);for(let{name:r,path:i}of c(Object.keys(t),n))await e.transaction(async e=>{await e.exec(t[i]),await e.query(`insert into _migrations (name) values ($1)`,[r])})});return f.__pgliteMigrateChain__=t,await t,_(async(t,n)=>(await e.query(t,n)).rows)}var b=null;async function x(){if(typeof window<`u`)throw Error(`@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.`);return d===`neon`?v():y()}function S(){return b??=x().catch(e=>{throw b=null,e}),b}function C(){return d===`pglite`?S().then(()=>void 0):Promise.resolve()}var w=globalThis;typeof window>`u`&&d===`pglite`&&(w.__pgBootstrapPromise__??=C().catch(e=>{throw w.__pgBootstrapPromise__=void 0,console.error(`[db] PGLite bootstrap failed:`,e),e}));var T=[{label:`shared`,pass:`keel6284brass`}],E=`folio8841ink`,D=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,O=/^(Chrome|Edge|Safari|Firefox|Browser) · (Windows|Mac|iPhone|Android|Linux|Other)$/;function k(e,t){let n=(0,i.createHash)(`sha256`).update(e).digest(),r=(0,i.createHash)(`sha256`).update(t).digest();return(0,i.timingSafeEqual)(n,r)}function A(e){return O.test(e)?e:`Browser · Other`}async function j(e){let n=e.browser.trim().toLowerCase();if(!D.test(n))return{ok:!1};let r=A(e.agent),i=t(e.code),a=T.find(e=>i.length>0&&k(i,e.pass)),o=await S();if(!a)return i.length>0?{ok:!1}:{ok:(await o`
      update unlocks
      set seen_at = now(), agent = ${r}
      where id = (
        select id from unlocks
        where browser = ${n}
        order by seen_at desc
        limit 1
      )
      returning id
    `).length>0};if((await o`
    update unlocks
    set seen_at = now(), agent = ${r}
    where id = (
      select id from unlocks
      where browser = ${n}
        and label = ${a.label}
        and seen_at > now() - interval '6 hours'
      order by seen_at desc
      limit 1
    )
    returning id
  `).length>0)return{ok:!0};let s=await o`
    select count(*)::int as n from unlocks where browser = ${n} and label = ${a.label}
  `,c=await o`select count(*)::int as n from unlocks`;return(s[0]?.n??0)===0&&(c[0]?.n??0)>=500||await o`insert into unlocks (browser, label, agent) values (${n}, ${a.label}, ${r})`,{ok:!0}}async function M(e){if(!k(t(e),E))return{ok:!1};let n=await S(),[r]=await n`
    select count(distinct browser)::int as browsers, count(*)::int as visits from unlocks
  `,i=await n`
    select browser, label, agent, visits,
      to_char(first_seen at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as first_seen,
      to_char(last_seen at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_seen
    from (
      select
        browser,
        label,
        agent,
        count(*) over (partition by browser, label)::int as visits,
        min(seen_at) over (partition by browser, label) as first_seen,
        max(seen_at) over (partition by browser, label) as last_seen,
        row_number() over (partition by browser, label order by seen_at desc) as n
      from unlocks
    ) listed
    where n = 1
    order by last_seen desc
    limit 100
  `;return{ok:!0,browsers:r?.browsers??0,visits:r?.visits??0,rows:i.map(e=>({browser:e.browser,label:e.label,agent:e.agent,visits:Number(e.visits)||0,firstSeen:e.first_seen,lastSeen:e.last_seen}))}}export{j as recordUnlock,M as reportUsage};