// Nosilec: reakcije in diagrami N, T, M — the third problem of almost
// every exam: a simply supported beam, an overhang or a cantilever with
// point loads, uniform (sometimes triangular) loads and couples.
//
// The beam and its numbers come from the Practice generator and the FEM /
// method-of-sections solver (core/), so the answers are the same ones the
// Practice and Build screens draw. Asked: the reactions, the extreme
// bending moment with its position, and T and M at the key points in the
// solution. The diagrams are drawn as on the exam's solution sheets:
// N, T stacked under the beam, positive T up, M on the tension side
// (positive, sagging, drawn below the axis).

import { generateProblem } from "../../core/generator.js";
import { momentExtrema, sampleDiagram, solve } from "../../core/solver.js";
import { distResultant, pointComponents } from "../../core/model.js";
import { ans, num, plain, q, nearZero } from "../kit.js";
import { svgText } from "../draw.js";
import { arrowHead, s } from "../../render/svg.js";

const LAYOUTS = ["simple", "simple", "overhang", "overhang", "cantilever"];

export const beamNtm = {
  id: "nosilec-ntm",
  group: "statika",
  title: "Nosilec: reakcije in N, T, M",
  desc: "Prostoležeči nosilec, previsni nosilec ali konzola: reakcije, diagrami, M_ekstr",

  generate(r) {
    for (;;) {
      const type = r.pick(LAYOUTS);
      const level = r.chance(0.7) ? "medium" : "hard";
      const model = generateProblem(type, level, r.next);
      // The asked M_ekstr and its place must be unique: no equal |M| of the
      // other sign or at another place (e.g. M constant between two couples).
      if (!extremeMoment(solve(model)).ambiguous) return { model };
    }
  },

  build({ model }) {
    const sol = solve(model);
    const L = model.beam.length;
    const sup = sol.reactions; // sorted by x, named A, B, …
    const fixed = sup.find((x) => x.type === "fixed");
    const hasAxial = model.loads.some((l) => l.type === "point" && Math.abs(pointComponents(l).fx) > 1e-9);

    // ---- The extreme moment (largest |M|), over key points and T = 0 points.
    const { ext } = extremeMoment(sol);

    // ---- Text
    const where = (x) => (x === 0 ? "na levem koncu" : Math.abs(x - L) < 1e-9 ? "na desnem koncu" : `pri x = ${num(x)} m`);
    const supText = sup.map((x) => `${x.type === "pin" ? "nepomično členkasto podporo" : x.type === "roller" ? "pomično podporo" : "vpetje"} ${x.name} ${where(x.x)}`);
    const loadText = model.loads.map((l) => {
      if (l.type === "point") {
        const dir = l.angle === 0 ? "navpično navzdol" : `poševno navzdol, ${Math.abs(l.angle)}° od navpičnice ${l.angle > 0 ? "v desno" : "v levo"}`;
        return `sila ${q(l.value, "kN")} ${where(l.x)}, ${dir}`;
      }
      if (l.type === "moment") return `koncentriran moment ${q(Math.abs(l.value), "kNm")} ${where(l.x)} (${l.value > 0 ? "v nasprotni smeri urinega kazalca" : "v smeri urinega kazalca"})`;
      if (l.q1 === l.q2) return `enakomerna zvezna obtežba q = ${q(l.q1, "kN/m")} od x = ${num(l.x1)} m do x = ${num(l.x2)} m`;
      return `linearna (trikotna) obtežba od ${q(l.q1, "kN/m")} pri x = ${num(l.x1)} m do ${q(l.q2, "kN/m")} pri x = ${num(l.x2)} m`;
    });

    // ---- Answers: vertical reactions (and Ax, M_A when they exist), M_ekstr and where.
    const answers = [];
    for (const rc of sup) {
      if (rc.type !== "roller" && hasAxial) answers.push(ans(`${rc.name}x`, `${rc.name}_x`, "kN", rc.Rx));
      answers.push(ans(`${rc.name}y`, `${rc.name}_y`, "kN", rc.Ry));
      if (rc.type === "fixed") answers.push(ans(`M${rc.name}`, `M_${rc.name}`, "kNm", rc.M));
    }
    const reactionKeys = answers.map((a) => a.key);
    answers.push(ans("Mext", "M_{ekstr}", "kNm", ext.value), ans("xext", "x", "m", ext.x, { tol: 0.1, note: "mesto M_{ekstr} (od levega konca)" }));
    // A reaction can come out 0 (or nearly): 1 % of the largest answer in its unit.
    nearZero(answers, reactionKeys);

    // ---- Solution
    const solution = [];
    const dists = model.loads.filter((l) => l.type === "dist");
    for (const d of dists) {
      const R = distResultant(d);
      solution.push(
        d.q1 === d.q2
          ? `Rezultanta zvezne obtežbe: Q = q·l = ${num(d.q1)}·${num(d.x2 - d.x1)} = ${num(R.F)} kN, prijemališče x = ${num(R.x)} m.`
          : `Rezultanta trikotne obtežbe: Q = ½·q·l = ${num(R.F)} kN, prijemališče v težišču trikotnika, x = ${num(R.x)} m.`,
      );
    }
    solution.push(...equations(model, sol, fixed));
    solution.push("Notranje sile na mejah polj (T levo | desno od točke; M levo | desno, kjer ima skok):");
    for (const x of sol.xs) {
      const tl = x > 0 ? num(sol.V(x, "-")) : "—";
      const tr = x < L ? num(sol.V(x, "+")) : "—";
      // A couple at x makes M jump: give both sides, not just one.
      const ml = sol.M(x, "-"), mr = sol.M(x, "+");
      const mText = x > 0 && x < L && Math.abs(ml - mr) > 1e-9 ? `${num(ml)} | ${num(mr)}` : num(sol.M(x, x < L ? "+" : "-"));
      solution.push(`x = ${num(x)} m: T = ${tl} | ${tr} kN, M = ${mText} kNm`);
    }
    for (const e of momentExtrema(sol)) solution.push(`T = 0 pri x = ${num(e.x)} m → lokalni ekstrem M = ${num(e.value)} kNm.`);
    solution.push(`Ekstremni moment: M_{ekstr} = ${num(ext.value)} kNm pri x = ${num(ext.x)} m (${ext.value > 0 ? "natezna spodnja vlakna" : "natezna zgornja vlakna"}).`);
    solution.push("Pravila za kontrolo: dT/dx = −q, dM/dx = T; sila → skok v T, moment → skok v M, M je ekstremen, kjer je T = 0.");

    return {
      title: "Nosilec: reakcije in notranje sile",
      text: [
        `Nosilec dolžine ${q(L, "m")} ima: ${supText.join("; ")}.`,
        `Obtežba: ${loadText.join("; ")}.`,
        `Izračunajte reakcije (pozitivno navzgor${hasAxial ? " oz. v desno" : ""}${fixed ? ", moment vpetja pozitiven v nasprotni smeri urinega kazalca" : ""}), narišite diagrame N, T, M in določite ekstremni upogibni moment (s predznakom: pozitiven, če so natezna spodnja vlakna) ter mesto, kjer nastopi.`,
      ],
      figure: (f) => drawBeam(f, model, sup),
      answers,
      solution,
      solutionFigure: (f) => drawDiagrams(f, model, sol, ext),
    };
  },
};

