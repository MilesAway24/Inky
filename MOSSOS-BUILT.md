# MossOS — what the demo actually contains

**Version 1.0 · 17 September 2026.** This is the precise inventory of the working
demo (`mossos-full.html`). It is the spec Claude Code rebuilds from, so every line
describes something that **exists and runs**, not something intended.

Companion documents: `mossos-CLAUDE.md` (the rules), `mossos-build-plan.md` (the
task list), `mossos-master-plan.md` (the reasoning and the research behind it).

**Nothing here is a mock-up.** Every screen below responds, every button does its
thing, and the whole demo was regression-tested in a browser: 14 destinations,
11 flows, zero page errors.

---

## 0 · Shell

| Part | Behaviour |
|---|---|
| Window | macOS desktop scene, dock, menu bar, traffic lights, 1232 × 790 app window |
| Tab strip | Chrome rules. Dashboard is pinned; objects open new tabs; `×` closes; `⌘W`; `+` |
| Breadcrumb | `MossOS / Tasks / Send the deck` — **every crumb but the last is clickable** and navigates back |
| Rail | Six groups, collapsible, 216 wide |
| Status bar | Session state · `⌘K` · date and a readable digital clock |
| Command palette | `⌘K` — fuzzy, grouped, arrow keys, Enter |
| Hotkeys | `⌘K` `⌘W` `⌘T` `⌘⇧S` Show me · `⌘⇧C` Smart capture · `⌘⇧F` session · `⌘1–7` |

### Rail order — final

```
Dashboard
DAILY      Tasks · Habits · Goals · Calendar · Notes · Journal
PROJECTS   MossOS · Learn Resolve · Invoices · Home
FOCUS      Focus · Workspaces · Smart capture · Show me
TOOLS      All tools · Tool Studio · [★ pinned] · [3 recent] · Command palette
SYSTEM     Live fix · Connectors · Settings · Desktop only
```

**Library is gone.** Projects took its place, Tools is second from last. Topics and
Lessons moved inside Notes.

---

## 1 · The four header buttons — what each one is for

These sit at the right of the breadcrumb bar and all four are wired.

| Button | What it does | Why it exists |
|---|---|---|
| **New ▾** | Menu: new task · habit (opens the builder) · goal · note · journal entry · tool | One creation point that is correct on every screen, so you never hunt for the right `+` |
| **Share** | Menu: export **PDF** · export **.docx** · copy as **markdown** · **send to a device** (via Connectors) · copy a **deep link** (`moss://view/arg`) | Getting a thing *out* is a different job from making it, and it is the same five options everywhere |
| **☆ Star** | On a tool: pins it to the rail permanently, and the icon fills. Anywhere else it says so rather than silently doing nothing | The rail holds five tool slots; starring decides which are yours and which rotate |
| **≡ (three lines)** | Menu: save these tabs as a workspace · move to… · **send to Drifted** · report a bug here · print · delete | Everything that acts on *this page as an object*. Drifted lives here because it is the opposite of urgent |

---

## 2 · Dashboard

Unchanged from the version that worked, plus two widgets.

Left column — clock card, **Actions** list, full **Apple Music** player (scrub,
volume, shuffle, repeat, queue), **Thoughts**.
Centre — **Working on right now** project gallery, **Tasks this week**, **Your tools**.
Right column — **Gallery**, **Play widget**, **Body double widget**, Pomodoro,
Recent fixes, Kept up with.

**Gallery** replaced the old "You" panel: a featured image with caption and date,
six thumbnails, and Shuffle. The stats it displaced were all duplicated elsewhere.

---

## 3 · Play and Body double as widgets

Both are now **one component rendered in three places** — Dashboard, Focus, and the
top of Tasks — sharing one piece of state. Doing a Play card in the dashboard
advances it on the Play page and in Tasks.

**Play widget** — the current card: icon, title, one line of why, its type pill, an
honest time estimate, then **Do it** and **skip ›**. Nothing else.

**Body double widget** — pick Wren, Bo or Juno inline, then *Work alongside*. While
running it shows the elapsed time and what they are doing, and the floating
always-on-top companion appears in the window. **End** stops both.

**Step zero is gone from every surface** — Play, Tasks, task detail. The Play card is
Do it / skip, which is the binary the mechanic depends on.

---

## 4 · Tasks

- Four stat tiles, search, group/sort/filter, `+ New task`
- **Three views: List · Board · 🧹 Sweep.** Sweep moved *inside* Tasks — the slipped
  list with four destinations: Today · Tomorrow · Whenever · **Drifted**
- The Play and Body-double widgets sit at the top
- Task detail: **Notes come before Steps** — notes are editable in place and the
  more-used surface; steps are below them
- No step zero. Buttons are Start this · Break it down · Reschedule

---

## 5 · Habits — rebuilt

**Tracking is real and daily.** A `Mark done` button on every habit, in three places
(Today list, Daily view, habit detail). Marking updates the week strip, the 30-day
grid, the month percentage, the "done today" tile and awards XP.

**Four stat tiles:** Done today · Marked this month · Longest run · Habit count.

**Three data views:**

| View | Shows |
|---|---|
| **◷ Week** | Seven-day bar strip per habit, in that habit's own colour, with a percentage |
| **▦ 30 days** | A 30-cell grid per habit, plus percentage and longest run |
| **☰ Daily** | One row per habit with a 14-day sparkline and the mark button |

**Every habit has an icon and a colour** carried consistently through every view,
the rail, and its detail page.

### The habit builder — three steps

1. **Start from something small** — eight templates (meds, move ten minutes, read a
   few pages, water, tidy one thing, phone out of the bedroom, write one line, sit
   still) or start blank
