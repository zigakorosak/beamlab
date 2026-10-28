// Palice in vrvi (bars and ropes over a pulley):
//   palica-vrv           a horizontal bar AB pinned at the wall in A, loaded
//                        with q (and maybe a point force), held at B by a
//                        rope at angle α that runs over a pulley C to the
//                        force F (12.6.2006: 4 m, q = 2 kN/m, 35° → F = 6,974 kN).
//   dve-palici           two bars pinned to a wall meet at B, where a small
//                        pulley carries a rope with the load Q: axial forces
//                        N_1, N_2 (4.2.2013: Q = 14 kN, 45°, rope parallel to
//                        bar 2 → N_1 = 14, N_2 = −33,8 kN; 27.6.2016: Q = 60 kN,
//                        30°, rope horizontal → N_1 = 43,92, N_2 = −120 kN).
//   dve-palici-napetost  the same, then the cross-sections from σ_dop and the
//                        elongations Δl = N·l/(E·A) (27.6.2016).

import { ans, num, q, rad } from "../kit.js";
import { s, arrowHead } from "../../render/svg.js";
import { svgText } from "../draw.js";

// ---------------------------------------------------------------------------

/** Bar on a rope: rope force F and the pin reactions. */
export function solvePalicaVrv({ L, q: qq, q0 = 0, q1 = L, P = 0, xP = 0, alpha }) {
  const Q = qq * (q1 - q0);
  const xQ = (q0 + q1) / 2;
  const M = Q * xQ + P * xP; // load moment about A
  const sa = Math.sin(rad(alpha)), ca = Math.cos(rad(alpha));
  // ΣM_A = 0: F·sin α·L − M = 0 (the rope tension is F on both sides of the pulley)
  const F = M / (L * sa);
  return { Q, xQ, M, F, Ax: F * ca, Ay: Q + P - F * sa };
}

