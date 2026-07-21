/**
 * OPTILINE — ESTIMATOR SCORECARD PDF GENERATOR  (v2)
 * =============================================================
 * Source:   "Basis Master" (BasisBoard export) + "Targets" sheet.
 * Targets:  Targets!A64:I81 —
 *             A:B  OE Pipeline by Estimator (end-of-2026 target $)
 *             E:F  2026 Awards by Estimator (annual target $)
 *             H:I  2026 New Bids by Estimator (annual created-$ target)
 * Output:   Team Summary grouped by Chief Estimator + one page per
 *           estimator with RYG scorecard, diagnostics, charts, BasisBoard
 *           accuracy line, and a blank recovery-plan box for the 1:1.
 *
 * ALL ACTUALS AND TARGETS ARE CURRENT CALENDAR YEAR (2026) ONLY.
 * Annual targets are prorated to the current week for grading, except the
 * pipeline target, which is an end-of-year balance goal.
 */

const CONFIG = {
  SPREADSHEET_ID: '1f8KrpUTLRi2_pgHTBZwapB8Ar5NEacHvR46gNVFblrw',
  DATA_SHEET: 'Basis Master',
  TARGETS_SHEET: 'Targets',
  TARGETS_RANGE: 'A64:N81',   // A:B pipeline, E:F awards, H:I new bids, L:N roster (Estimator | Start Date | Assigned CE)

  // ---- Web app access: Chief Estimators only (lowercase) ----
  WEB_APP_ALLOWED: [
    'leo@optiline.co',
    'smit@optiline.co',
    'wheaton@optiline.co',
    'john@optiline.co',
    'parth@optiline.co',
  ],

  // ---- Basis Master columns, by letter ----
  COL: {
    projectName:   'B',
    created:       'C',   // Bid Created Date
    deadline:      'E',   // Bid Deadline
    deadlineTime:  'F',
    estimator:     'T',
    stage:         'U',
    submitted:     'W',   // Actual Bid Submitted Date
    submittedTime: 'X',
    awarded:       'Y',   // Actual Bid Awarded Date
    lost:          'AA',  // Lost Date
    chiefEst:      'AG',  // Chief Estimator
    projectedCost: 'AV',
    region:        'BQ',
    company:       'CB',
    submittedAmt:  'CJ',  // Submitted $
    pendingAmt:    'CK',  // Pending $ (open pipeline amount)
  },

  // Columns that must be filled on OPEN SUBMITTED bids (BasisBoard accuracy)
  ACCURACY_COLS: [
    ['CG', 'Contact name'],   ['CB', 'Company name'],   ['BQ', 'Region'],
    ['AV', 'Projected Cost'], ['AW', 'Bid Gross Profit'],['AU', '# of Floors'],
    ['AT', 'Finished SF'],    ['AS', 'Project Category'],['AO', 'OE Start Date'],
    ['AQ', 'OE End Date'],    ['AM', 'Follow Up Date'], ['AH', 'BD Manager'],
    ['AG', 'Chief Estimator'],['AC', 'Office'],         ['W', 'Submitted Date'],
    ['O', 'Location'],        ['P', 'State'],
  ],

  // Stages EXCLUDED from the "bids due next N weeks" coverage window
  PIPELINE_DUE_EXCLUDE: ['awarded', 'lost', 'ours to lose', 'hot prospect', 'submitted'],

  TREND_WEEKS: 12,
  PIPELINE_WEEKS: 4,

  // ---- Thresholds ----
  TARGET_GREEN: 1.00, TARGET_YELLOW: 0.80,
  LATE_YELLOW: 0.05,  LATE_RED: 0.10,
  ACC_GREEN: 0.95,    ACC_YELLOW: 0.85,

  ANNUAL_WEEKS: 52,
  DRIVE_FOLDER: 'Estimator Scorecards',
};

/** Works both from the sheet menu and from the web app. */
function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/* ================================================================
 * MENU
 * ================================================================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Scorecards')
    .addItem('Generate Combined PDF (Drive)', 'menuCombinedPdf')
    .addItem('Generate Individual PDFs — ZIP (Drive)', 'menuZip')
    .addToUi();
}

function menuCombinedPdf() { showLink_(saveToDrive_(buildCombinedPdf_()), 'Combined scorecard PDF saved.'); }
function menuZip() { showLink_(saveToDrive_(buildZip_()), 'Individual scorecard PDFs (ZIP) saved.'); }

function showLink_(file, msg) {
  const html = HtmlService.createHtmlOutput(
    '<p style="font-family:Arial">' + msg + '</p>' +
    '<p><a href="' + file.getUrl() + '" target="_blank">Open ' + file.getName() + '</a></p>')
    .setWidth(420).setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, 'Scorecards');
}

function saveToDrive_(blob) {
  const it = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER);
  return folder.createFile(blob);
}

/* ================================================================
 * WEB APP  (Chief Estimators only)
 * ================================================================ */
function doGet() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!isAllowed_(email)) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:Arial;max-width:480px;margin:60px auto;text-align:center">' +
      '<h2 style="color:#E1251B">Access restricted</h2>' +
      '<p>This tool is limited to Optiline Chief Estimators.</p>' +
      '<p style="color:#666">Signed in as: ' + (email || 'unknown') + '</p></div>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutput(webAppHtml_(email))
    .setTitle('Optiline Estimator Scorecards')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // embeddable in the OE Dashboard tile viewer
}

function isAllowed_(email) {
  return CONFIG.WEB_APP_ALLOWED.map(function(e){return e.toLowerCase();}).indexOf(email) !== -1;
}
function assertAllowed_() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!isAllowed_(email)) throw new Error('Access denied for ' + email);
}

function getCombinedPdfB64() {
  assertAllowed_();
  const blob = buildCombinedPdf_();
  return { name: blob.getName(), b64: Utilities.base64Encode(blob.getBytes()) };
}
function getZipB64() {
  assertAllowed_();
  const blob = buildZip_();
  return { name: blob.getName(), b64: Utilities.base64Encode(blob.getBytes()) };
}

