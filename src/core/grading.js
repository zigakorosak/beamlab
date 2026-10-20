// When a typed or dragged answer counts as right. Approximate is fine:
// within 5 % of the exact value, or within 3 % of the problem's largest
// value (so small values near zero aren't held to a hair's width).

export const REL_TOL = 0.05;
export const SCALE_TOL = 0.03;

/** Allowed error for `answer` in a problem whose values go up to `scale`. */
export const tolerance = (answer, scale) => Math.max(REL_TOL * Math.abs(answer), SCALE_TOL * Math.abs(scale), 0.05);

export const closeEnough = (given, answer, scale, minTol = 0) =>
  Math.abs(given - answer) <= Math.max(tolerance(answer, scale), minTol) + 1e-9;

/** Right but not to the printed two decimals: worth showing the exact value. */
export const isExact = (given, answer) => Math.abs(given - answer) < 0.005 + 1e-9;
