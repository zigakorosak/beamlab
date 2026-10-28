// Težišče (centroid) problems:
//   tezisce-prevrnitev  a body cut out in the shape of a T (Γ, L, ⊥) stands
//                       on a board that is slowly tilted; it cannot slide, so
//                       it tips over its lower edge once the centroid passes
//                       above it: tan α = e/y_T (28.6.2006: flange 12×5 on a
//                       stem 5×10 cm → y_T = 9,0909 cm, α = 15,376°).
//   pappus              Pappus–Guldin: volume V = 2π·x_T·A and the wetted
//                       surface S = 2π·Σ x_i·l_i of an axisymmetric basin whose
//                       section is made of quarter circles (10.4.2006, R = 10 m
//                       → V = 6885,49 m³).

import { ans, angleAns, deg, num, q, rad } from "../kit.js";
import { s } from "../../render/svg.js";

// ---------------------------------------------------------------------------

/**
 * The body as rectangles [x, y, w, h] in cm, the base (lowest rectangle)
 * from x = 0. shape: "T" (flange b1×h1 centred on a stem b2×h2),
 * "G" (Γ: the flange flush with the stem's left side), "L" (stem b2×h2 at
 * the left end of a base b1×h1), "U" (⊥: stem centred on the base).
 */
export function bodyRects({ shape, b1, h1, b2, h2 }) {
  if (shape === "T") return [[0, 0, b2, h2], [-(b1 - b2) / 2, h2, b1, h1]];
  if (shape === "G") return [[0, 0, b2, h2], [0, h2, b1, h1]];
  if (shape === "L") return [[0, 0, b1, h1], [0, h1, b2, h2]];
  return [[0, 0, b1, h1], [(b1 - b2) / 2, h1, b2, h2]];
}

export function solvePrevrnitev(p) {
  const rects = bodyRects(p);
  const parts = rects.map(([x, y, w, h]) => ({ A: w * h, x: x + w / 2, y: y + h / 2 }));
  const A = parts.reduce((t, c) => t + c.A, 0);
  const xT = parts.reduce((t, c) => t + c.A * c.x, 0) / A;
  const yT = parts.reduce((t, c) => t + c.A * c.y, 0) / A;
  const base = rects[0][2];
  const e = p.down === "L" ? xT : base - xT; // horizontal distance to the lower edge
  return { rects, parts, A, xT, yT, base, e, alpha: deg(Math.atan(e / yT)) };
}

const SHAPE_NAME = { T: "črke T", G: "črke Γ", L: "črke L", U: "obrnjene črke T (⊥)" };

