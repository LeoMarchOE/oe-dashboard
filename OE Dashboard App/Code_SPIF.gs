/**
 * OPTILINE SPIF DASHBOARD — PRIVATE EDITION (serves V5.2 dashboard)
 * Bound to the OE SPIF spreadsheet. Serves the board at a private web-app
 * URL and reads the workbook server-side, so the sheet can be Restricted.
 *
 * Deploy: Deploy -> New deployment -> Web app
 *   Execute as:      Me
 *   Who has access:  Anyone within [your Workspace organization]
 *
 * After deploying, set the Google Sheet's General access to Restricted.
 * The dashboard keeps working because this script reads under your authority.
 */

// --- Access control: only these Google users may view this dashboard ---
var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co',
  'lcarroll@optiline.co','john@optiline.co','smit@optiline.co','parth@optiline.co',
  'wheaton@optiline.co','mduchesne@optiline.co','jstupalski@optiline.co','ajsanchez@optiline.co'];

function viewerEmail_() { return (Session.getActiveUser().getEmail() || '').toLowerCase(); }
function isAllowed_()   { return ALLOWED.indexOf(viewerEmail_()) !== -1; }

function doGet() {
  if (!isAllowed_()) return accessDenied(viewerEmail_());
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Optiline SPIF Sprint ’26')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpifData() {
  if (!isAllowed_()) return { denied: true };   // second layer: block direct data calls
  var ss = SpreadsheetApp.getActiveSpreadsheet();   // bound to OE SPIF
  var chart   = ss.getSheetByName('SPIF Chart');
  var sales   = ss.getSheetByName('Sales Log');
  var awarded = ss.getSheetByName('Awarded Log');

  return {
    fuel:         chart   ? chart.getRange('I3').getValue()                  : null,  // Fuel in the Tank
    awardedTotal: chart   ? chart.getRange('F3').getValue()                  : null,  // headline awards
    summary:      chart   ? chart.getRange('A1:N12').getDisplayValues()      : null,  // optional, future use
    sales:        sales   ? sales.getRange('A1:CN1000').getDisplayValues()   : null,  // pipeline rows
    awarded:      awarded ? awarded.getRange('A1:CN1000').getDisplayValues() : null   // awarded rows
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
