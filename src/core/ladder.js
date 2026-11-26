// What one notch of the mouse wheel does to a number: coarse steps far
// from the right answer, finer and finer ones as the value closes in on
// it, down to a step fine enough to land well inside the grading
// tolerance (grading.js) without typing decimals. Where the steps get
// finer gives the answer away a little; Practice is practice.
//
// The values one notch can reach form a fixed set (a ladder): multiples
// of `coarse` anywhere, and multiples of each finer 1-2-5 step s within
// ZONE·s of the target. A notch goes to the nearest of those beyond the
// current value, so up then down comes back to the same value, and a
// typed value in between steps to its neighbour. Each zone is wider than
// the next coarser step, so scrolling towards the target can't jump past
// a finer zone: about 2–3 notches per step size.

import { tolerance } from "./grading.js";

const ZONE = 5;

/** The largest 1, 2 or 5 × 10^k not above x. */
export function niceFloor(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f >= 5 - 1e-9 ? 5 : f >= 2 - 1e-9 ? 2 : 1) * p;
}

const clean = (v) => Number(v.toPrecision(12));

/** The 1-2-5 steps from `fine` up to `coarse` (both 1-2-5 numbers). */
function stepSizes(fine, coarse) {
  const out = [fine];
  while (out.at(-1) < coarse * (1 - 1e-9)) {
    const s = out.at(-1);
    const p = 10 ** Math.floor(Math.log10(s) + 1e-9);
    const m = Math.round(s / p);
    out.push(clean((m === 1 ? 2 : m === 2 ? 5 : 10) * p));
  }
  return out;
}

/**
 * The value one notch from `v` in direction `dir` (+1 up, −1 down), for a
 * ladder { target, fine, coarse, period? }. With a `period` (angles), the
 * target repeats every period.
 */
export function ladderStep(v, dir, { target, fine, coarse, period }) {
  const sizes = stepSizes(fine, Math.max(fine, coarse));
  const targets = period ? [-1, 0, 1].map((k) => target + (Math.round((v - target) / period) + k) * period) : [target];
  const eps = 1e-9 * Math.max(1, Math.abs(v));
  let best = dir > 0 ? Infinity : -Infinity;
  const consider = (c) => {
    if (dir > 0 ? c > v + eps && c < best : c < v - eps && c > best) best = c;
  };
  sizes.forEach((s, k) => {
    const next = (from) => (dir > 0 ? Math.floor(from / s + 1e-9) + 1 : Math.ceil(from / s - 1e-9) - 1) * s;
    if (k === sizes.length - 1) return consider(next(v));
    for (const t of targets) {
      const lo = t - ZONE * s;
      const hi = t + ZONE * s;
      // The first multiple of s beyond v that lies in [lo, hi].
      let c = next(v);
      if (dir > 0 && c < lo) c = Math.ceil(lo / s - 1e-9) * s;
      if (dir < 0 && c > hi) c = Math.floor(hi / s + 1e-9) * s;
      if (c >= lo - 1e-9 && c <= hi + 1e-9) consider(c);
    }
  });
  return Math.abs(best) < 1e-12 ? 0 : clean(best);
}

/** The finest step: one no bigger than `tol` lands within half of it. */
const fineFor = (tol) => niceFloor(tol);

/** A Practice reaction `answer`, judged against `scale` (grading.reactionScale). */
export function reactionLadder(answer, scale) {
  const fine = fineFor(tolerance(answer, scale));
  return { target: answer, fine, coarse: Math.max(fine, niceFloor(scale)) };
}

/** An exam answer ({ value, tol?, period?, scale? }, kit.js). */
export function answerLadder(a) {
  if (a.tol !== undefined) {
    // Angles to the degree: 1° steps near it, 10° … far off.
    const fine = niceFloor(a.tol);
    return { target: a.value, fine, coarse: Math.max(fine, niceFloor(a.tol * 20)), period: a.unit === "°" ? (a.period ?? 360) : undefined };
  }
  const fine = fineFor(tolerance(a.value, a.scale ?? 0, 1e-6));
  const size = Math.max(Math.abs(a.value), Math.abs(a.scale ?? 0), fine);
  return { target: a.value, fine, coarse: Math.max(fine, niceFloor(size / 4)) };
}