/** The largest |M| over the key points and the T = 0 points; `ambiguous`
 *  when another place (more than 0,1 m away) or the other sign reaches it
 *  too, or comes within 3 % (a near tie that rounding could flip). */
export function extremeMoment(sol) {
  const cands = [];
  for (const x of sol.xs) for (const side of ["-", "+"]) cands.push({ x, value: sol.M(x, side) });
  for (const e of momentExtrema(sol)) cands.push({ x: e.x, value: e.value });
  let ext = { x: 0, value: 0 };
  for (const c of cands) if (Math.abs(c.value) > Math.abs(ext.value) + 1e-9) ext = c;
  const tie = 0.03 * Math.abs(ext.value) + 1e-6;
  const ambiguous = cands.some((c) => Math.abs(Math.abs(c.value) - Math.abs(ext.value)) < tie && (Math.abs(c.x - ext.x) > 0.1 || c.value * ext.value < 0));
  return { ext, ambiguous };
}

/** The equilibrium equations, as on the exam's solution sheets. */
function equations(model, sol, fixed) {
  const lines = [];
  const acts = []; // { x, fx, fy } point actions incl. resultants; couples
  const couples = [];
  for (const l of model.loads) {
    if (l.type === "point") acts.push({ x: l.x, ...pointComponents(l) });
    else if (l.type === "moment") couples.push(l.value);
    else {
      const R = distResultant(l);
      acts.push({ x: R.x, fx: 0, fy: -R.F });
    }
  }
  const sx = sol.reactions;
  const term = (v, text) => `${v < 0 ? "−" : "+"} ${text}`;
  const join = (terms) => terms.join(" ").replace(/^\+ /, "").replace(/^− /, "−");

  if (fixed) {
    const n = fixed.name;
    const fy = [term(1, `${n}_y`), ...acts.filter((a) => Math.abs(a.fy) > 1e-9).map((a) => term(a.fy, num(Math.abs(a.fy))))];
    lines.push(`ΣF_y = 0: ${join(fy)} = 0 → ${n}_y = ${num(fixed.Ry)} kN`);
    const mt = [term(1, `M_${n}`)];
    for (const a of acts) {
      const m = (a.x - fixed.x) * a.fy; // CCW moment of the vertical part
      if (Math.abs(m) > 1e-9) mt.push(term(m, `${num(Math.abs(a.fy))}·${num(Math.abs(a.x - fixed.x))}`));
    }
    for (const c of couples) mt.push(term(c, num(Math.abs(c))));
    lines.push(`ΣM_${n} = 0 (v nasprotni smeri urinega kazalca +): ${join(mt)} = 0 → M_${n} = ${num(fixed.M)} kNm`);
  } else {
    const [A, B] = sx;
    // ΣM about A gives B, ΣM about B gives A.
    for (const [P, Q] of [[A, B], [B, A]]) {
      const t = [term(Q.x > P.x ? 1 : -1, `${Q.name}_y·${num(Math.abs(Q.x - P.x))}`)];
      for (const a of acts) {
        const m = (a.x - P.x) * a.fy;
        if (Math.abs(m) > 1e-9) t.push(term(m, `${num(Math.abs(a.fy))}·${num(Math.abs(a.x - P.x))}`));
      }
      for (const c of couples) t.push(term(c, num(Math.abs(c))));
      lines.push(`ΣM_${P.name} = 0: ${join(t)} = 0 → ${Q.name}_y = ${num(Q.Ry)} kN`);
    }
    const fy = [term(1, `${A.name}_y`), term(1, `${B.name}_y`), ...acts.filter((a) => Math.abs(a.fy) > 1e-9).map((a) => term(a.fy, num(Math.abs(a.fy))))];
    lines.push(`Kontrola ΣF_y = 0: ${join(fy)} = ${num(A.Ry + B.Ry + acts.reduce((t, a) => t + a.fy, 0))} ✓`);
  }
  const ax = acts.filter((a) => Math.abs(a.fx) > 1e-9);
  if (ax.length) {
    const pin = sx.find((x) => x.type !== "roller");
    lines.push(`ΣF_x = 0: ${pin.name}_x ${ax.map((a) => term(a.fx, num(Math.abs(a.fx)))).join(" ")} = 0 → ${pin.name}_x = ${num(pin.Rx)} kN`);
  }
  return lines;
}

