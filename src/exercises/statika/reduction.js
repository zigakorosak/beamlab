// Redukcija sistema sil (reduction of a force system to a point):
//   redukcija-2d   three planar forces given as vectors at given points:
//                  resultant R, moment about a point T and about O, and where
//                  the line of action of R crosses the x axis (27.5.2004).
//   redukcija-3d   forces along edges / diagonals of a box (kvader), maybe
//                  a couple: reduce to a corner (R and M components) or find
//                  the moment about an axis through two corners
//                  (30.1.2012, 29.1.2009).
//
// Sign convention (notes, poglavje 2): M = r × F, counterclockwise (about +z)
// positive; in 2D M_T = Σ[(x_i − x_T)·F_{iy} − (y_i − y_T)·F_{ix}].
// Moment about an axis: M_e = M_P · e for any point P on the axis.

import { ans, num, q } from "../kit.js";
import { iso, svgText } from "../draw.js";
import { s, arrowHead } from "../../render/svg.js";

/** A number for a formula: negative ones in parentheses. */
const p = (v) => (v < 0 ? `(${num(v)})` : num(v));
const vec = (v, unit = "") => `(${v.map((x) => num(x)).join("; ")})${unit ? " " + unit : ""}`;

const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (a, k) => a.map((x) => x * k);
const dot = (a, b) => a.reduce((t, x, i) => t + x * b[i], 0);
const norm = (a) => Math.hypot(...a);
const cross = ([ax, ay, az], [bx, by, bz]) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];

// ---------------------------------------------------------------- 2D

