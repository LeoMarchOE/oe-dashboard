/*** Optiline Bid Funnel Dashboard — live web app over the "ALL DATA" sheet ***
 *
 * File name in Apps Script: Dashboard.gs (companion HTML file: DashboardPage.html)
 *
 * Cohort basis: BID DEADLINE date (column "Bid deadline - Date").
 * Windows are calendar-based, anchored on YESTERDAY; deadlines after yesterday
 * are excluded, so every window is period-to-date. Q1–Q4 are the calendar
 * quarters of the current fiscal year (= calendar year, by TODAY's date).
 *
 * Stage logic (stage-based, per CEO decisions 2026-07-06):
 *   Invites   = every row (all stages incl. Declined)
 *   Board     = stage != Declined
 *   Bid Cap.  = stage == Declined AND stage reason == "Bid Capacity" (% shown vs Board)
 *   Submitted = Submitted date present OR stage in {Submitted, Awarded, Lost}
 *   Unresolved= Board - Submitted (computed client-side)
 *   Won/Lost  = stage Awarded / stage Lost
 *   Pipeline  = Board rows not yet Won or Lost (value = sum of "Pending $")
 *   FY rows   = Won/Lost and Pipeline restricted to Created date in current FY
 ***/

const DB_SHEET_NAME      = 'ALL DATA';
const DB_CAPACITY_REASON = 'Bid Capacity';
const DB_DECLINED_STAGE  = 'Declined';

// --- Access control: only these Google users may view this dashboard ---
var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co',
  'lcarroll@optiline.co','john@optiline.co','smit@optiline.co','parth@optiline.co',
  'wheaton@optiline.co','mduchesne@optiline.co','jstupalski@optiline.co','ajsanchez@optiline.co'];
function viewerEmail_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isAllowed_()   { return ALLOWED.indexOf(viewerEmail_()) !== -1; }

function doGet(e) {
  if (!isAllowed_()) return accessDenied(viewerEmail_());
  const t = HtmlService.createTemplateFromFile('DashboardPage');
  t.payload = JSON.stringify(db_compute_());
  return t.evaluate()
    .setTitle('Optiline — Bid Funnel Overview')
    .addMetaTag('viewport', 'width=1200')                                  // fit-to-width on phones (pinch to zoom)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);         // lets it embed in the launcher app
}

