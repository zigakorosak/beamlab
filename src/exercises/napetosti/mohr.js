// Ravninsko napetostno stanje, Mohrov krog (the third exam problem of
// 9.9.2016 and others):
//   mohr            a square element with σx, σy, τxy drawn as arrows →
//                   σ1, σ2, the direction α of σ1, τ_max and σ_N, τ_N on a
//                   given inclined plane; Mohr's circle in the solution.
//   mohr-inverzna   the inverse task (notes §8 "Inverzne naloge"): from σ1,
//                   σ2 and α, or from σ1, σ2 and τxy (with σx ≥ σy), find
//                   the stresses in the x, y frame.
// Formulas and signs: see element.js.

import { ans, angleAns, num, rad } from "../kit.js";
import { alphaSteps, mohrCircle, par, planeStress, stressElement } from "./element.js";

const CONV = "Dogovor: natezne napetosti so pozitivne; τ_{xy} je pozitivna, če na ploskvi z normalo +x kaže v smeri +y (na ploskvi z normalo +y pa v smeri +x).";
const ALPHA = "kot α med osjo x in smerjo σ_1 (merjen od osi x v nasprotni smeri urinega kazalca, −90° < α ≤ 90°)";

/** The inclined plane inside the element: its trace, its normal n and φ. */
function planeSketch(f, phi, h = 1) {
  const t = rad(phi + 90);
  const k = h / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t)));
  f.line([-k * Math.cos(t), -k * Math.sin(t)], [k * Math.cos(t), k * Math.sin(t)], "fig-rope");
  f.dashed([0, 0], [0.9 * h, 0]);
  f.force([0, 0], phi, { tail: true, world: 0.8 * h, cls: "fig-axis" });
  f.label([0.95 * h * Math.cos(rad(phi)), 0.95 * h * Math.sin(rad(phi))], "n", { dx: Math.cos(rad(phi)) > 0 ? -10 : 10, dy: 4, cls: "fig-name" });
  f.angle([0, 0], 0, phi, "φ", 22);
}