export const palicaVrv = {
  id: "palica-vrv",
  group: "statika",
  title: "Palica na vrvi",
  desc: "Vodoravna palica, členek ob steni, vrv čez škripec: sila F in reakcije",

  generate(rnd) {
    for (;;) {
      const L = rnd.step(2, 6, 0.5);
      const qq = rnd.step(1, 6, 1);
      let q0 = 0, q1 = L;
      if (rnd.chance(0.35)) {
        const cut = rnd.step(1, L - 1, 0.5);
        if (rnd.chance(0.5)) q1 = cut;
        else q0 = cut;
      }
      const withP = rnd.chance(0.4);
      const P = withP ? rnd.step(2, 10, 1) : 0;
      const xP = withP ? rnd.step(0.5, L, 0.5) : 0;
      const alpha = rnd.step(20, 70, 5);
      const R = solvePalicaVrv({ L, q: qq, q0, q1, P, xP, alpha });
      if (R.Ay < 0.15 * (R.Q + P)) continue; // keep A_y clearly non-zero
      return { L, q: qq, q0, q1, P, xP, alpha };
    }
  },

  build(p) {
    const { L, q: qq, q0, q1, P, xP, alpha } = p;
    const R = solvePalicaVrv(p);
    const full = q0 === 0 && q1 === L;
    const where = full ? "po vsej dolžini" : q0 === 0 ? `na prvih ${q(q1, "m")} od A` : `na zadnjih ${q(L - q0, "m")} (ob koncu B)`;
    const qText = `${where} obremenjena z enakomerno zvezno obtežbo q = ${q(qq, "kN/m")}`;
    const sa = Math.sin(rad(alpha)), ca = Math.cos(rad(alpha));
    return {
      title: this.title,
      text: [
        `Palica AB dolžine ${q(L, "m")} je v točki A členkasto pritrjena na steno in ${qText}${P ? `, ${xP === L ? "v točki B" : `v razdalji ${q(xP, "m")} od A`} pa še s silo P = ${q(P, "kN")}` : ""}. V točki B je pritrjena vrv, ki oklepa z vodoravnico kot α = ${alpha}° in teče čez škripec C, na drugem koncu pa nanjo deluje sila F (glej sliko).`,
        "Izračunajte jakost sile F, da bo palica stala vodoravno, ter velikosti komponent reakcije v členku A (A_x, A_y). Trenja ni, teža palice je zanemarljiva.",
      ],
      figure(f) {
        const hC = Math.min(L * 0.8 * Math.tan(rad(alpha)), 0.45 * L); // keep the figure wide (phones)
        const C = [L - hC / Math.tan(rad(alpha)), hC];
        f.ground([0, -0.6], [0, Math.max(0.6, 0.25 * L)]);
        f.member([0, 0], [L, 0]);
        f.pin([0, 0], 0);
        f.hinge([L, 0]);
        f.point([0, 0], "A", { dx: 6, dy: 18, dot: false });
        f.point([L, 0], "B", { dx: 8, dy: 16, dot: false });
        f.dist([q0, 0], [q1, 0], { label: `q = ${q(qq, "kN/m")}` });
        if (P) f.force([xP, 0], -90, { len: 40, label: `P = ${q(P, "kN")}`, labelAt: "end" });
        pulleyRope(f, [L, 0], C, alpha);
        // chained dimensions between the characteristic points, the total below
        const pts = [...new Set([0, q0, q1, P ? xP : 0, L])].sort((x, y) => x - y);
        if (pts.length > 2) for (let i = 1; i < pts.length; i++) f.dim([pts[i - 1], 0], [pts[i], 0], q(pts[i] - pts[i - 1], "m"), 28);
        f.dim([0, 0], [L, 0], q(L, "m"), pts.length > 2 ? 50 : 30);
      },
      answers: [ans("F", "F", "kN", R.F), ans("Ax", "A_x", "kN", R.Ax), ans("Ay", "A_y", "kN", R.Ay)],
      solution: [
        `Rezultanta zvezne obtežbe: Q = q·${num(q1 - q0)} = ${num(R.Q)} kN, prijemlje na sredini obteženega odseka, ${num(R.xQ)} m od A.`,
        "Trenja v škripcu ni, zato je sila v vrvi povsod enaka F; v B vrv vleče palico pod kotom α navzgor proti steni.",
        `ΣM_A = 0: F·sin α·L − Q·${num(R.xQ)}${P ? ` − P·${num(xP)}` : ""} = 0 → F = ${num(R.M)}/(${num(L)}·${num(sa)}) = ${num(R.F)} kN.`,
        `ΣF_x = 0: A_x − F·cos α = 0 → A_x = ${num(R.F)}·${num(ca)} = ${num(R.Ax)} kN (stena potiska palico, v smeri od stene).`,
        `ΣF_y = 0: A_y + F·sin α − Q${P ? " − P" : ""} = 0 → A_y = ${num(R.Q + P)} − ${num(R.F * sa)} = ${num(R.Ay)} kN (navzgor).`,
      ],
    };
  },
};

/**
 * Rope from B up to the pulley at C (at angle α, going up towards the wall),
 * wrapped round the left of the pulley, then straight up to the force F.
 * Drawn in pixels: the pulley has a fixed size and its support on the right.
 */
function pulleyRope(f, B, C, alpha) {
  f.pin(C, 180);
  f.custom([B, C], (T) => {
    const rho = 11;
    const a = rad(alpha);
    const cx = T.X(C[0]), cy = T.Y(C[1]);
    // Tangent point on the lower left (screen: y down).
    const tx = cx - rho * Math.sin(a), ty = cy + rho * Math.cos(a);
    const ex = cx - rho, ey = cy;
    const g = s("g", {});
    g.append(s("circle.fig-body", { cx, cy, r: rho }));
    g.append(s("line.fig-rope", { x1: T.X(B[0]), y1: T.Y(B[1]), x2: tx, y2: ty }));
    g.append(s("path.fig-rope", { d: `M${tx} ${ty} A${rho} ${rho} 0 0 1 ${ex} ${ey}` }));
    g.append(s("circle.fig-hinge", { cx, cy, r: 3 }));
    // F: rope going up from the left of the pulley.
    const len = 54;
    g.append(s("g.fig-force", {}, s("line", { x1: ex, y1: ey, x2: ex, y2: ey - len + 6 }), arrowHead(ex, ey - len, 0, -1, 10), svgText(ex - 8, ey - len + 10, "F", { class: "fig-force-label", "text-anchor": "end" })));
    g.append(svgText(cx + 6, cy - rho - 6, "C", { class: "fig-name", "text-anchor": "start" }));
    // α between the rope and the horizontal, marked at the pulley end (alternate angle).
    const R = 40;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = (-a * i) / 12;
      pts.push(`${tx + R * Math.cos(t)},${ty - R * Math.sin(t)}`);
    }
    g.append(s("g.fig-angle", {}, s("line", { x1: tx, y1: ty, x2: tx + R + 10, y2: ty, class: "fig-dashed" }), s("polyline", { points: pts.join(" "), fill: "none" }), svgText(tx + (R + 16) * Math.cos(a / 2), ty + (R + 16) * Math.sin(a / 2) + 4, `${alpha}°`, { class: "fig-angle-label", "text-anchor": "middle" })));
    return g;
  }, 70);
}

