# Beam Lab

A browser game for learning statics: support reactions, shear force and
bending moment diagrams of beams. Built the same way as
[GeoQuiz](https://zigakorosak.com/geoquiz/) and
[Anatomy Quiz](https://zigakorosak.com/anatomyquiz/), and meant to go live
at **zigakorosak.com/beamlab**.

## Features

- **Build**: drag a beam onto a grid, then pinned, roller and fixed
  supports, internal hinges, point forces (any angle), uniform and
  triangular distributed loads and moments. The reactions and the N, V
  and M diagrams (and the deflected shape) update live, also while you
  drag. Hover to read N, V and M anywhere; tap anything to edit its exact
  numbers. Undo/redo, ten textbook examples, and the beam is kept
  between visits.
- **Practice**: solve generated beams yourself. Pick a task (reactions,
  shear diagram, moment diagram, or the full solution), a beam type
  (simply supported, cantilever, overhanging, with a hinge, statically
  indeterminate, or mixed), the loads (easy / medium / hard) and how many
  beams. Type the reactions; draw the diagrams by dragging dots at the
  key points. Every answer is graded, the exact diagram is drawn over
  yours, and the reactions come with the equilibrium equations.
- **Practice this** in Build turns your own beam into a question.
- Statically determinate and indeterminate beams (continuous, propped,
  fixed–fixed), Gerber beams with hinges, and unstable set-ups explained
  ("nothing stops the beam sliding sideways").
- Metric only: m, kN, kN/m, kNm.
- Settings: draw positive moments up, or on the tension side; Build's
  snap step.

## Tech stack

Vanilla JavaScript (ES modules), no UI framework, SVG for all drawing.
[Vite](https://vite.dev/) for the dev server and build. No backend: fully
static. The solver is a small finite-element model plus the method of
sections in closed form (see `DESIGN.md`), checked against the textbook
beam formulas by `npm test`.

## Getting started

```bash
npm install
npm run dev       # dev server at http://localhost:5173/beamlab/
npm test          # solver checks against the beam-formula tables
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

### Archiving a snapshot

```bash
npm run archive -- <short-label>
```

Tars the project (excluding `node_modules`, `dist`, `archive`, `reference`)
into `archive/<timestamp>_<label>.tar.gz`, keeping the 10 most recent.

## Deployment

Deploys are **manual only**. Pushing to `main` does not trigger anything.

```bash
gh workflow run "Deploy to Namecheap"   # or scripts/deploy.sh, which also waits for the result
```

The workflow (`.github/workflows/deploy.yml`) runs the tests, builds the
site and FTPS-uploads `dist/` to Namecheap shared hosting at
`zigakorosak.com/beamlab/`. The one-time setup (repo, FTP account,
secrets) is in `DESIGN.md` → "Deployment".

## Project structure

```
src/
  core/       — model, solver, problem generator, equilibrium text, settings
  render/     — SVG drawing: beam + loads, diagrams, shared board layout
  ui/         — screens: home, wizard, game, Build, settings, how to play
  main.js     — top-level screen router
test/         — solver checks (node --test)
scripts/      — archive and release scripts
reference/    — GeoQuiz / Anatomy Quiz sources and beam-calculator pages (local only, gitignored)
```

## Docs conventions

This project keeps exactly three other markdown files: `DESIGN.md`
(architecture/design overview), `LOG.md` (chronological change history)
and `MISTAKES.md` (what went wrong while building; read it before a
debugging round). Substantive changes are documented there rather than in
new markdown files.