export const tezisce = {
  id: "tezisce-prevrnitev",
  group: "statika",
  title: "Prevrnitev telesa",
  desc: "Sestavljeno telo (T, L) na nagnjeni podlagi: težišče in kot prevrnitve",

  generate(rnd) {
    for (;;) {
      const shape = rnd.pick(["T", "T", "G", "L", "U"]);
      const b1 = rnd.int(6, 20), h1 = rnd.int(2, 6), b2 = rnd.int(2, 8), h2 = rnd.int(4, 16);
      if (b1 < b2 + 3) continue;
      const down = shape === "T" || shape === "U" ? "L" : rnd.pick(["L", "R"]);
      const p = { shape, b1, h1, b2, h2, down };
      const R = solvePrevrnitev(p);
      if (R.xT <= 0.5 || R.xT >= R.base - 0.5) continue; // stands at α = 0
      if (R.alpha < 8 || R.alpha > 60) continue;
      return p;
    }
  },

  build(p) {
    const { shape, b1, h1, b2, h2, down } = p;
    const R = solvePrevrnitev(p);
    const sym = shape === "T" || shape === "U";
    const answers = [];
    if (!sym) answers.push(ans("xT", "x_T", "cm", R.xT));
    answers.push(ans("yT", "y_T", "cm", R.yT), angleAns("alpha", "α", R.alpha));
    const flange = shape === "L" || shape === "U" ? `podnožje ${b1} × ${h1} cm` : `prečka ${b1} × ${h1} cm`;
    const stem = `steber ${b2} × ${h2} cm`;
    return {
      title: this.title,
      text: [
        `Homogen predmet, izrezan v obliki ${SHAPE_NAME[shape]} (${shape === "L" || shape === "U" ? `${flange}, nanj ${stem}` : `${stem}, na njem ${flange}`}; mere na sliki so v cm), stoji na deski. Desko počasi nagibamo; predmet ne more zdrsniti, ker ga na ${down === "L" ? "levem" : "desnem"} spodnjem robu zadržuje prislon.`,
        `Izračunajte lego težišča${sym ? " y_T (od spodnje ploskve)" : ": x_T (od levega roba predmeta) in y_T (od spodnje ploskve)"} in nagib deske α, pri katerem se predmet prevrne.`,
      ],
      figure(f) {
        const tilt = down === "L" ? 10 : -10;
        const cx = down === "L" ? 0 : R.base; // pivot corner
        const ct = Math.cos(rad(tilt)), st = Math.sin(rad(tilt));
        const P = ([x, y]) => [cx + (x - cx) * ct - y * st, (x - cx) * st + y * ct];
        const W = Math.max(b1, b2);
        // incline through the pivot
        const dir = [ct, st];
        const sgn = down === "L" ? 1 : -1;
        const g0 = [cx - sgn * dir[0] * 0.5 * W, -sgn * dir[1] * 0.5 * W];
        const g1 = [cx + sgn * dir[0] * 1.5 * W, sgn * dir[1] * 1.5 * W];
        // the board (deska) and its angle α with the horizontal at the low end
        f.member(g0, g1);
        f.dashed(g0, [g0[0] + sgn * 0.9 * W, g0[1]]);
        f.angle(g0, down === "L" ? 0 : 180 - Math.abs(tilt), down === "L" ? tilt : 180, "α", 70);
        for (const [x, y, w, h] of R.rects) f.polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(P));
        // stop at the pivot
        const k = 0.07 * W;
        f.polygon([P([cx, 0]), P([cx - sgn * k, 0]), P([cx - sgn * k, k * 1.4])], "fig-body");
        // dimensions (cm): widths outside on top/bottom, heights on the uphill side
        const [r0, r1] = R.rects;
        const top = r1[1] + r1[3];
        f.dim(P([r1[0], top]), P([r1[0] + r1[2], top]), `${r1[2]}`, -24);
        if (shape === "L" || shape === "U") {
          f.dim(P([r0[0], r0[1] + r0[3] / 2]), P([r0[0] + r0[2], r0[1] + r0[3] / 2]), `${r0[2]}`, 0);
        } else {
          f.dim(P([r0[0], r0[3] * 0.35]), P([r0[0] + r0[2], r0[3] * 0.35]), `${r0[2]}`, 0);
        }
        const side = down === "L" ? 1 : 0; // dims on the uphill side
        const xs0 = side ? Math.max(r0[0] + r0[2], r1[0] + r1[2]) : Math.min(r0[0], r1[0]);
        const off = side ? 26 : -26; // dim(): positive offset = right of a→b
        f.dim(P([xs0, 0]), P([xs0, r0[3]]), `${r0[3]}`, off);
        f.dim(P([xs0, r1[1]]), P([xs0, top]), `${r1[3]}`, off);
        f.label(P([R.base / 2, top]), "[cm]", { dx: 0, dy: -44 });
      },
      answers,
      solution: [
        `Telo razdelimo na dva pravokotnika (koordinata y od spodnje ploskve${sym ? "" : ", x od levega roba predmeta"}):`,
        ...R.parts.map((c, i) => `${i + 1}: A_${i + 1} = ${num(c.A)} cm², ${sym ? "" : `x_${i + 1} = ${num(c.x)} cm, `}y_${i + 1} = ${num(c.y)} cm`),
        ...(sym ? [] : [`x_T = Σx_i·A_i/ΣA_i = ${num(R.parts.reduce((t, c) => t + c.A * c.x, 0))}/${num(R.A)} = ${num(R.xT)} cm.`]),
        `y_T = Σy_i·A_i/ΣA_i = ${num(R.parts.reduce((t, c) => t + c.A * c.y, 0))}/${num(R.A)} = ${num(R.yT)} cm.`,
        `Predmet se prevrne okoli ${down === "L" ? "levega" : "desnega"} spodnjega roba, ko teža (navpičnica skozi težišče) pride nad ta rob. Vodoravna oddaljenost težišča od roba (v telesu): e = ${sym ? `${num(R.base)}/2 = ${num(R.e)}` : down === "L" ? `x_T = ${num(R.e)}` : `${num(R.base)} − x_T = ${num(R.e)}`} cm.`,
        `tan α = e/y_T = ${num(R.e)}/${num(R.yT)} → α = ${num(R.alpha)}°.`,
      ],
    };
  },
};

