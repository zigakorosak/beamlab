// Torzija krožnih gredi (polni ali votli prerez), three exam types:
//   odseki      stopnjasta gred, vpeta na levem koncu, z dvema momentoma:
//               M_T po odsekih, τ_max v vsakem odseku, zasuk prostega konca
//   dim         dimenzioniranje iz τ_dop in φ_dop (merodajen je večji premer)
//   nedolocena  gred, vpeta na obeh koncih, z momentom vmes:
//               M_A = L_2/(L_1 + L_2)·M_T, M_B = L_1/(L_1 + L_2)·M_T
// Units: M in kNm, lengths in m, diameters in mm, G in MPa, τ in MPa.
// τ = M_T/W_T, φ = M_T·L/(G·I_T) (rad), I_T = π(D⁴ − d⁴)/32, W_T = I_T/(D/2).

import { ans, deg, num, plain, q, rad } from "../kit.js";
import { shaft, torqueArc, wall } from "./figs.js";
import { svgText } from "../draw.js";

const G = 80000; // MPa, jeklo

/** I_T [mm⁴] and W_T [mm³] of a solid (d = 0) or hollow circle. */
export function circle(D, d = 0) {
  const IT = (Math.PI * (D ** 4 - d ** 4)) / 32;
  return { IT, WT: IT / (D / 2) };
}
/** τ [MPa] from M [kNm] and W_T [mm³]. */
const tau = (M, WT) => (M * 1e6) / WT;
/** φ [rad] from M [kNm], L [m], I_T [mm⁴]. */
const twist = (M, L, IT, g = G) => (M * 1e6 * L * 1e3) / (g * IT);

/** "a + b" with the sign of b written as an operator: "−2 − 8,5". */
const plus = (a, b) => `${num(a)} ${b < 0 ? "−" : "+"} ${num(Math.abs(b))}`;

const secText = (D, d) => (d ? `votel prerez D = ${D} mm, d = ${d} mm` : `poln prerez d = ${D} mm`);
const itText = (D, d) =>
  d ? `I_T = π(D⁴ − d⁴)/32 = π(${D}⁴ − ${d}⁴)/32` : `I_T = π d⁴/32 = π·${D}⁴/32`;
const wtText = (D, d) => (d ? `W_T = I_T/(D/2)` : `W_T = π d³/16 = π·${D}³/16`);

export const torzija = {
  id: "torzija",
  group: "trdnost",
  title: "Torzija gredi",
  desc: "Krožna gred: τ_max = M_T/W_T, zasuk φ, dimenzioniranje, obojestransko vpeta gred",

  generate(r) {
    const kind = r.pick(["odseki", "odseki", "dim", "nedolocena"]);
    if (kind === "odseki") {
      for (;;) {
        const L1 = r.step(0.5, 2, 0.5), L2 = r.step(0.5, 2, 0.5);
        const D1 = r.step(50, 120, 5);
        const D2 = D1 - r.step(10, 30, 5);
        const d = r.chance(0.3) ? Math.round((D2 * r.pick([0.5, 0.6, 0.7])) / 5) * 5 : 0;
        const MB = r.pick([-1, 1]) * r.step(1, 12, 0.5);
        const MC = r.pick([-1, 1]) * r.step(1, 12, 0.5);
        const p = { kind, L1, L2, D1, D2, d, MB, MC };
        if (D2 < 40 || (d && d >= D2 - 10)) continue;
        const t = this.build(p).answers;
        const t1 = t[1].value, t2 = t[2].value, phi = t[3].value;
        if (Math.abs(MB + MC) < 0.5) continue;
        if (Math.max(t1, t2) > 220 || Math.min(t1, t2) < 15) continue;
        if (phi < 0.3) continue;
        // Opposite twists of AB and BC that nearly cancel: rounding the two
        // terms would move φ_C by more than 5 %.
        const ph1 = Math.abs(twist(MB + MC, L1, circle(D1, d).IT)), ph2 = Math.abs(twist(MC, L2, circle(D2, d).IT));
        if (Math.max(ph1, ph2) > 3 * rad(phi)) continue;
        return p;
      }
    }
    if (kind === "dim") {
      for (;;) {
        const p = {
          kind,
          M: r.step(1, 20, 0.5),
          L: r.step(1, 4, 0.5),
          tauDop: r.pick([40, 50, 60, 70, 80]),
          phiDop: r.pick([0.5, 1, 1.5, 2]),
          alpha: r.chance(0.35) ? r.pick([0.5, 0.6, 0.7, 0.8]) : 0,
        };
        const D = this.build(p).answers[2].value;
        if (D >= 30 && D <= 250) return p;
      }
    }
    for (;;) {
      const L1 = r.step(0.5, 2.5, 0.5), L2 = r.step(0.5, 2.5, 0.5);
      const p = { kind, L1, L2, M: r.step(2, 20, 1), D: r.step(50, 120, 5) };
      const t = this.build(p).answers[2].value;
      if (t >= 20 && t <= 200) return p;
    }
  },

  build(p) {
    if (p.kind === "odseki") return buildSegments.call(this, p);
    if (p.kind === "dim") return buildDim.call(this, p);
    return buildFixed.call(this, p);
  },
};

