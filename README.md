# Inky / MossOS

The working MossOS demo and the document that describes it.

| File | What it is |
|---|---|
| `mossos-full.html` | The demo. A single self-contained page — open it in a browser, no build step, no dependencies. |
| `MOSSOS-BUILT.md` | The inventory of what the demo contains, section by section. |
| `mobile/` | **The phone-first MossOS** that runs inside the Claude app on iPhone and iPad, with sync, Claude and photos. `node mobile/build.mjs` builds it; see `mobile/README.md`. |
| `app/` | The installable app (PWA) built from the demo: fills the window, works on phones and offline, saves your changes. `node app/build.mjs` rebuilds it; see `app/README.md`. |

`MOSSOS-BUILT.md` describes only things that exist and run. Where the document
and the demo disagree, the demo is the truth.
