/**
 * OPTILINE PRECONSTRUCTION — STANDINGS (live web app)
 * Bound to the "Precon Dashboard Data" workbook.
 *
 * ONE URL adapts to the device:
 *   <web app URL>                 →  Auto    (responsive: wide screens get Columns, phones get Mobile)
 *   <web app URL>?view=columns    →  force the three-column board
 *   <web app URL>?view=mobile     →  force the phone layout
 *   <web app URL>?view=panel      →  the single rotating leaderboard (auto-cycles metrics)
 *
 * HTML files needed in this project, named exactly:  Auto   Panel
 * Reads the "Pivot Table 1" tab by section TITLE (not fixed rows), so it survives reflow.
 * New layout per block: Name | Actual | Target. Grand Total sits in row 1 with company targets.
 */

// --- Access control: only these Google users may view this dashboard ---
var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co',
  'lcarroll@optiline.co','john@optiline.co','smit@optiline.co','parth@optiline.co',
  'wheaton@optiline.co','mduchesne@optiline.co','jstupalski@optiline.co','ajsanchez@optiline.co'];

function viewerEmail_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isAllowed_()   { return ALLOWED.indexOf(viewerEmail_()) !== -1; }

function doGet(e) {
  if (!isAllowed_()) return accessDenied(viewerEmail_());
  var view = (e && e.parameter && e.parameter.view) ? String(e.parameter.view).toLowerCase() : '';
  if (view === 'panel') return render_('Panel', '');
  var force = '';
  if (view === 'columns' || view === 'grid' || view === 'all') force = 'columns';
  else if (view === 'mobile' || view === 'phone' || view === 'm') force = 'mobile';
  return render_('Auto', force);
}

function render_(file, force) {
  var t = HtmlService.createTemplateFromFile(file);
  t.force = force;                       // Auto reads this; Panel ignores it
  return t.evaluate()
    .setTitle('Optiline Preconstruction — Standings')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Returns {asOf, targets, cohorts} read live from the Pivot Table 1 tab.
 * Each person/region carries actual + target per metric:
 *   { name, pipeline, pipelineT, awards, awardsT, newBids, newBidsT, unassigned? }
 * targets = company totals from the Grand Total row: { pipeline:{actual,target}, ... }
 */
function getDashboardData() {
  if (!isAllowed_()) return { denied: true };   // second layer: block direct data calls
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Pivot Table 1');
  var v = sh.getDataRange().getValues();

  // For each metric family: name column, actual = name+1, target = name+2
  var COL = { pipeline: 0 /*A*/, awards: 5 /*F*/, newBids: 9 /*J*/ };

  var TITLES = {
    pipeline: {
      'Region':          'OE PIPELINE BY REGION',
      'Chief Estimator': 'OE PIPELINE BY CHIEF ESTIMATOR',
      'BD Manager':      'OE PIPELINE BY BD MANAGER',
      'Estimator':       'OE PIPELINE BY ESTIMATOR'
    },
    awards: {
      'Region':          '2026 AWARDS BY REGION',
      'Chief Estimator': '2026 AWARDS BY CHIEF ESTIMATOR',
      'BD Manager':      '2026 AWARDS BY BD MANAGER',
      'Estimator':       '2026 AWARDS BY ESTIMATOR'
    },
    newBids: {
      'Region':          '2026 NEW BIDS BY REGION',
      'Chief Estimator': '2026 NEW BIDS BY CHIEF ESTIMATOR',
      'BD Manager':      '2026 NEW BIDS BY BD MANAGER',
      'Estimator':       '2026 NEW BIDS BY ESTIMATOR'
    }
  };

  function isNum(x) { return typeof x === 'number' && !isNaN(x); }

  // Find the section title in nameCol, then read rows where the actual cell is
  // numeric (skips the header row), capturing actual + target until a blank name.
  function readBlock(nameCol, title) {
    var out = {}, start = -1;
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][nameCol]).trim() === title) { start = i; break; }
    }
    if (start < 0) return out;
    for (var r = start + 1; r < v.length; r++) {
      var nm = v[r][nameCol];
      if (nm === null || String(nm).trim() === '') break;
      if (String(nm).trim().toLowerCase() === 'grand total') break;
      var act = v[r][nameCol + 1];
      if (!isNum(act)) continue;                       // header/label row → skip
      var tgt = isNum(v[r][nameCol + 2]) ? v[r][nameCol + 2] : 0;
      out[String(nm).trim()] = { a: act, t: tgt };
    }
    return out;
  }

  // Company actual + target from the Grand Total row (now at the top).
  function grand(nameCol) {
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][nameCol]).trim().toLowerCase() === 'grand total') {
        var a = v[i][nameCol + 1], t = v[i][nameCol + 2];
        return { actual: isNum(a) ? a : 0, target: isNum(t) ? t : 0 };
      }
    }
    return { actual: 0, target: 0 };
  }

  var metrics = ['pipeline', 'awards', 'newBids'];
  var groups  = ['Region', 'Chief Estimator', 'BD Manager', 'Estimator'];

  var cohorts = groups.map(function (g) {
    var merged = {};
    metrics.forEach(function (m) {
      var blk = readBlock(COL[m], TITLES[m][g]);
      Object.keys(blk).forEach(function (nm) {
        if (!merged[nm]) merged[nm] = { name: nm, pipeline: 0, pipelineT: 0, awards: 0, awardsT: 0, newBids: 0, newBidsT: 0 };
        merged[nm][m] = blk[nm].a;
        merged[nm][m + 'T'] = blk[nm].t;
      });
    });
    var people = Object.keys(merged).map(function (k) { return merged[k]; });
    people.forEach(function (p) {
      if (/^n\/a$/i.test(p.name) || /unassigned/i.test(p.name)) { p.unassigned = true; p.name = 'Unassigned'; }
    });
    return { seg: 'BY ' + g.toUpperCase(), title: g, people: people };
  });

  var targets = {
    pipeline: grand(COL.pipeline),
    awards:   grand(COL.awards),
    newBids:  grand(COL.newBids)
  };

  var tz = ss.getSpreadsheetTimeZone() || 'America/New_York';
  return {
    asOf: Utilities.formatDate(new Date(), tz, "MMM d, yyyy 'at' h:mm a"),
    targets: targets,
    cohorts: cohorts
  };
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