function webAppHtml_(email) {
  return '<!DOCTYPE html><html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;background:#111;color:#fff;margin:0}' +
    '.wrap{max-width:520px;margin:60px auto;padding:32px;text-align:center}' +
    'h1{font-size:22px;letter-spacing:2px}h1 span{color:#E1251B}' +
    'button{display:block;width:100%;margin:14px 0;padding:16px;font-size:15px;font-weight:bold;' +
    'background:#E1251B;color:#fff;border:none;border-radius:6px;cursor:pointer}' +
    'button:disabled{background:#555}' +
    '.sub{color:#aaa;font-size:12px}#status{margin-top:16px;color:#aaa;font-size:13px}' +
    '</style></head><body><div class="wrap">' +
    '<h1>OPTILINE <span>&#9656;</span> ESTIMATOR SCORECARDS</h1>' +
    '<p class="sub">Signed in as ' + email + ' &middot; ' + (new Date()).getFullYear() + ' actuals vs. targets</p>' +
    '<button id="b1" onclick="dl(\'getCombinedPdfB64\',\'application/pdf\')">Download Combined PDF (one page per estimator)</button>' +
    '<button id="b2" onclick="dl(\'getZipB64\',\'application/zip\')">Download Individual PDFs (ZIP)</button>' +
    '<div id="status"></div></div>' +
    '<script>' +
    'function dl(fn,mime){var s=document.getElementById("status");s.textContent="Building report\\u2026 this can take a minute.";' +
    'document.querySelectorAll("button").forEach(function(b){b.disabled=true});' +
    'google.script.run.withSuccessHandler(function(r){' +
    'var a=document.createElement("a");a.href="data:"+mime+";base64,"+r.b64;a.download=r.name;' +
    'document.body.appendChild(a);a.click();a.remove();s.textContent="Downloaded "+r.name;' +
    'document.querySelectorAll("button").forEach(function(b){b.disabled=false});' +
    '}).withFailureHandler(function(e){s.textContent="Error: "+e.message;' +
    'document.querySelectorAll("button").forEach(function(b){b.disabled=false});' +
    '})[fn]();}' +
    '</script></body></html>';
}

/* ================================================================
 * TARGETS  (Targets!A64:I81 — three name/target lists)
 * ================================================================ */
function normName_(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

function getTargets_() {
  const sh = ss_().getSheetByName(CONFIG.TARGETS_SHEET);
  if (!sh) throw new Error('Sheet "' + CONFIG.TARGETS_SHEET + '" not found.');
  const vals = sh.getRange(CONFIG.TARGETS_RANGE).getValues();

  // 1) Roster comes from L:N — L Estimator, M Start Date, N Assigned Chief Estimator.
  const out = {}; // normName -> {name, start, ce, pipeline, awards, created}
  vals.forEach(function(r) {
    const name = String(r[11] || '').trim();
    if (!name || /^estimator$/i.test(name)) return;
    out[normName_(name)] = {
      name: name,
      start: toDate_(r[12]),
      ce: String(r[13] || '').trim(),
      pipeline: 0, awards: 0, created: 0,
    };
  });
  if (!Object.keys(out).length) {
    throw new Error('No estimators found in ' + CONFIG.TARGETS_SHEET + '!L65:N81 — roster is defined there.');
  }

  // 2) Attach targets by name; names not on the L:N roster are ignored.
  const put = function(name, key, val) {
    const k = normName_(String(name || '').trim());
    if (out[k]) { const n = toMoney_(val); if (n > 0) out[k][key] = n; }
  };
  vals.forEach(function(r) {
    put(r[0], 'pipeline', r[1]);  // A:B
    put(r[4], 'awards',   r[5]);  // E:F
    put(r[7], 'created',  r[8]);  // H:I
  });
  return out;
}

/* ================================================================
 * DATA LOADING  (fixed column letters)
 * ================================================================ */
function colIdx_(letter) { // 'A'->0
  let n = 0;
  letter = letter.toUpperCase();
  for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
  return n - 1;
}

function toDate_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === 'string' && v.trim()) { const d = new Date(v); if (!isNaN(d)) return d; }
  return null;
}
function toMoney_(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}
function combineDT_(d, t) {
  if (!d) return null;
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
  if (t instanceof Date && !isNaN(t)) out.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return out;
}
function filled_(v) {
  if (v === null || v === undefined) return false;
  if (v instanceof Date) return !isNaN(v);
  if (typeof v === 'number') return v !== 0;
  return String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'n/a';
}

function loadRows_() {
  const sh = ss_().getSheetByName(CONFIG.DATA_SHEET);
  if (!sh) throw new Error('Sheet "' + CONFIG.DATA_SHEET + '" not found.');
  const values = sh.getDataRange().getValues();
  const C = CONFIG.COL;
  const g = function(row, letter) { const i = colIdx_(letter); return i < row.length ? row[i] : ''; };
  return values.slice(1).map(function(r) {
    const dl = toDate_(g(r, C.deadline));
    const sub = toDate_(g(r, C.submitted));
    return {
      raw: r,
      estimator: String(g(r, C.estimator)).trim(),
      stage: String(g(r, C.stage)).trim().toLowerCase(),
      projectName: String(g(r, C.projectName)).trim(),
      company: String(g(r, C.company)).trim(),
      region: String(g(r, C.region)).trim(),
      chiefEst: String(g(r, C.chiefEst)).trim(),
      cost: toMoney_(g(r, C.projectedCost)),
      subAmt: toMoney_(g(r, C.submittedAmt)),
      pendAmt: toMoney_(g(r, C.pendingAmt)),
      created: toDate_(g(r, C.created)),
      deadline: dl,
      deadlineDT: combineDT_(dl, g(r, C.deadlineTime)),
      submitted: sub,
      submittedDT: combineDT_(sub, g(r, C.submittedTime)),
      awarded: toDate_(g(r, C.awarded)),
      lost: toDate_(g(r, C.lost)),
    };
  }).filter(function(r) { return r.estimator; });
}

/* ================================================================
 * DATE HELPERS
 * ================================================================ */
function weekStart_(d) { // Monday
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}
function addDays_(d, n) { const o = new Date(d); o.setDate(o.getDate() + n); return o; }
function fmtD_(d) { return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'M/d') : ''; }
function fmtDFull_(d) { return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'M/d/yyyy') : ''; }

