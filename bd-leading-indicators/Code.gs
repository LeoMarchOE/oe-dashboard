/*** OPTILINE — BD LEADING INDICATORS  (v1.1, 10/26/2026 — own data spreadsheet; Basis Master read-only) ***
 *
 * Monthly leading indicators for Business Development, by Region, from
 * 09/01/2026 forward:
 *   - New opportunities sourced (and how many went to bid)
 *   - Submitted -> Hot Prospect conversions (#, $) and conversion rate     [BD]
 *   - Hot Prospect at each month-start, and its change
 *   - Hot Prospect -> Ours To Lose / Awarded conversions (#, $)            [Estimating]
 *   - Lost from Hot Prospect
 *   - Open pipeline at each month-start
 *
 * HOW IT WORKS
 *   Basis Master (the existing hourly sheet) already has every project's
 *   CURRENT stage, region, value and created date. What it lacks is stage
 *   HISTORY. This script keeps its own small spreadsheet, "BD Leading Indicators
 *   — Data" (created automatically; Basis Master is only ever READ), whose
 *   "BD_Transitions" tab holds every
 *   BasisBoard stage change since 08/01/2026 (from the project activity log).
 *   Current stage + stage history = the stage of any project on any date, so
 *   every month-start can be rebuilt exactly, and nothing depends on a
 *   snapshot having run on the 1st.
 *
 *   bdSeed()    one-time backfill of stage history (~950 projects, ~15–20 min,
 *               runs itself in chunks via one-off triggers; just start it once).
 *   bdTrack()   every 30 min, 8 AM–6 PM ET: compares Basis Master stages to the
 *               last-known stages and pulls the activity log only for projects
 *               whose stage changed (typically 5–40 API calls a run).
 *   doGet()     the dashboard (Dashboard.html).
 *
 * SETUP (standalone Apps Script project, so it can't collide with the
 * doGet() of the SPIF / leaderboard / map web apps):
 *   1) script.google.com → New project → name "BD Leading Indicators".
 *      Paste Code.gs, add an HTML file named "Dashboard", paste Dashboard.html.
 *      Project Settings → show appsscript.json → paste appsscript.json.
 *   2) Project Settings → Script Properties:
 *        BASIS_API_KEY  = the same key the Master Export uses
 *        BB_SHEET_ID    = the "BB API Data" spreadsheet ID (or its full URL)
 *   3) Run bdSetup() once (authorize). It creates the tabs, starts the seed,
 *      and installs the 30-minute tracker. Seed progress: View → Executions,
 *      or the "BD_Meta" tab.
 *   4) Deploy → New deployment → Web app → Execute as: Me →
 *      Who has access: Anyone within Optiline → Deploy. Share the /exec URL.
 *      (Code changes need Manage deployments → Edit → New version.)
 ***/

/* ============================ CONFIG ============================ */
const BD = {
  API: 'https://api.basisboard.com/v1',
  MASTER: 'Basis Master',
  TRANS: 'BD_Transitions',
  LAST: 'BD_LastStage',
  META: 'BD_Meta',
  BASELINE: [2026, 8, 1],            // 09/01/2026 (month is 0-based)
  HISTORY_FROM: '2026-08-01',        // keep stage changes on/after this date
  SEED_CUTOFF: '2026-08-20',         // closed before this = closed all window, no history needed
  TRACK_EVERY_MIN: 30,
  WINDOW: [8, 18],                   // tracker runs 8:00 AM – 6:00 PM ET
  SEED_CHUNK_MS: 4.5 * 60 * 1000,    // stay under the 6-min execution cap
  PAR: 3,                            // parallel activity calls (rate-limit safe)
  TZ: 'America/New_York'
};

const REGIONS = ['Northern New England', 'South Shore', 'Mid Atlantic', 'Carolinas', 'Tennessee', 'Florida', 'East Texas', 'Unassigned'];
const OFF2REG = { 'NH': 'Northern New England', 'South Shore': 'South Shore', 'TN': 'Tennessee', 'NC': 'Carolinas',
                  'Florida': 'Florida', 'Mid-Atlantic': 'Mid Atlantic', 'East Texas': 'East Texas' };
const OPEN = ['Prospect', 'Active Pursuit', 'Qualified Opportunity', 'Accepted', 'Bidding', 'Re-Bid', 'Internal Review',
              'Approved', 'Submitted', 'Hot Prospect', 'Ours To Lose'];
const BID_STAGES = ['Bidding', 'Re-Bid', 'Internal Review', 'Approved', 'Submitted', 'On Hold', 'Hot Prospect',
                    'Ours To Lose', 'Awarded', 'Lost'];

