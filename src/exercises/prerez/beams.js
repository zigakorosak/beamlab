// The beams of the bending problems (upogib): a simply supported beam, an
// overhang or a cantilever with point loads, a uniform load and couples.
// The moment along the beam comes from the app's solver (core/solver.js),
// so the numbers are the ones the Practice screen would draw.
//
// A beam (plain JSON, part of an exercise's params):
//   { kind: "simple" | "overhang" | "cantilever",
//     L,               total length (m)
//     s,               overhang: the roller's x (span), the overhang is L − s
//     clamp,           cantilever: "left" | "right"
//     loads: [ { t: "F", x, F, name? }       kN, downward
//              { t: "q", x1, x2, q }         kN/m, downward
//              { t: "M", x, M } ] }          kNm, counterclockwise positive
// `name` replaces the value in the figure ("F", "2F") for the problems
// where the load is the unknown.

import { momentExtrema, sampleDiagram, solve } from "../../core/solver.js";
import { num, q, round } from "../kit.js";

export function toModel(beam) {
  const { kind, L } = beam;
  const supports =
    kind === "cantilever"
      ? [{ id: "A", type: "fixed", x: beam.clamp === "right" ? L : 0 }]
      : [{ id: "A", type: "pin", x: 0 }, { id: "B", type: "roller", x: kind === "overhang" ? beam.s : L }];
  const loads = beam.loads.map((l, i) => {
    if (l.t === "F") return { id: `l${i}`, type: "point", x: l.x, value: l.F, angle: 0 };
    if (l.t === "q") return { id: `l${i}`, type: "dist", x1: l.x1, x2: l.x2, q1: l.q, q2: l.q };
    return { id: `l${i}`, type: "moment", x: l.x, value: l.M };
  });
  return { beam: { x0: 0, length: L }, supports, hinges: [], loads };
}

/**
 * Solve and find the moment extremes: every key point (both sides of a
 * jump) and every T = 0 point. `crit` is the largest |M|; `unique` is
 * false when another place comes within 5 % of it (an ambiguous task).
 */
export function analyse(beam) {
  const sol = solve(toModel(beam));
  if (!sol.ok) throw new Error(sol.error);
  const cands = [];
  for (const x of sol.xs) for (const side of ["-", "+"]) cands.push({ x, value: sol.M(x, side), where: "key" });
  for (const e of momentExtrema(sol)) cands.push({ ...e, where: "T0" });
  let crit = cands[0];
  for (const c of cands) if (Math.abs(c.value) > Math.abs(crit.value) + 1e-9) crit = c;
  const unique = !cands.some((c) => Math.abs(c.value) >= 0.95 * Math.abs(crit.value) && (Math.abs(c.x - crit.x) > 1e-6 || Math.abs(c.value - crit.value) > 1e-6));
  const pos = cands.reduce((m, c) => (c.value > m.value ? c : m), { x: 0, value: 0 });
  const neg = cands.reduce((m, c) => (c.value < m.value ? c : m), { x: 0, value: 0 });
  return { sol, crit, unique, pos, neg };
}

/** Random exam-like beam. `scale` multiplies the load ranges (small for steel tubes). */
export function randomBeam(r, { scale = 1, couples = true } = {}) {
  const kind = r.pick(["simple", "simple", "overhang", "overhang", "cantilever"]);
  const F = () => Math.max(1, Math.round(r.int(2, 20) * scale));
  const Q = () => Math.max(1, Math.round(r.int(2, 10) * scale));
  const Mc = () => Math.max(1, Math.round(r.int(2, 16) * scale));
  const beam = { kind, loads: [] };
  if (kind === "simple") {
    beam.L = r.step(2, 6, 0.5);
    beam.s = beam.L;
  } else if (kind === "overhang") {
    beam.s = r.step(2, 5, 0.5);
    beam.L = round(beam.s + r.step(1, 2.5, 0.5));
  } else {
    beam.L = r.step(1, 3.5, 0.5);
    beam.clamp = r.pick(["left", "right"]);
  }
  const L = beam.L;
  const n = r.int(1, 2);
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let type = r.pick(couples ? ["F", "F", "q", "q", "M"] : ["F", "q"]);
    if (used.has("q") && type === "q") type = "F";
    used.add(type);
    if (type === "F") {
      let x = r.step(0.5, L, 0.5);
      if (kind === "simple" && x >= L) x = L / 2;
      if (kind === "cantilever" && beam.clamp === "left" && x < 0.5) x = L;
      if (kind === "cantilever" && beam.clamp === "right") x = r.step(0, L - 0.5, 0.5);
      if (kind === "overhang" && Math.abs(x - beam.s) < 1e-9) x = L; // not on the support
      beam.loads.push({ t: "F", x: round(x), F: F() });
    } else if (type === "q") {
      // Whole beam, the span or the overhang.
      let [x1, x2] = [0, L];
      if (kind === "overhang") [x1, x2] = r.pick([[0, L], [0, beam.s], [beam.s, L]]);
      else if (r.chance(0.3)) {
        const a = r.step(0, L - 1, 0.5);
        [x1, x2] = [a, round(Math.min(L, a + r.step(1, L, 0.5)))];
      }
      beam.loads.push({ t: "q", x1, x2, q: Q() });
    } else {
      let x = r.step(0, L, 0.5);
      // A couple on the clamp goes straight into the wall: move it to the free end.
      if (kind === "cantilever" && Math.abs(x - (beam.clamp === "left" ? 0 : L)) < 1e-9) x = beam.clamp === "left" ? L : 0;
      beam.loads.push({ t: "M", x, M: (r.chance(0.5) ? 1 : -1) * Mc() });
    }
  }
  if (crowded(beam)) return randomBeam(r, { scale, couples });
  return beam;
}