export const redukcija2d = {
  id: "redukcija-2d",
  group: "statika",
  title: "Redukcija ravninskega sistema sil",
  desc: "Tri sile kot vektorji: rezultanta, moment v točko T in O, premica rezultante",

  generate(r) {
    for (;;) {
      const forces = [];
      while (forces.length < 3) {
        const F = [r.int(-30, 30), r.int(-30, 30)];
        const at = [r.int(-6, 6), r.int(-6, 6)];
        if (norm(F) < 4) continue;
        if (forces.some((g) => g.at[0] === at[0] && g.at[1] === at[1])) continue;
        forces.push({ F, at });
      }
      const T = [r.int(-6, 6), r.int(-6, 6)];
      if (T[0] === 0 && T[1] === 0) continue;
      const res = solve2d({ forces, T });
      if (norm(res.R) < 5 || Math.abs(res.R[1]) < 3) continue;
      if (Math.abs(res.MO) < 3 || Math.abs(res.MT) < 3 || Math.abs(res.MO - res.MT) < 3) continue;
      if (Math.abs(res.x0) > 30) continue;
      if (!clearFigure({ forces, T })) continue;
      return { forces, T };
    }
  },

  build(params) {
    const { forces, T } = params;
    const { R, MO, MT, x0, mO, mT } = solve2d(params);
    const names = forces.map((_, i) => `F_${i + 1}`);
    const sum = (k) => forces.map((f) => p(f.F[k])).join(" + ");
    return {
      title: this.title,
      text: [
        `Reducirajte sistem treh sil ${forces.map((f, i) => `${names[i]} = ${vec(f.F, "kN")} s prijemališčem r_${i + 1} = ${vec(f.at, "m")}`).join(", ")}`,
        `a) v točko T${vec(T, "m")}, b) v koordinatno izhodišče O(0; 0).`,
        "c) Kje premica rezultante seka os x?",
        "Momenti so okrog osi z, pozitivni v nasprotni smeri urinega kazalca.",
      ],
      figure(f) {
        const pts = [[0, 0], T, ...forces.map((g) => g.at)];
        const xs = pts.map((v) => v[0]), ys = pts.map((v) => v[1]);
        const x0b = Math.min(...xs) - 1.5, x1b = Math.max(...xs) + 1.5;
        const y0b = Math.min(...ys) - 1.5, y1b = Math.max(...ys) + 1.5;
        const segs = arrows2d(params);
        f.bounds([[x0b, y0b], [x1b, y1b], ...segs.map((g) => g.b)]);
        f.custom([[x0b, 0], [x1b, 0]], (Tf) => axisArrow(Tf, [x0b, 0], [x1b, 0], "x"));
        f.custom([[0, y0b], [0, y1b]], (Tf) => axisArrow(Tf, [0, y0b], [0, y1b], "y"));
        f.point([0, 0], "O", { dx: -6, dy: 16, anchor: "end" });
        f.point(T, "T", { dx: 7, dy: 16 });
        forces.forEach((g, i) => {
          const ang = (Math.atan2(g.F[1], g.F[0]) * 180) / Math.PI;
          f.point(g.at, "", { dot: true });
          f.force(g.at, ang, { tail: true, world: segs[i].len, label: names[i], labelAt: "end" });
        });
      },
      answers: [
        ans("Rx", "R_x", "kN", R[0]),
        ans("Ry", "R_y", "kN", R[1]),
        ans("MT", "M_T", "kNm", MT),
        ans("MO", "M_O", "kNm", MO),
        ans("x0", "x_0", "m", x0, { note: "presečišče premice rezultante z osjo x" }),
      ],
      solution: [
        `Rezultanta je enaka pri obeh redukcijah: R_x = ΣF_{ix} = ${sum(0)} = ${num(R[0])} kN, R_y = ΣF_{iy} = ${sum(1)} = ${num(R[1])} kN.`,
        `a) M_T = Σ[(x_i − x_T)·F_{iy} − (y_i − y_T)·F_{ix}]:`,
        ...forces.map((g, i) => `${names[i]}: (${num(g.at[0])} − ${p(T[0])})·${p(g.F[1])} − (${num(g.at[1])} − ${p(T[1])})·${p(g.F[0])} = ${num(mT[i])} kNm`),
        `M_T = ${mT.map(p).join(" + ")} = ${num(MT)} kNm.`,
        `b) M_O = Σ(x_i·F_{iy} − y_i·F_{ix}):`,
        ...forces.map((g, i) => `${names[i]}: ${p(g.at[0])}·${p(g.F[1])} − ${p(g.at[1])}·${p(g.F[0])} = ${num(mO[i])} kNm`),
        `M_O = ${mO.map(p).join(" + ")} = ${num(MO)} kNm.`,
        `Kontrola: M_T = M_O − (x_T·R_y − y_T·R_x) = ${num(MO)} − (${p(T[0])}·${p(R[1])} − ${p(T[1])}·${p(R[0])}) = ${num(MT)} kNm.`,
        `c) Na premici rezultante je M = 0. Za točko (x_0; 0) velja M_O = x_0·R_y − 0·R_x → x_0 = M_O / R_y = ${num(MO)} / ${p(R[1])} = ${num(x0)} m.`,
      ],
    };
  },
};

export function solve2d({ forces, T }) {
  const R = forces.reduce((acc, f) => add(acc, f.F), [0, 0]);
  const m = (f, P) => (f.at[0] - P[0]) * f.F[1] - (f.at[1] - P[1]) * f.F[0];
  const mO = forces.map((f) => m(f, [0, 0]));
  const mT = forces.map((f) => m(f, T));
  const MO = mO.reduce((a, b) => a + b, 0);
  const MT = mT.reduce((a, b) => a + b, 0);
  return { R, MO, MT, mO, mT, x0: MO / R[1] };
}

