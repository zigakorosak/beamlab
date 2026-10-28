// Kombinirana obremenitev: upogib + torzija okroglih prerezov.
//   rocica   nosilec AB, vpet v A, s togo ročico BC pravokotno nanj;
//            v C deluje navpična sila F (slika je tloris, "pogled z vrha").
//            V vpetju: M = F·L (upogib), M_T = F·a (torzija).
//   jermen   gred na dveh ležajih z jermenico (sili jermena S_1, S_2
//            navpično navzdol); M_T = (S_1 − S_2)·R, M = (S_1 + S_2)·a·b/L.
// Nevarna točka: rob prereza, σ = M/W, τ = M_T/W_T (W_T = 2W za krog/cev);
// von Mises σ_ekv = √(σ² + 3τ²), Tresca σ_ekv = √(σ² + 4τ²).
// Units: kN, m, mm; σ in MPa. Shear from T is neglected (it is zero at the
// outer fibre, where σ is largest).

import { ans, num, q } from "../kit.js";
import { intoPage, torqueArc, wall } from "./figs.js";
import { svgText } from "../draw.js";

/** W [mm³] of a solid (d = 0) or hollow circle. */
export function wBend(D, d = 0) {
  return (Math.PI * (D ** 4 - d ** 4)) / (32 * D);
}

export function combined({ M, MT, D, t = 0, hyp }) {
  const W = wBend(D, t ? D - 2 * t : 0);
  const sigma = (M * 1e6) / W, tau = (MT * 1e6) / (2 * W);
  const k = hyp === "Tresca" ? 4 : 3;
  return { W, WT: 2 * W, sigma, tau, eq: Math.sqrt(sigma ** 2 + k * tau ** 2) };
}

/** Required solid diameter [mm]: σ_ekv = M_ekv/W ≤ σ_dop. */
export function requiredD({ M, MT, hyp, sdop }) {
  const Meq = hyp === "Tresca" ? Math.hypot(M, MT) : Math.sqrt(M ** 2 + 0.75 * MT ** 2);
  return { Meq, d: Math.cbrt((32 * Meq * 1e6) / (Math.PI * sdop)) };
}

function loads(p) {
  if (p.kind === "rocica") return { M: p.F * p.L, MT: p.F * p.a };
  const b = p.L - p.a;
  return { M: ((p.S1 + p.S2) * p.a * b) / p.L, MT: ((p.S1 - p.S2) * p.R) / 1000, b };
}