/** Two key points closer than 12 % of L: the dimension chain would be unreadable. */
export function crowded(beam) {
  const L = beam.L;
  const xs = [0, L, ...(beam.kind === "overhang" ? [beam.s] : []), ...beam.loads.flatMap((l) => (l.t === "q" ? [l.x1, l.x2] : [l.x]))];
  const u = [...new Set(xs.map((x) => round(x, 6)))].sort((a, b) => a - b);
  for (let i = 1; i < u.length; i++) if (u[i] - u[i - 1] < 0.12 * L - 1e-9) return true;
  // A force and a couple (or two forces) on the same point: their labels would collide.
  const pts = beam.loads.filter((l) => l.t !== "q").map((l) => round(l.x, 6));
  return new Set(pts).size < pts.length;
}

const where = (beam, x) => (x < 1e-9 ? "na levem koncu" : Math.abs(x - beam.L) < 1e-9 ? "na desnem koncu" : `pri x = ${num(x)} m`);

/** The beam in words (the figure shows the same). */
export function beamText(beam) {
  const sup =
    beam.kind === "cantilever"
      ? `Konzola dolžine ${q(beam.L, "m")} je vpeta ${beam.clamp === "left" ? "na levem" : "na desnem"} koncu.`
      : beam.kind === "simple"
        ? `Prostoležeči nosilec razpona ${q(beam.L, "m")} (nepomična podpora A levo, pomična B desno).`
        : `Nosilec s previsom: podpori A (x = 0) in B (x = ${num(beam.s)} m), previs do x = ${num(beam.L)} m.`;
  const loads = beam.loads.map((l) => {
    if (l.t === "F") return `sila ${l.name ?? q(l.F, "kN")} navpično navzdol ${where(beam, l.x)}`;
    if (l.t === "q") return `enakomerna obtežba ${l.name ?? `q = ${q(l.q, "kN/m")}`} od x = ${num(l.x1)} m do x = ${num(l.x2)} m`;
    return `moment ${q(Math.abs(l.M), "kNm")} ${where(beam, l.x)} (${l.M > 0 ? "v nasprotni smeri urinega kazalca" : "v smeri urinega kazalca"})`;
  });
  return `${sup} Obtežba: ${loads.join("; ")}.`;
}