/** The force arrows as drawn: from the point, length scaled to |F|. */
function arrows2d({ forces, T }) {
  const pts = [[0, 0], T, ...forces.map((g) => g.at)];
  const xs = pts.map((v) => v[0]), ys = pts.map((v) => v[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 3;
  const Fmax = Math.max(...forces.map((g) => norm(g.F)));
  return forces.map((g) => {
    const len = span * (0.1 + (0.12 * norm(g.F)) / Fmax);
    const e = scale(g.F, 1 / norm(g.F));
    return { a: g.at, b: add(g.at, scale(e, len)), len, span };
  });
}

const segDist = (p, a, b) => {
  const d = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
  return norm(sub(p, add(a, scale(d, t))));
};
const segSeg = (s1, s2) => {
  // Crossing segments have distance 0.
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  if (o(s1.a, s1.b, s2.a) * o(s1.a, s1.b, s2.b) < 0 && o(s2.a, s2.b, s1.a) * o(s2.a, s2.b, s1.b) < 0) return 0;
  return Math.min(segDist(s1.a, s2.a, s2.b), segDist(s1.b, s2.a, s2.b), segDist(s2.a, s1.a, s1.b), segDist(s2.b, s1.a, s1.b));
};

/** Arrows apart from each other, from O and T, and off the axes' names. */
function clearFigure(params) {
  const segs = arrows2d(params);
  const gap = 0.09 * segs[0].span;
  const pts = [[0, 0], params.T, ...params.forces.map((g) => g.at)];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (norm(sub(pts[i], pts[j])) < 2) return false;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) if (segSeg(segs[i], segs[j]) < gap) return false;
    for (const P of [[0, 0], params.T]) if (segDist(P, segs[i].a, segs[i].b) < gap) return false;
    // The name past the tip: clear of the points, the other arrows and the axes' names.
    const e = scale(sub(segs[i].b, segs[i].a), 1 / segs[i].len);
    const tag = add(segs[i].b, scale(e, 0.06 * segs[0].span));
    for (const P of [[0, 0], params.T, ...params.forces.map((g) => g.at)]) if (norm(sub(tag, P)) < 1.5 * gap) return false;
    for (let j = 0; j < segs.length; j++) if (j !== i && segDist(tag, segs[j].a, segs[j].b) < gap) return false;
    if (Math.abs(tag[0]) < gap || Math.abs(tag[1]) < gap) return false;
    // Not lying along an axis.
    const [a, b] = [segs[i].a, segs[i].b];
    if ((Math.abs(a[0]) < gap && Math.abs(b[0]) < gap) || (Math.abs(a[1]) < gap && Math.abs(b[1]) < gap)) return false;
  }
  return true;
}

/** A thin axis line with an arrowhead and a name at its end. */
function axisArrow(T, a, b, name) {
  const x1 = T.X(a[0]), y1 = T.Y(a[1]), x2 = T.X(b[0]), y2 = T.Y(b[1]);
  const L = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  return s(
    "g.fig-axis",
    {},
    s("line", { x1, y1, x2: x2 - ux * 6, y2: y2 - uy * 6 }),
    arrowHead(x2, y2, ux, uy, 9),
    name ? svgText(x2 + ux * 12 + (Math.abs(uy) > 0.5 ? 10 : 0), y2 + uy * 12 + 4 + (Math.abs(ux) > 0.5 ? 12 : 0), name, { "text-anchor": "middle" }) : null,
  );
}

// ---------------------------------------------------------------- 3D

// Corners of the box a × b × c as on the exam sheet (29.1.2009): O at the
// back bottom left, x towards the viewer, y right, z up.
export const corners = (a, b, c) => ({
  O: [0, 0, 0],
  A: [a, 0, 0],
  B: [a, b, 0],
  C: [0, b, 0],
  D: [a, 0, c],
  E: [a, b, c],
  F: [0, b, c],
  G: [0, 0, c],
});
const NAMES = ["O", "A", "B", "C", "D", "E", "F", "G"];
const EDGES = [["O", "A"], ["O", "C"], ["O", "G"], ["A", "B"], ["B", "C"], ["A", "D"], ["B", "E"], ["C", "F"], ["D", "E"], ["E", "F"], ["F", "G"], ["G", "D"]];

/** The projected (screen) direction of a 3D direction, as a length. */
const projLen = (d) => {
  const P = iso(d);
  return Math.hypot(P[0], P[1]) / norm(d);
};