export const kombinirana = {
  id: "kombinirana",
  group: "trdnost",
  title: "Upogib in torzija",
  desc: "Ročica ali gred z jermenico: σ = M/W, τ = M_T/W_T, primerjalna napetost (Mises, Tresca)",

  generate(r) {
    for (;;) {
      const kind = r.pick(["rocica", "rocica", "jermen"]);
      const mode = r.chance(0.6) ? "kontrola" : "dim";
      const hyp = r.pick(["Mises", "Mises", "Tresca"]);
      const sdop = r.pick([100, 120, 140, 160, 180]);
      let p;
      if (kind === "rocica") p = { kind, mode, hyp, sdop, L: r.step(0.5, 2.5, 0.5), a: r.step(0.2, 1.2, 0.1), F: r.step(1, 10, 0.5) };
      else {
        const L = r.step(1, 2.5, 0.5);
        const S1 = r.step(2, 20, 0.5);
        p = { kind, mode, hyp, sdop, L, a: r.step(0.2, L - 0.2, 0.1), R: r.step(100, 300, 25), S1, S2: Math.round(S1 * r.pick([0.2, 0.3, 0.4, 0.5]) * 2) / 2 };
        if (p.S2 <= 0 || p.S2 >= p.S1) continue;
      }
      if (mode === "kontrola") {
        if (r.chance(0.65)) p.D = r.step(40, 120, 5);
        else {
          p.D = r.step(60, 160, 10);
          p.t = r.step(4, 12, 1);
        }
        const x = combined({ ...loads(p), D: p.D, t: p.t, hyp });
        if (x.eq < 30 || x.eq > 300) continue;
      } else {
        const { d } = requiredD({ ...loads(p), hyp, sdop });
        if (d < 25 || d > 200) continue;
      }
      return p;
    }
  },

  build(p) {
    const { M, MT, b } = loads(p);
    const hypText = p.hyp === "Tresca" ? "po Trescovi hipotezi (σ_{ekv} = √(σ² + 4τ²))" : "po von Misesu (σ_{ekv} = √(σ² + 3τ²))";
    const secText = p.t ? `cev z zunanjim premerom D = ${p.D} mm in debelino stene t = ${p.t} mm` : `poln krožni prerez s premerom d = ${p.D} mm`;
    const intro =
      p.kind === "rocica"
        ? `Vodoravni nosilec AB dolžine L = ${q(p.L, "m")} je v A vpet. V B je nanj pravokotno pritrjena toga vodoravna ročica BC dolžine a = ${q(p.a * 100, "cm")}. V C deluje navpična sila F = ${q(p.F, "kN")} (navzdol). Slika kaže pogled od zgoraj.`
        : `Gred AB razpona L = ${q(p.L, "m")} je vrtljivo podprta v ležajih A in B. Na razdalji a = ${q(p.a * 100, "cm")} od A je jermenica s polmerom R = ${p.R} mm, na katero delujeta navpični sili jermena S_1 = ${q(p.S1, "kN")} in S_2 = ${q(p.S2, "kN")} (obe navzdol). Torzijski moment jermenice prevzame sklopka na koncu B.`;
    const crit = p.kind === "rocica" ? "v vpetju A" : "pod jermenico";
    const loadSol =
      p.kind === "rocica"
        ? [
            `Nevaren prerez je v vpetju A. Upogibni moment: M = F·L = ${num(p.F)}·${num(p.L)} = ${num(M)} kNm.`,
            `Torzijski moment (sila F na ročici a glede na os AB): M_T = F·a = ${num(p.F)}·${num(p.a)} = ${num(MT)} kNm (konstanten na vsem AB).`,
          ]
        : [
            `Torzijski moment med jermenico in sklopko: M_T = (S_1 − S_2)·R = (${num(p.S1)} − ${num(p.S2)})·${num(p.R / 1000)} = ${num(MT)} kNm.`,
            `Upogib: sila S_1 + S_2 = ${num(p.S1 + p.S2)} kN v razdalji a od A; reakciji A = ${num(((p.S1 + p.S2) * b) / p.L)} kN, B = ${num(((p.S1 + p.S2) * p.a) / p.L)} kN; največji moment pod jermenico M = (S_1 + S_2)·a·b/L = ${num(M)} kNm (b = L − a = ${num(b)} m).`,
          ];
    let text, answers, solution;
    if (p.mode === "kontrola") {
      const x = combined({ M, MT, D: p.D, t: p.t, hyp: p.hyp });
      const ok = x.eq <= p.sdop;
      text = [
        intro,
        `Prerez ${p.kind === "rocica" ? "nosilca AB" : "gredi"} je ${secText}. Dopustna napetost je σ_{dop} = ${p.sdop} MPa. Strižne napetosti zaradi prečne sile zanemarite.`,
        `Izračunajte upogibni in torzijski moment v nevarnem prerezu, normalno in strižno napetost v nevarni točki ter primerjalno napetost ${hypText}. Ali prerez zadošča?`,
      ];
      answers = [
        ans("M", "M", "kNm", M),
        ans("MT", "M_T", "kNm", MT),
        ans("s", "σ", "MPa", x.sigma),
        ans("t", "τ", "MPa", x.tau),
        ans("eq", "σ_{ekv}", "MPa", x.eq),
      ];
      solution = [
        ...loadSol,
        p.t
          ? `Cev: d_n = D − 2t = ${p.D - 2 * p.t} mm; W = π(D⁴ − d_n⁴)/(32D) = ${num(x.W)} mm³, W_T = 2W = ${num(x.WT)} mm³.`
          : `W = πd³/32 = ${num(x.W)} mm³, W_T = πd³/16 = 2W = ${num(x.WT)} mm³.`,
        `Nevarna točka na robu prereza ${crit}: σ = M/W = ${num(M * 1e6)}/${num(x.W)} = ${num(x.sigma)} MPa, τ = M_T/W_T = ${num(MT * 1e6)}/${num(x.WT)} = ${num(x.tau)} MPa.`,
        `σ_{ekv} = √(σ² + ${p.hyp === "Tresca" ? 4 : 3}τ²) = ${num(x.eq)} MPa ${ok ? "≤" : ">"} σ_{dop} = ${p.sdop} MPa → prerez ${ok ? "zadošča" : "NE zadošča"}.`,
      ];
    } else {
      const { Meq, d } = requiredD({ M, MT, hyp: p.hyp, sdop: p.sdop });
      text = [
        intro,
        `${p.kind === "rocica" ? "Nosilec AB" : "Gred"} bo polnega krožnega prereza. Dopustna napetost je σ_{dop} = ${p.sdop} MPa. Strižne napetosti zaradi prečne sile zanemarite.`,
        `Izračunajte upogibni in torzijski moment v nevarnem prerezu ter potrebni premer d ${hypText} (izračunana vrednost).`,
      ];
      answers = [ans("M", "M", "kNm", M), ans("MT", "M_T", "kNm", MT), ans("d", "d", "mm", d)];
      solution = [
        ...loadSol,
        `Krog: σ = M/W, τ = M_T/W_T = M_T/(2W) → σ_{ekv} = √(σ² + ${p.hyp === "Tresca" ? 4 : 3}τ²) = √(M² + ${p.hyp === "Tresca" ? "" : "0,75·"}M_T²)/W = M_{ekv}/W.`,
        `M_{ekv} = ${num(Meq)} kNm; W = πd³/32 ≥ M_{ekv}/σ_{dop} → d = ∛(32 M_{ekv}/(π σ_{dop})) = ∛(32·${num(Meq * 1e6)}/(π·${p.sdop})) = ${num(d)} mm.`,
      ];
    }
    return {
      title: this.title,
      text,
      figure(f) {
        if (p.kind === "rocica") drawArm(f, p);
        else drawPulley(f, p);
      },
      answers,
      solution,
    };
  },
};

