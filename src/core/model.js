// The beam model: one straight horizontal beam, its supports, internal
// hinges and loads. Plain JSON, so it can be cloned, saved to localStorage,
// put on the undo stack and handed to the solver as is.
//
// Units are fixed (metric only): metres, kN, kN/m, kNm.
// Every x is measured from the beam's left end, 0 … beam.length.
//
//   beam:     { x0, length }          x0 = where the left end sits on the
//                                      Build grid (cosmetic, metres)
//   supports: { id, type, x }         type: "pin" | "roller" | "fixed"
//   hinges:   { id, x }               internal moment release
//   loads:
//     { id, type: "point",  x, value, angle }   value kN (> 0); angle in
//                                                degrees from straight down,
//                                                positive towards +x (0 = ↓,
//                                                90 = →, 180 = ↑, −90 = ←)
//     { id, type: "moment", x, value }          kNm, counterclockwise positive
//     { id, type: "dist",   x1, x2, q1, q2 }    kN/m at x1 and x2, linear in
//                                                between, downward positive

export const SUPPORT_TYPES = {
  pin: { label: "Pinned support", short: "Pinned", restrains: ["x", "y"] },
  roller: { label: "Roller support", short: "Roller", restrains: ["y"] },
  fixed: { label: "Fixed support", short: "Fixed", restrains: ["x", "y", "m"] },
};

export const LOAD_LABELS = {
  point: "Point load",
  moment: "Moment",
  dist: "Distributed load",
};

export const EPS_X = 1e-6;
export const near = (a, b) => Math.abs(a - b) < EPS_X;

let counter = 0;
export const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const emptyModel = () => ({ beam: null, supports: [], hinges: [], loads: [] });

export const cloneModel = (m) => JSON.parse(JSON.stringify(m));

/** Point-load components (kN), y up: angle 0 points straight down. */
export function pointComponents(load) {
  const a = (load.angle * Math.PI) / 180;
  const fx = load.value * Math.sin(a);
  const fy = -load.value * Math.cos(a);
  // Kill the 1e-16 noise from sin(180°) etc., so "no axial force" stays exactly 0.
  return { fx: Math.abs(fx) < 1e-12 ? 0 : fx, fy: Math.abs(fy) < 1e-12 ? 0 : fy };
}

/** Resultant (kN, downward positive) and its position of a linear distributed load. */
export function distResultant(load) {
  const len = load.x2 - load.x1;
  const F = ((load.q1 + load.q2) / 2) * len;
  // Centroid of a trapezoid; falls back to the middle when the resultant is 0.
  const s = load.q1 + load.q2;
  const xc = Math.abs(s) < 1e-12 ? (load.x1 + load.x2) / 2 : load.x1 + (len * (load.q1 + 2 * load.q2)) / (3 * s);
  return { F, x: xc };
}

/**
 * Support names: A, B, C … from left to right, the way a textbook letters
 * them. Returns Map(supportId → letter).
 */
export function supportNames(model) {
  const sorted = [...model.supports].sort((a, b) => a.x - b.x);
  return new Map(sorted.map((s, i) => [s.id, String.fromCharCode(65 + i)]));
}

/** The reaction components a support has, in display order. */
export function reactionComponents(support) {
  return SUPPORT_TYPES[support.type].restrains;
}

/** Every x where something happens — the diagram's key points. */
export function keyPoints(model) {
  if (!model.beam) return [];
  const L = model.beam.length;
  const xs = [0, L];
  for (const s of model.supports) xs.push(s.x);
  for (const g of model.hinges) xs.push(g.x);
  for (const l of model.loads) {
    if (l.type === "dist") xs.push(l.x1, l.x2);
    else xs.push(l.x);
  }
  return uniqueSorted(xs.filter((x) => x >= -EPS_X && x <= L + EPS_X).map((x) => Math.min(L, Math.max(0, x))));
}

export function uniqueSorted(xs) {
  const sorted = [...xs].sort((a, b) => a - b);
  const out = [];
  for (const x of sorted) if (!out.length || !near(out[out.length - 1], x)) out.push(x);
  return out;
}

/** Statically: does anything load the beam along its axis? */
export function hasAxialLoad(model) {
  return model.loads.some((l) => l.type === "point" && Math.abs(pointComponents(l).fx) > 1e-9);
}

/**
 * Keep everything on the beam after its length changed or it was moved:
 * clamp distributed loads, drop what no longer fits.
 */
export function fitToBeam(model) {
  const L = model.beam.length;
  const inside = (x) => x >= -EPS_X && x <= L + EPS_X;
  model.supports = model.supports.filter((s) => inside(s.x));
  model.hinges = model.hinges.filter((g) => g.x > EPS_X && g.x < L - EPS_X);
  model.loads = model.loads.filter((l) => {
    if (l.type !== "dist") return inside(l.x);
    const a = Math.max(0, l.x1);
    const b = Math.min(L, l.x2);
    if (b - a < EPS_X) return false;
    // Re-interpolate the intensities at the clipped ends.
    const q = (x) => l.q1 + ((l.q2 - l.q1) * (x - l.x1)) / (l.x2 - l.x1);
    [l.q1, l.q2, l.x1, l.x2] = [q(a), q(b), a, b];
    return true;
  });
  // A fixed support only makes sense at an end (it's drawn as a wall).
  for (const s of model.supports) if (s.type === "fixed") s.x = s.x < L / 2 ? 0 : L;
  return model;
}