/* ================================================================
 * METRICS  (current calendar year only)
 * ================================================================ */
function computeMetrics_(rows, name, tgt, today) {
  const yr = today.getFullYear();
  const jan1 = new Date(yr, 0, 1);
  const inYr = function(d) { return d && d >= jan1 && d <= today; };
  const nk = normName_(name);
  const mine = rows.filter(function(r) { return normName_(r.estimator) === nk; });

  const curWk = weekStart_(today);
  const weeksElapsed = Math.max(1, Math.round((curWk - weekStart_(jan1)) / (7 * 86400000)) + 1);
  const remainingWeeks = Math.max(1, CONFIG.ANNUAL_WEEKS - weeksElapsed);

  // Employment start date (Targets L:M): prorate targets over employed weeks only.
  const start = tgt.start || null;
  const startsThisYear = start && start > jan1;
  let weeksEmployed = weeksElapsed;
  if (startsThisYear) {
    weeksEmployed = start > today ? 0 :
      Math.max(1, Math.round((curWk - weekStart_(start)) / (7 * 86400000)) + 1);
    weeksEmployed = Math.min(weeksEmployed, weeksElapsed);
  }
  const prorate = weeksEmployed / CONFIG.ANNUAL_WEEKS;

  const bidVal = function(r) { return r.subAmt || r.cost; };

  // --- Created (new bids), valued at Projected Cost ---
  const created = mine.filter(function(r) { return inYr(r.created); });
  const createdYtd = created.reduce(function(a, r) { return a + r.cost; }, 0);
  const createdMo = monthArr_();
  created.forEach(function(r) { createdMo[r.created.getMonth()] += r.cost; });

  // --- Submitted, valued at Submitted $ (CJ), fallback Projected Cost ---
  const subs = mine.filter(function(r) { return inYr(r.submitted); });
  const subYtd = subs.reduce(function(a, r) { return a + bidVal(r); }, 0);
  const subWk = {};
  subs.forEach(function(r) {
    const k = weekStart_(r.submitted).getTime();
    if (!subWk[k]) subWk[k] = { d: 0, n: 0 };
    subWk[k].d += bidVal(r); subWk[k].n += 1;
  });
  const subCurWk = subWk[curWk.getTime()] ? subWk[curWk.getTime()].d : 0;
  const subCurWkN = subWk[curWk.getTime()] ? subWk[curWk.getTime()].n : 0;
  let n4 = 0, sum4 = 0;
  for (let i = 1; i <= 4; i++) {
    const ws = addDays_(curWk, -7 * i);
    if (ws < weekStart_(jan1)) break;
    n4++; sum4 += subWk[ws.getTime()] ? subWk[ws.getTime()].d : 0;
  }
  const sub4Avg = n4 ? sum4 / n4 : 0;
  const trend = [];
  for (let i = CONFIG.TREND_WEEKS - 1; i >= 0; i--) {
    const ws = addDays_(curWk, -7 * i);
    if (ws < weekStart_(jan1)) continue;
    trend.push({ label: fmtD_(ws), dol: subWk[ws.getTime()] ? subWk[ws.getTime()].d : 0 });
  }

  // --- Awarded ---
  const awds = mine.filter(function(r) { return inYr(r.awarded); });
  const awdYtd = awds.reduce(function(a, r) { return a + bidVal(r); }, 0);
  const awdMo = monthArr_();
  awds.forEach(function(r) { awdMo[r.awarded.getMonth()] += bidVal(r); });

  // --- Open pipeline (point-in-time balance, Pending $ CK) ---
  const openPipeRows = mine.filter(function(r) { return r.pendAmt > 0 && !r.awarded && !r.lost; });
  const openPipe = openPipeRows.reduce(function(a, r) { return a + r.pendAmt; }, 0);

  // --- 4-week forward coverage: bids NOT in Awarded / Lost / Ours to Lose /
  //     Hot Prospect / Submitted, with a bid deadline in the window.
  //     Valued at Submitted $ (CJ); falls back to Projected Cost when CJ is blank.
  const pipeEnd = addDays_(today, CONFIG.PIPELINE_WEEKS * 7);
  const pipe4 = mine.filter(function(r) {
    return CONFIG.PIPELINE_DUE_EXCLUDE.indexOf(r.stage) === -1 &&
           r.deadline && r.deadline >= today && r.deadline <= pipeEnd;
  });
  const pipe4Dol = pipe4.reduce(function(a, r) { return a + (r.subAmt || r.cost); }, 0);
  const pipeWeeks = [];
  for (let i = 0; i < CONFIG.PIPELINE_WEEKS; i++) {
    const ws = addDays_(weekStart_(today), 7 * i);
    const we = addDays_(ws, 7);
    const dol = pipe4.reduce(function(a, r) { return a + (r.deadline >= ws && r.deadline < we ? (r.subAmt || r.cost) : 0); }, 0);
    pipeWeeks.push({ label: 'Wk of ' + fmtD_(ws), dol: dol });
  }

  // --- Late bid % (YTD) ---
  const judged = subs.filter(function(r) { return r.deadlineDT; });
  const late = judged.filter(function(r) { return r.submittedDT > r.deadlineDT; });
  const latePct = judged.length ? late.length / judged.length : 0;

  // --- Hit ratio (YTD awards ÷ YTD submissions) ---
  const hitCnt = subs.length ? awds.length / subs.length : 0;
  const hitDol = subYtd ? awdYtd / subYtd : 0;

  // --- Turnaround ---
  const turn = subs.filter(function(r) { return r.created && r.deadline && r.deadline >= r.created; });
  const avgUsed = turn.length ? turn.reduce(function(a, r) { return a + (r.submitted - r.created) / 86400000; }, 0) / turn.length : 0;
  const avgAllot = turn.length ? turn.reduce(function(a, r) { return a + (r.deadline - r.created) / 86400000; }, 0) / turn.length : 0;

  // --- BasisBoard accuracy: open submitted bids, required columns filled ---
  const openSubmitted = mine.filter(function(r) { return r.stage === 'submitted' && !r.awarded && !r.lost; });
  let checks = 0, passed = 0;
  const missCount = {};
  openSubmitted.forEach(function(r) {
    CONFIG.ACCURACY_COLS.forEach(function(cc) {
      checks++;
      const v = r.raw[colIdx_(cc[0])];
      if (filled_(v)) passed++;
      else missCount[cc[1]] = (missCount[cc[1]] || 0) + 1;
    });
  });
  const accuracy = checks ? passed / checks : 1;
  const topMisses = Object.keys(missCount).sort(function(a, b) { return missCount[b] - missCount[a]; })
    .slice(0, 3).map(function(k) { return k + ' (' + missCount[k] + ')'; });

  // --- Chief Estimator (dominant on current-year rows) & region ---
  const activeRows = mine.filter(function(r) { return inYr(r.created) || inYr(r.submitted) || inYr(r.awarded); });
  const ceCount = {}, regCount = {};
  activeRows.forEach(function(r) {
    if (r.chiefEst) ceCount[r.chiefEst] = (ceCount[r.chiefEst] || 0) + 1;
    if (r.region) regCount[r.region] = (regCount[r.region] || 0) + 1;
  });
  const top = function(m) { const k = Object.keys(m).sort(function(a, b) { return m[b] - m[a]; }); return k[0] || ''; };

  // --- Gap math (awards = the money metric) ---
  const awdTgtToDate = tgt.awards * prorate;
  const awdGap = awdYtd - awdTgtToDate;
  const awdReqRate = Math.max(0, (tgt.awards - awdYtd) / remainingWeeks);
  const crtTgtToDate = tgt.created * prorate;
  const crtGap = createdYtd - crtTgtToDate;
  const crtReqRate = Math.max(0, (tgt.created - createdYtd) / remainingWeeks);

  return {
    name: name, tgt: tgt, yr: yr, weeksElapsed: weeksElapsed, remainingWeeks: remainingWeeks,
    start: start, startsThisYear: startsThisYear, weeksEmployed: weeksEmployed,
    chiefEst: tgt.ce || top(ceCount),  // Assigned CE from Targets N; fallback = dominant CE on their bids
    book: top(regCount),
    createdYtd: createdYtd, createdN: created.length, createdMo: createdMo,
    crtTgtToDate: crtTgtToDate, crtGap: crtGap, crtReqRate: crtReqRate,
    subYtd: subYtd, subN: subs.length, subCurWk: subCurWk, subCurWkN: subCurWkN, sub4Avg: sub4Avg, trend: trend,
    awdYtd: awdYtd, awdN: awds.length, awdMo: awdMo,
    awdTgtToDate: awdTgtToDate, awdGap: awdGap, awdReqRate: awdReqRate,
    openPipe: openPipe, openPipeN: openPipeRows.length,
    pipe4Dol: pipe4Dol, pipe4N: pipe4.length, pipeWeeks: pipeWeeks,
    latePct: latePct, lateN: late.length, judgedN: judged.length,
    hitCnt: hitCnt, hitDol: hitDol,
    avgUsed: avgUsed, avgAllot: avgAllot, turnN: turn.length,
    accuracy: accuracy, openSubN: openSubmitted.length, topMisses: topMisses,
    avgBid: subs.length ? subYtd / subs.length : 0,
  };
}
function monthArr_() { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; }

