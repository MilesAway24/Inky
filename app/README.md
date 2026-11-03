# MossOS app

The installable version of the MossOS demo. It's a web app (PWA), so one build
installs on a Mac, Windows PC, iPhone, iPad or Android phone.

Compared with the demo it:

- **Fills the real window.** The fake macOS desktop, menu bar and dock are gone.
- **Works on phones.** Under 760 px wide the rail becomes a slide-out menu (☰)
  and every screen stacks into one column. Under 1180 px the dashboard uses two
  columns.
- **Works offline.** A service worker caches the app the first time it loads.
  The status bar shows "● Offline" when there's no connection.
- **Saves your changes.** Open tabs, habits marked done, pinned tools, goals,
  journal entries, notes and the rest are kept in the browser between launches.
  ⌘K → "Reset saved data" puts everything back to the starting data.
- **Has a real icon and shortcuts.** The moss icon from the demo's dock, plus
  shortcuts to Tasks, Habits and Focus from the installed icon.

## Build

```sh
node app/build.mjs
```

This reads `../mossos-full.html` and writes `app/index.html`. Don't edit
`index.html` by hand: change the demo, then rebuild. The build fails if a
change to the demo breaks one of its edits, so it can't quietly ship a
half-converted page. It also stamps `sw.js` so installed copies update.

## Run it locally

A service worker needs a web server; opening the file directly won't install.

```sh
cd app && python3 -m http.server 8000
```

Then open http://localhost:8000.

## Install it

The app has to be served over **HTTPS** to install (localhost is the one
exception). GitHub Pages, Netlify or Cloudflare Pages serving the `app/` folder
all work; no build step is needed on the host.

| Device | How |
|---|---|
| Mac, Windows (Chrome or Edge) | Install icon at the right of the address bar → Install |
| Mac (Safari) | File → Add to Dock |
| iPhone, iPad (Safari) | Share → Add to Home Screen |
| Android (Chrome) | ⋮ → Install app |

## Limits

- Saved data lives in that browser on that device. It doesn't sync between
  devices.
- Ticking a task's checkbox in a list is still display-only in the demo, so it
  isn't saved. Habit marks, stars, tabs and edits to data are saved.
- In an installed desktop window, ⌘W and ⌘T may go to the window rather than
  MossOS's own tabs, depending on the browser.
