// What one notch of the mouse wheel does to a number box: steps that
// grow with the value (1-2-5 steps, never more than a tenth of it), so
// scrolling alone always lands within the grading tolerance (5 % of the
// value, grading.js) without typing decimals, and big values don't take
// hundreds of notches.
//
// Near zero the step stops shrinking at `min`; with an absolute tolerance
// (angles to the degree) it never grows past `max`. Both come from the
// answer's tolerance (`ladderFor`), so every answer is reachable.

import { tolerance } from "./grading.js";

/** The largest 1, 2 or 5 × 10^k not above x. */
export function niceFloor(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f >= 5 - 1e-9 ? 5 : f >= 2 - 1e-9 ? 2 : 1) * p;
}

const clean = (v) => Number(v.toPrecision(12));

/** The step at magnitude m (≥ 0). */
export function stepAt(m, { min, max = Infinity }) {
  const s = m > 0 ? niceFloor(m / 10) : min;
  return Math.min(max, Math.max(min, s));
}

/**
 * The value one notch from `v` in direction `dir` (+1 up, −1 down). The
 * values it visits are a fixed ladder: each is a multiple of the step
 * below it, so up then down comes back to the same value, and a typed
 * value in between steps to its neighbour on the ladder.
 */
export function ladderStep(v, dir, opts) {
  const sign = v > 0 ? 1 : v < 0 ? -1 : dir;
  const m = Math.abs(v);
  if (dir === sign) {
    // Away from zero: the step of the region we're in.
    const s = stepAt(m, opts);
    return clean(sign * (Math.floor(m / s + 1e-9) + 1) * s);
  }
  // Towards zero: the step of the region just below.
  const s = stepAt(m * (1 - 1e-9), opts);
  const next = (Math.ceil(m / s - 1e-9) - 1) * s;
  return next <= 1e-12 ? 0 : clean(sign * next);
}

/** Practice's reactions: the floor is twice the smallest tolerance any
 *  reaction of that unit gets (grading.reactionScale), the same for every
 *  box of the unit, so it says nothing about this one's value. */
export const reactionLadder = (scale) => ({ min: niceFloor(2 * tolerance(0, scale)) });

/** An exam answer ({ value, tol?, scale? }, kit.js). With an absolute
 *  `tol` (angles to the degree) the step never grows past it. With a
 *  `scale`, the floor comes from that. Otherwise (graded to 5 % of the
 *  value alone) the floor is a hundredth of the value, nice-rounded, so
 *  the first notches from 0 give little away. */
export function answerLadder(a) {
  if (a.tol !== undefined) {
    const s = niceFloor(1.8 * a.tol);
    return { min: s, max: s };
  }
  if (a.scale) return { min: niceFloor(2 * tolerance(0, a.scale, 1e-6)) };
  return { min: niceFloor((2 * tolerance(a.value, 0, 1e-6)) / 10) };
}