/* ================================================================
 * FORMATTING / RYG
 * ================================================================ */
function money_(n) {
  const s = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e6) return s + '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return s + '$' + Math.round(n / 1e3) + 'K';
  return s + '$' + Math.round(n);
}
function pct_(x, dp) { return (100 * x).toFixed(dp === undefined ? 0 : dp) + '%'; }
function rygColor_(s) { return s === 'G' ? '#1E8E3E' : s === 'Y' ? '#F9AB00' : '#E1251B'; }
function vsTarget_(actual, target) {
  if (!target) return 'G';
  const r = actual / target;
  return r >= CONFIG.TARGET_GREEN ? 'G' : r >= CONFIG.TARGET_YELLOW ? 'Y' : 'R';
}
function confidential_() {
  return '<p style="text-align:center;font-size:7px;color:#999999;margin-top:10px;' +
    'border-top:1px solid #DDDDDD;padding-top:4px">CONFIDENTIAL &mdash; PROPERTY OF OPTILINE ENTERPRISES. ' +
    'This report contains proprietary bid, pricing, and personnel performance data. ' +
    'Do not copy, forward, or share outside Optiline without written authorization.</p>';
}

function legend_() {
  const sq = function(c) { return '<span style="color:' + c + ';font-size:10px">&#9632;</span> '; };
  return '<p style="font-size:8px;margin-top:6px">' +
    sq('#1E8E3E') + 'at/above target &nbsp; ' +
    sq('#F9AB00') + 'within 80% of target (Late-Bid: 5&ndash;10%) &nbsp; ' +
    sq('#E1251B') + 'below 80% of target (Late-Bid: &gt;10%)</p>';
}

function chip_(s) {
  // Colored status square (glyph — survives the HTML->PDF converter)
  return '<td style="text-align:center;color:' + rygColor_(s) + ';font-size:14px">&#9632;</td>';
}

/** Bars are drawn with block glyphs — the only primitive that renders identically
 *  in Google's HTML->PDF converter (which drops div/CSS backgrounds and flattens
 *  nested tables) and in every other renderer. */
function glyphs_(n) { let s = ''; for (let i = 0; i < n; i++) s += '█'; return s; }
function bar_(k, color, dimRemainder) {
  return '<span style="color:' + color + '">' + glyphs_(k) + '</span>' +
    (dimRemainder ? '<span style="color:#DDDDDD">' + glyphs_(dimRemainder) + '</span>' : '');
}

/* ================================================================
 * HTML BUILDERS
 * ================================================================ */