function buildSegments({ L1, L2, D1, D2, d, MB, MC }) {
  // Internal torque = sum of the external torques to the right of the cut
  // (vectors along +x positive).
  const MT2 = MC, MT1 = MB + MC, MA = -(MB + MC);
  const s1 = circle(D1, d), s2 = circle(D2, d);
  const t1 = Math.abs(tau(MT1, s1.WT)), t2 = Math.abs(tau(MT2, s2.WT));
  const ph1 = twist(MT1, L1, s1.IT), ph2 = twist(MT2, L2, s2.IT);
  const phi = ph1 + ph2;
  const dir = (M) => (M > 0 ? "+x (v desno)" : "−x (v levo)");
  return {
    title: torzija.title,
    text: [
      `Jeklena stopnjasta gred (G = ${num(G / 1000)} GPa) je na levem koncu A vpeta. Odsek AB ima dolžino L_1 = ${q(L1, "m")} in ${secText(D1, d)}, odsek BC dolžino L_2 = ${q(L2, "m")} in ${secText(D2, d)}.`,
      `V B deluje torzijski moment M_B = ${q(Math.abs(MB), "kNm")}, na prostem koncu C pa M_C = ${q(Math.abs(MC), "kNm")}. Vektor M_B kaže v smer ${dir(MB)}, vektor M_C v smer ${dir(MC)} (pravilo desne roke; os x kaže od A proti C).`,
      "Izračunajte velikost reakcijskega momenta v vpetju, največji strižni napetosti v obeh odsekih in velikost zasuka prereza C (v stopinjah).",
    ],
    figure(f) {
      const Lt = L1 + L2;
      const k = (Lt * 0.07) / D1;
      const ri = d ? d * k / 2 : 0;
      shaft(f, [
        { x0: 0, x1: L1, r: (D1 * k) / 2, ri },
        { x0: L1, x1: Lt, r: (D2 * k) / 2, ri },
      ]);
      wall(f, 0, D1 * k * 0.9);
      f.label([0, 0], "A", { dx: -16, dy: -30, anchor: "end" });
      // (Short segments on a phone: beside each other, or a row lower.)
      f.label([L1 / 2, -(D1 * k) / 2], d ? `D = ${D1}, d = ${d} mm` : `Ø${D1} mm`, { dy: 18, alts: [[0, 31, "middle"], [-10, 18, "middle"], [-10, 31, "middle"]] });
      // BC's label, wider than a short BC on a phone: right of the step, clear of B.
      const lab2 = d ? `D = ${D2}, d = ${d} mm` : `Ø${D2} mm`, w2 = plain(lab2).length * 6.5;
      f.custom([[L1 + L2 / 2, -(D2 * k) / 2]], (T) => {
        const xs = T.X(L1), cx = T.X(L1 + L2 / 2), y = T.Y(-(D2 * k) / 2) + 18;
        const t = svgText(cx, y, lab2, { class: "fig-label", "text-anchor": "middle" });
        t.alts = [[cx, y, "middle"], [cx, y + 13, "middle"], [cx + 10, y, "middle"], [cx + 10, y + 13, "middle"]];
        if (cx - w2 / 2 < xs + 4) t.alts.unshift([xs + 6, y, "start"], [xs + 6, y + 13, "start"]);
        return t;
      }, (ppm) => ({ l: w2 / 2 + 4, r: Math.max(w2 / 2, 6 + w2 - (L2 / 2) * ppm) + 4, t: 8, b: 18 + 13 + 6 }));
      const labC = `M_C = ${q(Math.abs(MC), "kNm")}`;
      torqueArc(f, [L1, 0], (D1 * k) / 2, Math.sign(MB), `M_B = ${q(Math.abs(MB), "kNm")}`, { avoid: [Lt, labC] });
      torqueArc(f, [Lt, 0], (D2 * k) / 2, Math.sign(MC), labC);
      // B under the step, or (with the diameters' labels crowding it on a phone) over it.
      f.custom([[L1, 0]], (T) => {
        const x = T.X(L1), yb = T.Y(-(D1 * k) / 2), yt = T.Y((D1 * k) / 2);
        const t = svgText(x - 8, yb + 16, "B", { class: "fig-label", "text-anchor": "end" });
        t.alts = [[x - 8, yb + 16, "end"], [x + 8, yb + 16, "start"], [x - 18, yt - 4, "end"], [x - 8, yb + 30, "end"]];
        return t;
      }, 34);
      f.label([Lt, 0], "C", { dx: 16, dy: 4, anchor: "start" });
      f.dim([0, -(D1 * k) / 2], [L1, -(D1 * k) / 2], `L_1 = ${q(L1, "m")}`, 42);
      f.dim([L1, -(D1 * k) / 2], [Lt, -(D1 * k) / 2], `L_2 = ${q(L2, "m")}`, 42);
    },
    answers: [
      ans("MA", "|M_A|", "kNm", Math.abs(MA)),
      ans("t1", "τ_{max,AB}", "MPa", t1),
      ans("t2", "τ_{max,BC}", "MPa", t2),
      ans("phi", "|φ_C|", "°", Math.abs(deg(phi))),
    ],
    solution: [
      "Torzijski moment v prerezu = vsota zunanjih momentov desno od prereza (vektor v smeri +x pozitiven).",
      `Odsek BC: M_{T2} = M_C = ${num(MT2)} kNm.  Odsek AB: M_{T1} = M_B + M_C = ${plus(MB, MC)} = ${num(MT1)} kNm.`,
      `Ravnotežje celote: M_A + M_B + M_C = 0 → M_A = ${num(MA)} kNm, |M_A| = ${num(Math.abs(MA))} kNm.`,
      `Odsek AB: ${itText(D1, d)} = ${num(s1.IT)} mm⁴, ${wtText(D1, d)} = ${num(s1.WT)} mm³.`,
      `τ_{max,AB} = |M_{T1}|/W_T = ${num(Math.abs(MT1) * 1e6)} Nmm / ${num(s1.WT)} mm³ = ${num(t1)} MPa.`,
      `Odsek BC: ${itText(D2, d)} = ${num(s2.IT)} mm⁴, ${wtText(D2, d)} = ${num(s2.WT)} mm³.`,
      `τ_{max,BC} = |M_{T2}|/W_T = ${num(Math.abs(MT2) * 1e6)} Nmm / ${num(s2.WT)} mm³ = ${num(t2)} MPa.`,
      `Zasuk (s predznaki): φ_C = M_{T1}L_1/(G I_{T1}) + M_{T2}L_2/(G I_{T2}) = ${plus(ph1, ph2)} = ${num(phi)} rad.`,
      `|φ_C| = ${num(Math.abs(phi))} rad · 180°/π = ${num(Math.abs(deg(phi)))}°.`,
    ],
  };
}

