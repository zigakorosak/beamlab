// Random practice problems with textbook-looking numbers: whole or half
// metres, loads in round kN. Every problem is run through the solver
// before it's handed out, so it is always stable.

import { newId } from "./model.js";
import { solve } from "./solver.js";

export const BEAM_TYPES = [
  { id: "simple", label: "Simply supported", desc: "Pinned and roller supports at the ends" },
  { id: "cantilever", label: "Cantilever", desc: "Fixed at one end, free at the other" },
  { id: "overhang", label: "Overhanging", desc: "Supports in from the ends" },
  { id: "hinge", label: "With a hinge", desc: "Gerber beam: still solvable by statics" },
  { id: "indeterminate", label: "Statically indeterminate", desc: "Propped, fixed–fixed or continuous" },
  { id: "mixed", label: "Mixed", desc: "Any of the statically determinate ones" },
];

export const LEVELS = [
  { id: "easy", label: "Easy", desc: "Vertical point loads" },
  { id: "medium", label: "Medium", desc: "Point loads and uniform loads" },
  { id: "hard", label: "Hard", desc: "Triangular loads, moments and inclined forces" },
];

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const range = (a, b, step) => {
  const out = [];
  for (let x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 100) / 100);
  return out;
};

// ---- Support layouts: { L, supports: [[type, x]], hinges: [x] }
const layouts = {
  simple(rng, grid) {
    const L = pick(rng, grid === 1 ? [4, 5, 6, 8] : range(4, 10, 1));
    return rng() < 0.75
      ? { L, supports: [["pin", 0], ["roller", L]] }
      : { L, supports: [["roller", 0], ["pin", L]] };
  },
  cantilever(rng, grid) {
    const L = pick(rng, grid === 1 ? [2, 3, 4] : range(2, 6, 0.5));
    return { L, supports: [["fixed", rng() < 0.6 ? 0 : L]] };
  },
  overhang(rng, grid) {
    const span = pick(rng, range(4, 8, 1));
    const a = pick(rng, range(1, 3, grid));
    const variant = pick(rng, ["right", "left", "both"]);
    if (variant === "right") return { L: span + a, supports: [["pin", 0], ["roller", span]] };
    if (variant === "left") return { L: a + span, supports: [["pin", a], ["roller", a + span]] };
    const b = pick(rng, range(1, 2, grid));
    return { L: a + span + b, supports: [["pin", a], ["roller", a + span]] };
  },
  hinge(rng, grid) {
    if (rng() < 0.5) {
      // Fixed – hinge – roller.
      const L = pick(rng, range(6, 10, 1));
      const h = pick(rng, range(2, L - 2, grid));
      const m = { L, supports: [["fixed", 0], ["roller", L]], hinges: [h] };
      return rng() < 0.5 ? m : mirror(m);
    }
    // Pin – roller – hinge (in the overhang) – roller.
    const s = pick(rng, range(4, 6, 1));
    const h = s + pick(rng, range(1, 2, grid));
    const L = h + pick(rng, range(2, 4, 1));
    const m = { L, supports: [["pin", 0], ["roller", s], ["roller", L]], hinges: [h] };
    return rng() < 0.5 ? m : mirror(m);
  },
  indeterminate(rng) {
    const kind = pick(rng, ["propped", "fixedfixed", "continuous"]);
    if (kind === "propped") {
      const L = pick(rng, range(4, 8, 1));
      const m = { L, supports: [["fixed", 0], ["roller", L]] };
      return rng() < 0.5 ? m : mirror(m);
    }
    if (kind === "fixedfixed") {
      const L = pick(rng, range(4, 8, 1));
      return { L, supports: [["fixed", 0], ["fixed", L]] };
    }
    const l1 = pick(rng, range(3, 6, 1));
    const l2 = rng() < 0.5 ? l1 : pick(rng, range(3, 6, 1));
    return { L: l1 + l2, supports: [["pin", 0], ["roller", l1], ["roller", l1 + l2]] };
  },
};

function mirror(m) {
  return {
    L: m.L,
    supports: m.supports.map(([t, x]) => [t, m.L - x]),
    hinges: (m.hinges ?? []).map((x) => m.L - x),
  };
}

// ---- Loads
function pointLoad(rng, xs, level) {
  const value = level === "easy" ? pick(rng, range(5, 40, 5)) : pick(rng, range(4, 40, 2));
  const inclined = level === "hard" && rng() < 0.4;
  const angle = inclined ? pick(rng, [30, 45, 60, -30, -45, -60]) : 0;
  return { type: "point", x: pick(rng, xs), value, angle };
}