function css_() {
  return '<style>' +
    '@page{size:letter;margin:26px}' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10px;margin:0}' +
    'table{border-collapse:collapse;width:100%}' +
    'th{background:#111;color:#fff;padding:4px 6px;font-size:9px;text-align:left}' +
    'td{border-bottom:1px solid #ddd;padding:4px 6px;font-size:10px}' +
    '.hdr{background:#111;color:#fff;padding:9px 12px}' +
    '.hdr h1{margin:0;font-size:15px;letter-spacing:1px}' +
    '.hdr .sub{color:#bbb;font-size:9px;margin-top:2px}' +
    '.red{color:#E1251B}' +
    '.sec{font-size:10px;font-weight:bold;margin:11px 0 3px;letter-spacing:1px;' +
    'border-left:4px solid #E1251B;padding-left:6px;text-transform:uppercase}' +
    '.callout{border:2px solid #111;background:#F4F4F4;padding:7px 9px;margin-top:6px;font-size:10px}' +
    '.plan{border:2px solid #E1251B;padding:9px;margin-top:10px}' +
    '.planline{border-bottom:1px solid #999;height:18px}' +
    '.num{text-align:right}.pb{page-break-after:always}' +
    '.grp{background:#333;color:#fff;font-weight:bold}' +
    '.subtot{background:#F4F4F4;font-weight:bold}' +
    '</style>';
}

function pageHeader_(title, subtitle) {
  // Single flat table (Google's converter flattens nested tables). Logo cell white,
  // title cell dark via bgcolor attr; text stays legible even if shading is dropped
  // because the title uses black text on a bottom-ruled band instead of white-on-black.
  return '<table cellpadding="0" cellspacing="0" width="100%" style="border-bottom:3px solid #E1251B"><tr>' +
    '<td width="73" style="border:none;padding:4px 7px;vertical-align:middle">' +
    '<img src="data:image/png;base64,' + LOGO_B64 + '" width="59" height="22"></td>' +
    '<td style="border:none;padding:6px 0 6px 10px;vertical-align:middle">' +
    '<h1 style="margin:0;font-size:15px;letter-spacing:1px;color:#111111">OPTILINE <span style="color:#E1251B">&#9656;</span> ' + title + '</h1>' +
    '<div style="color:#666666;font-size:9px;margin-top:2px">' + subtitle + '</div></td>' +
    '</tr></table>';
}

/** Bar chart as horizontal glyph bars, one row per period. perBarTarget colors red below / black at-or-above. */
function barChart_(data, perBarTarget, unused, note) {
  const max = Math.max(perBarTarget || 0, data.reduce(function(a, d) { return Math.max(a, d.dol); }, 0), 1);
  const GMAX = 20;
  let rows = '';
  data.forEach(function(d) {
    const k = Math.max(1, Math.round((d.dol / max) * GMAX));
    const color = !perBarTarget ? '#607080' : (d.dol >= perBarTarget ? '#1E8E3E' : '#E1251B');
    rows += '<tr><td style="border:none;width:34px;font-size:8px;color:#666;padding:0 4px 0 0;white-space:nowrap">' + d.label + '</td>' +
      '<td style="border:none;padding:0;font-size:8px;white-space:nowrap">' +
      (d.dol ? bar_(k, color, 0) + ' <span style="font-size:7px;color:#666">' + money_(d.dol) + '</span>'
             : '<span style="color:#DDDDDD">' + glyphs_(1) + '</span>') +
      '</td></tr>';
  });
  return '<table cellpadding="0" cellspacing="0" width="100%">' + rows + '</table>' +
         (note ? '<div style="font-size:8px;color:#666;margin-top:1px">' + note + '</div>' : '');
}

/** Horizontal glyph bars (pipeline weeks). */
function hBarChart_(data) {
  const max = Math.max(data.reduce(function(a, d) { return Math.max(a, d.dol); }, 0), 1);
  const GMAX = 16;
  let rows = '';
  data.forEach(function(d) {
    const k = Math.max(1, Math.round((d.dol / max) * GMAX));
    rows += '<tr><td style="border:none;width:60px;font-size:8px;color:#666;padding:0 4px 0 0;white-space:nowrap">' + d.label + '</td>' +
      '<td style="border:none;padding:0;font-size:8px;white-space:nowrap">' +
      (d.dol ? bar_(k, '#607080', 0) + ' <span style="font-size:7px;color:#666">' + money_(d.dol) + '</span>'
             : '<span style="color:#DDDDDD">' + glyphs_(1) + '</span> <span style="font-size:7px;color:#666">$0</span>') +
      '</td></tr>';
  });
  return '<table cellpadding="0" cellspacing="0" width="100%">' + rows + '</table>';
}

/** Progress bar: colored glyph fill + light-gray remainder. */
function progressBar_(label, actual, target, status) {
  const GMAX = 24;
  const p = target ? Math.min(1, actual / target) : 0;
  const k = Math.round(p * GMAX);
  const pctTxt = target ? pct_(actual / target) : 'n/a';
  return '<tr><td style="border:none;width:180px;font-size:9px;padding:3px 6px 3px 0">' + label + '</td>' +
    '<td style="border:none;padding:3px 0;font-size:11px;white-space:nowrap">' + bar_(k, rygColor_(status), GMAX - k) + '</td>' +
    '<td style="border:none;width:170px;font-size:9px;padding:3px 0 3px 8px" class="num">' +
    money_(actual) + ' of ' + money_(target) + ' &nbsp;(<b style="color:' + rygColor_(status) + '">' + pctTxt + '</b>)</td></tr>';
}

const MO_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function moData_(arr) { return arr.map(function(v, i) { return { label: MO_LABELS[i], dol: v }; }); }

