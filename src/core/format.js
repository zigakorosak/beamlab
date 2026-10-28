// Number formatting: at most two decimals, trailing zeros dropped, a real
// minus sign, and no "−0".

export function fmt(v, digits = 2) {
  // Half away from zero, so −15.625 and 15.625 print alike (Math.round
  // alone rounds −15.625 up to −15.62). The 1e-9 absorbs float noise.
  const r = (Math.sign(v) * Math.round(Math.abs(v) * 10 ** digits + 1e-9)) / 10 ** digits;
  if (Object.is(r, -0) || r === 0) return "0";
  return String(r).replace("-", "−");
}

export const kN = (v) => `${fmt(v)} kN`;
export const kNm = (v) => `${fmt(v)} kNm`;
export const kNpm = (v) => `${fmt(v)} kN/m`;
export const m = (v) => `${fmt(v)} m`;

/** Parse a typed number, accepting "," as the decimal point, "−", and
 *  spaces between digits as a thousands separator ("12 500"). */
export function parseNumber(text) {
  const t = String(text).trim().replace(/(\d)[\s\u00a0\u202f\u2009]+(?=\d)/g, "$1").replace(",", ".").replace("−", "-");
  if (t === "" || t === "-") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** A round step near `x`: 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceStep(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * p;
}
