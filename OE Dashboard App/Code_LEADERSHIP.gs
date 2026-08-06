/**
 * Optiline Leadership Dashboard — Apps Script web app backend
 * -----------------------------------------------------------
 * Serves Index.html and reads the live KPI workbook this script is bound to.
 * Paste as Code.gs, add the dashboard as an HTML file named exactly "Index",
 * then deploy as a Web App (see DEPLOYMENT.md). Restrict access to optiline.co.
 *
 * Every read is wrapped so a single missing/blank cell never blanks the page;
 * sheet lookups are name-tolerant (ignore case / spaces / slashes).
 */

var SPREADSHEET_ID = '1RTtAQZCst9NG8_IXAwXYlrVZST7Vu6VlgpVDi6abrnM';

// --- Access control: only these Google users may view this dashboard ---
var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co',
  'lcarroll@optiline.co','john@optiline.co','smit@optiline.co','wheaton@optiline.co',
  'claudia@optiline.co','alejandra@optiline.co','rogercolem@optiline.co','hector@optiline.co',
  'jordanburke@optiline.co','josh@optiline.co','rmarin@optiline.co'];

function viewerEmail_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isAllowed_()   { return ALLOWED.indexOf(viewerEmail_()) !== -1; }

function doGet() {
  if (!isAllowed_()) return accessDenied(viewerEmail_());
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Optiline — Leadership Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

/* ---------- helpers ---------- */
function sheet_(name) {
  var ss = ss_();
  var s = ss.getSheetByName(name);
  if (s) return s;
  // tolerant match: ignore case, spaces, slashes, punctuation
  var norm = function (x) { return String(x).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var target = norm(name), all = ss.getSheets();
  for (var i = 0; i < all.length; i++) { if (norm(all[i].getName()) === target) return all[i]; }
  throw new Error('Missing sheet: ' + name);
}
function num_(v) { return (typeof v === 'number' && !isNaN(v)) ? v : null; }
function rng_(name, a1) { return sheet_(name).getRange(a1).getValues(); }
function flat_(name, a1) { return rng_(name, a1).map(function (r) { return r[0]; }); }
function cell_(name, a1) { return sheet_(name).getRange(a1).getValue(); }

function getData() {
  if (!isAllowed_()) return { denied: true };   // second layer: block direct data calls
  var D = {
    ASOF: 'Live · ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/New_York', "MMMM d, yyyy 'at' h:mm a"),
    MONTHS: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    LABOR_TARGET: 0.40
  };

  try {
    D.REV_PROJ = flat_('Revenue Data', 'B2:B13').map(num_);
    D.REV_ACT  = flat_('Revenue Data', 'C2:C13').map(num_);
    D.REV_TARGET_MONTHLY = num_(cell_('Revenue Data', 'D2')) || 11250000;
    D.ACT_MONTHS = D.REV_ACT.filter(function (v) { return v !== null; }).length;
  } catch (e) { D._revErr = String(e); }

  try {
    D.ANNUAL       = { baseline:num_(cell_('Projection Data','L26')), target:num_(cell_('Projection Data','M26')), projection:num_(cell_('Projection Data','N26')) };
    D.GROSS_PROFIT = { baseline:num_(cell_('Projection Data','S26')), target:num_(cell_('Projection Data','T26')), current:num_(cell_('Projection Data','U26')) };
    D.NET_PROFIT   = { baseline:num_(cell_('Projection Data','Z26')), target:num_(cell_('Projection Data','AA26')), current:num_(cell_('Projection Data','AB26')) };
  } catch (e) { D._projErr = String(e); }

  try {
    D.REGIONS = rng_('Projection Data', 'A31:C33')
      .filter(function (r) { return r[0]; })
      .map(function (r) { return { name:String(r[0]).trim(), target:num_(r[1]), actual:num_(r[2]) }; });
  } catch (e) { D._regionErr = String(e); }

  try {
    var mkBD = function (label, totA1, tgtA1, a1) {
      var rows = rng_('Projection Data', a1).filter(function (r) { return r[0]; })
        .map(function (r) { return [String(r[0]).trim(), num_(r[1]), num_(r[2])]; });
      return { label:label, total:num_(cell_('Projection Data', totA1)), target:num_(cell_('Projection Data', tgtA1)), regions:rows };
    };
    D.BD = {
      pipeline: mkBD('OE Pipeline',  'B95','C95','A97:C102'),
      awards:   mkBD('2026 Awards',  'G95','H95','F97:H102'),
      bids:     mkBD('2026 New Bids','K95','L95','J97:L102')
    };
  } catch (e) { D._bdErr = String(e); }

  try {
    var matlYTD = num_(cell_('2026 Labor Data','N9')), adjRevYTD = num_(cell_('2026 Labor Data','N4'));
    D.COST = {
      cogs: num_(cell_('2026 Labor Data','N31')),
      labor: num_(cell_('2026 Labor Data','O33')),   // O33 = Total Labor % (N33 is the $ amount)
      material: (matlYTD && adjRevYTD) ? matlYTD / adjRevYTD : null,
      cogsTarget: 0.82
    };
    // B7:M7 is a horizontal range (one row) — take that row's columns, not flat_ (which reads a column)
    D.LABOR_MONTHLY = (rng_('2026 Labor Data', 'B7:M7')[0] || []).map(num_).filter(function (v) { return v !== null; });
  } catch (e) { D._laborErr = String(e); }

  // Financial Data — sum each sub-table, EXCLUDING its "Grand Total" row
  // AR by customer A/B/C | AR by job E/F | PCO Log I/J | Approved CO L/M | Open AP by Vendor O/P
  try {
    var fin = sheet_('Financial Data');
    var fr = fin.getRange(3, 1, Math.max(1, fin.getLastRow() - 2), 16).getValues();
    var isGT = function (r, i) { return String(r[i] || '').trim().toLowerCase() === 'grand total'; };
    var arBal = 0, arRet = 0, ap = 0, pco = 0, aco = 0, cust = [], proj = [], acoList = [];
    fr.forEach(function (r) {
      if (r[0] && !isGT(r, 0))    { arBal += num_(r[1]) || 0; arRet += num_(r[2]) || 0; cust.push([String(r[0]).trim(), num_(r[1]) || 0]); }
      if (r[4] && !isGT(r, 4))    { proj.push([String(r[4]).trim(), num_(r[5]) || 0]); }
      if (r[8] && !isGT(r, 8))    { pco += num_(r[9]) || 0; }
      if (r[11] && !isGT(r, 11))  { aco += num_(r[12]) || 0; acoList.push([String(r[11]).trim(), num_(r[12]) || 0]); }
      if (r[14] && !isGT(r, 14))  { ap += num_(r[15]) || 0; }
    });
    cust.sort(function (a, b) { return b[1] - a[1]; });
    proj.sort(function (a, b) { return b[1] - a[1]; });
    acoList.sort(function (a, b) { return b[1] - a[1]; });
    D.FIN = { ar: arBal, retention: arRet, ap: ap, pco: pco, approvedCO: aco, over90: null,
              topCustomers: cust.slice(0, 5), topProjects: proj.slice(0, 5), topApprovedCO: acoList.slice(0, 5) };
  } catch (e) { D._finErr = String(e); }

  try {
    var o90 = flat_('Over 90 Data', 'H1:H60').map(num_).filter(function (v) { return v !== null; });
    if (o90.length) { D.OVER90_TREND = o90.slice(-3); if (D.FIN) D.FIN.over90 = o90[o90.length - 1]; }
    var op = [];
    rng_('Over 90 Data', 'A2:D80').forEach(function (r) {
      var nm = String(r[0] || '').trim(), lc = nm.toLowerCase();
      if (nm && lc !== 'total' && lc !== 'grand total') op.push([nm, num_(r[3]) || 0]);
    });
    op.sort(function (a, b) { return b[1] - a[1]; });
    if (D.FIN) D.FIN.over90Projects = op.slice(0, 5);
  } catch (e) { D._o90Err = String(e); }

  try {
    D.TRIR = { value: num_(cell_('2026 Safety HR Data', 'I59')), target: num_(cell_('2026 Safety HR Data', 'J59')) };
  } catch (e) { D._trirErr = String(e); }

  try {
    var wl = sheet_('Watch List');
    var wr = wl.getRange(2, 1, Math.max(1, wl.getLastRow() - 1), 13).getValues();
    var order = [], byReason = {};
    wr.forEach(function (r) {
      if (!r[2]) return;
      var reason = String(r[0] || 'Other').trim(), job = String(r[3] || '?').trim(), bal = num_(r[12]) || 0;
      if (!byReason[reason]) { byReason[reason] = { reason:reason, count:0, amount:0, jobs:[] }; order.push(reason); }
      byReason[reason].count++; byReason[reason].amount += bal; byReason[reason].jobs.push(job);
    });
    order.sort();
    var jobs = 0, balance = 0;
    order.forEach(function (k) { jobs += byReason[k].count; balance += byReason[k].amount; });
    D.WATCH = { jobs:jobs, balance:balance, pendingPco:945744, groups: order.map(function (k) { return byReason[k]; }) };
  } catch (e) { D._watchErr = String(e); }

  try {
    var sh = sheet_('2026 Safety HR Data');
    var safetyRows = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 10).getValues();
    var recordables = 0;
    safetyRows.forEach(function (r) { if (r[0] instanceof Date) { var n = num_(r[9]); if (n) recordables += n; } });
    D.SAFETY = { recordables: recordables, fatalities: 0, severe: 0 };

    var hrRows = sh.getRange(92, 1, 60, 6).getValues();
    var employees = null, hoursYTD = 0, otYTD = 0, latestWeek = '';
    hrRows.forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      var ee = num_(r[1]);
      if (ee !== null) { employees = ee; latestWeek = Utilities.formatDate(r[0], Session.getScriptTimeZone() || 'America/New_York', 'MMM d'); }
      var ot = num_(r[4]); if (ot) otYTD += ot;
      var tot = num_(r[5]); if (tot) hoursYTD += tot;
    });

    var comp = sh.getRange(92, 11, 32, 2).getValues(), map = {};
    comp.forEach(function (r) {
      var a = r[0], b = r[1];
      if (typeof a === 'string' && typeof b === 'number') map[a.trim()] = b;
      else if (typeof b === 'string' && typeof a === 'number') map[b.trim()] = a;
    });
    var pick = function (keys) { for (var i = 0; i < keys.length; i++) if (map[keys[i]] != null) return map[keys[i]]; return null; };

    D.HR = {
      employees: employees,
      office: pick(['Total # of OE Office Staff']),
      field: pick(['# of Current OE Field Employees','Total # of OE Field Employees']),
      pms: pick(['Total # of OE PMs']),
      foremen: pick(['# of Foreman','# of Current OE Employee Foreman & FIT']),
      approvedSubs: pick(['# of Approved Sub Companies']),
      contractField: Math.round(pick(['Total # of Contract Field Workers']) || 0),
      unplaced: pick(['# of Employees Unplaced']) || 0,
      activeProjects: pick(['Active Projects']),
      projectsWithForeman: pick(['Active Projects with OE Foreman Assigned']),
      jobsNeedForeman: pick(['Jobs that need OE Foreman Assigned']),
      hoursYTD: hoursYTD, otYTD: otYTD, latestWeek: latestWeek
    };
  } catch (e) { D._hrErr = String(e); }

  return D;
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
