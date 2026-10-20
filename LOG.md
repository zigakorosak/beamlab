# Project Log

Newest first. What changed and why.

## 2026-10-20: First deploy; test glob

User request: deploy. The first run failed at `npm test`: the runner's
Node 22 reads `node --test test/` as one file named `test` (Node 26
here takes a directory). `npm test` is now `node --test "test/*.test.mjs"`,
which both understand. See MISTAKES.md.

## 2026-10-20: Wheel on the diagram, hover selects a box

User request: scrolling should also move the selected point on the
diagram; hovering a value box should select it without a click.

- `diagramEditor.attach`: a wheel over the band steps the selected dot by
  one snap step (not while dragging, not after Confirm), then the value
  box is synced and selected as for any dot pick.
- `selectOnFocus` (all number boxes): a mouse `pointerenter` focuses the
  box, which selects its text. Mouse only, so touch is unchanged;
  read-only boxes (after Confirm) are skipped.

Checked in Firefox: hovering a reaction box focuses it with "12.5"
selected, typing 9 replaces it; dot 2 selected, wheel up ×3 over the
band → 1.5 with the box's text selected; hovering the value box from
elsewhere focuses and selects it; the page didn't scroll. No page errors.

## 2026-10-20: Approximate answers, wheel, select on focus

User request: approximate values should count as correct; scrolling over a
box should change its value; selecting a dot should select the text in
the value box so it can be typed over.

- New `core/grading.js`, one rule for reactions and dots: right within
  max(5 % of the value, 3 % of the problem's largest value, 0.05); dots
  never stricter than one snap step. Was 1 % for reactions and 2 % of the
  maximum for dots. A close-but-not-exact reaction shows "✓ exact".
  `test/grading.test.mjs`: 4 checks.
- Wheel over a reaction box: ±1 (Shift ±0.1). Over the dot value box: one
  snap step, like + −. Non-passive listener, so the page doesn't scroll;
  reads deltaX too, since Firefox turns Shift+wheel sideways.
- Every box selects its text on focus (the mouseup right after a click
  focus is eaten, or it would drop the selection). Picking a dot (click,
  drag, ‹ ›, Tab, arrows) focuses the value box with the text selected,
  except after a touch (no keyboard popping up mid-drag). ← → ↑ ↓ in the
  box act as on the board.

Checked in Firefox (Playwright): wheel 3 up → 3, down → 2, Shift up →
2.1; click into a box selects all and typing replaces; clicking a dot
focuses the box with "0" selected, typing 5 sets it; → moves on with the
text selected; dragging a dot keeps the box in step. No page errors.

## 2026-10-20: GitHub repo

User request: create the repo (public, like `geoquiz` and `anatomyquiz`).
`zigakorosak/beamlab` on GitHub; first commit pushed to `main`. Repo-local
git identity set to match the other projects. The FTP account and the
deploy secrets are still to do (DESIGN.md, Deployment).

## 2026-10-20: First version

User request: read the references (GeoQuiz, Anatomy Quiz, two beam
calculator pages) for how to set up the project; build a game for
learning statics (shear and moment diagrams of beams) where the user drags
elements (beams, supports, forces…) onto a grid, then calculates and draws
the diagrams. Metric only.

Read as two modes, since "calculate and draw" could be the app's job or
the player's:
- **Build**: drag and drop onto a grid, the app solves and draws live.
- **Practice**: generated beams; the player types the reactions and draws
  V and M with draggable dots, and is graded.

Set up like the references: vanilla JS + Vite (`base: "/beamlab/"`), the
four docs, the archive / push / deploy scripts and a manual-only FTPS
deploy workflow (also runs the tests), Anatomy Quiz's `dom.js`,
`screenKit.js`, `hamburgerMenu.js`, its settings pattern and its dark
stylesheet rules under the same class names.

Solver: FEM for the reactions (handles indeterminate beams and hinges,
reports mechanisms and sideways sliding separately), method of sections
in closed form for N/V/M, deflected shape. `npm test`: 18 checks against
the beam-formula table in `reference/3` (simply supported, cantilevers,
propped, fixed–fixed, two-span continuous, overhang, couple, Gerber
beam, inclined load, unstable set-ups, 5wL⁴/384), all passing. The
generator was run 5,400 times (300 per type × level): every problem
solved.

Checked in Firefox with Playwright (1280 px and 390 px wide): drag and
drop of every element type, live diagrams matching a hand calculation,
beam-end and load-corner drags, hinge drag + Ctrl+Z, examples, the
tension-side setting; Practice through reactions (grading, equations
checked by hand for a Gerber beam), V and M stages (dot drags, grading,
solution overlay), summary, and a whole game on the Enter key alone (no
skipped stages). No console errors. Touch input not tried on a real
device.

Fixed while checking:
- Moments printed −15.62 next to a reaction of 15.63: `Math.round` rounds
  halves up, not away from zero. `fmt` now rounds half away from zero.
- The beam's end handle couldn't be grabbed when a support sat at the
  end: the support's invisible hit rectangle had an 18 px transparent
  stroke over it. Only `line.hit` gets a stroke now, and handles are drawn
  last.
- On a phone the 12 m minimum grid made the beam tiny; under 700 px the
  view fits the beam. Stretching the beam there zooms out at drag start,
  so the length now follows the pointer's movement, not its position
  (it jumped by 1–2 m).
- A fixed support's moment label ran off the board; it now sits under the
  arc on the beam's side, and Practice has wider side margins.
- Some base rules (`.action-button`, `.answer-area`, `.feedback-area`)
  were missed when copying Anatomy Quiz's stylesheet.
