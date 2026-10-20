# Mistakes & Lessons

A working reference for the assistant. `DESIGN.md` says what the code is,
`LOG.md` says what changed and why, and this file says **what went wrong
while getting there**, so the same time and tokens aren't spent twice.

Read this before a debugging round, especially a visual or interaction
one. Add to it whenever something takes more than one attempt.

The general lessons are carried over from GeoQuiz and Anatomy Quiz
(`reference/1/MISTAKES.md`, `reference/2/MISTAKES.md`, which have the full
stories).

---

## The single biggest lesson

**A bug reported twice means the theory is wrong. Stop theorizing and go
measure.** Build a way to observe the real output (a screenshot, a
printed model, a probe of what's under the pointer) before the next fix.

## Verification playbook

- **Solver first, in Node.** `npm test` checks the textbook cases. When a
  diagram looks wrong, print `solve(model)` and its `V`/`M` at the key
  points before touching the drawing code.
- **Look at the real page.** Playwright + Firefox (the user's only
  browser): `firefox.launch()`, screenshot, `Read` the PNG. Check at
  1280 px and at 390 px (phone) at least.
- **Drag with real mouse events**, with a small first move (the app's
  drag threshold is 4 px) and `steps` on the long move. Then read the
  saved model back from localStorage (`beamlab-build`) instead of trusting
  the picture.
- **Jitter synthetic clicks** (down, move 1–3 px, up). Perfectly still
  clicks hid a real "click does nothing" bug in GeoQuiz.
- **Check a control**: when changing shared code (`beamView.js`,
  `diagramView.js`, `board.js`), check both Build and Practice.

## Recurring mistake patterns

1. **Asserting instead of computing.** If a fix depends on a CSS
   specificity, inheritance, or hit-testing claim, compute or measure it.
2. **"This can only help."** A wider invisible hit area is extra pixels:
   it can swallow a neighbour's events (see below).
3. **Forgetting siblings in an element family.** Grep every place that
   enumerates supports / loads / hinges when adding a kind.
4. **Scale changes mid-gesture.** Anything that rescales the board during
   a drag turns absolute pointer positions into jumps; freeze the scale
   (`viewLock`) or use relative movement.
5. **Overclaiming in docs.** Write what was verified, not how confident
   it felt.

## Specific lessons from this project

- **Transparent strokes are hittable.** `.hit { stroke: transparent;
  stroke-width: 18 }` on a support's rect spilled 9 px past it and covered
  the beam's end handle: pressing the handle selected the roller. Fat
  strokes only on `line.hit`; handles drawn last.
- **`Math.round` isn't symmetric**: `Math.round(-1562.5) = -1562`, so
  −15.625 → −15.62 while 15.625 → 15.63. Round |v| and put the sign back.
- **Copying a stylesheet by section boundaries drops rules** that live in
  an unexpected section (`.action-button` sat between the 3D viewer rules
  in Anatomy Quiz). After copying, grep for every class the new code uses.
- **Statics sign check**: a downward load to the right of a wall needs a
  *counterclockwise* fixed-end moment. A test once expected −80 for +80;
  check the free body before "fixing" the solver.
- **An extremum can land exactly on a sample point** (a symmetric beam's
  midspan): V is exactly 0 there, so a strict sign-change test misses it.

## Environment gotchas

- `pkill -f "vite --port 5199"` matches its own shell's command line and
  kills the shell (exit 144): the rest of that command never ran. Kill
  by PID, or run the dev server as a background task.
- Scratch scripts go in the project root as `scratch-*.mjs` so imports
  resolve. Delete them when done.
- Playwright's Firefox build is in `~/.cache/ms-playwright` (shared with
  the other projects).