function db_compute_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DB_SHEET_NAME);
  if (!sh) throw new Error('Sheet "' + DB_SHEET_NAME + '" not found.');
  const vals = sh.getDataRange().getValues();
  const hdr = vals[0].map(String);
  const col = function (name) {
    const i = hdr.indexOf(name);
    if (i < 0) throw new Error('Column "' + name + '" not found in ' + DB_SHEET_NAME);
    return i;
  };
  const iDl = col('Bid deadline - Date'), iStage = col('Stage'),
        iReason = col('Stage reason'), iSub = col('Submitted date - Date'),
        iPend = col('Pending $'), iSubAmt = col('Submitted $'),
        iCr = col('Created date - Date');

  // Anchor everything on YESTERDAY (script time zone must be America/New_York).
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest = new Date(today.getTime() - 86400000);
  const y = yest.getFullYear(), m = yest.getMonth();
  const monOff = (yest.getDay() + 6) % 7;                      // days since Monday
  // Fiscal year = calendar year (per CEO 2026-07-06), based on TODAY's date.
  // Q1–Q4 are the calendar quarters of the current fiscal year.
  const fyYear = today.getFullYear();

  const windows = [
    { key: 'daily',     s: yest,                        e: yest },
    { key: 'weekly',    s: db_add_(yest, -monOff),      e: db_add_(yest, 6 - monOff) },
    { key: 'monthly',   s: new Date(y, m, 1),           e: new Date(y, m + 1, 0) },
    { key: 'q1',        s: new Date(fyYear, 0, 1),      e: new Date(fyYear, 3, 0) },
    { key: 'q2',        s: new Date(fyYear, 3, 1),      e: new Date(fyYear, 6, 0) },
    { key: 'q3',        s: new Date(fyYear, 6, 1),      e: new Date(fyYear, 9, 0) },
    { key: 'q4',        s: new Date(fyYear, 9, 1),      e: new Date(fyYear, 12, 0) },
    { key: 'ytd',       s: new Date(y, 0, 1),           e: yest }
  ];
  windows.forEach(function (w) {
    // Only bid deadlines up to YESTERDAY count — deadlines after yesterday are
    // excluded (per CEO 2026-07-06), so every window is a period-to-date window.
    if (w.e.getTime() > yest.getTime()) w.e = yest;
    w.st = w.s.getTime(); w.et = w.e.getTime() + 86399999;
    // Future quarters haven't started yet: no rows count, label shows the start.
    w.label = (w.st > yest.getTime()) ? 'starts ' + db_fmtDate_(w.s, false) : db_fmtRange_(w.s, w.e, w.key);
    w.invites = 0; w.createdCount = 0; w.acceptedCreated = 0; w.board = 0; w.declined = 0; w.capacity = 0;
    w.submitted = 0; w.won = 0; w.lost = 0; w.pipeJobs = 0; w.pipeDollars = 0;
    w.submittedDollars = 0; w.wonDollars = 0; w.lostDollars = 0;
    w.fyWon = 0; w.fyLost = 0; w.fyWonDollars = 0; w.fyLostDollars = 0;
    w.fyPipeJobs = 0; w.fyPipeDollars = 0;
  });

  for (let r = 1; r < vals.length; r++) {
    const row = vals[r];
    const cr = db_toDate_(row[iCr]);
    const stage0 = String(row[iStage] || '').trim();
    const declined0 = (stage0 === DB_DECLINED_STAGE);
    const capacity0 = declined0 && String(row[iReason] || '').trim() === DB_CAPACITY_REASON;
    // Gray sub-counts by CREATED date (when the BD Managers accepted them into
    // Basis) — before any deadline filtering. acceptedCreated = accepted to
    // board (incl. later capacity declines) counted by Created date.
    if (cr) {
      const ct = cr.getTime();
      for (let i = 0; i < windows.length; i++) {
        const w = windows[i];
        if (ct >= w.st && ct <= w.et) { w.createdCount++; if (!declined0 || capacity0) w.acceptedCreated++; }
      }
    }
    const dl = db_toDate_(row[iDl]);
    if (!dl) continue;                                          // no bid deadline -> not in any cohort
    const t = dl.getTime();
    const stage = String(row[iStage] || '').trim();
    const declined = (stage === DB_DECLINED_STAGE);
    const won = (stage === 'Awarded'), lost = (stage === 'Lost');
    const submitted = !declined && (String(row[iSub] || '').trim() !== '' || stage === 'Submitted' || won || lost);
    const capacity = declined && String(row[iReason] || '').trim() === DB_CAPACITY_REASON;
    const pend = Number(row[iPend]) || 0;
    const subAmt = Number(row[iSubAmt]) || 0;
    const inFY = !!cr && cr.getFullYear() === fyYear;   // created in current fiscal year

    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      if (t < w.st || t > w.et) continue;
      w.invites++;
      if (declined) { w.declined++; if (capacity) w.capacity++; continue; }
      w.board++;
      if (submitted) { w.submitted++; w.submittedDollars += subAmt; }
      if (won) { w.won++; w.wonDollars += subAmt; if (inFY) { w.fyWon++; w.fyWonDollars += subAmt; } }
      else if (lost) { w.lost++; w.lostDollars += subAmt; if (inFY) { w.fyLost++; w.fyLostDollars += subAmt; } }
      else { w.pipeJobs++; w.pipeDollars += pend; if (inFY) { w.fyPipeJobs++; w.fyPipeDollars += pend; } }
    }
  }

  return {
    asOf: db_fmtDate_(new Date(), true),
    anchor: db_fmtDate_(yest, true),
    year: y,
    fyYear: fyYear,
    cols: windows.map(function (w) {
      return {
        key: w.key, label: w.label,
        invites: w.invites, createdCount: w.createdCount, acceptedCreated: w.acceptedCreated,
        board: w.board, declined: w.declined,
        capacity: w.capacity, submitted: w.submitted,
        inprog: Math.max(0, w.board - w.submitted),
        won: w.won, lost: w.lost,
        pipeJobs: w.pipeJobs, pipeDollars: w.pipeDollars,
        submittedDollars: w.submittedDollars,
        wonDollars: w.wonDollars, lostDollars: w.lostDollars,
        fyWon: w.fyWon, fyLost: w.fyLost,
        fyWonDollars: w.fyWonDollars, fyLostDollars: w.fyLostDollars,
        fyPipeJobs: w.fyPipeJobs, fyPipeDollars: w.fyPipeDollars
      };
    })
  };
}

/* ----- helpers ----- */
function db_add_(d, days) { return new Date(d.getTime() + days * 86400000); }
function db_toDate_(v) {
  if (v instanceof Date) { const d = new Date(v); d.setHours(0, 0, 0, 0); return d; }
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const mm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!mm) return null;
  return new Date(+mm[3], +mm[1] - 1, +mm[2]);
}
const DB_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function db_fmtDate_(d, withYear) {
  return DB_MONTHS[d.getMonth()] + ' ' + d.getDate() + (withYear ? ', ' + d.getFullYear() : '');
}
function db_fmtRange_(s, e, key) {
  if (key === 'daily' || s.getTime() === e.getTime()) return db_fmtDate_(s, false);
  return db_fmtDate_(s, false) + ' – ' + db_fmtDate_(e, false);
}

/** Branded "access restricted" page shown to users not on the allowlist. */
function accessDenied(email) {
  var html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<style>body{margin:0;background:#000;color:#fff;font-family:Inter,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}'
    + '.box{max-width:440px;padding:32px}.bar{width:90px;height:9px;background:#E1251B;margin:0 auto 22px}'
    + 'h1{font-size:22px;letter-spacing:3px;margin:0 0 14px;font-weight:800}p{color:#bbb;font-size:14px;line-height:1.65}b{color:#E1251B}</style></head>'
    + '<body><div class="box"><div class="bar"></div><h1>ACCESS RESTRICTED</h1>'
    + '<p>This dashboard is limited to approved Optiline users.'
    + (email ? '<br><br>Signed in as <b>' + email + '</b>' : '<br><br>Could not confirm your Google identity.')
    + '<br><br>If you need access, contact the dashboard administrator.</p></div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Access Restricted')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
