# MossOS mobile

The phone-first MossOS, built to run inside the Claude app on iPhone and iPad as
a claude.ai artifact. Live at https://claude.ai/artifact/HBcY6uiPtkmGgYMj982TPg.

Running inside the Claude app is what gives it, with no server of its own:

- **Sync between devices.** Your data lives in your own private part of the artifact's database (`data/users/<you>/m/…`), so the iPhone and iPad see the same thing. Nobody else can read it, including other people you share the link with.
- **Claude.** Sort your inbox and break tasks into steps.
- **Photos.** Attach a photo to a capture.

Opened anywhere else, such as a plain browser, it still works, but saves on that device only.

## What's in it

| Screen | What it does |
|---|---|
| **Today** | Jump tiles, the Play card (one thing at a time: today's tasks, timed ones first once they're within the hour, then habits, goal next actions and small jobs), habits due today, life areas, slipped-and-rescheduled, and a log that writes itself |
| **Capture** (＋) | Type or dictate anything; each line is **smart-sorted** the moment you tap *Sort it*: a new task (with its day, area, project and first step), a task you already did (ticked off), a habit you did today (marked), a new habit, a note, an idea, a journal line, or a movie you watched (added to Movies and ranked). Claude sorts when it's available; built-in rules sort otherwise. You check each before it's filed. Or save to the inbox, or straight to a task or note. Optional photo |
| **Inbox** | Anything you saved for later, sorted the same way when you're ready |
| **Tasks** | Today / Upcoming / Someday, area filter. An add box that reads plain words ("gym 6pm every Mon, Thu", "pay rent every month on the 1st at 9am"). Swipe right to finish, left for tomorrow, both with Undo; tap a name to rename it. Repeating tasks roll forward when done. Detail: notes before steps, Break it down, time, repeat, area, project. Sweep for slipped tasks. Times show in the app only: the Claude app can't send phone notifications |
| **Life areas** | Work (EMS · iCare), HCPD, Gym, Inky, School, Partner, Money. State, focus, open tasks. Editable |
| **Money** | Payday OS: pay stub and Friday plan, allowance, budget, groceries, debts, savings, roadmap and Roth IRA, spending vs plan, sort purchases, what if, "Can I afford this?", Benji, live Monarch. Import your Payday OS backup once |
| **Habits** | Mark done (on Today or the Habits page), skip a day on purpose without breaking the streak, week strip, 30-day grid, daily sparkline, streak and best run, a builder with templates, any days of the week |
| **Goals** | Rebuilt from the old demo: each goal owns a colour and shows exactly one next action. *Done* records a session and asks for the next one; *Something else* swaps it (pick an unfinished step or type one) with nothing logged as missed. *Last seven weeks* counts sessions; no percentages, nothing turns red, no week is a failure. No Claude-generated goals |
| **Projects** | Active / Parked / Finished. Each has *Done when…*, one **Next** step (*Start* puts it on today; *Done* logs it and asks for the next), *Where I left off* (asked for when you leave after time spent), its tasks, and panels by kind: checklist, log, links, notes, people, budget |
| **Journal** | One entry a day: mood plus words, prompted from today's log. A week of moods at a glance |
| **Calendar** | Month grid with a dot per task in its area's colour; week view as blocks coloured by area (the Status design); tap a day to see it and add to it |
| **Notes** | Search, filter by kind or area, pin, link to a project, turn into a task |
| **Tools** | **Rank**: Movies (with a watchlist: Want to watch / Watching / Watched; only watched ones are ranked) and any list you make (books, burgers…), ranked head-to-head by binary insertion (about 7 taps for a list of 100), re-rank or nudge anything. **Flashcards**: decks with five-box spaced review. **Bored**: pick one thing. **Gym**: sets, reps, last time, a weight trend. **Focus timer**: 25 / 5 / 15 |
| **Getting around** | Today and More open with one-tap tiles (Habits, Goals, Notes, Projects, Tools, Calendar…) with live counts. The bottom bar is Today · Tasks · ＋ · Habits · More by default; Settings lets you pick any three sections around ＋ |
| **Settings** | Sync status, bottom bar, theme, clear examples, erase |