function buildDim({ M, L, tauDop, phiDop, alpha }) {
  const k4 = 1 - alpha ** 4;
  const Dt = Math.cbrt((16 * M * 1e6) / (Math.PI * tauDop * k4));
  const phiR = rad(phiDop);
  const Dp = ((32 * M * 1e6 * L * 1e3) / (Math.PI * G * phiR * k4)) ** 0.25;
  const D = Math.max(Dt, Dp);
  const hollow = alpha > 0;
  const sym = hollow ? "D" : "d";
  return {
    title: torzija.title,
    text: [
      `Jeklena ${hollow ? `votla gred (razmerje premerov d/D = ${num(alpha)})` : "gred polnega krožnega prereza"} dolžine L = ${q(L, "m")} prenaša torzijski moment M_T = ${q(M, "kNm")}. G = ${num(G / 1000)} GPa.`,
      `Dopustna strižna napetost je τ_{dop} = ${tauDop} MPa, dopustni zasuk enega konca gredi glede na drugega pa φ_{dop} = ${num(phiDop)}°.`,
      `Določite potrebni ${hollow ? "zunanji " : ""}premer ${sym} iz pogoja za napetost, iz pogoja za zasuk in merodajni premer (izračunane vrednosti, brez zaokroževanja).`,
    ],
    figure(f) {
      const r0 = L * 0.05;
      shaft(f, [{ x0: 0, x1: L, r: r0, ri: hollow ? r0 * alpha : 0 }]);
      torqueArc(f, [0, 0], r0, -1, "M_T");
      torqueArc(f, [L, 0], r0, 1, "M_T");
      f.dim([0, -r0], [L, -r0], `L = ${q(L, "m")}`, 34);
      f.label([L / 2, r0], hollow ? `D = ?, d = ${num(alpha)}·D` : "d = ?", { dy: -10 });
    },
    answers: [
      ans("Dt", `${sym}_τ`, "mm", Dt),
      ans("Dp", `${sym}_φ`, "mm", Dp),
      ans("D", sym, "mm", D, { note: "merodajni" }),
    ],
    solution: [
      hollow
        ? `Votel prerez, d = αD (α = ${num(alpha)}): W_T = πD³(1 − α⁴)/16, I_T = πD⁴(1 − α⁴)/32; 1 − α⁴ = ${num(k4)}.`
        : "Poln prerez: W_T = πd³/16, I_T = πd⁴/32.",
      `Napetost: τ_{max} = M_T/W_T ≤ τ_{dop} → ${sym}_τ = ∛(16 M_T/(π τ_{dop}${hollow ? "(1 − α⁴)" : ""})) = ∛(16·${num(M * 1e6)}/(π·${tauDop}${hollow ? "·" + num(k4) : ""})) = ${num(Dt)} mm.`,
      `Zasuk v radianih: φ_{dop} = ${num(phiDop)}°·π/180 = ${num(phiR)} rad.`,
      `Zasuk: φ = M_T L/(G I_T) ≤ φ_{dop} → ${sym}_φ = ∜(32 M_T L/(π G φ_{dop}${hollow ? "(1 − α⁴)" : ""})) = ∜(32·${num(M * 1e6)}·${num(L * 1e3)}/(π·${G}·${num(phiR)}${hollow ? "·" + num(k4) : ""})) = ${num(Dp)} mm.`,
      `Merodajen je večji premer: ${sym} = max(${num(Dt)}; ${num(Dp)}) = ${num(D)} mm (merodajen je pogoj za ${Dt >= Dp ? "napetost" : "zasuk"}).`,
      ...(hollow ? [`Notranji premer d = αD = ${num(alpha * D)} mm.`] : []),
    ],
  };
}

