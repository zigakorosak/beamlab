// When a typed or dragged answer counts as right. Approximate is fine:
// within 5 % of the exact value, or within 3 % of the problem's largest
// value (so small values near zero aren't held to a hair's width).

export const REL_TOL = 0.05;
export const SCALE_TOL = 0.03;

/** Allowed error for `answer` in a problem whose values go up to `scale`.
 *  `floor` is the smallest allowed error: 0.05 suits kN and kNm; the exam
 *  exercises pass a tiny one, since their answers can be 0,06 kN/cm² or f = 0,15. */
export const tolerance = (answer, scale, floor = 0.05) => Math.max(REL_TOL * Math.abs(answer), SCALE_TOL * Math.abs(scale), floor);

export const closeEnough = (given, answer, scale, minTol = 0, floor = 0.05) =>
  Math.abs(given - answer) <= Math.max(tolerance(answer, scale, floor), minTol) + 1e-9;

/** Right but not to the printed two decimals: worth showing the exact value. */
export const isExact = (given, answer) => Math.abs(given - answer) < 0.005 + 1e-9;
