# Beam Lab — Design Document

## Goal

A browser game for learning statics of beams: support reactions, and the
axial force (N), shear force (V) and bending moment (M) diagrams. Two
ways in:

- **Build**: a sandbox. Drag elements onto a grid, see the answers live.
- **Practice**: the game. Solve generated beams yourself, get graded.

Same look, habits and project setup as GeoQuiz and Anatomy Quiz (their
sources are in `reference/1` and `reference/2`). `reference/3` holds the
two beam pages the scope was taken from: a beam calculator (supports:
pinned, roller, fixed; loads: point, distributed, moment) and the
"beam formulas with shear and moment diagrams" table, which `npm test`
checks the solver against.

Metric only: m, kN, kN/m, kNm. English UI.

## Tech stack

- Vanilla JavaScript (ES modules), no UI framework.
- [Vite](https://vite.dev/) for the dev server and build, `base: "/beamlab/"`.
- SVG for every drawing (no canvas, no chart library).
- No backend. Fully static; Build's beam and the settings live in
  localStorage.
- `node --test` for the solver checks; Playwright + Firefox (devDependency)
  for browser-driven checks.

## Architecture

```
src/
  core/
    model.js      — the beam model (plain JSON), support/load metadata, helpers
                    (point-load components, load resultants, key points, fitToBeam)
    solver.js     — reactions (FEM), N/V/M (method of sections), deflected shape,
                    diagram sampling, moment extrema
    generator.js  — random practice problems: BEAM_TYPES × LEVELS
    explain.js    — the equilibrium equations shown after a reactions answer
    examples.js   — Build's Examples menu (textbook cases)
    format.js     — number formatting/parsing, niceStep()
    settings.js   — persistent preferences (localStorage), GeoQuiz's settings.js
  render/
    svg.js        — s() SVG element helper, arrows, moment arcs
    beamView.js   — drawModel(): beam, supports, hinges, loads, reactions, ruler, handles
    diagramView.js — drawDiagram(): one N/V/M/w band; keyLabels()
    board.js      — shared x scale (makeScale) and the stack of solved bands
  ui/
    dom.js, screenKit.js, hamburgerMenu.js — copied from Anatomy Quiz
    popup.js      — centred popup (Examples), Anatomy Quiz's Subjects popup
    home.js       — Practice / Build / How to play / Settings
    gameWizard.js — task → beam type → loads → number of beams
    game.js       — Practice: stages, grading, summary
    diagramEditor.js — the player's diagram: draggable dots, grading
    build.js      — Build: palette, drag & drop, inspector, undo, live diagrams
    settingsScreen.js, helpScreen.js
  main.js         — top-level screen router; screens may return a cleanup function
test/
  solver.test.mjs — 18 checks against the beam-formula tables, equilibrium, stability
```

### The model (`core/model.js`)

One straight horizontal beam. Every x is measured from its left end.

```
beam:     { x0, length }              x0: where it sits on Build's grid (cosmetic)
supports: { id, type, x }             "pin" | "roller" | "fixed"
hinges:   { id, x }                   internal moment release, never at an end
loads:    { id, type: "point",  x, value, angle }   kN; angle from straight down, + towards +x
          { id, type: "moment", x, value }          kNm, counterclockwise +
          { id, type: "dist",   x1, x2, q1, q2 }    kN/m, linear, downward +
```

Plain JSON on purpose: it's cloned for every undo step and drag preview,
saved to localStorage, and handed to the solver and the game as is.
Rules the UI keeps (and the solver checks): a fixed support only at an
end (it's drawn as a wall), at most one support per point, no hinge on a
fixed support.

Supports are lettered A, B, C… from left to right (`supportNames`), and
reactions named Ax, Ay, MA like on paper.

### Sign conventions

- Loads and reactions: x right, y up, moments counterclockwise positive.
  The reactions the player types are positive in the direction of the
  dashed arrows: Ax →, Ay ↑, MA ↺.
- Internal forces: N > 0 in tension; V > 0 when the forces left of the
  cut push up; M > 0 sagging (bottom fibres in tension).
- Drawing: N and V positive up. M positive up by default, or on the
  tension side (positive down) with Settings → "On the tension side", the
  European habit. Grading compares values, so both drawings grade the same.

### Solver (`core/solver.js`)

1. **Reactions by FEM.** Nodes at every key point (ends, supports,
   hinges, point loads, moments, distributed-load ends), so each element
   carries at most a linear distributed load. Euler–Bernoulli frame
   elements with EA = EI = 1: a uniform EI doesn't change the reactions,
   and with consistent nodal loads (3-point Gauss, exact for cubic shape
   functions × a linear load) the nodal results are exact. A hinge node
   gets two rotation DOFs, one per side. A moment applied at a hinge goes
   to the right side (the generator never puts one there).
   Reactions: R = K·u − F at the restrained DOFs.
2. **Stability.** Axial and bending decouple in a straight beam, so the
   two subsystems are solved apart. A zero pivot (below 1e-9 × the
   largest diagonal) in the axial one means "nothing stops it sliding
   sideways"; in the bending one, a mechanism. Each gets its own message.
   `indeterminacy()` is the textbook count: reactions − 3 − hinges.
3. **N, V, M by the method of sections**, in closed form: everything left
   of the cut, the reactions included, with the distributed loads'
   integrals done analytically. `fn(x, "-")` / `fn(x, "+")` are the
   limits from the left and right, so jumps are exact. Round-off below
   1e-9 is snapped away (12.5, not 12.499999999999998).
4. **Deflected shape** (`sol.deflection`): FEM nodal v and θ, then EI·w'' = M
   integrated inside each element. Shape only: there's no section, so no
   units. The test checks 5wL⁴/384 for a UDL.

`sampleDiagram` turns a diagram into a polyline with a repeated x at every
jump; `momentExtrema` finds the zeros of V inside segments (sampling +
bisection; an exact zero on a sample point counts too).

### Problem generator (`core/generator.js`)

Beam types: simply supported, cantilever, overhanging (right, left or
both), with a hinge (fixed–hinge–roller, or pin–roller–hinge–roller,
either way round), statically indeterminate (propped cantilever,
fixed–fixed, two-span continuous), and mixed (the determinate ones only:
indeterminate beams need the force method, which is a choice, not a
surprise).

Levels:
- **Easy**: 1–2 vertical point loads, 5–40 kN in 5s, positions on a 1 m grid.
- **Medium**: a uniform load (full span or part), maybe a point load; 0.5 m grid.
- **Hard**: at least one of a triangular load, a couple, or an inclined
  force (30/45/60°), plus 1–2 more loads of any kind.

Point loads and couples never sit on a support (they'd go straight into
the reaction) or a hinge. Each problem is solved before it's handed out
and rejected if unstable or if nothing bends.

### Board layout (`render/`)

One SVG, stacked bands, all on the same x scale (`makeScale`, 72 px left
margin for the band titles):

```
model band (250 px): loads above the beam, supports and reactions below,
                     dimension line with every key point
N band (170 px)      only if a force has an axial part
V band
M band
w band               Build only, off by default
```

Value labels (`keyLabels`): both sides of every key point (one label where
they agree), moment peaks first and in bold with a dot. A label that would
overlap one already placed is dropped. Colours: loads amber, reactions
green, N violet, V blue, M pink, w teal.

### Build (`ui/build.js`)

- **Palette**: Beam, Pinned, Roller, Fixed, Hinge, Force, Uniform load,
  Triangular, Moment. Dragging a tile renders the would-be model as a
  live preview (diagrams too) while over the board; dropping commits.
  A tap adds it at the middle of the beam. One beam at a time (its tile is
  disabled once placed); a dropped support replaces one at the same point.
- **On the board**: drag elements along the beam (snapped to Settings'
  step); the beam body moves it all; the round end handles resize it;
  a distributed load's square corners move that end sideways and change
  its intensity up/down (1 kN/m per 4 px, steps of 0.5). Press without
  moving selects. While dragging, the scale is frozen (`viewLock`).
  Stretching the beam freezes it at ≥ 12 m, so on a phone the view zooms
  out for room, and the new length is measured from the drag's start,
  not the pointer's absolute position (it would jump otherwise).
- **View**: at least 12 m of grid on a wide screen; under 700 px wide, just
  the beam + 1.5 m, so it's not tiny.
- **Inspector**: the selected element's exact numbers (fields commit on
  Enter/blur), direction buttons for forces (↓ ↑ → ← ↘ ↙) and moments,
  Delete. Not rebuilt while one of its fields has focus.
- **Toggles**: Reactions, N, V, M, Deflection. Hover shows a crosshair and
  "x = … N = … V = … M = …" in the status line, which otherwise says
  "Statically determinate" / "indeterminate (degree n)" or why it's
  unstable.
- Undo/redo (200 steps; ↶ ↷, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z), Delete key,
  Escape. The beam is saved to localStorage (`beamlab-build`).
- **Practice this** starts a one-beam full-solution game on the current
  beam; ☰ → Back there returns to Build.

### Practice (`ui/game.js`, `ui/diagramEditor.js`)

Wizard: "What do you want to practise?" (Full solution / Support reactions
/ Shear force diagram / Bending moment diagram) → "Choose a beam" →
"Choose the loads" → "How many beams?" (3, 5, 10). Named steps with a
history, as in GeoQuiz, so ☰ → Back returns to the last step.

Header: "Beam 2 / 5", the stage chip (with more than one stage), "Score",
the beam's timer, Confirm → Next / Next beam / See Results, ☰ (Restart /
Back / Home).

