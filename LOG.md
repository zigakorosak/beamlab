# Project Log

Newest first. What changed and why.

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