/** Angle (degrees) between two 3D directions as drawn. */
const screenAngle = (d1, d2) => {
  const [a, b] = [iso(d1), iso(d2)];
  const c = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};

export function solve3d({ a, b, c, forces, couple, point, axis }) {
  const K = corners(a, b, c);
  const P = K[point];
  const Fs = forces.map((f) => {
    const d = sub(K[f.to], K[f.from]);
    const e = scale(d, 1 / norm(d));
    const F = scale(e, f.F);
    const rel = sub(K[f.from], P);
    return { d, e, F, rel, M: cross(rel, F) };
  });
  let Mc = null;
  if (couple) {
    const d = sub(K[couple.to], K[couple.from]);
    Mc = scale(d, couple.M / norm(d));
  }
  const R = Fs.reduce((acc, f) => add(acc, f.F), [0, 0, 0]);
  let M = Fs.reduce((acc, f) => add(acc, f.M), [0, 0, 0]);
  if (Mc) M = add(M, Mc);
  let os = null;
  if (axis) {
    const [U, V] = axis;
    const d = sub(K[V], K[U]);
    const e = scale(d, 1 / norm(d));
    // Moment about a point on the axis (U), then its component along e.
    const MU = add(M, cross(sub(P, K[U]), R));
    os = { d, e, MU, Me: dot(MU, e) };
  }
  return { K, P, Fs, Mc, R, M, os };
}