export const mohr = {
  id: "mohr",
  group: "trdnost",
  title: "Napetostno stanje: Mohrov krog",
  desc: "Element s σ_x, σ_y, τ_xy: glavni napetosti, smer, τ_max, napetosti na poševni ravnini",

  generate(r) {
    for (;;) {
      const sx = r.step(-60, 80, 10);
      const sy = r.step(-60, 80, 10);
      const txy = r.step(-50, 50, 10);
      const phi = r.step(15, 165, 15);
      if (txy === 0) continue;
      const st = planeStress(sx, sy, txy);
      // Away from α = ±90° (the edge of the stated range) and from tiny circles.
      if (st.R < 20 || Math.abs(st.alpha) > 84) continue;
      return { sx, sy, txy, phi };
    }
  },

  build({ sx, sy, txy, phi }) {
    const st = planeStress(sx, sy, txy);
    const sN = st.sN(phi), tN = st.tN(phi);
    const a2 = st.alpha > 0 ? st.alpha - 90 : st.alpha + 90;
    const dir = (v, pos, neg) => (v > 0 ? pos : v < 0 ? neg : "brez napetosti");
    return {
      title: this.title,
      text: [
        "V točki stene je znano ravninsko napetostno stanje, ki ga kaže slika (velikosti napetosti so v MPa, puščice kažejo dejanske smeri napetosti).",
        `Določite glavni napetosti σ_1 ≥ σ_2, ${ALPHA}, največjo strižno napetost τ_{max} ter normalno in strižno napetost σ_N, τ_N na ravnini, katere normala n oklepa z osjo x kot φ = ${phi}° (v nasprotni smeri urinega kazalca). Narišite Mohrov krog.`,
        `${CONV} τ_N je pozitivna v smeri normale n, zasukane za +90°.`,
      ],
      figure(f) {
        stressElement(f, { sx, sy, txy, labels: { sx: num(Math.abs(sx)), sy: num(Math.abs(sy)), txy: num(Math.abs(txy)) } });
        planeSketch(f, phi);
      },
      answers: [
        ans("s1", "σ_1", "MPa", st.s1),
        ans("s2", "σ_2", "MPa", st.s2),
        angleAns("alpha", "α", st.alpha, { note: "smer σ₁ od osi x, −90° < α ≤ 90°" }),
        ans("tmax", "τ_{max}", "MPa", st.R),
        ans("sN", "σ_N", "MPa", sN),
        ans("tN", "τ_N", "MPa", tN),
      ],
      solution: [
        `S slike: σ_x = ${num(sx)} MPa (${dir(sx, "nateg", "tlak")}), σ_y = ${num(sy)} MPa (${dir(sy, "nateg", "tlak")}), τ_{xy} = ${num(txy)} MPa (na desni ploskvi kaže ${txy > 0 ? "navzgor" : "navzdol"}).`,
        `Središče in polmer Mohrovega kroga: C = (σ_x + σ_y)/2 = ${num(st.C)} MPa, R = √(((σ_x − σ_y)/2)² + τ_{xy}²) = √(${par((sx - sy) / 2)}² + ${par(txy)}²) = ${num(st.R)} MPa.`,
        `Glavni napetosti: σ_1 = C + R = ${num(st.s1)} MPa, σ_2 = C − R = ${num(st.s2)} MPa.`,
        ...alphaSteps(sx, sy, txy),
        `Smer σ_2 je pravokotna: α_2 = ${num(a2)}°.`,
        `Največja strižna napetost: τ_{max} = R = (σ_1 − σ_2)/2 = ${num(st.R)} MPa, na ravninah pri α ± 45°, kjer je normalna napetost σ̄ = C = ${num(st.C)} MPa.`,
        `Poševna ravnina, φ = ${phi}° (2φ = ${2 * phi}°):`,
        `σ_N = (σ_x + σ_y)/2 + (σ_x − σ_y)/2·cos 2φ + τ_{xy}·sin 2φ = ${num(st.C)} + ${par((sx - sy) / 2)}·${par(Math.cos(rad(2 * phi)))} + ${par(txy)}·${par(Math.sin(rad(2 * phi)))} = ${num(sN)} MPa`,
        `τ_N = −(σ_x − σ_y)/2·sin 2φ + τ_{xy}·cos 2φ = −${par((sx - sy) / 2)}·${par(Math.sin(rad(2 * phi)))} + ${par(txy)}·${par(Math.cos(rad(2 * phi)))} = ${num(tN)} MPa`,
        `Mohrov krog: točki X(σ_x; τ_{xy}) = (${num(sx)}; ${num(txy)}) in Y(σ_y; −τ_{xy}) = (${num(sy)}; ${num(-txy)}) sta krajišči premera; os τ kaže navzgor. Točka N(σ_N; τ_N) = (${num(sN)}; ${num(tN)}) leži na krogu (kontrola: (σ_N − C)² + τ_N² = ${num((sN - st.C) ** 2 + tN ** 2)} = R² = ${num(st.R ** 2)}).`,
      ],
      solutionFigure(f) {
        mohrCircle(f, sx, sy, txy, { extra: [{ p: [sN, tN], name: `N (φ = ${phi}°)` }] });
      },
    };
  },
};

