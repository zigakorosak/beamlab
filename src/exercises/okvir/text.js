// Worked-solution lines for frames, from a solved frame (frame.js):
//   resultantLines  distributed loads replaced by their resultants
//   reactionLines   ΣM about the pin / clamp, then ΣF_x, ΣF_y
//   fieldLines      N, T, M at the ends of every field, extremes (T = 0)
//   nodeLine        the moment check of a node, e.g. "26 − 9 − 22 + 5 = 0"

import { num } from "../kit.js";

const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
const small = (v, ref = 1) => Math.abs(v) < 1e-9 * Math.max(1, ref);
const signed = (v, text) => `${v < 0 ? "−" : "+"} ${text}`;
const joinTerms = (terms) => (terms.length ? terms.join(" ").replace(/^\+ /, "").replace(/^− /, "−") : "0");

/** Point of application of a distributed item's resultant, and the resultant. */
function distResultant(sol, it) {
  const m = sol.members[it.member];
  const R = ((it.to - it.from) * (it.q0 + it.q1)) / 2;
  // A load running from q to −q has no single resultant (only a couple); the
  // generators never make one, so its position just stays finite here.
  const sum = it.q0 + it.q1;
  const uc = Math.abs(sum) < 1e-12 ? (it.from + it.to) / 2 : it.from + ((it.to - it.from) * (it.q0 + 2 * it.q1)) / (3 * sum);
  return { R, p: [m.A[0] + m.e[0] * uc, m.A[1] + m.e[1] * uc], F: [it.d[0] * R, it.d[1] * R], uc };
}

/** Each known load as a force (with its point) or a couple. */
function knownActions(sol) {
  const acts = [];
  for (const it of sol.loadItems) {
    if (it.kind === "F") acts.push({ F: it.F, p: it.p, label: it.label });
    else if (it.kind === "M") acts.push({ M: it.M, label: it.label });
    else {
      const r = distResultant(sol, it);
      acts.push({ F: r.F, p: r.p, label: "Q" });
    }
  }
  return acts;
}

export function resultantLines(sol, { len = "m", fu = "kN" } = {}) {
  const out = [];
  for (const it of sol.loadItems) {
    if (it.kind !== "D") continue;
    const r = distResultant(sol, it);
    const m = sol.members[it.member];
    out.push(`Rezultanta zvezne obtežbe na ${m.a}${m.b}: Q = ${num(Math.abs(r.R))} ${fu}, prijemališče ${num(r.uc)} ${len} od ${m.a}${Math.abs(m.e[0] * m.e[1]) > 1e-9 ? " vzdolž osi odseka" : ""} (težišče obtežbe).`);
  }
  return out;
}

/**
 * Reaction equations. `pivot`: the node of the pin or clamp. Moment terms
 * are written as force·arm, counterclockwise positive.
 */
export function reactionLines(sol, pivot, { fu = "kN", mu = "kNm" } = {}) {
  const P = sol.reactions.find((r) => r.node === pivot && r.kind === "F")?.p;
  const at = P ?? [0, 0];
  const lines = [];
  const acts = knownActions(sol);
  const momentTerms = () => {
    const t = [];
    for (const a of acts) {
      if (a.M !== undefined) {
        t.push(signed(a.M, num(Math.abs(a.M))));
        continue;
      }
      const r = [a.p[0] - at[0], a.p[1] - at[1]];
      // rx·Fy − ry·Fx, written as two products when both are there.
      if (!small(a.F[1]) && !small(r[0])) t.push(signed(r[0] * a.F[1], `${num(Math.abs(a.F[1]))}·${num(Math.abs(r[0]))}`));
      if (!small(a.F[0]) && !small(r[1])) t.push(signed(-r[1] * a.F[0], `${num(Math.abs(a.F[0]))}·${num(Math.abs(r[1]))}`));
    }
    return t;
  };
  const piv = sol.reactions.filter((r) => r.node === pivot);
  const others = sol.reactions.filter((r) => r.node !== pivot);
  const clamp = piv.find((r) => r.kind === "M");

  for (const o of others) {
    const arm = cross([o.p[0] - at[0], o.p[1] - at[1]], o.dir);
    const t = [signed(arm, `${o.name}·${num(Math.abs(arm))}`), ...momentTerms()];
    lines.push(`ΣM_${pivot} = 0 (v nasprotni smeri urinega kazalca +): ${joinTerms(t)} = 0 → ${o.name} = ${num(o.value)} ${fu}`);
  }
  for (const [ax, i, name] of [["x", 0, piv.find((r) => r.kind === "F" && r.dir[0] === 1)], ["y", 1, piv.find((r) => r.kind === "F" && r.dir[1] === 1)]]) {
    if (!name) continue;
    const t = [signed(1, name.name)];
    for (const o of others) if (!small(o.dir[i])) t.push(signed(o.dir[i] * o.value, num(Math.abs(o.dir[i] * o.value))));
    for (const a of acts) if (a.F && !small(a.F[i])) t.push(signed(a.F[i], num(Math.abs(a.F[i]))));
    lines.push(`ΣF_${ax} = 0: ${joinTerms(t)} = 0 → ${name.name} = ${num(name.value)} ${fu}`);
  }
  if (clamp) {
    const t = [signed(1, clamp.name), ...momentTerms()];
    lines.push(`ΣM_${pivot} = 0 (v nasprotni smeri urinega kazalca +): ${joinTerms(t)} = 0 → ${clamp.name} = ${num(clamp.value)} ${mu}`);
  }
  return lines;
}