function estimatorPage_(m, today, teamHitAvg) {
  const t = m.tgt;
  const crtStatus = vsTarget_(m.createdYtd, m.crtTgtToDate);
  const awdStatus = vsTarget_(m.awdYtd, m.awdTgtToDate);
  const pipeStatus = vsTarget_(m.openPipe, t.pipeline);
  const lateStatus = m.latePct > CONFIG.LATE_RED ? 'R' : m.latePct > CONFIG.LATE_YELLOW ? 'Y' : 'G';
  const accStatus = m.accuracy >= CONFIG.ACC_GREEN ? 'G' : m.accuracy >= CONFIG.ACC_YELLOW ? 'Y' : 'R';
  const turnNote = m.avgAllot && m.avgAllot < 5 ? ' — short windows: check assignment timing (CE issue, not estimator)' : '';

  const gapSentence = 'Through week ' + m.weeksElapsed + ' of ' + m.yr +
    (m.startsThisYear ? ' (employed ' + m.weeksEmployed + ' wks — targets prorated from ' + fmtDFull_(m.start) + ')' : '') +
    ': awarded <b>' + money_(m.awdYtd) +
    '</b> vs. prorated target <b>' + money_(m.awdTgtToDate) + '</b> &rarr; ' +
    (m.awdGap >= 0 ? '<b style="color:#1E8E3E">ahead by ' + money_(m.awdGap) + '</b>.'
                   : '<b style="color:#E1251B">behind by ' + money_(-m.awdGap) + '</b>.') +
    ' To reach the ' + money_(t.awards) + ' annual award target, required run-rate is <b>' + money_(m.awdReqRate) +
    '/wk awarded</b> for the remaining ' + m.remainingWeeks + ' weeks. New-bid creation: ' + money_(m.createdYtd) +
    ' vs. ' + money_(m.crtTgtToDate) + ' prorated (' + (m.crtGap >= 0 ? 'ahead ' + money_(m.crtGap) : 'behind ' + money_(-m.crtGap)) +
    '; needs ' + money_(m.crtReqRate) + '/wk created).';

  return '<div class="pb">' +
    pageHeader_('ESTIMATOR SCORECARD', '<b style="color:#111111;font-size:11px">' + m.name + '</b>' +
      (m.chiefEst ? ' &middot; Chief Estimator: ' + m.chiefEst : '') +
      (m.book ? ' &middot; Book: ' + m.book : '') +
      (m.startsThisYear ? ' &middot; Started ' + fmtDFull_(m.start) + ' (targets prorated to ' + m.weeksEmployed + ' employed wks)' : '') +
      ' &middot; ' + m.yr + ' YTD &middot; Generated ' + fmtDFull_(today)) +

    '<div class="sec">Core Scorecard — ' + m.yr + ' Targets</div>' +
    '<table>' + progressBar_('<b>Awarded $</b> vs prorated target', m.awdYtd, m.awdTgtToDate, awdStatus) +
    progressBar_('<b>New Bids Created $</b> vs prorated target', m.createdYtd, m.crtTgtToDate, crtStatus) +
    progressBar_('<b>Open Pipeline $</b> vs end-of-' + m.yr + ' target', m.openPipe, t.pipeline, pipeStatus) + '</table>' +

    '<table style="margin-top:5px"><tr><th>Metric</th><th class="num">Value</th><th class="num">Threshold / Target</th><th style="text-align:center">Status</th></tr>' +
    '<tr><td><b>Late-Bid %</b> <span style="color:#666;font-size:8px">(&gt;' + pct_(CONFIG.LATE_RED) +
    ' triggers root-cause discussion)</span></td><td class="num">' + pct_(m.latePct, 1) + ' (' + m.lateN + ' of ' + m.judgedN +
    ')</td><td class="num">&le; ' + pct_(CONFIG.LATE_RED) + '</td>' + chip_(lateStatus) + '</tr>' +
    '<tr><td><b>Submitted $ YTD</b> (' + m.subN + ' bids &middot; this wk: ' + money_(m.subCurWk) + '/' + m.subCurWkN +
    ' &middot; 4-wk avg: ' + money_(m.sub4Avg) + '/wk)</td><td class="num">' + money_(m.subYtd) +
    '</td><td class="num" style="color:#666">feeds awards + pipeline</td><td></td></tr>' +
    '<tr><td><b>Annual award target</b></td><td class="num">' + money_(t.awards) + '</td><td class="num" style="color:#666">Targets tab</td><td></td></tr></table>' +
    '<div class="callout">' + gapSentence + '</div>' +

    '<div class="sec">Diagnostic</div>' +
    '<table><tr><th>Metric</th><th class="num">Value</th><th>Read</th></tr>' +
    '<tr><td>Bid count / avg size (YTD submitted)</td><td class="num">' + m.subN + ' / ' + money_(m.avgBid) +
    '</td><td style="color:#666">High count + low $ = buried in small bids (assignment mix, not effort)</td></tr>' +
    '<tr><td>Hit ratio — count (YTD)</td><td class="num">' + pct_(m.hitCnt, 1) +
    '</td><td style="color:#666">$-weighted: ' + pct_(m.hitDol, 1) + ' &middot; team avg ' + pct_(teamHitAvg, 1) +
    ' — read against their book/market, not raw</td></tr>' +
    '<tr><td>Bids due next ' + CONFIG.PIPELINE_WEEKS + ' wks — open bids in working stages</td><td class="num">' +
    money_(m.pipe4Dol) + ' (' + m.pipe4N + ')</td><td style="color:#666">Predicts next month\'s Submitted $ before it happens</td></tr>' +
    '<tr><td>Turnaround — days used vs. allotted</td><td class="num">' + m.avgUsed.toFixed(1) + ' / ' + m.avgAllot.toFixed(1) +
    '</td><td style="color:#666">n=' + m.turnN + turnNote + '</td></tr></table>' +

    '<div class="sec">Data Integrity</div>' +
    '<table><tr><td><b>BasisBoard accuracy</b> — required fields on ' + m.openSubN + ' open submitted bids' +
    (m.topMisses.length ? ' <span style="color:#E1251B;font-size:8px">Top gaps: ' + m.topMisses.join(', ') + '</span>' : '') +
    ' <span style="color:#666;font-size:8px">(no entry = no credit)</span></td>' +
    '<td class="num" style="width:60px">' + pct_(m.accuracy) + '</td>' + chip_(accStatus) + '</tr></table>' +

    '<table style="margin-top:8px"><tr>' +
    '<td style="border:none;width:50%;vertical-align:top"><div class="sec">Awarded $ by Month vs Target</div>' +
    barChart_(moData_(m.awdMo), m.tgt.awards / 12, 52, 'Monthly target: ' + money_(m.tgt.awards / 12) + ' &middot; green = at/above, red = below') + '</td>' +
    '<td style="border:none;width:50%;vertical-align:top;padding-left:10px"><div class="sec">New Bids Created $ by Month vs Target</div>' +
    barChart_(moData_(m.createdMo), m.tgt.created / 12, 52, 'Monthly target: ' + money_(m.tgt.created / 12) + ' &middot; green = at/above, red = below') + '</td></tr>' +
    '<tr><td style="border:none;vertical-align:top"><div class="sec">Weekly Submitted $ — Last ' + CONFIG.TREND_WEEKS + ' Wks</div>' +
    barChart_(m.trend, 0, 52) + '</td>' +
    '<td style="border:none;vertical-align:top;padding-left:10px"><div class="sec">Pipeline Due — Next ' + CONFIG.PIPELINE_WEEKS +
    ' Weeks</div>' + hBarChart_(m.pipeWeeks) + '</td></tr></table>' +

    '<div class="plan"><b>ESTIMATOR\'S STATED PLAN TO CLOSE THE GAP</b> ' +
    '<span style="color:#666;font-size:8px">— filled in by the estimator, in the meeting, on the record</span>' +
    '<div class="planline"></div><div class="planline"></div><div class="planline"></div>' +
    '<table style="margin-top:6px"><tr>' +
    '<td style="border:none;font-size:9px">Owner: ______________________</td>' +
    '<td style="border:none;font-size:9px">Review date: ______________________</td>' +
    '<td style="border:none;font-size:9px">CE initials: ____________</td></tr></table></div>' +
    commitmentsBlock_() +
    legend_() +
    confidential_() +
    '</div>';
}

