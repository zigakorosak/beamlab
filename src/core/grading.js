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

/** Practice's reactions ([{ answer, unit }], typed values `given`): a small
 *  one is judged against the largest reaction in its own unit, so a fixed
 *  end's 300 kNm doesn't let a 6 kN force pass with either sign. */
export function reactionsOk(given, reactions) {
  // 3 % of a third = 1 % of the largest reaction in the same unit: enough
  // for a reaction that comes out about 0, too little to pass a wrong sign
  // (3 % of the largest let −0,9 pass for By = 2 next to Ay = 98).
  const scale = (unit) => Math.max(...reactions.filter((r) => r.unit === unit).map((r) => Math.abs(r.answer))) / 3;
  return reactions.map((r, i) => closeEnough(given[i], r.answer, scale(r.unit)));
}

/** Right but not to the printed two decimals: worth showing the exact value. */
export const isExact = (given, answer) => Math.abs(given - answer) < 0.005 + 1e-9;

/** An exam exercise's answer `a` ({ value, unit, scale?, tol?, period? }):
 *  with `tol`, an absolute error (angles: modulo `period`, default 360°);
 *  otherwise 5 % of its own value, or 3 % of `scale` when the module gives
 *  one (answers that can be about 0). No other floor. */
export function answerOk(given, a) {
  if (a.tol === undefined) return closeEnough(given, a.value, a.scale ?? 0, 0, 1e-6);
  let d = given - a.value;
  if (a.unit === "°") {
    const p = a.period ?? 360;
    d = ((((d + p / 2) % p) + p) % p) - p / 2;
  }
  return Math.abs(d) <= a.tol + 1e-9;
}
