uri=open("_logo_datauri.txt").read().strip()

HEAD = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="OE Dashboard">
<meta name="theme-color" content="#000000">
<title>Optiline Dashboards</title>

<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">
<link rel="manifest" href="manifest.webmanifest">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

<style>
  :root{
    --black:#000000; --red:#E1251B; --white:#FFFFFF;
    --g1:#202020; --g2:#404040; --g3:#606060; --g4:#808080;
    --card:#121212; --card-edge:#262626; --radius:18px;
    --font-body:'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
    --font-head:'Helvetica Neue','HelveticaNeue-Bold','Inter',Arial,sans-serif;
  }
  *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html,body{ margin:0; height:100%; }
  body{ background:var(--black); color:var(--white); font-family:var(--font-body); -webkit-font-smoothing:antialiased; overflow:hidden; }

  #home{ height:100%; overflow-y:auto; -webkit-overflow-scrolling:touch;
    padding: calc(env(safe-area-inset-top) + 22px) calc(env(safe-area-inset-right) + 18px) calc(env(safe-area-inset-bottom) + 40px) calc(env(safe-area-inset-left) + 18px); }

  header.brand{ display:flex; align-items:center; gap:14px; padding-bottom:18px; border-bottom:1px solid var(--g1); margin-bottom:22px; }
  .logo-img{ height:34px; width:auto; display:block; align-self:flex-start; }
  @media(max-width:380px){ .logo-img{ height:26px; } }

  /* sign-in reminder banner */
  .signin-note{ display:flex; align-items:center; gap:12px;
    background:rgba(225,37,27,.10); border:1px solid rgba(225,37,27,.45);
    border-radius:12px; padding:11px 14px; margin-bottom:20px;
    font-size:12.5px; color:#eee; line-height:1.45; }
  .signin-note.hide{ display:none; }
  .signin-note a{ color:var(--red); font-weight:700; text-decoration:none; }
  .note-x{ margin-left:auto; background:none; border:none; color:var(--g4); font-size:20px; line-height:1; cursor:pointer; flex:none; padding:0 2px; }

  .pagetitle{ font-family:var(--font-head); font-size:13px; letter-spacing:3px; text-transform:uppercase; color:var(--g4); margin:0 0 16px 2px; font-weight:700; }

  .grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
  @media(min-width:620px){ .grid{ grid-template-columns:repeat(3,1fr);} }
  @media(min-width:900px){ .grid{ grid-template-columns:repeat(4,1fr);} }

  .tile{ position:relative; background:var(--card); border:1px solid var(--card-edge); border-radius:var(--radius);
    padding:20px 16px 18px; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer;
    transition:transform .12s ease, border-color .12s ease, background .12s ease; overflow:hidden; }
  .tile:active{ transform:scale(.97); }
  @media(hover:hover){ .tile:hover{ border-color:var(--red); background:#161616; } }
  .tile::after{ content:""; position:absolute; right:-18px; bottom:-18px; width:54px; height:54px;
    background:linear-gradient(135deg, transparent 46%, var(--g1) 46%, var(--g1) 60%, transparent 60%); opacity:.7; }

  .icon-badge{ width:62px;height:62px; border-radius:16px; background:var(--red); display:flex;align-items:center;justify-content:center;
    margin-bottom:14px; box-shadow:0 6px 18px rgba(225,37,27,.28); }
  .icon-badge svg{ width:34px;height:34px; color:var(--white); }
  .tile .label{ font-family:var(--font-head); font-weight:700; font-size:15px; letter-spacing:.6px; text-transform:uppercase; }
  .tile .desc{ margin-top:5px; font-size:11.5px; color:var(--g4); line-height:1.35; }

  footer.foot{ margin-top:30px; text-align:center; font-size:10.5px; letter-spacing:2px; color:var(--g2); text-transform:uppercase; }

  #viewer{ position:fixed; inset:0; background:var(--black); display:none; flex-direction:column; }
  #viewer.open{ display:flex; }
  .topbar{ flex:none; display:flex; align-items:center; gap:10px; padding: calc(env(safe-area-inset-top) + 10px) 14px 10px; background:#0c0c0c; border-bottom:1px solid var(--g1); }
  .iconbtn{ flex:none; width:38px;height:38px; border:none;border-radius:10px; background:var(--g1); color:var(--white); display:flex;align-items:center;justify-content:center; cursor:pointer; }
  .iconbtn:active{ background:var(--g2); }
  .iconbtn.red{ background:var(--red); }
  .iconbtn svg{ width:20px;height:20px; }
  .topbar .vtitle{ flex:1; min-width:0; font-family:var(--font-head); font-weight:700; font-size:15px; letter-spacing:.4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .topbar .vtitle small{ display:block; font-family:var(--font-body); font-weight:500; font-size:10.5px; color:var(--g4); letter-spacing:1px; }

  .frame-wrap{ flex:1; position:relative; background:#0c0c0c; }
  iframe#frame{ position:absolute; inset:0; width:100%; height:100%; border:0; background:#fff; }

  .loader{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; color:var(--g4); background:#0c0c0c; padding:24px; }
  .loader.hide{ display:none; }
  .spinner{ width:42px;height:42px;border-radius:50%; border:3px solid var(--g1); border-top-color:var(--red); animation:spin 0.8s linear infinite; }
  @keyframes spin{ to{ transform:rotate(360deg);} }
  .loader .hint{ font-size:11.5px; max-width:240px; text-align:center; line-height:1.5; }

  /* auth prompt (shown when dashboard fails to load) */
  .authbox{ display:none; flex-direction:column; align-items:center; gap:16px; max-width:300px; text-align:center; }
  .loader.needauth .spinner{ display:none; }
  .loader.needauth .hint{ display:none; }
  .loader.needauth .authbox{ display:flex; }
  .authicon{ width:54px;height:54px;border-radius:50%; background:rgba(225,37,27,.15); border:1px solid rgba(225,37,27,.5); display:flex;align-items:center;justify-content:center; color:var(--red); }
  .authicon svg{ width:26px;height:26px; }
  .authmsg{ font-size:13px; color:#cfcfcf; line-height:1.55; }
  .authmsg b{ color:#fff; }
  .authbtns{ display:flex; flex-direction:column; gap:10px; width:100%; }
  .btn-red{ background:var(--red); color:#fff; border:none; border-radius:11px; padding:13px 18px; font-weight:700; font-family:var(--font-head); letter-spacing:.5px; font-size:14px; cursor:pointer; }
  .btn-ghost{ background:var(--g1); color:#fff; border:none; border-radius:11px; padding:12px 18px; font-size:13px; cursor:pointer; }
</style>
</head>
'''

BODY = r'''<body>

  <main id="home">
    <header class="brand">
      <img class="logo-img" src="__LOGO__" alt="Optiline">
    </header>

    <div class="signin-note" id="signinNote">
      <span>Dashboards open with your Optiline (<b>optiline.co</b>) Google account. Not loading? <a href="https://accounts.google.com/" target="_blank" rel="noopener">Sign in to Google</a>.</span>
      <button class="note-x" id="noteX" aria-label="Dismiss">&times;</button>
    </div>

    <p class="pagetitle">Dashboards</p>
    <div class="grid" id="grid"></div>
    <footer class="foot">Optiline&trade; Enterprises &middot; Internal Dashboards</footer>
  </main>

  <section id="viewer">
    <div class="topbar">
      <button class="iconbtn red" id="backBtn" aria-label="Back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="vtitle"><span id="vName">Dashboard</span><small id="vDesc"></small></div>
      <button class="iconbtn" id="reloadBtn" aria-label="Reload">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
      </button>
      <button class="iconbtn" id="popBtn" aria-label="Open in new tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
      </button>
    </div>
    <div class="frame-wrap">
      <div class="loader" id="loader">
        <div class="spinner"></div>
        <div class="hint">Loading dashboard&hellip;</div>
        <div class="authbox">
          <div class="authicon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          </div>
          <div class="authmsg">This dashboard didn&rsquo;t load. You may need to sign in to your <b>Optiline (optiline.co)</b> Google account, then reload.</div>
          <div class="authbtns">
            <button class="btn-red" id="signinBtn">Sign in to Google</button>
            <button class="btn-ghost" id="reload2Btn">Reload dashboard</button>
            <button class="btn-ghost" id="pop2Btn">Open full screen instead</button>
          </div>
        </div>
      </div>
      <iframe id="frame" title="Dashboard" referrerpolicy="origin"></iframe>
    </div>
  </section>

<script>
const APPS = [
  { name:"OE Business Dev", desc:"Business Development", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbxtZNDAC_3d_wkCstZjnKo527ATPQ8EwlLSneb3FqyG4FSbf82XHRZ_gZXrfbBebI2K/exec", icon:"bd" },
  { name:"OE Pipeline", desc:"Pipeline Map", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbxRt9Lxf4RKOYyCgB9tRhTufBvD8rwbVT_OLVpQkdnSABK_O5a4yIYqFt-0A0dBLxXW/exec", icon:"pipeline" },
  { name:"OE Precon Dashboard", desc:"Preconstruction Standings", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbzMmLqmCQ5B5ANjorKA0cAesdOwVy_kTs9fvogfuNkbPVJJi9cLuTEFy2w-bZIH5UiNew/exec", icon:"precon" },
  { name:"OE Leadership", desc:"Leadership Dashboard", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbwbVIfS0oSCbzLemM53fwOAXWq1j_EV-BYiF4T0zzbhdDuhQYzHsw9naSAS9mo8a1A/exec", icon:"leadership" },
  { name:"OE CEO", desc:"CEO Weekly Update", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbyHnvhOQpKr5SWNlFEAgkFGzKRntnLYlzHf-rjetV4SXQHuOPySkwaSC6cMDRzb8YEH/exec", icon:"ceo" },
  { name:"OE Bid Funnel", desc:"Bid Funnel Overview", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbzoXaptrTxyCWjAqXTwLs4pejj2VjkHFFZ3ka5v87aDFcYanYOksjuX6qpKOw1A1yjW1Q/exec", icon:"funnel", ext:true },
  { name:"OE Estimators", desc:"Estimator Performance", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbzt9gabRWt3hz4gPfbG1nbU6IYuj8V_vX_QNxQzxR3b14MPs694OonxHy3vKS1wybtI/exec", icon:"estperf" },
  { name:"OE Bid Pace", desc:"Bid Pace Overview", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbxwu9EkRx5XyDj3AO5WAnPOL6XfuvDMWfbkttuCpQD2ohZSJ0arUTXtGmbnMcdgn0xBQg/exec", icon:"bidpace" },
  { name:"OE Precon Leader", desc:"Precon Leader Dashboard", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbxnrOPlMjiypugLnB_yF8qAqkr626QX2Bz0wvn9A1xpROgUx6q69m1-XnB9wmYjkITaqQ/exec", icon:"preconlead" },
  { name:"OE Operations", desc:"Operations Dashboard", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbyrnpPOfw35MBWJvOk-m_3V91XESMqOBdTOyiS2_Dzon1_dPogQ1CAiQSWiUohhIiKR/exec", icon:"operations", ext:true },
  { name:"OE Estimator Scorecards", desc:"Estimator Report Cards", url:"https://script.google.com/a/macros/optiline.co/s/AKfycbwY4tlhkpGF9eLR3ItyEUimdTY37Z5M4ONyaoJZXdSk_e-a0TWEqvHg9yxJPr4NuTUi/exec", icon:"scorecard" },
  { name:"OE Active Projects", desc:"Active Projects", url:"https://script.google.com/macros/s/AKfycbw0Do9YS1XL7Ks3LA7AJ4_E9eoEZS_kErF29IdDQBfJyb0ccKhIsLhc6G6TrUIXf-iQGw/exec", icon:"projects" }
  // ,{ name:"New App", desc:"What it does", url:"https://.../exec", icon:"grid" }
];

const ICONS = {
  bd:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6.8 6h10.4"/><path d="M6.6 7.6 10.8 16.2"/><path d="M17.4 7.6 13.2 16.2"/></svg>`,
  spif:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4.5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v.8A3.2 3.2 0 0 0 7.2 10"/><path d="M17 6h3v.8A3.2 3.2 0 0 1 16.8 10"/><path d="M12 13.5V16"/><path d="M8.5 20h7"/><path d="M9.5 20a2.5 2.5 0 0 1 5 0"/><path d="M12 6.2v2.2M11 7.1h1.4a.7.7 0 0 1 0 1.4H11.2"/></svg>`,
  pipeline:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.2-5.5-6.2-10.2A6.2 6.2 0 0 1 18.2 10.8C18.2 15.5 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.3"/></svg>`,
  precon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4.5" width="14" height="16.5" rx="2.2"/><path d="M9 4.5V4a3 3 0 0 1 6 0v.5"/><path d="M9 17v-3"/><path d="M12 17v-5.5"/><path d="M15 17v-2"/></svg>`,
  grid:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/></svg>`,
  leadership:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18a8 8 0 0 1 16 0"/><path d="M12 18l4.6-4.6"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  ceo:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/><path d="M11.5 12.5h1"/></svg>`,
  funnel:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"/></svg>`,
  estperf:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V13"/><path d="M9 20V8"/><path d="M14 20v-4"/><path d="M19 20V4"/><path d="M3 20h18"/></svg>`,
  bidpace:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 17a8.5 8.5 0 0 1 17 0"/><path d="M12 17l5-3.2"/><circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none"/><path d="M12 8.4v1.6"/><path d="M5.8 11.1l1.1 1.1"/><path d="M18.2 11.1l-1.1 1.1"/></svg>`,
  preconlead:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.3"/><path d="M12 7.3V10"/><rect x="9" y="10" width="6" height="11" rx="1"/><rect x="3" y="14" width="6" height="7" rx="1"/><rect x="15" y="13" width="6" height="8" rx="1"/></svg>`,
  operations:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/></svg>`,
  scorecard:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V7.6z"/><path d="M14 3v4.6H18.6"/><path d="M8.6 12.4l1.5 1.5 3-3.1"/><path d="M8.6 17h6"/></svg>`,
  projects:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="4" y="9.5" width="6.5" height="11" rx="1"/><rect x="12.5" y="4" width="7" height="16.5" rx="1"/><path d="M6.6 13h1.2M6.6 16.2h1.2M15 7.4h2.2M15 11h2.2M15 14.6h2.2"/></svg>`
};

const grid=document.getElementById('grid');
APPS.forEach((app,i)=>{
  const t=document.createElement('div'); t.className='tile';
  t.innerHTML=`<div class="icon-badge">${ICONS[app.icon]||ICONS.grid}</div><div class="label">${app.name}</div><div class="desc">${app.desc||''}</div>`;
  t.addEventListener('click',()=>openApp(i));
  grid.appendChild(t);
});

const viewer=document.getElementById('viewer'), frame=document.getElementById('frame'),
      loader=document.getElementById('loader'), vName=document.getElementById('vName'), vDesc=document.getElementById('vDesc');
let currentUrl='', authTimer=null;
const AUTH_TIMEOUT=8000; // ms before showing the sign-in prompt

function startLoad(url){
  clearTimeout(authTimer);
  loader.classList.remove('hide','needauth');
  frame.src=url;
  authTimer=setTimeout(()=>loader.classList.add('needauth'), AUTH_TIMEOUT);
}
// On phones/tablets, iOS blocks embedded Google sign-in, so open the
// dashboard full-screen (first-party) instead of in the in-app viewer.
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
function openApp(i){
  const app=APPS[i]; currentUrl=app.url;
  if(app.ext){ window.open(app.url,'_blank'); return; }   // always open full-screen (no embed)
  if(isTouch){ window.location.href=app.url; return; }
  vName.textContent=app.name; vDesc.textContent=app.desc||'';
  viewer.classList.add('open');
  startLoad(app.url);
  history.pushState({view:'app'},'','#'+encodeURIComponent(app.name));
}
function closeApp(){ clearTimeout(authTimer); viewer.classList.remove('open'); frame.src='about:blank'; }

frame.addEventListener('load',()=>{
  if(frame.src && frame.src!=='about:blank'){ clearTimeout(authTimer); loader.classList.add('hide'); }
});

document.getElementById('backBtn').addEventListener('click',()=>history.back());
document.getElementById('reloadBtn').addEventListener('click',()=>startLoad(currentUrl));
document.getElementById('reload2Btn').addEventListener('click',()=>startLoad(currentUrl));
document.getElementById('popBtn').addEventListener('click',()=>{ if(currentUrl) window.open(currentUrl,'_blank'); });
document.getElementById('pop2Btn').addEventListener('click',()=>{ if(currentUrl) window.open(currentUrl,'_blank'); });
document.getElementById('signinBtn').addEventListener('click',()=>window.open('https://accounts.google.com/','_blank'));
window.addEventListener('popstate',()=>{ if(viewer.classList.contains('open')) closeApp(); });

// home sign-in banner (remember dismissal)
const note=document.getElementById('signinNote');
try{ if(localStorage.getItem('oe_note_dismissed')==='1') note.classList.add('hide'); }catch(e){}
document.getElementById('noteX').addEventListener('click',()=>{ note.classList.add('hide'); try{localStorage.setItem('oe_note_dismissed','1');}catch(e){} });
</script>
</body>
</html>
'''

html=(HEAD+BODY).replace("__LOGO__", uri)
open("gh-pages/index.html","w").write(html)
print("built gh-pages/index.html bytes:", len(html))