/* ============================ SETUP ============================ */
function bdSetup() {
  const ss = bd_ss_();
  bd_sheet_(ss, BD.TRANS, ['Activity ID', 'Project ID', 'Changed At (UTC)', 'From Stage', 'To Stage']);
  bd_sheet_(ss, BD.LAST, ['Project ID', 'Stage']);
  bd_sheet_(ss, BD.META, ['Key', 'Value']);
  bd_removeTriggers_('bdTrack');
  ScriptApp.newTrigger('bdTrack').timeBased().everyMinutes(BD.TRACK_EVERY_MIN).create();
  bdSeed();
}

/* ============================ SEED (one-time backfill) ============================ */
function bdSeed() {
  const props = PropertiesService.getScriptProperties();
  const ss = bd_ss_();
  const qsh = bd_sheet_(ss, 'BD_SeedQueue', ['Project ID']);
  let queue;
  if (props.getProperty('BD_SEED_RUNNING') !== '1') {
    const master = bd_readMaster_();
    queue = master.filter(function (p) {
      if (p.stage === 'Awarded' && p.awardedIso && p.awardedIso < BD.SEED_CUTOFF) return false;
      if (p.stage === 'Lost' && p.lostIso && p.lostIso < BD.SEED_CUTOFF) return false;
      return true;
    }).map(function (p) { return p.id; });
    bd_writeLast_(ss, master);                       // baseline for the tracker
    props.setProperty('BD_SEED_RUNNING', '1');
    props.setProperty('BD_SEED_TOTAL', String(queue.length));
    bd_meta_(ss, 'Seed started', new Date());
  } else {
    queue = qsh.getLastRow() > 1 ? qsh.getRange(2, 1, qsh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  }
  const t0 = Date.now();
  const known = bd_knownActivityIds_(ss);
  while (queue.length && Date.now() - t0 < BD.SEED_CHUNK_MS) {
    const batch = queue.splice(0, BD.PAR);
    bd_appendTransitions_(ss, bd_fetchStageChanges_(batch), known);
  }
  if (qsh.getLastRow() > 1) qsh.getRange(2, 1, qsh.getLastRow() - 1, 1).clearContent();
  bd_removeTriggers_('bdSeed');
  if (queue.length) {
    qsh.getRange(2, 1, queue.length, 1).setValues(queue.map(function (id) { return [id]; }));
    bd_meta_(ss, 'Seed remaining', queue.length);
    ScriptApp.newTrigger('bdSeed').timeBased().after(60 * 1000).create();
  } else {
    props.deleteProperty('BD_SEED_RUNNING');
    bd_meta_(ss, 'Seed remaining', 0);
    bd_meta_(ss, 'Seed finished', new Date());
    bdClearCache();
  }
}

/* ============================ TRACKER (incremental) ============================ */
function bdTrack() {
  const h = Number(Utilities.formatDate(new Date(), BD.TZ, 'H'));
  if (h < BD.WINDOW[0] || h >= BD.WINDOW[1]) return;
  if (PropertiesService.getScriptProperties().getProperty('BD_SEED_RUNNING') === '1') return;   // seed still running
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const ss = bd_ss_();
    const master = bd_readMaster_();
    if (master.length < 1000) throw new Error('Basis Master looks incomplete (' + master.length + ' rows) — skipped.');
    const last = {};
    const lsh = ss.getSheetByName(BD.LAST);
    if (lsh.getLastRow() > 1) lsh.getRange(2, 1, lsh.getLastRow() - 1, 2).getValues()
      .forEach(function (r) { last[r[0]] = r[1]; });
    const changed = master.filter(function (p) { return last[p.id] !== p.stage; }).map(function (p) { return p.id; });
    const known = bd_knownActivityIds_(ss);
    let added = 0;
    for (let i = 0; i < changed.length; i += BD.PAR) {
      added += bd_appendTransitions_(ss, bd_fetchStageChanges_(changed.slice(i, i + BD.PAR)), known);
    }
    bd_writeLast_(ss, master);
    bd_meta_(ss, 'Last tracker run', new Date());
    bd_meta_(ss, 'Last tracker result', changed.length + ' stage change(s) detected, ' + added + ' history row(s) added');
    if (added) bdClearCache();
  } finally {
    lock.releaseLock();
  }
}