### Added from Miles's answers

- **Quick capture on open:** opening MossOS after 10+ minutes away lands in a capture box. Enter saves to the inbox, and Claude sorts it later. Settings → Opens to switches it to Today.
- **Tomorrow:** one evening planning page, linked from Today after 5pm, Calendar and More. It shows:
  - what's left from today, with quick moves
  - tomorrow's tasks, plus an add box
  - tomorrow's bills and payday
  - habits due
  - the inbox
  - one line for today's journal
- **Add to Calendar:** timed tasks, habit reminders, and bills and paydays get a 📅 button that opens `ics.agical.io`. That service builds the calendar file, so iPhone offers "Add to Calendar", alert included. The title and time pass through it. Repeating items add their next date only. **Copy** is the fallback.
- **Challenges:** built on habits, 30/75/111 days or your own length. A day counts when every chosen habit is done.
  - **Strict:** a miss ends the run, and the run stays on record.
  - **Grace:** one miss per 7 days is forgiven.
  - Each challenge shows as a wall of squares; it also appears on Habits and in Today's Habits heading.
- **Books:**
  - Pages, pace and a finish estimate. Logging feeds a reading habit.
  - Quotes and thoughts are saved as notes, so they show in Notes search and under a 📖 Books filter.
  - A Claude reading companion: recap, discussion questions, "how does this apply to me", or ask anything. It is told your page and not to spoil past it or guess.
  - Capture understands "read 20 pages of …" and "“quote” — Book p. 27".

### Money (Payday OS)

The Money tab runs Payday OS **unchanged** (`mobile/finance/payday.html`) inside a frame on the MossOS page. `build.mjs` makes three checked edits to it, and the build fails if any of them stops matching:

1. A bridge, so the frame uses the page's Claude connection (sync, Monarch, Benji).
2. Payday's own header and tabs are hidden; MossOS's section row (Today · Plan Friday · Budget · Debts · Savings · Month · Monarch · More · Can I afford this?) drives it instead.
3. The glue in `mobile/finance/glue.js`: `__finSummary`, `__finEvents`, `__finLog`, `__finImport`, `__finTheme`, `__finInfo`. Each is built from Payday's own functions, so the numbers match.

Money also shows up across MossOS:

- **Today:** left today, left until Friday, and the next bills.
- **Calendar:** marks for paydays and bills.
- **Capture:** a **Spent** type ("spent $12 at Wawa") goes into Payday's purchase log.
- **Money life area:** shows the next bill.

Payday's data lives in this artifact's database at `data/users/<id>/state`. To bring over the old Payday OS link's data, use **Money → Import** (or Settings → Import from Payday OS) and paste Payday OS → Settings → *Copy JSON backup*. After that the old link keeps working but no longer syncs with MossOS.

Second pass, also in Money:

- **Groceries** is in the section row.
- **More** opens a sheet with Roadmap (card kill dates, Roth IRA), Spending (plan vs actual), Sort purchases, Month, What if, Ask Payday, Monarch and Settings.
- **Groceries → Tasks:** **Send** turns this week's shopping list into one "Grocery run" task, one step per item. Sending again updates the same task.
- **Capture:** a **Grocery list** type ("add eggs and milk to the grocery list", "groceries: bread, rice") puts the items on Payday's list.
- **Today:** the Money section shows spending against this week's plan (once Monarch is connected) and the next card to be paid off.
- **Heads up:** purchases waiting to be sorted, wishlist items whose 72 hours are up, and an unfinished Friday checklist on Fridays.

## Build and test

```sh
node mobile/build.mjs          # → mobile/dist/mossos.html (the file that gets published)
node mobile/test/e2e.js        # Playwright: phone, iPad, and plain-browser runs
```

The source is plain JS in `src/js/`, loaded in file-name order into one script. There's no framework and no dependencies.
`test/mock-claude.js` stands in for the Claude app (database, user, Claude) so the flows can be tested locally. It can't
prove real sync or real Claude answers; those need the live link.

## Publishing

Publish `mobile/dist/mossos.html` to the artifact URL above with these capabilities:
`{"db":{},"user":{},"sample":{},"assets":{}}`.