// ---------------------------------------------------------------------------

/**
 * Basin: flat bottom of width w (w = 0: none), a quarter-circle bottom of
 * radius R (centre on the bottom's edge, R above the floor) and a convex
 * quarter-circle rim of radius R. Water up to the rim (depth 2R).
 * Half section (x from the axis): b = w/2.
 */
export function solvePappus({ R, w }) {
  const b = w / 2;
  const e = (4 * R) / (3 * Math.PI);
  const qA = (Math.PI * R * R) / 4;
  const parts = [
    ...(b > 0 ? [{ name: `pravokotnik ob osi ${num(b)} × ${num(2 * R)} m`, A: 2 * R * b, x: b / 2 }] : []),
    { name: `pravokotnik ${num(2 * R)} × ${num(R)} m (zgornji pas)`, A: 2 * R * R, x: b + R },
    { name: "− četrtina kroga pod robom (tla)", A: -qA, x: b + 2 * R - e },
    { name: "+ četrtina kroga ob dnu (voda)", A: qA, x: b + e },
  ];
  const A = parts.reduce((t, c) => t + c.A, 0);
  const Sx = parts.reduce((t, c) => t + c.A * c.x, 0);
  const xT = Sx / A;
  const V = 2 * Math.PI * xT * A;
  // wetted profile: flat bottom, bottom arc, rim arc
  const arc = (Math.PI * R) / 2;
  const lines = [
    ...(b > 0 ? [{ name: "ravno dno", l: b, x: b / 2 }] : []),
    { name: "lok dna", l: arc, x: b + (2 * R) / Math.PI },
    { name: "lok roba", l: arc, x: b + 2 * R - (2 * R) / Math.PI },
  ];
  const S = 2 * Math.PI * lines.reduce((t, c) => t + c.l * c.x, 0);
  return { b, e, parts, A, Sx, xT, V, lines, S };
}