/* ============================ DASHBOARD ============================ */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Optiline | BD Leading Indicators')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Called from the page. Returns every month since baseline, all regions.
function bdGetData() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('bd_data_v1');
  if (hit) return hit;
  const ss = bd_ss_();
  const master = bd_readMaster_();
  const trans = bd_readTransitions_(ss);
  const out = bdCompute_(master, trans, new Date());
  let basisSync = '';
  try { const meta = bd_bb_().getSheetByName('Sync Meta'); if (meta) basisSync = String(meta.getRange('B1').getDisplayValue()); } catch (e) {}
  out.basisSync = basisSync;
  out.seedRemaining = bd_metaGet_(ss, 'Seed remaining');
  const json = JSON.stringify(out);
  if (json.length < 95000) cache.put('bd_data_v1', json, 600);
  return json;
}

/* ============================ METRICS (pure — no Apps Script calls) ============================ */
function bdCompute_(projects, transitions, now) {
  const byId = {};
  projects.forEach(function (p) { byId[p.id] = p; });
  const hist = {};
  transitions.forEach(function (t) { (hist[t.pid] = hist[t.pid] || []).push(t); });
  Object.keys(hist).forEach(function (k) { hist[k].sort(function (a, b) { return a.at - b.at; }); });

  function stageAt(p, T) {
    if (p.created > T) return null;
    const h = hist[p.id] || [];
    for (let i = 0; i < h.length; i++) if (h[i].at > T) return h[i].from;
    return p.stage;
  }
  function blank() { const o = {}; REGIONS.concat(['All']).forEach(function (r) { o[r] = [0, 0]; }); return o; }
  function add(o, r, v) { o[r][0]++; o[r][1] += v; o.All[0]++; o.All[1] += v; }

  // month-start points
  const pts = [];
  let d = new Date(BD.BASELINE[0], BD.BASELINE[1], BD.BASELINE[2]);
  while (d <= now) { pts.push(d); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  const ends = pts.slice(1).concat([now]);

  function snapshot(T) {
    const s = { pipeline: blank(), submitted: blank(), hp: blank(), otl: blank(), hpList: [] };
    projects.forEach(function (p) {
      const st = stageAt(p, T);
      if (OPEN.indexOf(st) < 0) return;
      add(s.pipeline, p.region, p.value);
      if (st === 'Submitted') add(s.submitted, p.region, p.value);
      if (st === 'Hot Prospect') add(s.hp, p.region, p.value);
      if (st === 'Ours To Lose') add(s.otl, p.region, p.value);
    });
    return s;
  }

  const months = pts.map(function (t1, i) {
    const t2 = ends[i];
    const complete = i < pts.length - 1;
    const start = snapshot(t1), end = snapshot(t2);
    const sourced = blank(), sourcedBid = blank(), conv = blank(), estConv = blank(), hpLost = blank();
    projects.forEach(function (p) {
      if (p.created > t1 && p.created <= t2) {
        add(sourced, p.region, p.value);
        const seen = [p.stage].concat((hist[p.id] || []).map(function (h) { return h.to; }));
        if (seen.some(function (s) { return BID_STAGES.indexOf(s) >= 0; })) add(sourcedBid, p.region, p.value);
      }
    });
    const log = [], cSeen = {}, eSeen = {}, lSeen = {};
    Object.keys(hist).forEach(function (pid) {
      const p = byId[pid]; if (!p) return;
      hist[pid].forEach(function (h) {
        if (!(h.at > t1 && h.at <= t2)) return;
        const into = h.to === 'Hot Prospect' && h.from !== 'Hot Prospect';
        const outof = h.from === 'Hot Prospect' && h.to !== 'Hot Prospect';
        if (!into && !outof) return;
        let type;
        if (into) type = h.from === 'Submitted' ? 'BD conversion' : 'In from ' + h.from;
        else if (h.to === 'Ours To Lose' || h.to === 'Awarded') type = 'Est. conversion → ' + (h.to === 'Ours To Lose' ? 'OTL' : 'Awarded');
        else if (h.to === 'Lost') type = 'Lost';
        else type = 'Returned → ' + h.to;
        log.push({ at: h.at.getTime(), name: p.name, region: p.region, move: into ? 'IN' : 'OUT', type: type, value: p.value });
        if (into && h.from === 'Submitted' && !cSeen[pid]) { cSeen[pid] = 1; add(conv, p.region, p.value); }
        if (outof && (h.to === 'Ours To Lose' || h.to === 'Awarded') && !eSeen[pid]) { eSeen[pid] = 1; add(estConv, p.region, p.value); }
        if (outof && h.to === 'Lost' && !lSeen[pid]) { lSeen[pid] = 1; add(hpLost, p.region, p.value); }
      });
    });
    log.sort(function (a, b) { return a.at - b.at; });
    return {
      key: Utilities_fmt_(t1, 'yyyy-MM'), label: Utilities_fmt_(t1, 'MMMM yyyy'),
      from: Utilities_fmt_(t1, 'MM/dd/yyyy'), to: Utilities_fmt_(t2, 'MM/dd/yyyy'), complete: complete,
      start: start, end: end, sourced: sourced, sourcedBid: sourcedBid, conv: conv, estConv: estConv, hpLost: hpLost, log: log
    };
  });
  return { generated: now.getTime(), regions: REGIONS, months: months };
}

// Formatting that works both in Apps Script and in plain JS tests.
function Utilities_fmt_(d, pat) {
  if (typeof Utilities !== 'undefined') return Utilities.formatDate(d, BD.TZ, pat);
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return pat.replace('yyyy', d.getFullYear()).replace('MMMM', M[d.getMonth()]).replace('MM', p2(d.getMonth() + 1)).replace('dd', p2(d.getDate()));
}

/* ============================ SHEET I/O ============================ */
// The BB API Data spreadsheet — READ ONLY (Basis Master, Sync Meta). Nothing is written here:
// it is large and busy (Master Export writes every 15 min), and writes to it time out.
function bd_bb_() {
  const raw = String(PropertiesService.getScriptProperties().getProperty('BB_SHEET_ID') || '').trim();
  if (!raw) throw new Error('Set Script Property BB_SHEET_ID (the BB API Data spreadsheet ID or URL).');
  const m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(raw);      // accepts a full URL or just the ID
  return bd_retry_(function () { return SpreadsheetApp.openById(m ? m[1] : raw); });
}
// A small, dedicated spreadsheet for this tool's own tabs (stage history, last stage, meta).
// Created automatically on first run; its ID is kept in Script Property BD_DATA_ID.
function bd_ss_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('BD_DATA_ID');
  if (!id) {
    const ss = SpreadsheetApp.create('BD Leading Indicators — Data (do not edit)');
    id = ss.getId();
    props.setProperty('BD_DATA_ID', id);
    Logger.log('Created data spreadsheet: ' + ss.getUrl());
  }
  return bd_retry_(function () { return SpreadsheetApp.openById(id); });
}
function bd_retry_(fn) {
  for (let i = 1; ; i++) {
    try { return fn(); }
    catch (e) {
      if (i >= 4 || !/timed out|Service|busy|try again/i.test(String(e))) throw e;
      Utilities.sleep(4000 * i);
    }
  }
}
function bd_sheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');   // keep ISO timestamps as text
  }
  const def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  return sh;
}

