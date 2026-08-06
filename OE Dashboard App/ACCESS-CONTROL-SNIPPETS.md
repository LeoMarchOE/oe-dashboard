# Restrict a dashboard to specific Google users

Do this in each dashboard's Apps Script project (SPIF, Pipeline, Precon, Leadership).
The CEO dashboard is already done.

## Steps (per dashboard)
1. Open the dashboard, then **Extensions → Apps Script**.
2. In `Code.gs`, find the **`function doGet(...) {`** line. Paste the matching
   **GATE** block (below) on the very next lines, right after the `{`.
3. Paste the **accessDenied** function once, at the bottom of the file (outside doGet).
4. **Ctrl+S**, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
5. Confirm the deployment is **Execute as: Me** and **Who has access: Anyone within optiline.co**
   (the check can only read the visitor's email when it's domain-restricted like this).

Emails are compared in lowercase, so case in the sheet/typing doesn't matter.

---

## GATE — OE SPIF, OE PIPELINE, OE PRECON DASHBOARD  (same list for all three)
Paste right after `function doGet(...) {`:

```javascript
  // --- Access control: approved Google users only ---
  var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co',
    'lcarroll@optiline.co','john@optiline.co','smit@optiline.co','parth@optiline.co',
    'wheaton@optiline.co','mduchesne@optiline.co','jstupalski@optiline.co','ajsanchez@optiline.co'];
  var VIEWER = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (ALLOWED.indexOf(VIEWER) === -1) return accessDenied(VIEWER);
```

## GATE — OE LEADERSHIP
Paste right after `function doGet(...) {`:

```javascript
  // --- Access control: approved Google users only ---
  var ALLOWED = ['leo@optiline.co','tommy@optiline.co','mick@optiline.co','gkelly@optiline.co',
    'lcarroll@optiline.co','john@optiline.co','smit@optiline.co','wheaton@optiline.co',
    'claudia@optiline.co','alejandra@optiline.co','rogercolem@optiline.co','hector@optiline.co',
    'jordanburke@optiline.co','josh@optiline.co','rmarin@optiline.co'];
  var VIEWER = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (ALLOWED.indexOf(VIEWER) === -1) return accessDenied(VIEWER);
```

---

## accessDenied — paste once at the bottom of EACH project's Code.gs
(Identical for every dashboard.)

```javascript
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
```

---

## To add or remove people later
Edit the `ALLOWED` list in that project, save, and redeploy a new version.