Stages: `full` = reactions → N (only with an axial load) → V → M; the
others are one stage. Single-diagram tasks show the reactions solved. In a
full solution, diagrams already done stay up (solved, faint) as help.

- **Reactions**: one field per component, dashed named arrows on the beam.
  Right within max(0.02, 1 %). Empty counts as 0. Enter goes to the next
  field, and confirms from the last. The result shows ✓ or the right value
  per field, the solved reactions on the beam, the distributed loads'
  resultants (dashed), and `equilibriumSteps`: resultants, ΣFx, ΣFy, ΣM
  about the first support, "ΣM = 0" for the part right of each hinge,
  and a note on indeterminate beams.
- **Diagrams**: a dot just left and just right of every key point (jumps),
  plus a middle dot on a segment where the curve bends (V under a varying
  load, M under any distributed load); the curve through a middle dot is a
  parabola. Drag dots (a press within 26 px of a dot's column grabs it and
  moves it there), or pick one (‹ › or ← →) and type, or nudge (− + or
  ↑ ↓). The y range is 1.3 × the true maximum, rounded up to the value
  grid; the snap step is a nice number near 1/40 of it; a dot is right
  within max(2 % of the maximum, 0.6 × step, 0.01). After Confirm: dots
  green/red, the exact diagram dashed over the player's, with its labels,
  and for M the largest |M| and where.