/** Committed Action Review — hand-filled in the 1:1: were last meeting's commitments carried out? */
function commitmentsBlock_() {
  const line = '<table cellpadding="0" cellspacing="0" width="100%"><tr>' +
    '<td style="border:none;border-bottom:1px solid #999;height:18px;font-size:9px">&nbsp;</td>' +
    '<td width="130" style="border:none;border-bottom:1px solid #999;font-size:9px;text-align:right;color:#666">' +
    '&#9744; Done &nbsp; &#9744; Open</td></tr></table>';
  return '<div style="border:2px solid #111111;padding:9px;margin-top:8px">' +
    '<b>COMMITTED ACTION REVIEW</b> ' +
    '<span style="color:#666;font-size:8px">— last meeting\'s commitments: carried out or still open?</span>' +
    line + line + line + '</div>';
}

/* ---------- Team summary, grouped by Chief Estimator ---------- */
function summaryPage_(list, today) {
  const yr = list[0].yr, wk = list[0].weeksElapsed;
  // group
  const groups = {};
  list.forEach(function(m) {
    const ce = m.chiefEst || '(No Assigned CE on Targets L:N)';
    if (!groups[ce]) groups[ce] = [];
    groups[ce].push(m);
  });
  let body = '';
  Object.keys(groups).sort().forEach(function(ce) {
    body += '<tr><td bgcolor="#333333" colspan="12" style="color:#ffffff;font-weight:bold">CHIEF ESTIMATOR: ' + ce.toUpperCase() + '</td></tr>';
    const tot = { crt: 0, crtT: 0, sub: 0, awd: 0, awdT: 0, pipe: 0, pipeT: 0 };
    groups[ce].forEach(function(m) {
      const awdStatus = vsTarget_(m.awdYtd, m.awdTgtToDate);
      const lateStatus = m.latePct > CONFIG.LATE_RED ? 'R' : m.latePct > CONFIG.LATE_YELLOW ? 'Y' : 'G';
      tot.crt += m.createdYtd; tot.crtT += m.crtTgtToDate; tot.sub += m.subYtd;
      tot.awd += m.awdYtd; tot.awdT += m.awdTgtToDate; tot.pipe += m.openPipe; tot.pipeT += m.tgt.pipeline;
      body += '<tr><td>' + m.name + '</td>' +
        '<td class="num">' + money_(m.createdYtd) + '</td>' +
        '<td class="num">' + (m.crtTgtToDate ? pct_(m.createdYtd / m.crtTgtToDate) : '—') + '</td>' +
        '<td class="num">' + money_(m.subYtd) + '</td>' +
        '<td class="num">' + money_(m.awdYtd) + '</td>' +
        '<td class="num">' + (m.awdTgtToDate ? pct_(m.awdYtd / m.awdTgtToDate) : '—') + '</td>' +
        '<td class="num">' + money_(m.openPipe) + '</td>' +
        '<td class="num">' + (m.tgt.pipeline ? pct_(m.openPipe / m.tgt.pipeline) : '—') + '</td>' +
        '<td class="num">' + pct_(m.latePct, 1) + '</td>' +
        '<td class="num">' + pct_(m.accuracy) + '</td>' +
        chip_(awdStatus) + chip_(lateStatus) + '</tr>';
    });
    const strow = '<tr><td><b>Subtotal</b></td>' +
      '<td class="num"><b>' + money_(tot.crt) + '</b></td>' +
      '<td class="num"><b>' + (tot.crtT ? pct_(tot.crt / tot.crtT) : '—') + '</b></td>' +
      '<td class="num"><b>' + money_(tot.sub) + '</b></td>' +
      '<td class="num"><b>' + money_(tot.awd) + '</b></td>' +
      '<td class="num"><b>' + (tot.awdT ? pct_(tot.awd / tot.awdT) : '—') + '</b></td>' +
      '<td class="num"><b>' + money_(tot.pipe) + '</b></td>' +
      '<td class="num"><b>' + (tot.pipeT ? pct_(tot.pipe / tot.pipeT) : '—') + '</b></td>' +
      '<td colspan="4"></td></tr>';
    body += strow.replace(/<td/g, '<td bgcolor="#EEEEEE"');
  });
  return '<div class="pb">' +
    pageHeader_('PRECON TEAM SUMMARY — BY CHIEF ESTIMATOR',
      yr + ' YTD through week ' + wk + ' &middot; current-year actuals vs. targets &middot; Generated ' + fmtDFull_(today)) +
    '<div class="sec">Estimators Grouped Under Their Chief Estimator</div>' +
    '<table><tr><th>Estimator</th><th class="num">Created YTD</th><th class="num">vs Tgt</th>' +
    '<th class="num">Submitted YTD</th><th class="num">Awarded YTD</th><th class="num">vs Tgt</th>' +
    '<th class="num">Open Pipeline</th><th class="num">vs EOY Tgt</th><th class="num">Late %</th>' +
    '<th class="num">BB Acc</th><th style="text-align:center">Awards</th><th style="text-align:center">Late</th></tr>' +
    body + '</table>' +
    legend_() +
    '<p style="color:#666;font-size:8px;margin-top:4px">Created/Awarded graded vs. annual targets prorated to week ' + wk +
    ' of ' + CONFIG.ANNUAL_WEEKS + '; Open Pipeline graded vs. end-of-year target. $ values: Created = Projected Cost, ' +
    'Submitted/Awarded = Submitted $ (CJ), Pipeline = Pending $ (CK). Roster and Chief Estimator assignments come from ' +
    'Targets L:N; mid-year hires are graded on targets prorated from their start date. Hit ratios read against each estimator\'s book, not raw. ' +
    'Source: "' + CONFIG.DATA_SHEET + '" + Targets rows 64–81. No entry in BasisBoard = no credit.</p>' +
    confidential_() + '</div>';
}

