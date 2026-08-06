/**
 * OPTILINE · ESTIMATOR PERFORMANCE V2 — server side
 * Bound to the Basis Master spreadsheet. Reads live data on every page load.
 *
 * Setup: Extensions → Apps Script on the Basis Master sheet, paste this into
 * Code.gs, create an HTML file named "Index" with the dashboard HTML, then
 * Deploy → New deployment → Web app.
 */

const SHEET_NAME = ''; // optional: force a specific tab name. Blank = auto-detect by headers.
const SPREADSHEET_ID = '1f8KrpUTLRi2_pgHTBZwapB8Ar5NEacHvR46gNVFblrw'; // Basis Master. Used when the script is not bound to the sheet.

// --- Access control: only these Google users may view this dashboard ---
var ALLOWED = ['leo@optiline.co','gkelly@optiline.co','smit@optiline.co','parth@optiline.co','john@optiline.co'];
function viewerEmail_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isAllowed_()   { return ALLOWED.indexOf(viewerEmail_()) !== -1; }

function doGet() {
  if (!isAllowed_()) return accessDenied(viewerEmail_());
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Optiline · Estimator Performance')
    .addMetaTag('viewport', 'width=1300')                                  // fit-to-width on phones (pinch to zoom)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);         // lets it embed in the launcher app
}

function getData() {
  if (!isAllowed_()) return JSON.stringify({ denied: true, recs: [], count: 0, generated: '' });
  // Works both container-bound (Extensions → Apps Script from the sheet) and standalone (script.google.com):
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (err) { ss = null; }
  if (!ss) {
    if (!SPREADSHEET_ID) throw new Error('Script is not bound to a spreadsheet and SPREADSHEET_ID is blank. Set SPREADSHEET_ID at the top of Code.gs.');
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  // Locate the data tab: honor SHEET_NAME if set, otherwise find the tab
  // whose header row contains the three fields we depend on.
  let sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : null;
  if (!sheet) {
    const needed = ['Estimator', 'Submitted $', 'Won Quotes'];
    const sheets = ss.getSheets();
    for (let s = 0; s < sheets.length; s++) {
      const sh = sheets[s];
      if (sh.getLastRow() < 2) continue;
      const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      let ok = true;
      for (let n = 0; n < needed.length; n++) if (hdr.indexOf(needed[n]) < 0) ok = false;
      if (ok) { sheet = sh; break; }
    }
  }
  if (!sheet) throw new Error('No tab found with headers: Estimator / Submitted $ / Won Quotes. Set SHEET_NAME at the top of Code.gs.');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const hdr = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  const col = function (name) { return hdr.indexOf(name) + 1; }; // 1-based, 0 = missing

  const c = {
    est: col('Estimator'),
    ce: col('Chief Estimator'),
    subDate: col('Submitted date - Date'),
    bidDl: col('Bid deadline - Date'),
    created: col('Created date - Date'),
    awdDate: col('Awarded date - Date'),
    lostDate: col('Lost date - Date'),
    oeStart: col('OE Start Date - Date'),
    subAmt: col('Submitted $'),
    wonAmt: col('Won Quotes'),
    lostAmt: col('Lost Quotes'),
    projCost: col('Projected Cost'),
    gpPct: col('Bid Gross Profit %')
  };
  if (!c.est || !c.subAmt || !c.wonAmt) throw new Error('Required columns missing (Estimator / Submitted $ / Won Quotes).');

  // Read only the columns we need — much faster than pulling all 90 fields.
  const read = function (colIdx) {
    if (!colIdx) return [];
    return sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().map(function (r) { return r[0]; });
  };
  const vEst = read(c.est), vCe = read(c.ce), vSubDate = read(c.subDate), vBidDl = read(c.bidDl),
        vCreated = read(c.created), vAwdDate = read(c.awdDate), vLostDate = read(c.lostDate),
        vOeStart = read(c.oeStart), vSubAmt = read(c.subAmt), vWonAmt = read(c.wonAmt), vLostAmt = read(c.lostAmt),
        vProjCost = read(c.projCost), vGpPct = read(c.gpPct);

  const tz = Session.getScriptTimeZone();
  const money = function (v) {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const ymd = function (v) {
    if (v == null || v === '') return '';
    const d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  };

  // Record shape: [est, ce, subDate, sub$, awdDate, won$, createdDate, oeStart, lostDate, lost$, projCost, bidGpPct]
  // Losses are identified by Lost date; lost$ = Lost Quotes (client falls back to Submitted $ when 0).
  // Bid GP is computed client-side from Projected Cost (preferred) with Bid GP % as fallback.
  const recs = [];
  for (let i = 0; i < vEst.length; i++) {
    const sa = money(vSubAmt[i]);
    const aa = money(vWonAmt[i]);
    if (sa <= 0 && aa <= 0) continue;
    const cd = ymd(vCreated[i]);
    const sd = ymd(vSubDate[i]) || ymd(vBidDl[i]) || cd;
    const ad = ymd(vAwdDate[i]);
    const os = c.oeStart ? ymd(vOeStart[i]) : '';
    const ldt = c.lostDate ? ymd(vLostDate[i]) : '';
    const la = c.lostAmt ? money(vLostAmt[i]) : 0;
    const pcv = c.projCost ? money(vProjCost[i]) : 0;
    const gpv = c.gpPct ? money(vGpPct[i]) : 0;
    let e = String(vEst[i] == null ? '' : vEst[i]).trim(); if (!e) e = 'Unassigned';
    const ce = c.ce ? String(vCe[i] == null ? '' : vCe[i]).trim() : '';
    recs.push([e, ce, sd, Math.round(sa), ad, Math.round(aa), cd, os, ldt, Math.round(la), Math.round(pcv), Math.round(gpv * 100) / 100]);
  }

  return JSON.stringify({
    generated: Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a"),
    tz: tz,
    count: recs.length,
    recs: recs
  });
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