function drawArm(f, p) {
  const { L, a } = p;
  f.member([0, 0], [L, 0]);
  f.member([L, 0], [L, -a]);
  wall(f, 0, Math.max(0.25, (L + a) * 0.1));
  f.label([0, 0], "A", { dx: 10, dy: -10, anchor: "start" });
  f.label([L, 0], "B", { dx: 10, dy: -10, anchor: "start" });
  f.label([L, -a], "C", { dx: -14, dy: -4, anchor: "end" });
  intoPage(f, [L, -a], true, `F = ${q(p.F, "kN")}`, { dx: -14, dy: 22 });
  f.dim([0, 0], [L, 0], `L = ${q(L, "m")}`, -28);
  f.dim([L, 0], [L, -a], `a = ${q(a * 100, "cm")}`, -30);
  // Under AB, or (F's label in the way on a phone) from A on, or (a long
  // arm BC through it) left of the arm.
  f.custom([[L / 2, 0]], (T) => {
    const y = T.Y(0) + 34;
    const t = svgText(T.X(L / 2), y, "tloris (pogled od zgoraj)", { class: "fig-label", "text-anchor": "middle" });
    const xl = T.X(L) - 12, ym = (T.Y(0) + T.Y(-a)) / 2 + 4;
    t.alts = [[T.X(L / 2), y, "middle"], [T.X(0) + 4, y, "start"], [xl, ym, "end"], [xl, ym + 20, "end"], [xl, ym - 20, "end"]];
    return t;
  }, { l: 82, r: 82, t: 8, b: 38 });
}

function drawPulley(f, p) {
  const { L, a } = p;
  const Rw = Math.min(0.45, L * 0.22); // pulley radius as drawn
  f.member([0, 0], [L, 0]);
  f.pin([0, 0]);
  f.roller([L, 0]);
  f.label([0, 0], "A", { dx: -12, dy: -8, anchor: "end" });
  f.label([L, 0], "B", { dx: -6, dy: -12, anchor: "end", alts: [[-6, -26, "end"], [-16, 16, "end"]] });
  // Pulley seen from the side: a thin disc.
  f.rect(a - 0.04, -Rw, 0.08, 2 * Rw);
  f.force([a, -Rw], -90, { tail: true, len: 40, label: "S_1 + S_2", labelSide: -1 });
  torqueArc(f, [L + 0.18, 0], 0.03, 1, "");
  // (Alternatives clear of the support's hatching.)
  f.label([L + 0.18, 0], "sklopka", { dy: 40, cls: "fig-force-label", alts: [[10, 40, "start"], [-14, 44, "end"], [0, -26, "middle"], [10, -26, "start"], [0, -40, "middle"], [6, -26, "middle"]] });
  f.line([L, 0], [L + 0.18, 0], "fig-rope");
  f.dim([0, Rw], [a, Rw], `a = ${q(a * 100, "cm")}`, -14);
  f.dim([0, Rw], [L, Rw], `L = ${q(L, "m")}`, -40);
  // End view of the pulley, to the right (on a phone a little further:
  // "sklopka" over the coupling between them ran onto the pulley).
  const endView = (gap) => (g) => {
    const c = [L + gap + Rw, 0];
    g.circle(c, Rw);
    g.point(c, "", { dot: true });
    g.line([c[0] - Rw, 0], [c[0] - Rw, -Rw * 0.9], "fig-rope");
    g.line([c[0] + Rw, 0], [c[0] + Rw, -Rw * 0.9], "fig-rope");
    g.force([c[0] - Rw, -Rw * 0.9], -90, { tail: true, len: 30, label: "S_1", labelAt: "end" });
    g.force([c[0] + Rw, -Rw * 0.9], -90, { tail: true, len: 30, label: "S_2", labelAt: "end" });
    g.line(c, [c[0] + Rw * 0.7071, Rw * 0.7071], "fig-thin");
    g.label([c[0] + Rw * 0.7071, Rw * 0.7071], "R", { dx: 6, dy: -4, anchor: "start" });
    g.label([c[0], Rw], "pogled vzdolž osi", { dy: -14, alts: [[0, -28, "middle"]] }); // (higher: "sklopka" below it)
  };
  f.byWidth(500, endView(Math.max(0.55, 0.18 + 0.18 * (L + 2 * Rw + 0.5))), endView(0.55));
}