// ---------------------------------------------------------------------------

/**
 * Two bars meeting at B: bar 1 horizontal from the wall (length L1), bar 2
 * from a lower (below = true) or higher pin on the same wall at angle α.
 * rope: "none" (Q hangs from B), "h" (rope from B horizontally to the
 * wall, over the pulley and down to Q) or "p" (rope parallel to bar 2).
 * N tension positive.
 */
export function solveDvePalici({ L1, alpha, below, rope, Q }) {
  const a = rad(alpha);
  const sgn = below ? -1 : 1;
  const e2 = [-Math.cos(a), sgn * Math.sin(a)]; // B → pin of bar 2
  // Direction of the rope's free run from B towards its anchor on the wall.
  const u = rope === "h" ? [-1, 0] : rope === "p" ? e2 : [0, 0];
  // ΣF: −N1·(1, 0) + N2·e2 + Q·u + Q·(0, −1) = 0
  const N2 = (Q * (1 - u[1])) / e2[1];
  const N1 = N2 * e2[0] + Q * u[0];
  const l2 = L1 / Math.cos(a);
  return { N1, N2, l2, h: L1 * Math.tan(a), u, e2 };
}

function genDvePalici(rnd) {
  for (;;) {
    const L1 = rnd.step(2, 6, 0.2);
    const alpha = rnd.pick([30, 45, 60]);
    const below = rnd.chance(0.7);
    const rope = rnd.pick(["h", "h", "p", "none"]);
    const Q = rnd.step(5, 80, 1);
    const R = solveDvePalici({ L1, alpha, below, rope, Q });
    if (Math.abs(R.N1) < 0.1 * Q || Math.abs(R.N2) < 0.1 * Q) continue;
    return { L1: Math.round(L1 * 10) / 10, alpha, below, rope, Q };
  }
}

function dveText({ L1, alpha, below, rope, Q }) {
  const ropeText = {
    none: `V vozlišču B visi breme Q = ${q(Q, "kN")}.`,
    h: `V vozlišču B je majhen kolut (njegove dimenzije zanemarite). Čezenj teče vrv, ki je na steni pritrjena tako, da od koluta poteka vodoravno, na drugem koncu pa navpično visi breme Q = ${q(Q, "kN")}.`,
    p: `V vozlišču B je majhen kolut (njegove dimenzije zanemarite). Čezenj teče vrv, ki je pritrjena ob spodnjem členku palice 2 in poteka vzporedno s palico 2, na drugem koncu pa navpično visi breme Q = ${q(Q, "kN")}.`,
  }[rope].replace("spodnjem", below ? "spodnjem" : "zgornjem");
  return `Palica 1 dolžine ${q(L1, "m")} je vodoravna, palica 2 je pritrjena na isto steno ${below ? "niže" : "više"} in oklepa s palico 1 kot ${alpha}°. Obe palici sta na steni in v vozlišču B členkasto pritrjeni. ${ropeText} Trenja ni, teža palic je zanemarljiva.`;
}