function drawBeam(f, model, sup) {
  const L = model.beam.length;
  f.member([0, 0], [L, 0]);
  for (const rc of sup) {
    if (rc.type === "pin") f.pin([rc.x, 0], 90);
    else if (rc.type === "roller") f.roller([rc.x, 0], 90);
    else f.fixed([rc.x, 0], rc.x === 0 ? 0 : 180);
    // Left of the support, below the beam (the dimensions are further down).
    f.label([rc.x, 0], rc.name, { dx: -16, dy: 34, cls: "fig-name", alts: [[-18, 20, "end"], [16, 34, "middle"], [-12, -10, "end"]] });
  }
  // Distributed loads that overlap are stacked, as on the exam sheets: each
  // one sits on its own level above the one below (LEVEL px apart).
  const LEVEL = 50;
  const dists = model.loads.filter((l) => l.type === "dist");
  const level = new Map();
  dists.forEach((d, i) => {
    let k = 0;
    while (dists.slice(0, i).some((e) => level.get(e) === k && e.x1 < d.x2 - 1e-9 && d.x1 < e.x2 - 1e-9)) k++;
    level.set(d, k);
  });
  const levels = dists.length ? Math.max(...level.values()) + 1 : 0;
  // A couple's label: above the arc, or below the beam when a distributed
  // load is drawn there; two couples close together take opposite sides.
  const coupleBelow = (l) => {
    const covered = dists.some((d) => d.x1 <= l.x + 1e-9 && l.x <= d.x2 + 1e-9);
    const prev = model.loads.slice(0, model.loads.indexOf(l)).filter((m) => m.type === "moment" && Math.abs(m.x - l.x) < 0.2 * L);
    return { covered, below: covered !== prev.length % 2 > 0 };
  };
  // A distributed load's label goes where no point force's arrow, couple's
  // label or neighbouring load's label is (the other places are tried too
  // when it's drawn: an inclined arrow's tail, …). A triangular load is
  // labelled near its high end, where the value applies.
  const places = (d) => (d.q1 !== d.q2 ? (d.q2 > d.q1 ? [0.8, 0.65, 0.92] : [0.2, 0.35, 0.08]) : [0.5, 0.25, 0.75, 0.15, 0.85]);
  const fixedXs = model.loads.filter((p) => p.type === "point" || (p.type === "moment" && !coupleBelow(p).below)).map((p) => p.x);
  const choose = (d, xs) =>
    places(d)
      .map((t) => [t, Math.min(Infinity, ...xs.map((x) => Math.abs(x - (d.x1 + (d.x2 - d.x1) * t))))])
      .reduce((best, c) => (c[1] > best[1] + 0.3 * (d.x2 - d.x1) * 0.25 ? c : best))[0];
  const first = new Map(dists.map((d) => [d, choose(d, fixedXs)]));
  const labelX = (d, t) => d.x1 + (d.x2 - d.x1) * t;
  const labelT = new Map(dists.map((d) => [d, choose(d, [...fixedXs, ...dists.filter((e) => e !== d && level.get(e) === level.get(d)).map((e) => labelX(e, first.get(e)))])]));
  for (const l of model.loads) {
    if (l.type === "point") {
      const ang = -90 + l.angle; // from straight down, towards +x
      // Long enough to reach above the stacked loads; label past the tail.
      f.force([l.x, 0], ang, { label: q(l.value, "kN"), len: 62 + Math.max(0, levels - 1) * LEVEL, labelAt: "auto" });
    } else if (l.type === "moment") {
      f.moment([l.x, 0], l.value > 0);
      const { covered, below } = coupleBelow(l);
      // (Above a distributed load: over its arrows, not among them.)
      // (Or, an inclined force's arrow there, beside the arc or a row further out.)
      const dy = below ? 52 : covered ? -44 - Math.max(0, levels - 1) * LEVEL : -24, out = below ? 14 : -14;
      f.label([l.x, 0], q(Math.abs(l.value), "kNm"), { dy, cls: "fig-force-label", alts: [[22, dy, "start"], [-22, dy, "end"], [0, dy + out, "middle"], [22, dy + out, "start"], [-22, dy + out, "end"]] });
    } else {
      const t = labelT.get(l);
      stackedDist(f, l, level.get(l) * LEVEL, [t, ...places(l).filter((u) => u !== t)]);
    }
  }
  // Dimension chain under the beam between consecutive key points.
  const xs = [...new Set([0, L, ...sup.map((x) => x.x), ...model.loads.flatMap((l) => (l.type === "dist" ? [l.x1, l.x2] : [l.x]))])].sort((a, b) => a - b);
  // (Short segments on a phone: labels that don't fit side by side take a second row.)
  f.dimChain(xs.map((x) => [x, 0]), xs.slice(1).map((x, i) => `${num(x - xs[i])} m`), 62);
  f.bounds([[0, 0.6], [L, -0.6]]);
}

