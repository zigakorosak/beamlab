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
import { ans, num, q } from "../kit.js";
import { svgText } from "../draw.js";
import { arrowHead, s } from "../../render/svg.js";

const LAYOUTS = ["simple", "simple", "overhang", "overhang", "cantilever"];

export const beamNtm = {
  id: "nosilec-ntm",
  group: "statika",
  title: "Nosilec: reakcije in N, T, M",
  desc: "Prostoležeči nosilec, previsni nosilec ali konzola: reakcije, diagrami, M_ekstr",

  generate(r) {
    const type = r.pick(LAYOUTS);
    const level = r.chance(0.7) ? "medium" : "hard";
    return { model: generateProblem(type, level, r.next) };
  },

  build({ model }) {
    const sol = solve(model);
    const L = model.beam.length;
    const sup = sol.reactions; // sorted by x, named A, B, …
    const fixed = sup.find((x) => x.type === "fixed");
    const hasAxial = model.loads.some((l) => l.type === "point" && Math.abs(pointComponents(l).fx) > 1e-9);

    // ---- The extreme moment (largest |M|), over key points and T = 0 points.
    let ext = { x: 0, value: 0 };
    const consider = (x, v) => {
      if (Math.abs(v) > Math.abs(ext.value) + 1e-9) ext = { x, value: v };
    };
    for (const x of sol.xs) for (const side of ["-", "+"]) consider(x, sol.M(x, side));
    for (const e of momentExtrema(sol)) consider(e.x, e.value);

    // ---- Text
    const where = (x) => (x === 0 ? "na levem koncu" : Math.abs(x - L) < 1e-9 ? "na desnem koncu" : `pri x = ${num(x)} m`);
    const supText = sup.map((x) => `${x.type === "pin" ? "nepomična členkasta podpora" : x.type === "roller" ? "pomična podpora" : "vpetje"} ${x.name} ${where(x.x)}`);
    const loadText = model.loads.map((l) => {
      if (l.type === "point") {
        const dir = l.angle === 0 ? "navpično navzdol" : `pod kotom ${Math.abs(l.angle)}° od navpičnice (${l.angle > 0 ? "v desno" : "v levo"})`;
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
    answers.push(ans("Mext", "M_{ekstr}", "kNm", ext.value), ans("xext", "x", "m", ext.x, { tol: 0.1, note: "mesto M_{ekstr} (od levega konca)" }));

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
    solution.push("Notranje sile na mejah polj (T levo | desno od točke, M):");
    for (const x of sol.xs) {
      const tl = x > 0 ? num(sol.V(x, "-")) : "—";
      const tr = x < L ? num(sol.V(x, "+")) : "—";
      solution.push(`x = ${num(x)} m: T = ${tl} | ${tr} kN, M = ${num(sol.M(x, x < L ? "+" : "-"))} kNm`);
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
    f.label([rc.x, 0], rc.name, { dx: -16, dy: 34, cls: "fig-name" });
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
  for (const l of model.loads) {
    if (l.type === "point") {
      const ang = -90 + l.angle; // from straight down, towards +x
      // Long enough to reach above the stacked loads; label past the tail.
      f.force([l.x, 0], ang, { label: q(l.value, "kN"), len: 62 + Math.max(0, levels - 1) * LEVEL, labelAt: "end" });
    } else if (l.type === "moment") {
      // Label above the arc, or below the beam when a distributed load is
      // drawn there; two couples close together take opposite sides.
      f.moment([l.x, 0], l.value > 0);
      const covered = dists.some((d) => d.x1 <= l.x + 1e-9 && l.x <= d.x2 + 1e-9);
      const prev = model.loads.slice(0, model.loads.indexOf(l)).filter((m) => m.type === "moment" && Math.abs(m.x - l.x) < 0.2 * L);
      const below = covered !== prev.length % 2 > 0;
      f.label([l.x, 0], q(Math.abs(l.value), "kNm"), below ? { dy: 52, cls: "fig-force-label" } : { dy: -24, cls: "fig-force-label" });
    } else {
      // The label goes where no point force's arrow crosses it.
      const pointXs = model.loads.filter((p) => p.type === "point").map((p) => p.x);
      // (A triangular load is labelled near its high end, where the value applies.)
      const tri = l.q1 !== l.q2;
      const at = (tri ? (l.q2 > l.q1 ? [0.8, 0.65, 0.92] : [0.2, 0.35, 0.08]) : [0.5, 0.25, 0.75, 0.15, 0.85])
        .map((t) => [t, Math.min(Infinity, ...pointXs.map((x) => Math.abs(x - (l.x1 + (l.x2 - l.x1) * t))))])
        .reduce((best, c) => (c[1] > best[1] + 0.3 * (l.x2 - l.x1) * 0.25 ? c : best));
      stackedDist(f, l, level.get(l) * LEVEL, at[0]);
    }
  }
  // Dimension chain under the beam between consecutive key points.
  const xs = [...new Set([0, L, ...sup.map((x) => x.x), ...model.loads.flatMap((l) => (l.type === "dist" ? [l.x1, l.x2] : [l.x]))])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] - xs[i] > 1e-9) f.dim([xs[i], 0], [xs[i + 1], 0], `${num(xs[i + 1] - xs[i])} m`, 62);
  f.bounds([[0, 0.6], [L, -0.6]]);
}

/** A distributed load drawn `base` px above the beam (its arrows end on a thin line there). */
function stackedDist(f, l, base, labelAt = 0.5) {
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
    const lx = x1 + (x2 - x1) * labelAt;
    g.append(svgText(lx, y - (h0 + (h1 - h0) * labelAt) - 8, label, { class: "fig-force-label", "text-anchor": "middle" }));
    return g;
  }, base + hmax + 26);
}

/** N, T, M under each other, values at the key points, M on the tension side. */
function drawDiagrams(f, model, sol, ext) {
  const L = model.beam.length;
  const amp = Math.max(0.55, L * 0.11); // world height of the biggest value
  const gap = amp * 2.6;
  f.bounds([[-L * 0.1, amp], [L * 1.02, -2 * gap - amp * 1.3]]); // room for the band names on the left
  const bands = [
    { fn: sol.N, name: "N [kN]", down: false, cls: "diag-n" },
    { fn: sol.V, name: "T [kN]", down: false, cls: "diag-t" },
    { fn: sol.M, name: "M [kNm]", down: true, cls: "diag-m" },
  ];
  bands.forEach((b, i) => {
    const y0 = -i * gap;
    const pts = sampleDiagram(sol, b.fn, 40);
    let peak = 0;
    for (const [, v] of pts) peak = Math.max(peak, Math.abs(v));
    const k = peak > 1e-9 ? amp / peak : 0;
    const Y = (v) => y0 + (b.down ? -v : v) * k;
    f.line([0, y0], [L, y0], "fig-thin");
    f.label([0, y0], b.name, { dx: -10, dy: 4, anchor: "end", cls: "fig-name" });
    const poly = [[0, y0], ...pts.map(([x, v]) => [x, Y(v)]), [L, y0]];
    f.polygon(poly, `fig-diagram.${b.cls}`);
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
    const placed = [];
    for (const [x, v, side] of labels.values()) {
      if (placed.some(([px, pv]) => Math.abs(px - x) < 0.07 * L && Math.abs(pv - v) * k < amp * 0.3)) continue;
      placed.push([x, v]);
      const dy = (b.down ? -v : v) > 0 ? -6 : 14;
      f.label([x, Y(v)], num(v), { dx: side === "-" ? -4 : side === "+" ? 4 : 0, dy, anchor: side === "-" ? "end" : side === "+" ? "start" : "middle", cls: "fig-value" });
    }
    if (peak < 1e-9) f.label([L / 2, y0], "0", { dy: -6, cls: "fig-value" });
  });
  // Where the extreme moment is: a dashed line down to the M axis.
  const yM = -2 * gap;
  const kM = amp / Math.max(1e-9, ...sampleDiagram(sol, sol.M, 40).map(([, v]) => Math.abs(v)));
  if (Math.abs(ext.value) > 1e-9) f.dashed([ext.x, yM], [ext.x, yM - ext.value * kM]);
}