// Basis Master -> [{id,name,stage,region,value,created,awardedIso,lostIso}]
function bd_readMaster_() {
  const sh = bd_bb_().getSheetByName(BD.MASTER);
  if (!sh) throw new Error('Tab "' + BD.MASTER + '" not found in the BB API Data spreadsheet.');
  const vals = bd_retry_(function () { return sh.getDataRange().getValues(); });
  const H = vals[0].map(function (h) { return String(h).trim(); });
  const c = function (h) { const i = H.indexOf(h); if (i < 0) throw new Error('Basis Master column missing: ' + h); return i; };
  const iId = c('Project ID'), iName = c('Project Name'), iCD = c('Created date - Date'), iCT = c('Created date - Time'),
        iSt = c('Stage'), iOff = c('Office'), iReg = c('Region'), iSub = c('Submitted $'), iPen = c('Pending $'),
        iAw = c('Awarded date - Date'), iLo = c('Lost date - Date');
  const out = [];
  for (let r = 1; r < vals.length; r++) {
    const v = vals[r];
    if (!v[iId]) continue;
    const reg = String(v[iReg] || '').trim() || OFF2REG[String(v[iOff] || '').trim()] || 'Unassigned';
    const pen = Number(v[iPen]) || 0, sub = Number(v[iSub]) || 0;
    out.push({ id: String(v[iId]), name: String(v[iName]).trim(), stage: String(v[iSt]).trim(),
               region: REGIONS.indexOf(reg) >= 0 ? reg : 'Unassigned', value: pen > 0 ? pen : sub,
               created: bd_parseET_(v[iCD], v[iCT]), awardedIso: bd_iso_(v[iAw]), lostIso: bd_iso_(v[iLo]) });
  }
  return out;
}
function bd_parseET_(dv, tv) {            // "M/d/yyyy" + "h:mm a" (ET), or Sheets Date values -> Date
  let y, mo, d;
  if (dv instanceof Date) { y = dv.getFullYear(); mo = dv.getMonth(); d = dv.getDate(); }
  else {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dv || '').trim());
    if (!m) return new Date(0);
    y = Number(m[3]); mo = Number(m[1]) - 1; d = Number(m[2]);
  }
  let hh = 0, mm = 0;
  if (tv instanceof Date) { hh = tv.getHours(); mm = tv.getMinutes(); }
  else {
    const t = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(tv || '').trim());
    if (t) { hh = Number(t[1]) % 12 + (/p/i.test(t[3]) ? 12 : 0); mm = Number(t[2]); }
  }
  return new Date(y, mo, d, hh, mm);
}
function bd_iso_(dv) {
  if (dv instanceof Date) return Utilities.formatDate(dv, BD.TZ, 'yyyy-MM-dd');
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dv || '').trim());
  return m ? m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : '';
}
function bd_readTransitions_(ss) {
  const sh = ss.getSheetByName(BD.TRANS);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().map(function (r) {
    return { pid: String(r[1]), at: new Date(r[2]), from: String(r[3]), to: String(r[4]) };
  });
}
function bd_knownActivityIds_(ss) {
  const sh = ss.getSheetByName(BD.TRANS); const k = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { k[r[0]] = 1; });
  return k;
}
function bd_appendTransitions_(ss, rows, known) {
  const fresh = rows.filter(function (r) { if (known[r[0]]) return false; known[r[0]] = 1; return true; });
  if (fresh.length) {
    const sh = ss.getSheetByName(BD.TRANS);
    sh.getRange(sh.getLastRow() + 1, 1, fresh.length, 5).setValues(fresh);
  }
  return fresh.length;
}
function bd_writeLast_(ss, master) {
  const sh = ss.getSheetByName(BD.LAST);
  const rows = master.map(function (p) { return [p.id, p.stage]; });
  const prev = sh.getLastRow();
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  if (prev > rows.length + 1) sh.getRange(rows.length + 2, 1, prev - rows.length - 1, 2).clearContent();
}
function bd_meta_(ss, key, val) {
  const sh = ss.getSheetByName(BD.META);
  const keys = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return r[0]; }) : [];
  const i = keys.indexOf(key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(val); else sh.appendRow([key, val]);
}
function bd_metaGet_(ss, key) {
  const sh = ss.getSheetByName(BD.META); if (!sh || sh.getLastRow() < 2) return '';
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().filter(function (r) { return r[0] === key; });
  return v.length ? v[0][1] : '';
}

