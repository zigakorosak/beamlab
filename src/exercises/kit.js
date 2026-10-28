// Shared tools for the exam exercises (izpitne naloge): a seeded random
// source, Slovenian number formatting, and the shape every exercise takes.
//
// An exercise module (see registry.js) is
//   { id, group: "statika" | "trdnost", title, desc,
//     generate(rng) → params,      random but exam-like numbers
//     build(params) → exercise }   pure: the same params give the same task
// so tests can feed the numbers of a real exam to build() and compare with
// the worked solution.
//
// An exercise is
//   { title,
//     text: [paragraph…],          the task, in Slovenian, like the exam sheet
//     figure?: (fig) => void,      draws into a figure (draw.js)
//     answers: [{ key, label, unit, value, scale?, tol?, period?, step?, note? }],
//                                  graded to 5 % of value, or 3 % of `scale` if larger
//                                  (nearZero()); `tol`: absolute, angles modulo `period`
//     solution: [line…],           the worked solution, step by step
//     solutionFigure?: (fig) => void }  e.g. the N, T, M diagrams, under the solution
// Labels and text may use the markup of `rich()`: A_y, M_{max}, σ_1.

import { SCALE_TOL } from "../core/grading.js";

export function rng(seed = Date.now()) {
  // mulberry32
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Integer in [a, b]. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** One of the items. */
    pick: (items) => items[Math.floor(next() * items.length)],
    /** A multiple of `step` in [lo, hi]. */
    step: (lo, hi, step) => {
      // Never past hi: hi − lo need not be a whole number of steps (l/6 …).
      const n = Math.floor((hi - lo) / step + 1e-9);
      return round(lo + step * Math.floor(next() * (n + 1)), 6);
    },
    chance: (p) => next() < p,
  };
}

export const rad = (deg) => (deg * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const round = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * A number the way the exam writes it: decimal comma, about four
 * significant digits (never rounding away whole units), real minus sign.
 *   6.97412 → "6,974"   43393.2 → "43393"   0.058812 → "0,05881"
 */
export function num(v, sig = 4) {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 1e-9) return "0";
  const whole = Math.floor(Math.log10(Math.abs(v))) + 1;
  const decimals = Math.min(8, Math.max(0, sig - whole));
  let t = (Math.sign(v) * Math.round(Math.abs(v) * 10 ** decimals + 1e-9 * Math.abs(v))) / 10 ** decimals;
  t = t.toFixed(decimals);
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  if (/^-?0$/.test(t)) return "0";
  return t.replace(".", ",").replace("-", "−");
}

/** "8 kN", "2,5 m" — a value with its unit. */
export const q = (v, unit, sig) => (unit ? `${num(v, sig)} ${unit}` : num(v, sig));

/**
 * Split light markup into parts: "M_{max} = 3" → [["M"], ["max", "sub"], [" = 3"]].
 * `_x` subscripts one character, `_{…}` a group; `^{…}` superscripts.
 */
export function richParts(text) {
  const parts = [];
  const re = /([_^])(\{([^}]*)\}|(.))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push([text.slice(last, m.index)]);
    parts.push([m[3] ?? m[4], m[1] === "_" ? "sub" : "sup"]);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push([text.slice(last)]);
  return parts;
}

/** Markup → plain text (for aria labels and tests): "M_{max}" → "Mmax". */
export const plain = (text) => richParts(text).map(([t]) => t).join("");

/** Answer helpers, so modules read like the exam's list of results. */
export const ans = (key, label, unit, value, extra = {}) => ({ key, label, unit, value, ...extra });
/** Angles are graded to the degree, not to 5 %, and modulo `period`
 *  (360°; 180° for the direction of an axis or line, which α and α + 180° share). */
export const angleAns = (key, label, value, extra = {}) => ans(key, label, "°", value, { tol: 1, period: 360, ...extra });

/**
 * Answers `keys` can come out about 0: give them a `scale`, so they're right
 * within 1 % of the largest answer with the same unit (or of `mag`), not
 * 5 % of almost nothing. Every other answer is graded to 5 % of its own value.
 */
export function nearZero(answers, keys, mag) {
  for (const a of answers) {
    if (!keys.includes(a.key) || a.scale !== undefined) continue;
    const m = mag ?? Math.max(...answers.filter((b) => b.unit === a.unit).map((b) => Math.abs(b.value)));
    a.scale = (0.01 / SCALE_TOL) * m;
  }
  return answers;
}

/** g as the exams use it. */
export const G = 9.81;
