// The worked hand calculation of a composite section, line by line as on
// the exam's solution sheets (vse_enacbe_in_postopki.md §7, "POSTOPEK —
// sestavljen prerez"): split into parts, centroid, Steiner, I_xy.

import { num } from "../kit.js";

/** "pravokotnik 6 × 2", "krog Ø4 (luknja)" … */
export function describePart(p) {
  let d;
  if (p.t === "rect") d = `pravokotnik ${num(p.w)} × ${num(p.h)}`;
  else if (p.t === "circle") d = `krog Ø${num(2 * p.r)}`;
  else if (p.t === "semi") d = `polkrog r = ${num(p.r)}`;
  else if (p.t === "quarter") d = `četrtina kroga r = ${num(p.r)}`;
  else d = `pravokotni trikotnik ${num(Math.abs(p.b))} × ${num(Math.abs(p.h))}`;
  return p.hole ? `${d} (izrez, A < 0)` : d;
}

/** The local centroidal formulas of one part, in words + numbers. */
function localLines(p, r, i, { y = true, x = false, xy = false }) {
  const s = p.hole ? "−" : "";
  const out = [];
  if (p.t === "rect") {
    if (y) out.push(`I_{x${i}} = ${s}b·h³/12 = ${s}${num(p.w)}·${num(p.h)}³/12 = ${num(r.Ix)}`);
    if (x) out.push(`I_{y${i}} = ${s}h·b³/12 = ${num(r.Iy)}`);
  } else if (p.t === "circle") {
    if (y) out.push(`I_{x${i}} = ${s}π·r⁴/4 = ${num(r.Ix)}`);
    if (x) out.push(`I_{y${i}} = ${num(r.Iy)}`);
  } else if (p.t === "semi") {
    if (y) out.push(`I_{x${i}} = ${s}(π·r⁴/8 − A·e²), e = 4r/(3π) = ${num((4 * p.r) / (3 * Math.PI))} → ${num(r.Ix)}`);
    if (x) out.push(`I_{y${i}} = ${s}π·r⁴/8 = ${num(r.Iy)}`);
  } else if (p.t === "quarter") {
    if (y) out.push(`I_{x${i}} = I_{y${i}} = ${s}(π·r⁴/16 − A·e²) = ${num(r.Ix)}`);
  } else {
    if (y) out.push(`I_{x${i}} = ${s}b·h³/36 = ${num(r.Ix)}`);
    if (x) out.push(`I_{y${i}} = ${s}h·b³/36 = ${num(r.Iy)}`);
  }
  if (xy && (p.t === "tri" || p.t === "quarter")) out.push(`I_{xy${i}} = −∫xy dA (lokalno) = ${num(-r.D)}`);
  return out;
}

/** A factor in a product: negative numbers in brackets. */
const pn = (v) => (v < 0 ? `(${num(v)})` : num(v));

const sum = (terms) => terms.join(" + ").replace(/\+ −/g, "− ");

/**
 * Lines of the calculation. opts: { x: also I_y and x_T; xy: also I_xy;
 * unit: "cm" }.
 */
export function sectionLines(sec, P, { x = true, xy = false, unit = "cm" } = {}) {
  const u2 = `${unit}²`, u4 = `${unit}⁴`;
  const L = [];
  L.push(`Prerez razdelimo na dele; koordinate merimo od točke O (spodnji levi vogal prereza oz. očrtanega pravokotnika), ${unit}.`);
  sec.parts.forEach((p, k) => {
    const r = P.rows[k];
    L.push(`Del ${k + 1} — ${describePart(p)}: A_${k + 1} = ${num(r.A)} ${u2}, ${x ? `x_${k + 1} = ${num(r.x)}, ` : ""}y_${k + 1} = ${num(r.y)} ${unit}.`);
  });
  L.push(`A = ΣA_i = ${sum(P.rows.map((r) => num(r.A)))} = ${num(P.A)} ${u2}`);
  if (x) L.push(`x_T = ΣA_i·x_i / A = (${sum(P.rows.map((r) => `${num(r.A)}·${pn(r.x)}`))}) / ${num(P.A)} = ${num(P.xT)} ${unit}`);
  L.push(`y_T = ΣA_i·y_i / A = (${sum(P.rows.map((r) => `${num(r.A)}·${pn(r.y)}`))}) / ${num(P.A)} = ${num(P.yT)} ${unit}`);
  sec.parts.forEach((p, k) => {
    const ls = localLines(p, P.rows[k], k + 1, { y: true, x, xy });
    if (ls.length) L.push(`Lastni (težiščni) momenti dela ${k + 1}: ${ls.join("; ")}.`);
  });
  L.push(`Steiner: I_x = Σ[I_{xi} + A_i·(y_i − y_T)²] = ${sum(P.rows.map((r) => `${num(r.Ix)} + ${num(r.A)}·${pn(r.dy)}²`))} = ${num(P.Ix)} ${u4}`);
  if (x) L.push(`I_y = Σ[I_{yi} + A_i·(x_i − x_T)²] = ${sum(P.rows.map((r) => `${num(r.Iy)} + ${num(r.A)}·${pn(r.dx)}²`))} = ${num(P.Iy)} ${u4}`);
  if (xy) {
    const local = P.rows.some((r) => r.D !== 0);
    L.push(
      `Deviacijski moment (zapiski: I_{xy} = −∫xy dA): I_{xy} = Σ[I_{xyi} − A_i·(x_i − x_T)(y_i − y_T)] = ${sum(P.rows.map((r) => `${local ? `${num(-r.D)} + ` : ""}${num(-r.A)}·${pn(r.dx)}·${pn(r.dy)}`))} = ${num(P.Ixy)} ${u4}`,
    );
  }
  return L;
}