/* ============================ API ============================ */
// Stage-change rows [activityId, projectId, changedAtISO, from, to] for a few projects (parallel).
function bd_fetchStageChanges_(ids) {
  const key = PropertiesService.getScriptProperties().getProperty('BASIS_API_KEY');
  if (!key) throw new Error('Set Script Property BASIS_API_KEY.');
  let pending = ids.slice(), rows = [];
  for (let attempt = 1; pending.length && attempt <= 6; attempt++) {
    const reqs = pending.map(function (id) {
      return { url: BD.API + '/projects/' + id + '/activities', headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true };
    });
    const resps = UrlFetchApp.fetchAll(reqs);
    const retry = []; let wait = 0;
    resps.forEach(function (r, i) {
      const code = r.getResponseCode();
      if (code === 200) {
        (JSON.parse(r.getContentText()).activities || []).forEach(function (a) {
          if (a.type !== 'project_stage_changed' || a.createdAt < BD.HISTORY_FROM) return;
          const d = a.activityData || {};
          rows.push([a.id, pending[i], a.createdAt, d.oldStage || '', d.newStage || '']);
        });
      } else if (code === 404) {
        // project deleted — nothing to record
      } else {
        retry.push(pending[i]);
        if (code === 429) wait = Math.max(wait, Number(r.getAllHeaders()['Retry-After']) || 5);
      }
    });
    pending = retry;
    if (pending.length) Utilities.sleep(Math.max(wait, attempt * 2) * 1000);
    else Utilities.sleep(350);
  }
  if (pending.length) throw new Error('Activity fetch failed after retries for ' + pending.length + ' project(s).');
  return rows;
}

function bd_removeTriggers_(fn) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t); });
}

// Manual helpers
function bdClearCache() { CacheService.getScriptCache().remove('bd_data_v1'); }
function bdStatus() {
  const ss = bd_ss_(); const sh = ss.getSheetByName(BD.META);
  Logger.log(JSON.stringify(sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 2).getDisplayValues()));
  Logger.log('History rows: ' + (ss.getSheetByName(BD.TRANS).getLastRow() - 1));
}