/** A distributed load drawn `base` px above the beam (its arrows end on a thin line there).
 *  `labelAt`: places for the label along the load (0…1), the first preferred. */
function stackedDist(f, l, base, labelAt = [0.5]) {
  const hmax = 30;
  const qmax = Math.max(l.q1, l.q2);
  const h0 = (hmax * l.q1) / qmax;
  const h1 = (hmax * l.q2) / qmax;
  const label = l.q1 === l.q2 ? `q = ${q(l.q1, "kN/m")}` : q(qmax, "kN/m");
  f.custom([[l.x1, 0], [l.x2, 0]], (T) => {
    const y = T.Y(0) - base;
    const x1 = T.X(l.x1), x2 = T.X(l.x2);
    const n = Math.max(2, Math.round((x2 - x1) / 16));
    const g = s("g.fig-load", {}, base ? s("line", { x1, y1: y, x2, y2: y, class: "fig-thin" }) : null);
    const tails = [];
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n;
      const h = h0 + ((h1 - h0) * i) / n;
      tails.push(`${x},${y - h}`);
      if (h > 3) g.append(s("line", { x1: x, y1: y - h, x2: x, y2: y - 5 }), arrowHead(x, y, 0, 1, 7));
    }
    g.append(s("polyline", { points: tails.join(" "), fill: "none" }));
    // Over the tails' line where it is highest under the label (a triangle's slopes).
    const half = plain(label).length * 3.5;
    const hAt = (x) => h0 + ((h1 - h0) * Math.max(0, Math.min(1, (x - x1) / (x2 - x1 || 1))));
    const alts = labelAt.map((t) => {
      const lx = x1 + (x2 - x1) * t;
      return [lx, y - Math.max(hAt(lx - half), hAt(lx + half)) - 8, "middle"];
    });
    // (A row higher: an inclined force's arrow crossing them all.)
    alts.push(...alts.map(([x, yy, a]) => [x, yy - 14, a]));
    // (Or a short load with a force at its end: past either end, running outwards.)
    alts.push([x1 - 6, y - h0 + 4, "end"], [x2 + 6, y - h1 + 4, "start"], [x1 - 6, y - Math.max(h0, h1) - 8, "end"], [x2 + 6, y - Math.max(h0, h1) - 8, "start"]);
    // (Or, a force's arrow beside it, level with the arrow's tail, above it all.)
    alts.push([x1, y - 72, "start"], [x2, y - 72, "end"]);
    const t = svgText(alts[0][0], alts[0][1], label, { class: "fig-force-label", "text-anchor": "middle" });
    if (alts.length > 1) t.alts = alts;
    g.append(t);
    return g;
  }, (ppm) => {
    // Above the beam only; and room for the label where it runs past the
    // load's ends (a short load at the end of the beam).
    const half = plain(label).length * 3.5 + 4, t0 = labelAt[0] * (l.x2 - l.x1) * ppm, t1 = (1 - labelAt[0]) * (l.x2 - l.x1) * ppm;
    return { t: base + hmax + 26, b: 8, l: Math.max(8, half - t0), r: Math.max(8, half - t1) };
  });

}

