# Project Log

Newest first. What changed and why.

## 2026-10-28: Correctness review finished (round 14 clean)

Fourteen review rounds, seven reviewers each (app core and the six
exercise groups), until one round found no mistake a user can meet.
Round 14: 0 everywhere. The last polish: frame texts say a vertical point
force acts "navzdol" (before, only the figure's arrow showed it).

## 2026-10-28: Correctness review, round 14 (app core)

- Read the whole app outside the exercise modules again (core, render,
  ui, registry, figure kit, tests, docs). Sweeps: 23 000 printed
  equilibrium equations add up to 0 within their 2-decimal rounding;
  N, V, M close to 0 past the right end, M = 0 at hinges and free or
  pinned ends; 32 400 Practice figures (320, 360, 414, 800 px; asked,
  solved, solved with resultants) and Build's examples at 320 / 800 px
  with no text clipped or on another.
- Practice figure: a fixed support's clockwise reaction moment was
  modelled for label placement as the counterclockwise arc (−60°…200°)
  instead of the one drawn (−20°…240°). No generated beam had its label
  on the arc (31 000 checked), so nothing visible changed.
- DESIGN.md: solver.test.mjs has 24 checks, including the Practice
  figure's text-clash test.

## 2026-10-28: Correctness review, round 13 (app core)

- Practice / Build beam figure: texts had fixed places. Of 3 600
  generated beams at 326 px, ~480 had given values printed over each
  other (point loads 1 m apart, two couples, a load's size on the
  distributed load's or an angle's), ~350 had a point load's shaft
  through the "q kN/m", and once solved, ~2 000 had a reaction running
  off the board ("By = 28.75 kN" at the right support) and ~850 had
  reaction labels on each other or on a support name. Every text now
  takes the first of a few places that is on the board and clear of the
  other texts, the arrows and the shapes (`placeLabels`, beamView.js;
  Build and Practice pass the board's width). A horizontal reaction's
  arrow is shortened where the board ends close by (its head was cut off
  on a long beam on a phone). A test (solver.test.mjs) draws 720
  generated beams at 326 and 800 px, asked and solved: no text clipped
  or on another. Left: at 326 px about 1 beam in 150 (mostly solved ones
  with three supports) has a text crossed by an arrow's shaft.

## 2026-10-28: Correctness review, round 12 (app core)

- Practice figure: an inclined force (Hard: 30°, 45° or 60°) was drawn
  with its size only, so the angle a student needs for its components
  wasn't given anywhere. It now has a dashed vertical at its tip and an
  arc labelled with the angle from the vertical (Build too). The force's
  label sits past its tail on the side away from the arc, kept inside the
  board (near an end it was clipped), a row up if pushed onto the angle.
- Mohr task asks for τ_max "v ravnini x, y" (with σ_1, σ_2 of one sign the
  absolute maximum is larger; the solution notes it); prerez symmetry note
  "težiščni osi x in y sta glavni osi".
- Practice figure: a segment's length on the dimension line was left out
  when the segment was under 22 px wide, which on a phone (360 px) was
  about 4 in 10 beams: a load's position was then not given. Every
  length is printed now; one too long for its segment goes a row under
  the line, or above it. A test (solver.test.mjs) checks both at 320 px.
- Checked: `reactionsOk()` (1 % of the largest reaction in the same unit;
  of ~91 000 nonzero generated reactions, a wrong sign passes only for
  |R| ≤ 0,4 kN beside a much larger one), and the diagram dots (a wrong
  sign passes only for a dot under 2,6 % of the diagram's maximum, below
  one snap step). DESIGN.md's dot rule now says what the code does.

## 2026-10-28: Correctness review, round 11 (app core)

- Practice reactions: a small reaction was judged against the largest
  reaction of any unit, so a fixed end's moment in kNm loosened the
  forces in kN: with M_A = 388,5 kNm, B_y = 6 kN passed as −5 kN (in
  ~7 % of generated beams a force ≥ 3 kN was graded to more than 15 %).
  Now the largest reaction in the same unit (`reactionsOk()` in
  grading.js); a test checks it. The near-zero allowance is 1 % of that
  largest reaction (was 3 %), so a small reaction's wrong sign fails too
  (B_y = 2 next to A_y = 98 passed as −0,9).
- Exercises: the knot solution says rope directions are measured from +x
  ("180° − 30° = 150°"); nosilec-valj A_x is graded to its own 5 %;
  upogib F_max on a cantilever lists the clamp moment.

## 2026-10-28: Layout test checks circles; Mohr's circle labels on phones

- Layout test: text across a circle's outline (`fig-rope`, `fig-body`,
  `fig-hole` circles, sampled as a 72-gon) now fails, like text on a rope.
  It found ~200 Mohr / Mohr-inverzna solution figures per 200 seeds at
  326 px (mostly "σ [MPa]" on the circle, also X/Y/N and 2α), the threshold
  wheel's "E" on its rim (trenje-prag, every figure), a short rope's
  "l = …" on the sphere (krogla-vrv), "y = …" on a round section's rim
  (strig-nosilec) and "sklopka" on the pulley (kombinirana, phone).
- Mohr's circle: the σ axis reaches far enough past the circle for its
  name (a share of the drawing's width, more on a phone); on a phone room
  above and below the circle, room beside it for a side point's text, and
  the points' texts may go clear of the circle over the point; C and σ_1
  have a row further out. Desktop unchanged where it already fit.
- placeLabels: an empty text (Mohr's hidden τ_max) no longer blocks
  others; circles are sampled finer and a body's outline costs like a rope;
  an angle's label may go inside its arc as a last resort.
- E inside the wheel by the rim; the rope's l above where it is tied when
  the rope is short; the round section's y level drawn out (dashed) past
  the circle with its name there; on a phone the pulley's end view sits
  a little further right, "B" and "pogled vzdolž osi" have second places.
- 0 failures at LAYOUT_SEEDS=1000.

## 2026-10-28: Correctness review, round 10 (app core)

- Practice generator: point loads and couples could go anywhere but the
  beam's left end (x = 0), so a cantilever fixed on the right never had a
  load at its free tip, nor a left overhang at its end, while the mirror
  images had one in about a third of the beams. Both ends count now; a
  test checks the right-fixed cantilever's tip gets loads.
- Frame N-T-M diagrams: a field whose diagram crosses zero gets a ⊕ and
  a ⊖ (before: one sign per field, so the other area had none).
- Wording: prerez I_xy note "enaka absolutna vrednost" (not "znesek");
  hipoteze names both hypotheses when both give ν < 1; strig "ob obeh
  podporah" for a load at midspan; okvir-l roller no longer "(ob steni)";
  palica-polvalj's half-cylinder is "na tla pritrjen" (frictionless).
- Known source error added: the ladder sheet's B_x = 476,13 is 476,31.

## 2026-10-28: Correctness review, round 9 (app core, figure kit)

- Figure kit: `placeLabels()` read an SVG arc (a couple's arrow, a rope
  round a pulley) as the straight chord between its ends, so a label could
  sit on a couple's arc unpenalised while the empty gap under it counted
  as a crossed force line. Arcs are now followed along the curve; a test
  checks a label moves off a couple's arc.
- Text widths: Greek letters (σ, φ, α, θ …), Δ, √ and | were
  planned narrower than the app's font draws them; now at least as wide
  as the layout test measures them.
- When a label pushes a neighbour aside, the two labels' overlap was
  counted twice after the move, so some good moves were refused.
- Layout test: a rope's arc round a pulley (`path.fig-rope`) is now one
  of the lines no text may lie on, as the test's header says.

## 2026-10-28: Figure layout test

- `test/figures-layout.test.mjs`: every figure and solution figure at
  326 and 728 px, 200 random tasks each (`LAYOUT_SEEDS` for more): no
  text cut off, no texts overlapping, no text on a member, rope or force's
  shaft, every N-T-M value drawn. With 300 tasks per exercise it first
  found about 3500 figures with a problem (of ~50 000); now none in 1000.
- Figure kit: `placeLabels()` makes a label on a text far worse than a
  crossed line, measures text with per-character widths, checks turned
  labels turned, places labels with fewer choices first and lets one push
  a neighbour aside; dimension labels slide along their line; more places
  for force, load, couple and angle labels; `dimChain()` up to 3 rows.
- Frame diagrams always draw every value (the least bad place when none is
  free), keep signs and node names off the frame's lines, place the
  titles last; a phone stacks the three diagrams more often.
- Exercise figures: more label places (3D box corners, centroid T,
  cable, torque labels a row higher, Mohr circle, beam loads and
  couples, frame node names and loads; a frame's horizontal force at
  least as long as its label); upogib's section lower on a
  phone; palica-vrv's generator redraws the few loads whose labels had no
  room between P's arrow and the rope on a phone; the Mohr circle leaves
  out the τ_max text a little sooner when X or Y is near the top; beam N-T-M diagrams
  show values they used to skip next to a similar one.

## 2026-10-28: Correctness review, round 8 (app core)

- Practice generator: distributed loads no longer overlap. On the hard
  level about a quarter of the beams had two loads drawn over each other
  (e.g. a full-span uniform load and a triangular one), and now and then
  two identical ones, which looked like a single load while the answer
  counted both. Such a draw is redrawn; a test checks it.

## 2026-10-28: Correctness review, round 7

- Typed answers accept a space as a thousands separator ("12 500",
  "1 234,5"); before, such an answer was graded wrong.
- Figure kit: on a phone one side may take up to 45 % of the width (both
  together ≤ 62 %), so a long side label ("Al cev, A_a = 18 cm²") is no
  longer clipped on a figure that fills the width.
- Ladder (koef): the worker is never drawn at the midpoint, where the P
  and Q arrows lay on top of each other.
- Pappus solution "od njenih ravnih robov"; bloka "Kvader 1 miruje, ker
  ga drži vrv."; the rod-in-tube leader labels end nearer the drawing.

## 2026-10-28: Correctness review, round 6 (app core, figure kit)

- Figure kit: a drawing that is as tall as allowed (so narrower than the
  box) now shifts sideways to give a capped side its room; before, the
  side cap clipped a long label on a phone (hooke-palice "Al cev,
  A_a = 13 cm²" lost its end at 328 px).
- Test: every exercise's figure and solution figure render at 326 and
  728 px (a minimal DOM stand-in) with no exception, no NaN and within the
  height asked for.
- Exercises: "I-prerez", "T-prerez" etc. hyphenated as in the notes; the
  bending task no longer says the section is "desno" (on a phone it is
  drawn under the beam); hollow-rectangle draws keep a ≥ 4 × 4 cm
  opening; the branch figure's ground is hatched below its line.
- kit.js `rng.step` never draws past its upper bound (it could overshoot
  by half a step, e.g. a cable sag past l/6).
- Frame diagrams: a value label stays inside the figure when a free place
  there exists (okvir-posevni "−13,65" lost its last digit on a phone).

## 2026-10-28: Figure layout pass (phone 326 px and desktop 760 px)

- Figure kit (draw.js): per-side room for forces, loads, dimensions and
  angles (it was the same on all four sides, which shrank phone figures);
  `alts` / `labelAt: "auto"` let a label take the clearest of several
  places (placeLabels() after drawing); narrow angles push their label
  (and arc) out of the wedge; `dimChain()` moves a dimension label that
  doesn't fit a row out; `dim(…, { beside })`; `byWidth()` for a separate
  phone layout; the height cap only applies when the drawing fills the
  height. Old calls draw as before where nothing collided.
- Phone layouts: cross-sections under the beam (upogib, strig), taller M
  bands (upogib, nosilec-ntm in px), stacked frame diagrams, Mohr point
  texts inside the circle.
- Labels moved off lines, hatching and each other in most exercises
  (palica-polvalj, torzija, hipoteze, okvir-posevni, redukcija-3d, …);
  cantilevers label the clamp A.

## 2026-10-28: Correctness review, rounds 4–5 (exercise modules)

- Beam N-T-M: where a couple makes M jump, the field list shows both
  sides ("M = 2 | −6 kNm"); before, only the right side, unlabelled.
- Walls hatched behind the wall, not on the body's side: palica-vrv,
  dve-palici (+ napetost), krogla-vrv (one wall).
- Branch (veja): the clamp's reaction couple is "moment vpetja", no longer
  printed as M_O with the opposite sign of the graded M_O.
- Cantilever bending tasks name the clamp ("vpetje A"); the solution's
  M_A states its sign convention. Clamped shaft with L₁ = L₂ says both
  segments carry the same torque. Inverse Mohr never draws a zero
  principal stress. Symmetric cable asks for V "ob podpori".
- Axial-bar tasks say "Uklona ne upoštevajte." (compressed bars are
  slender; the course's Hooke tasks ignore buckling).
- Frames: a force at a node with a couple gets a longer arrow so its label
  clears the arc; node names keep off a wall roller and the height
  dimension.

## 2026-10-28: Correctness review, round 4 (app core, runner, registry)

- Build: a force's angle typed as 180° was stored as −180° (same force,
  but the ↑ button no longer showed as active); angles now go to
  −180° < angle ≤ 180°.
- Re-checked the solver, the equilibrium equations, grading, the registry
  wrapper (2000 draws of every exercise: no NaN, no loose `scale`, only
  float dust below 1e-9 near 0) and the docs against the code.

## 2026-10-28: Correctness review, round 3 (exercise modules)

- Every exercise: the redraw rule is now "would still pass 20 % off"
  (round 3 first had "at half its value", which let okvir-konzola
  M_BC = 1 kNm pass anywhere in 0,51–1,49). Answers with an absolute `tol`
  (angles, x ± 0,1 m, n) are exempt. Redraws: up to 11 % of Mohr draws,
  ≤ 6 % elsewhere.
- Hooke: the clamped bar without ΔT has no near-zero scale (N₂ = −3,6
  passed at ±24 %); the heated clamped bar's u and the stepped bar's ΔL
  redraw when they nearly cancel; "se mora cev skrajšati".
- Sections: the half-disc solution lines follow its orientation; α_G for
  I_x = I_y, I_xy < 0 is +45° (inside −45° < α ≤ 45°). Neither reachable
  by the current generators.
- Frames: "2 polji" (dual); the solver keeps the couple of a linear load
  whose resultant is 0 (not reachable by the generators).
- Text: "na prvem metru", "na razdalji", "s polmerom … in maso …";
  tipping solution prints e = 4/2 instead of an undefined b/2.

## 2026-10-28: Correctness review, round 3 (app core, runner, registry)

- Every exercise (registry.js): a draw is also drawn again when a nonzero
  answer would pass at half its value. Round 2 only stopped 0 and the
  opposite sign, so a near-zero `scale` still passed σ_2 = −0,19 for
  −1,10 MPa (Mohr), R_x = 0,45 for 1 kN (2D reduction), s_1 = 0,6 for
  1,23 MPa (hypotheses). Affects under 3 % of draws (Mohr, reduction,
  beam/frame reactions, strain, Hooke, hypotheses). Test over 1000 draws
  of every generator.

## 2026-10-28: Correctness review, round 2 (exercise modules)

- Every exercise (registry.js): floating-point dust in an answer becomes 0,
  and a draw whose nonzero answer would also be passed by 0 or by the
  opposite sign is drawn again. Found by a sweep: e.g. σ_N = 0,8 MPa
  passed as 0, a frame moment −0,125 passed as +0,125. Test over 1000
  draws of every generator.
- Tolerances: Hooke stepped bar N/σ, the inverse Mohr τ_xy and the tensor
  τ_xy no longer get a near-zero scale (σ = 3,33 passed at ±60 %); the
  clamped bar's σ follows N's scale; nosilec-valj A_y = 0 no longer passes
  when the beam's weight gives a small A_y.
- Generators: 2D reduction |x₀| ≥ 0,5 m; stepped shaft rejects segment
  twists that nearly cancel; frame konzola rejects tiny nonzero moments;
  open thin-walled τ ≤ 250 MPa; rectangle with a hole now ~12 % of the
  section tasks (corner hole, shape picked once); C flanges stick out
  ≥ 2 cm; tube wall ≤ D/4.
- Text: beam task's supports in the accusative ("nepomično členkasto
  podporo"); klanec "nasproti smeri, v katero bi telo zdrsnilo"; tezisce
  x_T from the body's left edge; Tresca "σ_1 ≥ 0 ≥ σ_2" and no "(0)";
  inclined-beam load position "vzdolž osi odseka".
- Figure: the pulley's wall hatched behind the wall, not towards it.

## 2026-10-28: Correctness review, round 2 (app core)

- Practice's equilibrium equations (`explain.js`) didn't add up for two
  Build-only cases: a couple placed right on a hinge (the solver puts it
  on the part to the right; the hinge's equation left it out), and a
  distributed load whose q changes sign (its resultant can be 0, losing
  the couple it makes, or sit outside the part right of a hinge). Such a
  load is now split at q = 0 into two resultants (`distPieces()` in
  model.js), in the equations and in the dashed resultants on the beam.
  Tests put the solved reactions into every printed equation.
- Removed the unused `resultants()` from solver.js.

## 2026-10-28: Correctness review, round 1 (exercise modules)

Seven reviewers re-derived every exercise and swept thousands of draws;
33 mistakes fixed in total, none in the core formulas. Exercise fixes:
- Beam N-T-M: draws with two equal |M| extremes or a flat extreme are
  re-drawn (the key's x or sign was arbitrary); inclined forces say
  "poševno navzdol". F₄: φ never within 2° of 0°/360°. 3D reduction asks
  for the |R| it grades. Cable: S_B arrow and its angle follow the drawn
  (exaggerated) curve; b and α_B labels no longer collide.
- Friction/bodies: nosilec-valj no longer draws the lower half-cylinder
  through the beam; lestev "koef" B_x graded to its own value; a comma.
- Sections: tan 2α_G prints (−I_xy) in brackets; half/quarter-disc bounding
  box (centroid axes and label of rectSemi); T/U note names the larger
  compressive stress too; the centroid label sits below the axes.
- Stresses: axial-bar draws stay elastic (steel ≤ 240, Al ≤ 150 MPa); glue
  σx 0,3–6 kN/cm²; strain check says ε_N; Tresca text for two compressive
  principal stresses.
- Shear/torsion/vessels: τ(y) point never at the edge; sphere minimum wall
  uses pd/(4σ); Slovenian fixes ("računanemu", "v barih", zvar sentence).
- Frames: konzola grades M_BC(B) too; inclined beam rejects a rope within
  20° of the beam, says "sila v vrvi" and "Lastno težo veje zanemarite";
  L-frame rejects a near-zero or corner-equal M_ekstr and asks for S.

## 2026-10-28: Correctness review (app core, Build, Practice, runner)

- Exam answers: graded to 5 % of their own value. Before, every answer
  also passed within 3 % of the largest answer with the same unit, so a
  small A_x = 0,1·B passed at 30 % off. Answers that can be about 0 get a
  `scale` from their module (`nearZero()`, 1 % of the largest same-unit
  answer): reduction R/M components, nosilec-valj A, beam and frame
  reactions and corner forces, Mohr σ_1, σ_2, σ_N, τ_N (and the inverse
  task's σ_x, σ_y, τ_xy), strain → stress σ/ε, Hooke N/σ, hypotheses σ_1, σ_2.
  Found by a 2000-draw sweep of every generator.
- Angles are graded ±1° modulo a `period`: 360° (0° is right for 359,6°),
  180° for directions of axes (Mohr/strain α, α_G). All in `answerOk()`,
  with tests; every printed answer is checked to grade right.
- Exam answer boxes: the mouse wheel rounded the typed value to two
  decimals with a decimal point (0,0588 → 1.06 → 0.06); it now keeps every
  digit and the decimal comma.
- Mock-exam summary could print "0 min 60 s".
- Build: a distributed load whose q changes sign was drawn with every arrow
  one way and labelled without signs; the area now touches the beam at
  q = 0, each arrow points its own way, and the label is signed. An upward
  resultant (Practice this) points up.
- Wizard: "Full solution" says it includes N when a force is inclined.
- Re-checked the solver on 7 200 generated beams (global equilibrium,
  dM/dx = V, M = 0 at hinges and pinned ends, extrema at V = 0) and the
  printed equilibrium equations against the reactions: no errors.

## 2026-10-27: Izpitne naloge (exam exercises)

User request: "i added new reference. i want the app to be able to give me
exercises so that i can pass any exam". The new reference (`reference/4/om`)
is the "Osnove mehanike" course at NTF Ljubljana: notes, a textbook and 64
photos of past exams. Asked two questions: language → Slovenian with the
course's notation; scope → both statics and strength.

- Catalogued every exam photo (4 parallel agents): ~30 exams, ~85
  problems, with the worked answers where the photo had them. Most
  frequent: N-T-M of beams and frames (~25), friction (~14), reactions and
  contacts (~14), bending stress (~9, on every recent exam).
- Built the framework: `exercises/kit.js` (exercise shape, seeded rng,
  `num()` with a decimal comma, sub/superscript markup), `exercises/draw.js`
  (exam-style figure kit in world units), `exercises/registry.js`,
  `ui/exercises.js` (topic menu, runner, mock exam 30/35/35 points, 90 min),
  `ui/inputKit.js` (the number-box helpers moved out of game.js).
- 37 exercises, written by 7 parallel agents against a shared brief plus my
  beam N-T-M one (`nosilec/beamNtm.js`, on the core solver): see DESIGN.md
  "Izpitne naloge" for the list. Frames got their own solver
  (`okvir/frame.js`); cross-sections a section module (`prerez/section.js`).
- Tests: every exercise's build() against the worked exam answers (and the
  notes' examples where no exam answer exists), plus 300–1000 random draws
  each checking the physics independently (equilibrium residuals,
  eigenvalues, compatibility, dM/ds = T, grid integration of sections…).
  `npm test`: 115 passing.
- Found errors in the sources (the code follows the physics; DESIGN.md
  lists them): the 28.1.2015 rod solution (23,39° for 26,39°), two
  course-note examples (torsion spring M_t, welded tube W_T), the notes'
  two meanings of I_1.
- Grading: `closeEnough` got a `floor` argument; the exercises use none,
  so 0,06 kN/cm² or f = 0,15 are also judged to 5 % (the old ±0,05 floor
  was 30 % there). "Exact" is judged by the printed digits.
- Figure margins: per side, from each item's own room (labels by text
  width), settled in a few rounds; phones get taller figures. Beam loads
  that overlap are stacked; labels avoid arrows.
- Checked in Firefox at 1280 and 390 px: all 37 topics twice with their
  solutions, and a mock exam through to the summary; no page errors. The
  dev server stayed off (low memory): built to a scratch folder and served
  it to Playwright with `page.route` (`scratch-serve.mjs`, gitignored).

## 2026-10-20: First deploy; test glob

User request: deploy. The first run failed at `npm test`: the runner's
Node 22 reads `node --test test/` as one file named `test` (Node 26
here takes a directory). `npm test` is now `node --test "test/*.test.mjs"`,
which both understand. See MISTAKES.md. Second run green (tests, build,
FTPS upload); https://zigakorosak.com/beamlab/ redirects to www like
GeoQuiz, serves "Beam Lab", assets 200, Build opens in Firefox with no
page errors.

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