function udl(rng, L, grid) {
  const q = pick(rng, range(2, 12, 1));
  if (rng() < 0.5) return { type: "dist", x1: 0, x2: L, q1: q, q2: q };
  const [x1, x2] = twoPositions(rng, L, grid);
  return { type: "dist", x1, x2, q1: q, q2: q };
}

function triangular(rng, L, grid) {
  const q = pick(rng, range(4, 15, 1));
  const [x1, x2] = rng() < 0.5 ? [0, L] : twoPositions(rng, L, grid);
  return rng() < 0.5 ? { type: "dist", x1, x2, q1: 0, q2: q } : { type: "dist", x1, x2, q1: q, q2: 0 };
}

function couple(rng, xs) {
  return { type: "moment", x: pick(rng, xs), value: pick(rng, range(5, 30, 5)) * (rng() < 0.5 ? 1 : -1) };
}

function twoPositions(rng, L, grid) {
  const xs = range(0, L, grid);
  for (;;) {
    const a = pick(rng, xs);
    const b = pick(rng, xs);
    if (Math.abs(a - b) >= 1) return a < b ? [a, b] : [b, a];
  }
}

function makeLoads(rng, level, L, grid, supportXs) {
  // Point loads and couples never sit right on a support (there they'd go
  // straight into the reaction and teach nothing) or on a hinge (a couple
  // there is ambiguous: which side gets it?).
  // (Both ends count: a cantilever fixed on the right has its free tip at 0.)
  const pts = range(0, L, grid).filter((x) => !supportXs.some((s) => Math.abs(s - x) < 1e-9));
  const loads = [];
  if (level === "easy") {
    const n = rng() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) loads.push(pointLoad(rng, pts, level));
  } else if (level === "medium") {
    loads.push(udl(rng, L, grid));
    if (rng() < 0.6) loads.push(pointLoad(rng, pts, level));
  } else {
    const special = pick(rng, ["tri", "couple", "inclined"]);
    if (special === "tri") loads.push(triangular(rng, L, grid));
    if (special === "couple") loads.push(couple(rng, pts));
    if (special === "inclined") loads.push({ ...pointLoad(rng, pts, level), angle: pick(rng, [30, 45, 60, -30, -45, -60]) });
    const extra = rng() < 0.5 ? 1 : 2;
    for (let i = 0; i < extra; i++) {
      const kind = pick(rng, ["point", "udl", "tri", "couple"]);
      if (kind === "point") loads.push(pointLoad(rng, pts, level));
      else if (kind === "udl") loads.push(udl(rng, L, grid));
      else if (kind === "tri") loads.push(triangular(rng, L, grid));
      else loads.push(couple(rng, pts));
    }
  }
  // Two point loads (or couples) on the same spot read as one: keep the first.
  const seen = new Set();
  return loads.filter((l) => {
    if (l.type === "dist") return true;
    const key = `${l.type}@${l.x}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A ready model for `typeId` ("simple", …, "mixed") at `levelId`. */
export function generateProblem(typeId, levelId, rng = Math.random) {
  const grid = levelId === "easy" ? 1 : 0.5;
  for (let attempt = 0; attempt < 100; attempt++) {
    const type =
      typeId === "mixed" ? pick(rng, ["simple", "simple", "cantilever", "overhang", "overhang", "hinge"]) : typeId;
    const layout = layouts[type](rng, grid);
    const model = {
      beam: { x0: 1, length: layout.L },
      supports: layout.supports.map(([t, x]) => ({ id: newId("s"), type: t, x })),
      hinges: (layout.hinges ?? []).map((x) => ({ id: newId("g"), x })),
      loads: makeLoads(rng, levelId, layout.L, grid, [...layout.supports.map(([, x]) => x), ...(layout.hinges ?? [])]).map((l) => ({
        id: newId("l"),
        ...l,
      })),
      kind: type,
    };
    // Distributed loads drawn over each other hide each other (two equal
    // ones look like one): their spans may touch, not overlap.
    const dists = model.loads.filter((l) => l.type === "dist");
    if (dists.some((a, i) => dists.slice(i + 1).some((b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 1e-9))) continue;
    const sol = solve(model);
    if (!sol.ok) continue;
    // Something must actually bend.
    if (sol.xs.every((x) => Math.abs(sol.M(x, "-")) < 1e-6 && Math.abs(sol.M(x, "+")) < 1e-6)) continue;
    return model;
  }
  throw new Error(`could not generate a ${typeId}/${levelId} problem`);
}