export const mohrInverzna = {
  id: "mohr-inverzna",
  group: "trdnost",
  title: "Inverzna naloga: iz glavnih napetosti",
  desc: "Iz σ_1, σ_2 in kota α (ali τ_xy) določi σ_x, σ_y, τ_xy",

  generate(r) {
    for (;;) {
      const s1 = r.step(-40, 120, 10);
      const s2 = r.step(-100, 80, 10);
      if (s1 - s2 < 30) continue;
      if (r.chance(0.55)) {
        const alpha = r.step(-75, 75, 5);
        if (Math.abs(alpha) < 15) continue;
        return { kind: "kot", s1, s2, alpha };
      }
      const R = (s1 - s2) / 2;
      const txy = r.step(-60, 60, 5);
      if (Math.abs(txy) < 10 || Math.abs(txy) > 0.85 * R) continue;
      return { kind: "tau", s1, s2, txy };
    }
  },

  build(p) {
    const { s1, s2 } = p;
    const C = (s1 + s2) / 2, R = (s1 - s2) / 2;
    const intro = `V točki ravninskega napetostnega stanja sta znani glavni napetosti σ_1 = ${num(s1)} MPa in σ_2 = ${num(s2)} MPa.`;
    const base = [`C = (σ_1 + σ_2)/2 = ${num(C)} MPa, R = (σ_1 − σ_2)/2 = ${num(R)} MPa.`];

    if (p.kind === "kot") {
      const { alpha } = p;
      const c2 = Math.cos(rad(2 * alpha)), s2a = Math.sin(rad(2 * alpha));
      const sx = C + R * c2, sy = C - R * c2, txy = R * s2a;
      const back = planeStress(sx, sy, txy);
      return {
        title: this.title,
        text: [
          `${intro} Smer σ_1 oklepa z osjo x kot α = ${num(alpha)}° (merjen od osi x, pozitiven v nasprotni smeri urinega kazalca).`,
          "Določite napetosti σ_x, σ_y in τ_{xy} v koordinatnem sistemu x, y.",
          CONV,
        ],
        figure(f) {
          stressElement(f, { sx: s1, sy: s2, rot: alpha, labels: { sx: `σ_1 = ${num(s1)}`, sy: `σ_2 = ${num(s2)}` }, show: ["sx", "sy"], axes: false });
          f.dashed([0, 0], [0.95, 0]);
          f.label([0.95, 0], "x", { dx: -6, dy: alpha > 0 ? 14 : -6, cls: "fig-name" });
          f.dashed([0, 0], [Math.cos(rad(alpha)), Math.sin(rad(alpha))]);
          f.angle([0, 0], 0, alpha, `α = ${num(alpha)}°`, 34);
        },
        answers: [ans("sx", "σ_x", "MPa", sx), ans("sy", "σ_y", "MPa", sy), ans("txy", "τ_{xy}", "MPa", txy)],
        solution: [
          ...base,
          `Točka X(σ_x; τ_{xy}) leži na krogu pod kotom 2α = ${num(2 * alpha)}° od smeri σ_1 (v Mohrovem krogu je kot podvojen):`,
          `σ_x = C + R·cos 2α = ${num(C)} + ${num(R)}·${par(c2)} = ${num(sx)} MPa`,
          `σ_y = C − R·cos 2α = ${num(sy)} MPa`,
          `τ_{xy} = R·sin 2α = ${num(R)}·${par(s2a)} = ${num(txy)} MPa`,
          `Kontrola: σ_x + σ_y = ${num(sx + sy)} = σ_1 + σ_2; tan 2α = 2τ_{xy}/(σ_x − σ_y) da α = ${num(back.alpha)}° ✓`,
        ],
        solutionFigure(f) {
          mohrCircle(f, sx, sy, txy);
        },
      };
    }

    const { txy } = p;
    const d = Math.sqrt(R * R - txy * txy);
    const sx = C + d, sy = C - d;
    const st = planeStress(sx, sy, txy);
    return {
      title: this.title,
      text: [
        `${intro} V koordinatnem sistemu x, y je strižna napetost τ_{xy} = ${num(txy)} MPa, normalna napetost v smeri x pa je večja od tiste v smeri y (σ_x ≥ σ_y).`,
        `Določite σ_x, σ_y in ${ALPHA}.`,
        CONV,
      ],
      figure(f) {
        stressElement(f, { txy, labels: { txy: num(Math.abs(txy)) } });
        f.label([0, 0], "σ_x, σ_y = ?", { dy: 4, cls: "fig-name" });
      },
      answers: [ans("sx", "σ_x", "MPa", sx), ans("sy", "σ_y", "MPa", sy), angleAns("alpha", "α", st.alpha, { note: "smer σ₁ od osi x, −90° < α ≤ 90°" })],
      solution: [
        ...base,
        "Ker je R² = ((σ_x − σ_y)/2)² + τ_{xy}² in σ_x ≥ σ_y:",
        `(σ_x − σ_y)/2 = √(R² − τ_{xy}²) = √(${num(R)}² − ${par(txy)}²) = ${num(d)} MPa (pogoj obstoja |τ_{xy}| ≤ R je izpolnjen).`,
        `σ_x = C + ${num(d)} = ${num(sx)} MPa, σ_y = (σ_1 + σ_2) − σ_x = ${num(sy)} MPa.`,
        ...alphaSteps(sx, sy, txy),
      ],
      solutionFigure(f) {
        mohrCircle(f, sx, sy, txy);
      },
    };
  },
};