export const redukcija3d = {
  id: "redukcija-3d",
  group: "statika",
  title: "Redukcija prostorskega sistema sil",
  desc: "Sile na kvadru: redukcija v oglišče in moment okrog osi",

  generate(r) {
    for (;;) {
      const a = r.step(1.5, 5, 0.5), b = r.step(1.5, 5, 0.5), c = r.step(1.5, 4, 0.5);
      const K = corners(a, b, c);
      const n = r.pick([2, 2, 3]);
      const forces = [];
      let ok = true;
      while (forces.length < n) {
        const from = r.pick(NAMES), to = r.pick(NAMES);
        if (from === to) continue;
        const d = sub(K[to], K[from]);
        if (projLen(d) < 0.35) { ok = false; break; }
        // Not two forces on the same line.
        if (forces.some((f) => (f.from === from && f.to === to) || (f.from === to && f.to === from))) continue;
        // Arrows from the same corner must look different on the sketch.
        if (forces.some((f) => f.from === from && screenAngle(sub(K[f.to], K[f.from]), d) < 30)) { ok = false; break; }
        forces.push({ from, to, F: r.int(2, 12) });
      }
      if (!ok) continue;
      let couple = null;
      if (n === 2 && r.chance(0.5)) {
        const [u, v] = r.pick(EDGES);
        couple = r.chance(0.5) ? { from: u, to: v, M: r.int(2, 10) } : { from: v, to: u, M: r.int(2, 10) };
        if (forces.some((f) => f.from === couple.from)) continue;
      }
      const variant = r.pick(["tocka", "os"]);
      const point = r.chance(0.5) ? "O" : r.pick(NAMES);
      let axis = null;
      if (variant === "os") {
        const u = r.pick(NAMES), v = r.pick(NAMES);
        if (u === v) continue;
        axis = [u, v];
      }
      const params = { a, b, c, forces, couple, point, variant, axis };
      const res = solve3d(params);
      if (norm(res.R) < 1 || norm(res.M) < 1) continue;
      if (variant === "os" && Math.abs(res.os.Me) < 1) continue;
      // Avoid answers like 0,004 that are zero in disguise.
      if ([...res.R, ...res.M].some((v) => Math.abs(v) > 1e-9 && Math.abs(v) < 0.05)) continue;
      return params;
    }
  },

  build(params) {
    const { a, b, c, forces, couple, point, variant, axis } = params;
    const res = solve3d(params);
    const { K, P, Fs, Mc, R, M, os } = res;
    const names = forces.map((_, i) => `F_${i + 1}`);
    const at = point === "O" ? "koordinatno izhodišče O" : `oglišče ${point}`;
    const text = [
      `Na kvader z dimenzijami a = ${q(a, "m")}, b = ${q(b, "m")} in c = ${q(c, "m")} deluje sistem ${forces.length === 2 ? "dveh" : "treh"} sil${couple ? " in momenta" : ""}. ` +
        forces.map((f, i) => `Sila ${names[i]} = ${q(f.F, "kN")} deluje v točki ${f.from} in kaže proti ${f.to}.`).join(" ") +
        (couple ? ` Moment M_1 = ${q(couple.M, "kNm")} deluje v točki ${couple.from}, njegov vektor kaže proti ${couple.to}.` : ""),
    ];
    if (variant === "tocka") text.push(`Reducirajte ta sistem v ${at}: določite komponente rezultante R in rezultirajočega momenta M_${point} v prikazanem koordinatnem sistemu.`);
    else
      text.push(
        `a) Reducirajte sistem v ${at} (komponente momenta M_${point}).`,
        `b) S kolikšnim momentom deluje sistem okrog osi ${axis[0]}${axis[1]}, usmerjene od ${axis[0]} proti ${axis[1]}?`,
      );
    text.push("Momenti so desnosučni (M = r × F).");

    const answers =
      variant === "tocka"
        ? [ans("Rx", "R_x", "kN", R[0]), ans("Ry", "R_y", "kN", R[1]), ans("Rz", "R_z", "kN", R[2]), ans("Mx", `M_{${point}x}`, "kNm", M[0]), ans("My", `M_{${point}y}`, "kNm", M[1]), ans("Mz", `M_{${point}z}`, "kNm", M[2])]
        : [ans("R", "|R|", "kN", norm(R)), ans("Mx", `M_{${point}x}`, "kNm", M[0]), ans("My", `M_{${point}y}`, "kNm", M[1]), ans("Mz", `M_{${point}z}`, "kNm", M[2]), ans("Mos", `M_{${axis.join("")}}`, "kNm", os.Me)];

    const solution = [
      `Koordinate oglišč: ${NAMES.map((n) => `${n}${vec(K[n])}`).join(", ")} (m).`,
      ...forces.flatMap((f, i) => {
        const g = Fs[i];
        return [
          `${names[i]}: smer ${f.from}→${f.to} = ${vec(g.d)}, |${f.from}${f.to}| = ${num(norm(g.d))} m, e = ${vec(g.e)}; ${names[i]} = ${num(f.F)}·e = ${vec(g.F, "kN")}.`,
        ];
      }),
      `R = ΣF_i = ${vec(R, "kN")}, |R| = ${num(norm(R))} kN.`,
      `Ročice od ${point}: r_i = (prijemališče − ${point}).`,
      ...forces.map((f, i) => `M(${names[i]}) = r_${i + 1} × ${names[i]} = ${vec(Fs[i].rel)} × ${vec(Fs[i].F)} = ${vec(Fs[i].M, "kNm")}`),
      ...(couple ? [`Moment M_1 je prost vektor (prištejemo ga nespremenjenega): smer ${couple.from}→${couple.to}, M_1 = ${vec(Mc, "kNm")}.`] : []),
      `M_${point} = ${vec(M, "kNm")}.`,
    ];
    if (variant === "os") {
      const [U, V] = axis;
      if (U !== point) solution.push(`Moment glede na točko ${U} na osi: M_${U} = M_${point} + (r_${point} − r_${U}) × R = ${vec(os.MU, "kNm")}.`);
      solution.push(`Enotski vektor osi: e = ${U}${V}/|${U}${V}| = ${vec(os.d)}/${num(norm(os.d))} = ${vec(os.e)}.`);
      solution.push(`M_{${U}${V}} = M_${U}·e = ${num(os.Me)} kNm.`);
    }

    return {
      title: this.title,
      text,
      figure(f) {
        drawBox(f, params, res);
      },
      answers,
      solution,
    };
  },
};