/** Beam, supports, loads and the dimension chain under it; y = 0 is the beam axis. */
export function drawBeam(f, beam, { dims = true } = {}) {
  const L = beam.L;
  f.member([0, 0], [L, 0]);
  if (beam.kind === "cantilever") f.fixed([beam.clamp === "left" ? 0 : L, 0], beam.clamp === "left" ? 0 : 180);
  else {
    f.pin([0, 0], 90);
    f.roller([beam.kind === "overhang" ? beam.s : L, 0], 90);
    f.point([0, 0], "A", { dot: false, dx: -18, dy: 10, anchor: "end" });
    f.point([beam.kind === "overhang" ? beam.s : L, 0], "B", { dot: false, dx: 18, dy: 10 });
  }
  const qs = beam.loads.filter((l) => l.t === "q");
  for (const l of qs) f.dist([l.x1, 0], [l.x2, 0], { label: l.name ?? `q = ${q(l.q, "kN/m")}`, h0: 22 });
  const Fs = beam.loads.filter((l) => l.t === "F").sort((a, b) => a.x - b.x);
  for (const l of beam.loads) {
    if (l.t === "F") {
      // Above a distributed load the arrow starts higher, label at its tail.
      const onQ = qs.some((d) => l.x >= d.x1 - 1e-9 && l.x <= d.x2 + 1e-9);
      // Label on the right, unless at the right end or a neighbour sits close on the right.
      const k = Fs.indexOf(l);
      const crowdedRight = (k < Fs.length - 1 && Fs[k + 1].x - l.x < 0.3 * L) || qs.some((d) => d.x1 > l.x + 1e-9 && d.x1 - l.x < 0.3 * L);
      const side = l.x > L - 1e-9 || crowdedRight ? -1 : 1;
      f.force([l.x, 0], -90, { label: l.name ?? `F = ${q(l.F, "kN")}`, len: onQ ? 74 : 50, labelAt: onQ ? "end" : "side", labelSide: side });
    } else if (l.t === "M") f.moment([l.x, 0], l.M > 0, `${q(Math.abs(l.M), "kNm")}`);
  }
  if (dims) {
    const xs = [0, L];
    if (beam.kind === "overhang") xs.push(beam.s);
    for (const l of beam.loads) l.t === "q" ? xs.push(l.x1, l.x2) : xs.push(l.x);
    const u = [...new Set(xs.map((x) => round(x, 6)))].sort((a, b) => a - b);
    for (let i = 0; i < u.length - 1; i++) f.dim([u[i], 0], [u[i + 1], 0], `${num(u[i + 1] - u[i])} m`, 52);
  }
}

/**
 * The M diagram as on the exam's solution sheets: drawn on the tension
 * side (positive, sagging, below the axis), values at the key points and
 * at the extremes. y0 = where its axis goes; height = world units of the
 * largest |M|.
 */
export function drawMoment(f, beam, an, { y0 = 0, height = 1, fmt = num, title = "M [kNm]" } = {}) {
  const { sol } = an;
  const pts = sampleDiagram(sol, sol.M, 60);
  const m = Math.max(1e-9, ...pts.map(([, v]) => Math.abs(v)), Math.abs(an.crit.value));
  const k = height / m;
  const Y = (v) => y0 - v * k;
  f.polygon([[0, y0], ...pts.map(([x, v]) => [x, Y(v)]), [beam.L, y0]], "fig-body");
  f.line([0, y0], [beam.L, y0], "fig-rope");
  f.label([0, y0], title, { dx: -8, dy: 4, anchor: "end" });
  f.bounds([[-0.2 * beam.L, y0]]); // room for the title
  const shown = [];
  const mark = (x, v) => {
    if (Math.abs(v) < 1e-9) return;
    if (shown.some(([sx, sv]) => Math.abs(sx - x) < 0.12 * beam.L && Math.abs(sv - v) < 0.15 * m)) return;
    shown.push([x, v]);
    f.label([x, Y(v)], fmt(v), { dy: v > 0 ? 16 : -7 });
  };
  mark(an.crit.x, an.crit.value);
  for (const x of sol.xs) for (const side of ["-", "+"]) mark(x, sol.M(x, side));
  for (const e of momentExtrema(sol)) mark(e.x, e.value);
}

/** Reactions and how M_max was found, for the solution. */
export function momentLines(beam, an) {
  const lines = [];
  const rs = an.sol.reactions;
  lines.push(
    `Reakcije (ravnotežne enačbe): ${rs
      .map((x) => `${x.name}_y = ${num(x.Ry)} kN${x.type === "fixed" ? `, M_${x.name} = ${num(x.M)} kNm` : ""}`)
      .join(", ")}.`,
  );
  const c = an.crit;
  const why =
    c.where === "T0"
      ? "kjer je prečna sila T = 0"
      : beam.kind === "cantilever" && Math.abs(c.x - (beam.clamp === "left" ? 0 : beam.L)) < 1e-9
        ? "v vpetju"
        : beam.kind === "overhang" && Math.abs(c.x - beam.s) < 1e-9
          ? "nad podporo B"
          : "na mestu, kjer se diagram M lomi ali skoči";
  lines.push(`Diagram M (spodaj): največji |M| je pri x = ${num(c.x)} m (${why}): M_{max} = ${num(c.value)} kNm = ${num(c.value * 100)} kNcm.`);
  return lines;
}
