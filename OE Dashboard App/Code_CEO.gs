/**
 * Optiline — CEO Dashboard (container-bound to the CEO Weekly Update workbook)
 *
 * Reads the "Weekly Update" sheet live each time the page loads, so the
 * dashboard always reflects the latest numbers. The "Data as of" date comes
 * straight from cell B3.
 *
 * Deploy: Extensions > Apps Script (from the workbook) > paste this file +
 * an HTML file named "Index" > Deploy > New deployment > Web app.
 */
function doGet() {
  // --- Access control: only these Google users may view this dashboard ---
  var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co','lcarroll@optiline.co'];
  var VIEWER = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (ALLOWED.indexOf(VIEWER) === -1) return accessDenied(VIEWER);

  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Weekly Update');
  var lastRow = Math.min(sh.getLastRow(), 80);
  var rng  = sh.getRange(1, 1, lastRow, 16);   // A1:P{lastRow} (P = 2025 revenue)
  var disp = rng.getDisplayValues();           // exactly as shown (currency, %, status text)
  var num  = rng.getValues();                  // raw numbers (for the chart/totals)

  function d(r, c) { return (disp[r - 1] && disp[r - 1][c - 1] != null) ? String(disp[r - 1][c - 1]) : ''; }
  function n(r, c) { var v = num[r - 1] && num[r - 1][c - 1]; return (typeof v === 'number') ? v : 0; }
  function row(r, c1, c2) { var a = []; for (var c = c1; c <= c2; c++) a.push(d(r, c)); return a; }
  function cmpRow(rowA, rowB) {   // 1=green (>= full prior yr), 0.5=orange (on YTD pace), -1=red (behind pace), 0=n/a
    var cols = [2, 3, 4, 5, 6, 7, 8], a = [], yp = (typeof yearPct === 'number') ? yearPct : 1;
    for (var i = 0; i < cols.length; i++) {
      var x = n(rowA, cols[i]), y = n(rowB, cols[i]), st;
      if (y <= 0) st = (x > 0 ? 1 : 0);
      else if (x >= y) st = 1;
      else if (x >= y * yp) st = 0.5;
      else st = -1;
      a.push(st);
    }
    return a;
  }

  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Locate the billing block dynamically (labels and month columns can shift)
  var monthStartCol = 0;
  for (var hr = 36; hr <= 41 && !monthStartCol; hr++) {
    for (var hc = 2; hc <= 10; hc++) { if (/jan/i.test(d(hr, hc))) { monthStartCol = hc; break; } }
  }
  if (!monthStartCol) monthStartCol = 3;
  var totalCol = monthStartCol + 12;

  var monthlyTotals = [0,0,0,0,0,0,0,0,0,0,0,0];
  var total2025 = 0;
  var billing = [];
  var EXCLUDE = { NY: true };   // regions to hide from the table + totals
  for (var r = 37; r <= lastRow; r++) {
    var lbl = '';
    for (var lc = 1; lc <= 3; lc++) { if (/GC Income/i.test(d(r, lc))) { lbl = d(r, lc); break; } }
    if (!lbl) continue;
    var region = lbl.replace(/GC Income\s*-?\s*/i, '').trim() || lbl;
    if (EXCLUDE[region.toUpperCase()]) continue;
    var vals = [];
    for (var c = monthStartCol; c < monthStartCol + 12; c++) { vals.push(d(r, c)); monthlyTotals[c - monthStartCol] += n(r, c); }
    var n2026 = n(r, totalCol), n2025 = n(r, totalCol + 1);
    total2025 += n2025;
    var cmp = (n2026 > n2025) ? 1 : (n2026 < n2025 ? -1 : 0);   // 2026 vs 2025 ($0 prior counts as up)
    billing.push({ region: region, vals: vals, total: d(r, totalCol), rev2025: d(r, totalCol + 1), cmp: cmp });
  }

  // Sort regions north -> south so the table matches a US map (ME first, FL last)
  var ORDER = { ME:1, NH:2, VT:3, NY:4, MA:5, RI:6, CT:7, NJ:8, PA:9, MD:10, DE:11, WV:12, VA:13, KY:14, TN:15, NC:16, SC:17, GA:18, AL:19, MS:20, FL:21 };
  billing.sort(function(a, b) {
    return (ORDER[a.region.toUpperCase()] || 99) - (ORDER[b.region.toUpperCase()] || 99);
  });

  // Owner-distribution pace: % of limit used vs % of year elapsed (as of B3)
  var asOfDate = num[2][1];        // raw value of B3
  var yearPct = null, distPct = null, overPace = false;
  if (asOfDate instanceof Date) {
    var yr = asOfDate.getFullYear();
    var doy = Math.floor((asOfDate - new Date(yr, 0, 1)) / 86400000) + 1;
    var diy = ((yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0) ? 366 : 365;
    yearPct = doy / diy;
  }
  var limitN = n(22, 2), distN = n(23, 2);
  if (limitN > 0) distPct = distN / limitN;
  if (yearPct != null && distPct != null) overPace = distPct > yearPct;

  // Net profit margin = 2026 contract-only net income / 2026 actual revenue
  var netProfitPct = (n(17, 6) > 0) ? (n(15, 2) / n(17, 6)) : null;

  var data = {
    asOf: d(3, 2),
    preparedBy: d(4, 2),
    liquidity: [
      { k: 'Cash / LOC',                         v: d(8, 2),  s: d(8, 3) },
      { k: 'LOC Balance Drawn',                   v: d(9, 2),  s: d(9, 3) },
      { k: 'LOC Availability Remaining',          v: d(10, 2), s: d(10, 3) },
      { k: 'LOC Available per Receivables (BBC)', v: d(11, 2), s: d(11, 3) },
      { k: 'Eligible Borrowing Base',             v: d(12, 2), s: d(12, 3) },
      { k: 'Over 90 Receivables (inc ret)',       v: d(13, 2), s: d(13, 3) },
      { k: 'Contract Backlog',                    v: d(14, 2), s: d(14, 3) }
    ],
    netIncome2026: d(15, 2), margin2026: d(15, 6), margin2027: d(15, 7),
    netProfitPct: netProfitPct,
    trend: d(16, 2),
    traj: [
      { k: 'Revenue',      s: d(17, 2), pct: d(17, 3), target: d(17, 4), v2026: d(17, 6), v2027: d(17, 7) },
      { k: 'Gross Profit', s: d(18, 2), pct: d(18, 3), target: d(18, 4), v2026: d(18, 6), v2027: d(18, 7) },
      { k: 'Net Profit',   s: d(19, 2), pct: d(19, 3), target: d(19, 4), v2026: d(19, 6), v2027: d(19, 7) }
    ],
    covenant: { s: d(20, 2), note: (d(20, 3) || d(20, 4) || d(20, 5)) },
    backlogQuality: d(21, 2),
    ownerLimit: d(22, 2),
    ownerThrough: d(23, 2),
    ownerThroughLbl: d(23, 1),
    ownerRemaining: d(23, 3),
    ownerYearPct: yearPct,
    ownerDistPct: distPct,
    ownerOverPace: overPace,
    regions: row(25, 3, 8),
    bidsSubmitted: { total: d(26, 2), vals: row(26, 3, 8) },
    newBids:       { total: d(27, 2), vals: row(27, 3, 8) },
    bids2025:      { total: d(28, 2), vals: row(28, 3, 8) },
    newBidsCmp:    cmpRow(27, 28),   // Current New Bids 2026 vs 2025 Bids Created
    awards:        { total: d(29, 2), vals: row(29, 3, 8) },
    awards2025:    { total: d(30, 2), vals: row(30, 3, 8) },
    awardsCmp:     cmpRow(29, 30),   // 2026 Awards vs 2025 Awards
    openBids:      { total: d(34, 2), vals: row(34, 3, 8) },
    hitRateAll: d(31, 2),
    hitRateNew: d(32, 2),
    lastWeekAwards: d(33, 2),
    lastWeekProjects: (d(33, 4) + ' ' + d(33, 5)).trim(),
    months: months,
    monthlyTotals: monthlyTotals,
    total2025: total2025,
    billing: billing
  };

  var t = HtmlService.createTemplateFromFile('Index');
  t.data = JSON.stringify(data);
  return t.evaluate()
    .setTitle('Optiline — CEO Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
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