function buildFixed({ L1, L2, M, D }) {
  const L = L1 + L2;
  const MA = (L2 / L) * M, MB = (L1 / L) * M;
  const { IT, WT } = circle(D);
  const tmax = tau(Math.max(MA, MB), WT);
  const phiC = twist(MA, L1, IT);
  return {
    title: torzija.title,
    text: [
      `Jeklena gred polnega krožnega prereza s premerom d = ${D} mm je na obeh koncih (A in B) vpeta. V prerezu C, ki je L_1 = ${q(L1, "m")} od A in L_2 = ${q(L2, "m")} od B, deluje torzijski moment M_T = ${q(M, "kNm")}. G = ${num(G / 1000)} GPa.`,
      "Izračunajte velikosti reakcijskih momentov v vpetjih, največjo strižno napetost v gredi in zasuk prereza C (v stopinjah).",
    ],
    figure(f) {
      const r0 = L * 0.045;
      shaft(f, [{ x0: 0, x1: L, r: r0 }]);
      wall(f, 0, r0 * 2.2);
      wall(f, L, r0 * 2.2, false);
      torqueArc(f, [L1, 0], r0, 1, `M_T = ${q(M, "kNm")}`);
      f.label([0, 0], "A", { dx: -16, dy: -26, anchor: "end" });
      f.label([L, 0], "B", { dx: 16, dy: -26, anchor: "start" });
      f.label([L1, -r0], "C", { dx: -16, dy: 18, alts: [[16, 18, "middle"], [-16, 30, "middle"]] });

      f.dim([0, -r0], [L1, -r0], `L_1 = ${q(L1, "m")}`, 36);
      f.dim([L1, -r0], [L, -r0], `L_2 = ${q(L2, "m")}`, 36);
      f.label([L1 + L2 / 2, r0], `Ø${D} mm`, { dy: -8 });
    },
    answers: [
      ans("MA", "M_A", "kNm", MA),
      ans("MB", "M_B", "kNm", MB),
      ans("tau", "τ_{max}", "MPa", tmax),
      ans("phi", "φ_C", "°", deg(phiC)),
    ],
    solution: [
      "Enkrat statično nedoločen problem. Ravnotežje: M_A + M_B = M_T.",
      "Kompatibilnost: zasuk C, računan od A, je enak zasuku, računanemu od B: M_A L_1/(G I_T) = M_B L_2/(G I_T).",
      `M_A = L_2/(L_1 + L_2)·M_T = ${num(L2)}/${num(L)}·${num(M)} = ${num(MA)} kNm,  M_B = L_1/(L_1 + L_2)·M_T = ${num(MB)} kNm.`,
      `I_T = πd⁴/32 = ${num(IT)} mm⁴, W_T = πd³/16 = ${num(WT)} mm³.`,
      `τ_{max} = max(M_A, M_B)/W_T = ${num(Math.max(MA, MB) * 1e6)} Nmm / ${num(WT)} mm³ = ${num(tmax)} MPa (${MA === MB ? "M_A = M_B, enaka v obeh odsekih AC in CB" : `v odseku z večjim momentom, to je ${MA > MB ? "AC" : "CB"}`}).`,
      `φ_C = M_A L_1/(G I_T) = ${num(MA * 1e6)}·${num(L1 * 1e3)}/(${G}·${num(IT)}) = ${num(phiC)} rad = ${num(deg(phiC))}°.`,
    ],
  };
}