function dveFigure(p, f) {
  const { L1, alpha, below, rope, Q } = p;
  const R = solveDvePalici(p);
  const y2 = below ? -R.h : R.h;
  const B = [L1, 0];
  const top = Math.max(0, y2), bot = Math.min(0, y2);
  f.ground([0, bot - 0.3], [0, top + 0.3]);
  f.member([0, 0], B);
  f.member([0, y2], B);
  f.pin([0, 0], 0);
  f.pin([0, y2], 0);
  f.hinge(B);
  f.label([L1 / 2, 0], "1", { dy: below ? -10 : 18 });
  f.label([L1 / 2, y2 / 2], "2", { dx: 12, dy: below ? 14 : -8 }); // beside the bar, away from the wall
  f.point(B, "B", { dx: 10, dy: below ? -12 : 18, dot: false });
  f.dim([0, top], [L1, top], q(L1, "m"), -30);
  // Angle between the bars, at B.
  f.angle(B, below ? 180 : 180 - alpha, below ? 180 + alpha : 180, `${alpha}°`, alpha <= 30 ? 62 : 36);
  if (rope === "none") {
    f.force(B, -90, { tail: true, len: 56, label: `Q = ${q(Q, "kN")}` });
    return;
  }
  f.custom([B, [0, y2]], (T) => {
    const rho = 9;
    const bx = T.X(B[0]), by = T.Y(B[1]);
    // Rope run from the wall to B, direction d = −u (screen: y down).
    const d = [-R.u[0], R.u[1]]; // world (dx, dy) → screen (dx, −dy) with u = (ux, uy)
    // normal on the left of the travel (wrapping over the pulley's top)
    const n = [d[1], -d[0]];
    const tx = bx + n[0] * rho, ty = by + n[1] * rho;
    // From the tangent point back along the run to the wall x = 0.
    const wx = T.X(0);
    const t = (tx - wx) / (d[0] || 1e-9);
    const ax = wx, ay = ty - d[1] * t;
    const g = s("g", {});
    g.append(s("line.fig-rope", { x1: ax, y1: ay, x2: tx, y2: ty }));
    // over the top to the rightmost point, then down to Q
    g.append(s("path.fig-rope", { d: `M${tx} ${ty} A${rho} ${rho} 0 0 1 ${bx + rho} ${by}` }));
    g.append(s("circle.fig-body", { cx: bx, cy: by, r: rho }));
    g.append(s("circle.fig-hinge", { cx: bx, cy: by, r: 3 }));
    g.append(s("circle.fig-dot", { cx: ax, cy: ay, r: 3 }));
    const hy = by + 62;
    g.append(s("line.fig-rope", { x1: bx + rho, y1: by, x2: bx + rho, y2: hy }));
    g.append(s("rect.fig-body", { x: bx + rho - 16, y: hy, width: 32, height: 26 }));
    g.append(svgText(bx + rho, hy + 18, "Q", { class: "fig-label", "text-anchor": "middle" }));
    g.append(svgText(bx + rho + 22, hy + 18, `Q = ${q(Q, "kN")}`, { class: "fig-force-label", "text-anchor": "start" }));
    return g;
  }, 100);
}

function dveSolution(p) {
  const { alpha, below, rope, Q } = p;
  const R = solveDvePalici(p);
  const sgn = below ? "−" : "+";
  const lines = [
    "Izrežemo vozlišče B (s kolutom). Osni sili N_1, N_2 vrišemo kot nateg (kažeta od B proti steni); pozitiven rezultat je nateg, negativen tlak.",
  ];
  if (rope === "none") {
    lines.push(`ΣF_x = 0: −N_1 − N_2·cos ${alpha}° = 0`, `ΣF_y = 0: ${sgn}N_2·sin ${alpha}° − Q = 0`);
  } else {
    lines.push("Vrv čez kolut brez trenja: na obeh straneh je sila S = Q. Na vozlišče delujeta Q navpično navzdol in S v smeri vrvi proti pritrdišču.");
    if (rope === "h") lines.push(`ΣF_x = 0: −N_1 − N_2·cos ${alpha}° − S = 0`, `ΣF_y = 0: ${sgn}N_2·sin ${alpha}° − Q = 0`);
    else lines.push(`ΣF_x = 0: −N_1 − N_2·cos ${alpha}° − S·cos ${alpha}° = 0`, `ΣF_y = 0: ${sgn}N_2·sin ${alpha}° ${sgn} S·sin ${alpha}° − Q = 0`);
  }
  lines.push(
    `N_2 = ${num(R.N2)} kN (${R.N2 >= 0 ? "nateg" : "tlak"}).`,
    `N_1 = ${num(R.N1)} kN (${R.N1 >= 0 ? "nateg" : "tlak"}).`,
  );
  return lines;
}