/* ================================================================
 * PDF ASSEMBLY
 * ================================================================ */
function buildAllMetrics_() {
  const today = new Date();
  const rows = loadRows_();
  const targets = getTargets_();
  const list = Object.keys(targets)
    .map(function(k) { return targets[k]; })
    .sort(function(a, b) { return a.name < b.name ? -1 : 1; })
    .map(function(t) { return computeMetrics_(rows, t.name, t, today); });
  if (!list.length) throw new Error('No estimators found in Targets.');
  const withSubs = list.filter(function(m) { return m.subN > 0; });
  const teamHitAvg = withSubs.length ? withSubs.reduce(function(a, m) { return a + m.hitCnt; }, 0) / withSubs.length : 0;
  return { list: list, today: today, teamHitAvg: teamHitAvg };
}

/** The HTML->PDF converter ignores CSS classes — force header styling inline.
 *  White-on-black via bgcolor attr, with inline color so it renders either way. */
function pdfSafe_(html) {
  return html
    .replace(/<th style="/g, '<th bgcolor="#111111" style="color:#ffffff;')
    .replace(/<th class="num">/g, '<th bgcolor="#111111" class="num" style="color:#ffffff">')
    .replace(/<th>/g, '<th bgcolor="#111111" style="color:#ffffff">');
}

function buildCombinedPdf_() {
  const a = buildAllMetrics_();
  let html = '<html><head><meta charset="UTF-8">' + css_() + '</head><body>';
  html += summaryPage_(a.list, a.today);
  a.list.forEach(function(m) { html += estimatorPage_(m, a.today, a.teamHitAvg); });
  html += '</body></html>';
  const name = 'Estimator_Scorecards_' + Utilities.formatDate(a.today, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.pdf';
  return Utilities.newBlob(pdfSafe_(html), MimeType.HTML, name).getAs(MimeType.PDF).setName(name);
}

function buildZip_() {
  const a = buildAllMetrics_();
  const stamp = Utilities.formatDate(a.today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const blobs = a.list.map(function(m) {
    const html = '<html><head><meta charset="UTF-8">' + css_() + '</head><body>' +
                 estimatorPage_(m, a.today, a.teamHitAvg) + '</body></html>';
    const nm = 'Scorecard_' + m.name.replace(/[^A-Za-z0-9]+/g, '_') + '_' + stamp + '.pdf';
    return Utilities.newBlob(pdfSafe_(html), MimeType.HTML, nm).getAs(MimeType.PDF).setName(nm);
  });
  return Utilities.zip(blobs, 'Estimator_Scorecards_' + stamp + '.zip');
}

/* Optiline OE monogram (black/red on white), embedded so the PDF needs no external fetch */
const LOGO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAMEAAABICAIAAADAnwbbAAAdVUlEQVR42u19a7BkRZXut1bm3rtep8/pB31o+jRN2+DwGETxAQZg49xwUBiDAQln4qphXA3/XPQX/HBCI27c+WeEc++EcGcIf1xmYkbh3uCqgNi+8JcGAoqOiAxqN82jpR9093lUnaraO3Ot+yOr8uxTVefRNHaf7jlJcDqrateunZlfrlzrW5lrkapivayXUyi83gXrZR1D62UdQ+tlHUPrZR1D6+XNKf9hrRO7motEhJkBeO+JiJlDfxFR7L7yO7E340sRCS/jV8L75ZfxtwbeGb5mYLSGbxvuQ/0y8j7hmQeuid8aeKThNweK915VrbWrufjsnSRxyMrdS6uZPWUEqKpzjpnDy3CvgKqzruO892FulLEb2hL+iogxJjYtdGL8SvyiqhpjlpoV51IJvRR6INZXi6GAntCnA3M63KvT6czMzExPTxdFISLhK91ut9VqNZvN+fn5brc7OzsrIs65CErnXHiAMDzh0xUlU5qmA3IoSZKA6TjAWZYlSVKv1xuNRqPRqFQqaZrGy7IsazQaGzdutNYmSRIaNQALZo4CeBlkhEkVHjv++rmHJCLK85yZq9VqXI56H60GQ+Xpparz8/NHjx49cuTIsWPHjhw5sn///sOHD7darZmZmdnZ2TzPvfdFURRF4b333jvnvPdhYCJKwhMURVHGUJzQKyhxiyVBeLwoGkODwzXMHFBirWXmNE2ZOXREtVodGxsbHx/funXrtm3bJicnJyYmduzYMTU1Va1Ww8K0VCeU32m32w8//PDjjz/e7XbDWuacy7LsHFOPmLnVar3jHe/45Cc/OTk5GUYz9LNdDYBiZ73++uvPPvvsk08++cwzzxw6dGh6errb7XY6HedcURRhwILwL4oiDmesxGEIU5yI4hKwFD5GyqHhKRIVsnirPM/Lilr5yiBdRKTT6aRpmqZptVqt1WrVanViYuLSSy+98cYb3/Wud01OTlar1bLcjWJpoH9+/etfP/jgg865INJU1XuPc0AS6UK/GWOmp6ePHTt26623Tk5OluWQXY02rar79u177LHH9u7d+/zzzx8/fly8N9ZmWRZUImtttVqN422MCRJvtPxQVUBFRaUsdYgIOsK6GZAHIy2gRUJCoSppkoJAIMWCvq+iIEBVVEWkWq2G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';