- One point per stage that's entirely right. Summary: "Game Over", score,
  times, and every beam with each stage ✓ or ✗ right/total; Play Again /
  Back / Home, inert for the first 500 ms (`REPORT_GUARD_MS`, as in
  Anatomy Quiz).

### Interface

GeoQuiz / Anatomy Quiz's dark palette and classes (`menu-screen`,
`menu-option`, `wizard-*`, `game-header`, `game-menu-*`, `action-button`,
`game-summary`, …), copied rather than reinvented. Menu screens are one
centred column of equal buttons. On narrow screens Build's palette
becomes a scrolling row above the board.

Settings (`beamlab-settings`): "Bending moment diagram": Positive up
(default) / On the tension side. "Build: snap positions to": 1, 0.5
(default), 0.25, 0.1 m.

## Current scope (v1)

Straight horizontal beams only, uniform EI, no settlement or springs.
No frames, trusses or inclined members. Not tried on a physical phone.

## Possible next steps

- Frames (vertical members, corners): the FEM already has axial DOFs;
  needs 2D element orientation, a 2D editor and diagrams drawn along members.
- A section (I-beam etc.) and material, for real deflections and stresses
  like the calculator in `reference/3`.
- Practice modes: "find the maximum moment and where", "which diagram
  belongs to this beam" (multiple choice), a deflected-shape sketch.
- Step-by-step hints during a stage (e.g. "the jump at B equals By").
- Slovenian translation.

## Project conventions

- **Docs**: four markdown files, each with one job: this one
  (design/overview), `LOG.md` (chronological history), `MISTAKES.md`
  (process lessons, read before a debugging round), `README.md`
  (outward-facing intro). Don't add further `.md` files.
- **Tests**: `npm test` after touching `core/`. The deploy runs it too.
- **Archiving**: after a significant change, run `npm run archive --
  <short-label>`. It excludes `node_modules`, `dist`, `archive` and
  `reference`, and keeps the 10 most recent snapshots.
- **Release scripts** (copied from Anatomy Quiz): `scripts/git-push.sh "msg"`
  stages everything, refuses credential-looking paths, commits and
  pushes. `scripts/deploy.sh` triggers the manual deploy workflow and
  waits for pass/fail. `scripts/push-deploy.sh "msg"` runs both, and
  `scripts/archive-p-d.sh <label> "msg"` archives first.
- **Scratch scripts**: `scratch-*.mjs` in the project root (gitignored),
  deleted in the same turn they're finished with.

## Deployment

Target: `zigakorosak.com/beamlab/` on Namecheap shared hosting (cPanel),
the same host as GeoQuiz and Anatomy Quiz. `.github/workflows/deploy.yml`
runs `npm test`, builds on GitHub's runner and FTPS-uploads `dist/`. It is
**manual only** (`workflow_dispatch`): run it from the Actions tab or with
`gh workflow run "Deploy to Namecheap"`.

`vite.config.js` sets `base: "/beamlab/"`. If the deploy path changes,
that line must change to match.

**One-time setup:**

1. ~~Create the GitHub repo and push~~: done, `zigakorosak/beamlab` (public).
2. cPanel FTP account scoped to `public_html/beamlab`.
3. Repo secrets `FTP_SERVER` (`zigakorosak.com`), `FTP_USERNAME`,
   `FTP_PASSWORD`.

Gotchas from GeoQuiz's setup:

- Use the bare domain `zigakorosak.com` for `FTP_SERVER`. The
  `ftp.zigakorosak.com` that cPanel suggests doesn't resolve (NXDOMAIN).
- `server-dir` is relative to the FTP account's own login root. With an
  account scoped to `public_html/beamlab`, it must be `./`, or the app
  ends up nested inside itself.
- Pin `SamKirkland/FTP-Deploy-Action@v4.4.0`. There is no `@v4` tag.
- Secrets are write-only. The only way to check them is a deploy run.
