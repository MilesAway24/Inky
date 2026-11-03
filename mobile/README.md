# MossOS mobile

The phone-first MossOS, built to run inside the Claude app on iPhone and iPad as
a claude.ai artifact. Live at https://claude.ai/artifact/HBcY6uiPtkmGgYMj982TPg.

Running inside the Claude app is what gives it, with no server of its own:

- **Sync between devices.** Your data lives in your own private part of the artifact's database (`data/users/<you>/m/…`), so the iPhone and iPad see the same thing. Nobody else can read it, including other people you share the link with.
- **Claude.** Sort your inbox and break tasks into steps.
- **Photos.** Attach a photo to a capture.

Opened anywhere else, such as a plain browser, it still works, but saves on that device only.

## What's in it (Phases 1–3)

| Screen | What it does |
|---|---|
| **Today** | Priorities (1 P1 + 2 P2; a fourth means swapping one to tomorrow), the Play card (one thing at a time from tasks, habits and goal next actions, *Do it* / *Skip*), habits due today, life areas, slipped-and-rescheduled, and a log that writes itself |
| **Capture** (＋) | Type or dictate. Each line becomes an inbox item, or save straight to a task or note. Optional photo |
| **Inbox** | Sort with Claude (type, area, day, first step; you confirm each) or by hand |
| **Tasks** | Today / Tomorrow / This week / Later / Whenever / Drifted, area filter. Detail: notes before steps, Break it down, When, P1/P2, area. Sweep for slipped tasks |
| **Life areas** | Work (EMS · iCare), HCPD, Gym, Inky, School, Partner, Money. State, focus, open tasks. Editable |
| **Habits** | Mark done (on Today or the Habits page), skip a day on purpose without breaking the streak, week strip, 30-day grid, daily sparkline, streak and best run, a builder with templates, any days of the week |
| **Goals** | Why, steps that set the progress, and one next action. *Put it on today* makes it a task; finishing it asks for the next one, and Claude can suggest three |
| **Projects** | Active / Parked / Finished. Each has *Done when…*, one **Next** step (*Start* puts it on today; *Done* logs it and asks for the next), *Where I left off* (asked for when you leave after time spent), its tasks, and panels by kind: checklist, log, links, notes, people, budget |
| **Journal** | One entry a day: mood plus words, prompted from today's log. A week of moods at a glance |
| **Calendar** | Month grid with a dot per task in its area's colour; week view as blocks coloured by area (the Status design); tap a day to see it and add to it |
| **Notes** | Search, filter by kind or area, pin, link to a project, turn into a task |
| **Settings** | Sync status, theme, clear examples, erase |

Money is the next phase: Payday OS moves into it. Until then the Money tab links to Payday OS. The full plan is in the repo history and in `/root/.claude/plans/`.

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