/**
 * N, T, M under each other, values at the key points, M on the tension side.
 * The bands' heights are in px (the values are 11 px text at any scale): a
 * phone gets bands as tall as it needs, a desktop the usual ones.
 */
function drawDiagrams(f, model, sol, ext) {
  const L = model.beam.length;
  const ampOf = (ppm) => Math.max(56, Math.min(76, 0.11 * L * ppm)); // px of the biggest value
  const gapOf = (amp) => 2.6 * amp + 20; // px between the bands' axes (room for the values)
  const bands = [
    { fn: sol.N, name: "N [kN]", down: false, cls: "diag-n" },
    { fn: sol.V, name: "T [kN]", down: false, cls: "diag-t" },
    { fn: sol.M, name: "M [kNm]", down: true, cls: "diag-m" },
  ].map((b) => {
    const pts = sampleDiagram(sol, b.fn, 40);
    let peak = 0;
    for (const [, v] of pts) peak = Math.max(peak, Math.abs(v));
    // Values at key points (both sides of a jump) and at the moment peak
    // (first, so it wins when two labels would overlap).
    const labels = new Map();
    if (b.fn === sol.M) for (const e of momentExtrema(sol)) labels.set(`e${e.x}`, [e.x, e.value, "0"]);
    for (const x of sol.xs)
      for (const side of ["-", "+"]) {
        if ((x === 0 && side === "-") || (x === L && side === "+")) continue;
        const v = b.fn(x, side);
        if (Math.abs(v) < 1e-6 * (1 + peak)) continue;
        const key = `${x}:${num(v)}`;
        if (!labels.has(key)) labels.set(key, [x, v, side]);
      }
    return { ...b, pts, peak, labels: [...labels.values()] };
  });
  // The names need ~60 px left of the axes; the values ~20 past the ends.
  const pad = (ppm) => {
    const amp = ampOf(ppm);
    return { l: 66, r: 26, t: amp + 22, b: 2 * gapOf(amp) + amp + 24 };
  };
  f.custom([[0, 0], [L, 0]], (T) => {
    const amp = ampOf(T.ppm), gap = gapOf(amp);

    const g = s("g", {});
    const expected = []; // the values that must be there (test/figures-layout.test.mjs)
    bands.forEach((b, i) => {
      const y0 = T.Y(0) + i * gap;
      const k = b.peak > 1e-9 ? amp / b.peak : 0;
      const Y = (v) => y0 - (b.down ? -v : v) * k;
      g.append(s("line.fig-thin", { x1: T.X(0), y1: y0, x2: T.X(L), y2: y0 }));
      g.append(svgText(T.X(0) - 10, y0 + 4, b.name, { class: "fig-name", "text-anchor": "end" }));
      const poly = [[0, 0], ...b.pts, [L, 0]].map(([x, v], n, all) => `${T.X(x)},${n === 0 || n === all.length - 1 ? y0 : Y(v)}`);
      g.append(s(`polygon.fig-diagram.${b.cls}`, { points: poly.join(" ") }));
      const placed = [];
      for (const [x, v, side] of b.labels) {
        // Skip the same number again within reach of its text (a constant T
        // on a short field); every other value is drawn (placeLabels finds it room).
        const wv = num(v).length * 6;
        if (placed.some(([px, pv]) => num(pv) === num(v) && Math.abs(px - x) * T.ppm < 2 * wv + 10)) continue;
        placed.push([x, v]);
        expected.push(num(v));
        const up = (b.down ? -v : v) > 0;
        const dx = side === "-" ? -4 : side === "+" ? 4 : 0;
        const anchor = side === "-" ? "end" : side === "+" ? "start" : "middle";
        const px = T.X(x) + dx, py = Y(v);
        const t = svgText(px, py + (up ? -6 : 14), num(v), { class: "fig-value", "text-anchor": anchor });
        // Crowded (a phone, values close together): a row further out, or the other side.
        t.alts = [[px, py + (up ? -6 : 14), anchor], [px, py + (up ? -18 : 26), anchor], [T.X(x) - dx, py + (up ? -6 : 14), side === "-" ? "start" : side === "+" ? "end" : "middle"], [px, py + (up ? 14 : -6), anchor], [px, py + (up ? -30 : 38), anchor]];
        g.append(t);
      }
      if (b.peak < 1e-9) g.append(svgText(T.X(L / 2), y0 - 6, "0", { class: "fig-value", "text-anchor": "middle" }));
    });
    // Where the extreme moment is: a dashed line down to the M axis.
    const M = bands[2];
    if (Math.abs(ext.value) > 1e-9 && M.peak > 1e-9) {
      const y0 = T.Y(0) + 2 * gap;
      g.append(s("line.fig-dashed", { x1: T.X(ext.x), y1: y0, x2: T.X(ext.x), y2: y0 + (ext.value * amp) / M.peak }));
    }
    g.setAttribute("data-values", JSON.stringify(expected));
    return g;
  }, pad);
}
