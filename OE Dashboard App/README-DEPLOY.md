# Optiline Dashboards — GitHub Pages version (custom iOS icon)

This is the self-hosted version of the launcher. Because GitHub Pages controls
the page itself, your **OE DASHBOARD icon** shows up properly when you add it to
the iPhone home screen — which Apps Script couldn't do.

It works exactly like before: tap a tile, the dashboard opens inside the app,
back button to switch. Adding a future dashboard is still one block in the
`APPS` list inside `index.html`.

## What's in this folder
- `index.html` — the launcher (logo + fonts already embedded)
- `apple-touch-icon.png` — the iOS home-screen icon (OE + DASHBOARD)
- `icon-120/152/167/180/192/512.png` — icon sizes for all devices
- `manifest.webmanifest` — makes it installable as an app

Keep all files together in the same folder — don't rename them.

---

## Publish on GitHub Pages (about 5 minutes, free)

1. Go to **https://github.com** and sign in (or create a free account).
2. Click **+** (top right) → **New repository**. Name it e.g. `oe-dashboard`. Set it **Public**. Click **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Drag in **all the files from this folder** (the `.html`, all the `.png`s, and the `.webmanifest`). Click **Commit changes**.
5. Go to the repo's **Settings** → **Pages** (left sidebar).
6. Under "Build and deployment" → **Source**, choose **Deploy from a branch**. Set branch to **main** and folder to **/ (root)**. Click **Save**.
7. Wait ~1 minute, refresh the Pages settings — it'll show your live URL, like:
   `https://YOURNAME.github.io/oe-dashboard/`

That URL is your app.

---

## Put it on the iPhone home screen (with the custom icon)

1. Open the GitHub Pages URL in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. You'll get the **OE DASHBOARD** icon on your home screen, opening full-screen with no browser bars.

On **PC**: bookmark the URL, or in Chrome/Edge use **⋮ → Save and share → Create shortcut** (check "Open as window").

---

## Add more dashboards later

Open `index.html`, find the `APPS` list near the top of the `<script>` section,
and copy one block:

```js
{ name: "OE SAFETY", desc: "Safety Log", url: "https://.../exec", icon: "grid" }
```

Edit the four fields, save, and re-upload `index.html` to the repo (GitHub:
open the file → pencil icon → paste → Commit, or drag the new file in). The URL
stays the same. Icon keys: `spif`, `pipeline`, `precon`, `grid` (default).

---

## Note on the dashboards loading
Your dashboards are restricted to the `optiline.co` Google Workspace, so you'll
need to be signed into your Optiline Google account in Safari for them to load
inside the app. Each dashboard also has a **pop-out** button (top-right) that
opens it full-screen in a new tab if it ever won't embed.