export const pappus = {
  id: "pappus",
  group: "statika",
  title: "Pappus–Guldin: kotanja",
  desc: "Prostornina in površina osnosimetrične kotanje s krožnimi loki",

  generate(rnd) {
    const R = rnd.step(2, 12, 1);
    const w = rnd.chance(0.4) ? 0 : rnd.step(2, 20, 2);
    return { R, w };
  },

  build(p) {
    const { R, w } = p;
    const S = solvePappus(p);
    const b = S.b;
    return {
      title: this.title,
      text: [
        `Osnosimetrična kotanja ima prerez, popisan s krožnimi loki polmera R = ${q(R, "m")}${w ? ` in ravnim dnom premera ${q(w, "m")}` : ""} (glej sliko; loki se gladko stikajo). Kotanja je napolnjena z vodo do vrha (globina 2R).`,
        "Izračunajte ploščino A polovice prereza vode (od osi do roba), oddaljenost njenega težišča od osi x_T, prostornino vode V ter površino S omočenega dna in sten.",
      ],
      figure(f) {
        const xs = b + 2 * R;
        const ext = 0.6 * R;
        const prof = [];
        if (b > 0) prof.push([0, 0]);
        for (let a = 270; a <= 360; a += 5) prof.push([b + R * Math.cos(rad(a)), R + R * Math.sin(rad(a))]);
        for (let a = 180; a >= 90; a -= 5) prof.push([xs + R * Math.cos(rad(a)), R + R * Math.sin(rad(a))]);
        prof.push([xs + ext, 2 * R]);
        const right = prof;
        const left = right.map(([x, y]) => [-x, y]).reverse();
        const outline = [...left, ...right];
        const yb = -0.35 * R;
        f.polygon([[-xs - ext, yb], ...outline, [xs + ext, yb]]);
        if (b > 0) {
          // The axis, with a gap for the bottom's dimension label (which sits on it).
          f.custom([[0, yb - 0.2 * R], [0, 2.4 * R]], (T) => {
            const x = T.X(0), yl = T.Y(0) - 31;
            return s("g", {}, s("line.fig-dashed", { x1: x, y1: T.Y(yb - 0.2 * R), x2: x, y2: yl + 8 }), s("line.fig-dashed", { x1: x, y1: yl - 9, x2: x, y2: T.Y(2.4 * R) }));
          });
        } else f.dashed([0, yb - 0.2 * R], [0, 2 * R + 0.4 * R]);
        f.line([-xs, 2 * R], [xs, 2 * R], "fig-thin");
        f.label([0.45 * xs, 2 * R], "▽", { dy: -4 });
        // radii
        const c1 = [b, R], c2 = [xs, R];
        f.point(c1, "", {});
        f.point(c2, "", {});
        const p1 = [b + R * Math.cos(rad(300)), R + R * Math.sin(rad(300))];
        f.line(c1, p1, "fig-thin");
        f.label([(c1[0] + p1[0]) / 2, (c1[1] + p1[1]) / 2], "R", { dx: -10, dy: 2, alts: [[10, -2, "middle"]] });

        const p2 = [xs + R * Math.cos(rad(135)), R + R * Math.sin(rad(135))];
        f.line(c2, p2, "fig-thin");
        f.label([(c2[0] + p2[0]) / 2, (c2[1] + p2[1]) / 2], "R", { dx: 10, dy: 2 });
        f.dashed([b, R], [xs, R]);
        f.label([xs + ext, 2 * R], `R = ${q(R, "m")}`, { dx: 0, dy: -12, anchor: "end" });
        if (b > 0) f.dim([-b, 0], [b, 0], q(w, "m"), -22);
      },
      answers: [ans("A", "A", "m²", S.A), ans("xT", "x_T", "m", S.xT), ans("V", "V", "m³", S.V), ans("S", "S", "m²", S.S)],
      solution: [
        `Polovico prereza vode (od osi do roba) sestavimo iz likov; e = 4R/(3π) = ${num(S.e)} m je oddaljenost težišča četrtine kroga od njenih ravnih robov.`,
        ...S.parts.map((c) => `${c.name}: A_i = ${num(c.A)} m², x_i = ${num(c.x)} m, A_i·x_i = ${num(c.A * c.x)} m³`),
        `A = ΣA_i = ${num(S.A)} m², x_T = ΣA_i·x_i/A = ${num(S.Sx)}/${num(S.A)} = ${num(S.xT)} m.`,
        `Pappus–Guldin: V = 2π·x_T·A = 2π·${num(S.xT)}·${num(S.A)} = ${num(S.V)} m³.`,
        `Za površino: težišča črt (četrtina loka: 2R/π = ${num((2 * R) / Math.PI)} m od središča v smeri x):`,
        ...S.lines.map((c) => `${c.name}: l = ${num(c.l)} m, x = ${num(c.x)} m`),
        `S = 2π·Σx_i·l_i = ${num(S.S)} m².`,
      ],
    };
  },
};