/** The box in oblique projection with corner names, axes and the loads. */
function drawBox(f, { a, b, c, forces, couple }, { K }) {
  const X = (n) => iso(K[n]);
  const ctr = iso([a / 2, b / 2, c / 2]);
  const size = Math.max(a, b, c);
  // Edges: those meeting O are hidden behind the box.
  for (const [u, v] of EDGES) {
    if (u === "O") f.dashed(X(u), X(v));
    else f.line(X(u), X(v), "fig-member");
  }
  // Axes, beyond the box.
  const ext = 0.35 * size;
  const tips = { x: [a + ext * 1.6, 0, 0], y: [0, b + ext, 0], z: [0, 0, c + ext] };
  const from = { x: "A", y: "C", z: "G" };
  for (const k of ["x", "y", "z"]) {
    const p0 = X(from[k]), p1 = iso(tips[k]);
    f.custom([p0, p1], (T) => axisArrow(T, p0, p1, k));
  }
  // Corner names, pushed away from the centre of the picture.
  for (const n of NAMES) {
    const P = X(n);
    let dx = P[0] - ctr[0], dy = P[1] - ctr[1];
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    if (n === "O") { dx = 0.7; dy = 0.7; } // inside the box drawing, up-right of the hidden corner
    f.label(P, n, { dx: dx * 13, dy: -dy * 13 + 5, cls: "fig-name" });
  }
  // Dimensions as letters with values, next to visible edges.
  const edgeLabel = (u, v, text, ox, oy, anchor = "middle") => {
    const m = [(X(u)[0] + X(v)[0]) / 2, (X(u)[1] + X(v)[1]) / 2];
    f.label(m, text, { dx: ox, dy: oy, anchor, cls: "fig-dim-label" });
  };
  edgeLabel("B", "C", `a = ${num(a)} m`, 10, 16, "start");
  edgeLabel("A", "B", `b = ${num(b)} m`, 0, 18);
  edgeLabel("A", "D", `c = ${num(c)} m`, -8, 4, "end");
  // Forces from their points toward the named corners.
  const L0 = 0.45 * size;
  forces.forEach((g, i) => {
    const P = X(g.from), Q = X(g.to);
    const len = Math.min(L0, 0.5 * Math.hypot(Q[0] - P[0], Q[1] - P[1]));
    const ang = (Math.atan2(Q[1] - P[1], Q[0] - P[0]) * 180) / Math.PI;
    f.force(P, ang, { tail: true, world: len, label: `F_${i + 1}`, labelAt: "end" });
  });
  if (couple) {
    const P = X(couple.from), Q = X(couple.to);
    const ux = Q[0] - P[0], uy = Q[1] - P[1];
    const L = Math.hypot(ux, uy);
    const len = Math.min(L0, 0.5 * L);
    const E = [P[0] + (ux / L) * len, P[1] + (uy / L) * len];
    f.custom([P, E], (T) => {
      const x1 = T.X(P[0]), y1 = T.Y(P[1]), x2 = T.X(E[0]), y2 = T.Y(E[1]);
      const l = Math.hypot(x2 - x1, y2 - y1) || 1;
      const vx = (x2 - x1) / l, vy = (y2 - y1) / l;
      // A moment vector: double arrowhead.
      return s(
        "g.fig-force",
        {},
        s("line", { x1, y1, x2: x2 - vx * 6, y2: y2 - vy * 6 }),
        arrowHead(x2, y2, vx, vy, 10),
        arrowHead(x2 - vx * 9, y2 - vy * 9, vx, vy, 10),
        svgText(x2 + vx * 12, y2 + vy * 12 + 4, "M_1", { class: "fig-force-label", "text-anchor": vx > 0.35 ? "start" : vx < -0.35 ? "end" : "middle" }),
      );
    }, 30);
  }
}