2. **What is it, and what makes it easy** — name, icon (12), colour (6), and **the
   cue**: what already happens right before it. The builder says why: an
   implementation intention is meta-analysed at **d = 0.99** across 29 studies
3. **How often** — day picker, and a live preview. **On a miss: "Holds at baseline"
   is the only option**, stated as a fact rather than offered as a choice

Habit detail shows month percentage, longest run, marks, the week strip, the 30-day
grid, and the cue.

---

## 6 · Goals — new

Four live goals, each with **its own colour, icon and area** (Thesis, Body, Money,
Build). Grid of cards showing the goal, why it matters, **the one next action**, a
progress bar and a due date.

Goal detail: a large **"The one next action"** block with Start this, a seven-week
activity spark, the parts as checkable rows, and the why in a note box.

**A goal shows one next action and nothing else actionable.** It never turns red,
never reports a percentage behind, and going quiet produces no event.

---

## 7 · Calendar — three linked views

Tasks, habits and goals all appear, colour-coded, with a legend.

| View | What it is |
|---|---|
| **☀ Day** | Time-ordered rows with a coloured spine, kind icon, and a line about where the free blocks are |
| **◷ Week** | Seven columns, every item as a coloured pill with its kind icon |
| **▦ Month** | 30 cells, coloured dots per item, a count, today outlined in green |

---

## 8 · Notes — a real document system

Notes now **houses Topics and Lessons**. One list, filterable by All · 📄 Notes ·
🗂 Topics · 📓 Lessons, with search.

Opening any document opens a **word-processor tab**:

- A toolbar: **B / I / U · H1 · H2 · bullets · numbered · quote · code · divider** — all
  working through `execCommand` on a live contenteditable page
- **A real page** — cream stock, margins, a page shadow, an editable title, a metadata
  line, and a footer with page count and a live word count
- **Export: PDF · .docx · .md**, each wired
- `Saved · synced to 4 devices` in the toolbar; documents are stored once and
  reachable from every connected device via Connectors

---

## 9 · Journal — new

A compose card for today with a **mood picker** (good / okay / low), a free
textarea, **Save**, and **Give me a prompt** (four rotating prompts). Below it, this
week's mood counts as pills — *recorded, not scored* — and the entries as rows with
date, text and mood.

*"Nothing is required. A blank day stays blank."*

---

## 10 · Focus — now hosts three things

| Tab | Contents |
|---|---|
| **🎯 Session** | The Play and Body-double widgets, the three modes (Light / Study / Locked with its cost dialog), the **drift ladder** as four rungs, and the session log |
| **🪑 Body double** | The full body-double surface — three characters with their own rhythms, start, not-today, and the deliberately-absent list |
| **⏱ Pomodoro** | The working 25/5 timer with mode chips, start and reset |

---

## 11 · Smart capture — brought over from Inky

`⌘⇧C` from anywhere, or the rail item.

- **Three sample screens** — Mail, Safari, Notes — each with a Capture button and a
  scan animation over the source
- Output is **CaptureActions**: a neutral label, one of six categories
  (fact · resource · logistics · idea · question · progress) each with its own
  colour, and provenance
- **Add** puts it in the review queue — *not* in Tasks. A second step promotes it
- **The credential line**: *"1 item was dropped for containing credentials. MossOS
  kept the count, not the content."* The Mail sample contains a card number and the
  Notes sample a wifi password; neither ever appears
- `⌘⇧C` opens a floating capture sheet in the corner with the same results

**What it never keeps**, stated on the page: no frame on disk, no window titles, no
credentials, nothing auto-entered.

---

## 12 · Workspaces

A named set of tabs, saved and restored whole. Opening one repopulates the tab strip
and shows the **handoff note** above the page. Closing asks **"Where were you?"** —
one line, written by you, skippable in silence.

---

## 13 · Tools

- **★ Pinned** section — starred tools, permanently in the rail
- **◷ Last three used** — rotates automatically as you open tools
- **🧰 Everything else** — the remaining nine, in a compact grid
- Opening a tool bumps it to the front of recents
- The star in the header pins and unpins, rebuilding the rail live

---

## 14 · Unchanged and still working

Tool Studio (blocks, draft, templates, checks) · Live fix · Connectors · Show me
with the annotation overlay · Projects · Settings (nine rows, three groups) ·
Desktop only.

---

## 15 · Colour

Every section now carries its own hue, the way the mobile build did:

| Where | Colour |
|---|---|
| Goals | one per goal — moss, blue, tan, purple |
| Habits | one per habit, through every view |
| Capture categories | six, one per category |
| Calendar | by kind — tasks green, habits blue, goals purple |
| Journal moods | green / blue / tan |

Green stays affirmative, amber stays attention, and **nothing is ever red for being
late** — because nothing is ever late.

---

## 16 · What this demo deliberately does not have

- **Step zero** — removed everywhere on request
- **Overdue penalties** — listed in Settings as *"Not implemented, and will not be"*
- **A general-purpose floating widget** — the only floating surface is the
  body-double companion, and it exists only while a session runs
- **Count badges in navigation** beyond the rail's quiet numerals
- **Streak-loss language** anywhere

---

## For Claude Code

Build to this document. Where it and `mossos-build-plan.md` disagree about scope,
the build plan decides *order*; this document decides *behaviour*. Where either
disagrees with the running demo, **the demo is the truth** — open it and look.

The rules in `mossos-CLAUDE.md` still govern everything: never penalise absence,
never block, no count badges, never open with what is owed, nothing enters unapproved,
gate cosmetics never function.