/**
 * Per member: the fields with N, T, M at both ends, and M where T = 0.
 * `order`: member ids; `posName(m, s)`: optional text for a position.
 */
export function fieldLines(sol, order, { fu = "kN", mu = "kNm", len = "m" } = {}) {
  const out = [];
  for (const id of order) {
    const m = sol.members[id];
    const nf = m.breaks.length - 1;
    const fields = nf === 2 ? "polji" : nf <= 4 ? "polja" : "polj";
    out.push(`Odsek ${m.a}${m.b} (s od ${m.a} proti ${m.b}, dolžina ${num(m.L)} ${len}${nf > 1 ? `, ${nf} ${fields}` : ""}):`);
    for (let j = 0; j < nf; j++) {
      const s0 = m.breaks[j], s1 = m.breaks[j + 1];
      const a = m.at(s0, "+"), b = m.at(s1, "-");
      const f3 = (x) => num(Math.abs(x) < 1e-9 ? 0 : x);
      const range = nf > 1 ? `  s ∈ [${num(s0)}; ${num(s1)}]: ` : "  ";
      const N = Math.abs(a.N - b.N) < 1e-9 ? `N = ${f3(a.N)} ${fu}` : `N: ${f3(a.N)} → ${f3(b.N)} ${fu}`;
      const T = Math.abs(a.T - b.T) < 1e-9 ? `T = ${f3(a.T)} ${fu}` : `T: ${f3(a.T)} → ${f3(b.T)} ${fu}`;
      out.push(`${range}${N}; ${T}; M: ${f3(a.M)} → ${f3(b.M)} ${mu}`);
    }
    for (const x of m.extremes) out.push(`  T = 0 pri s = ${num(x.s)} ${len} → ekstrem M = ${num(x.M)} ${mu}`);
  }
  return out;
}

/** "Kontrola momentov v vozlišču C: 22,5 − 22,5 = 0 ✓" (moments on the node). */
export function nodeLine(sol, node, { mu = "kNm" } = {}) {
  const chk = sol.nodeCheck(node);
  const parts = chk.parts.filter((p) => !small(p.M, 1e-3));
  if (parts.length < 2) return null;
  const t = joinTerms(parts.map((p) => signed(p.M, num(Math.abs(p.M)))));
  return `Kontrola ravnovesja momentov v vozlišču ${node} (momenti, s katerimi delujejo konci palic${parts.some((p) => p.load) ? " in zunanji moment" : ""} na vozlišče): ${t} = ${num(Math.abs(chk.M) < 1e-9 ? 0 : chk.M)} ${mu} ✓`;
}

export const CONVENTION =
  "Predznaki: N > 0 pomeni nateg. Vsak odsek gledamo kot nosilec s črtkanimi vlakni spodaj in koordinato s od začetka proti koncu odseka: M > 0, kadar so črtkana vlakna v nategu; T > 0, kadar desni del (od s proti koncu) deluje na levega v smeri proti črtkanim vlaknom. Velja dM/ds = T in dT/ds = −q (q proti črtkanim vlaknom).";