export const dvePalici = {
  id: "dve-palici",
  group: "statika",
  title: "Dve palici s kolutom",
  desc: "Dve palici na steni, v vozlišču kolut z vrvjo in bremenom: osni sili",
  generate: genDvePalici,
  build(p) {
    const R = solveDvePalici(p);
    return {
      title: this.title,
      text: [dveText(p), "Izračunajte osni sili v palicah 1 in 2 (nateg +, tlak −)."],
      figure: (f) => dveFigure(p, f),
      answers: [ans("N1", "N_1", "kN", R.N1), ans("N2", "N_2", "kN", R.N2)],
      solution: dveSolution(p),
    };
  },
};

/** Sizing: A = |N|/σ_dop, Δl = N·l/(E·A). σ in kN/cm², E in MPa. */
export function solveNapetost(p) {
  const R = solveDvePalici(p);
  const A1 = Math.abs(R.N1) / p.sdop; // cm²
  const A2 = Math.abs(R.N2) / p.sdop;
  const E = p.E / 10; // MPa → kN/cm²
  const dl1 = (R.N1 * p.L1 * 1000) / (E * A1); // mm
  const dl2 = (R.N2 * R.l2 * 1000) / (E * A2);
  return { ...R, A1, A2, dl1, dl2, Ekn: E };
}

const MATERIALS = [
  { name: "aluminij", E: 70000, sdop: [6, 7, 8, 10] },
  { name: "jeklo", E: 210000, sdop: [12, 14, 16] },
  { name: "les", E: 10000, sdop: [1, 1.2, 1.5] },
];

export const dvePaliciNapetost = {
  id: "dve-palici-napetost",
  group: "trdnost",
  title: "Dimenzioniranje dveh palic",
  desc: "Osni sili, potrebna prereza iz σ_dop in raztezka palic",
  generate(rnd) {
    const p = genDvePalici(rnd);
    const mat = rnd.pick(MATERIALS);
    return { ...p, E: mat.E, sdop: rnd.pick(mat.sdop) };
  },
  build(p) {
    const R = solveNapetost(p);
    const Etext = p.E >= 100000 ? `${num(p.E / 100000)}·10⁵ MPa` : `${num(p.E / 10000)}·10⁴ MPa`;
    return {
      title: this.title,
      text: [
        dveText(p),
        `Izračunajte osni sili v palicah (nateg +, tlak −), najmanjši potrebni ploščini prerezov A_1 in A_2, da ne bo presežena dopustna napetost σ_dop = ±${q(p.sdop, "kN/cm²")}, ter spremembi dolžin palic Δl_1 in Δl_2 (podaljšek +, skrček −) pri teh prerezih. E = ${Etext}. Uklona ne upoštevajte.`,
      ],
      figure: (f) => dveFigure(p, f),
      answers: [
        ans("N1", "N_1", "kN", R.N1),
        ans("N2", "N_2", "kN", R.N2),
        ans("A1", "A_1", "cm²", R.A1),
        ans("A2", "A_2", "cm²", R.A2),
        ans("dl1", "Δl_1", "mm", R.dl1),
        ans("dl2", "Δl_2", "mm", R.dl2),
      ],
      solution: [
        ...dveSolution(p),
        `σ = N/A ≤ σ_dop → A = |N|/σ_dop: A_1 = ${num(Math.abs(R.N1))}/${num(p.sdop)} = ${num(R.A1)} cm², A_2 = ${num(Math.abs(R.N2))}/${num(p.sdop)} = ${num(R.A2)} cm².`,
        `Dolžina palice 2: l_2 = l_1/cos ${p.alpha}° = ${num(R.l2)} m. E = ${Etext} = ${num(R.Ekn)} kN/cm².`,
        `Δl = N·l/(E·A) (pri A = |N|/σ_dop je to ±σ_dop·l/E):`,
        `Δl_1 = ${num(R.N1)}·${num(p.L1 * 1000)}/(${num(R.Ekn)}·${num(R.A1)}) = ${num(R.dl1)} mm.`,
        `Δl_2 = ${num(R.N2)}·${num(R.l2 * 1000)}/(${num(R.Ekn)}·${num(R.A2)}) = ${num(R.dl2)} mm.`,
      ],
    };
  },
};
