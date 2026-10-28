// Dva zložena kvadra (stacked blocks): the upper block 1 is tied to the
// wall with a rope (horizontal or rising at β towards the wall), the lower
// block 2 is pulled away from the wall by a horizontal force F. Friction f_1
// between the blocks, f_2 between block 2 and the floor. Find the rope
// force and the force F at which block 2 starts to slide.
// Exam: G1 = 3 kN, G2 = 4 kN, f = 0,4 at both contacts, rope horizontal
// → S = 1,2 kN, F = 1,2 + 2,8 = 4,0 kN.

import { ans, num, q, rad } from "../kit.js";
import { own } from "./common.js";

export function solveBloka({ G1, G2, f1, f2, beta }) {
  const sb = Math.sin(rad(beta)), cb = Math.cos(rad(beta));
  // Block 1: S cos β = T1 = f1·N1, N1 = G1 − S sin β.
  const S = (f1 * G1) / (cb + f1 * sb);
  const N1 = G1 - S * sb;
  const T1 = f1 * N1;
  const N2 = N1 + G2;
  const T2 = f2 * N2;
  return { S, N1, T1, N2, T2, F: T1 + T2 };
}

export const trenjeBloka = {
  id: "trenje-bloka",
  group: "statika",
  title: "Zložena kvadra s trenjem",
  desc: "Zgornji kvader privezan na steno, spodnjega vlečemo: sila za zdrs",

  generate(r) {
    for (;;) {
      const G1 = r.int(1, 8);
      const G2 = r.int(2, 10);
      const same = r.chance(0.4);
      const f1 = r.step(0.15, 0.5, 0.05);
      const f2 = same ? f1 : r.step(0.1, 0.5, 0.05);
      if (!same && f1 === f2) continue;
      const beta = r.pick([0, 0, 15, 20, 30, 45]);
      return { G1, G2, f1, f2, beta };
    }
  },

  build(p) {
    const { G1, G2, f1, f2, beta } = p;
    const R = solveBloka(p);
    const fText = f1 === f2 ? `Koeficient trenja na obeh stičnih ploskvah je f = ${num(f1)}.` : `Koeficient trenja med kvadroma je f_1 = ${num(f1)}, med kvadrom 2 in tlemi pa f_2 = ${num(f2)}.`;
    const rope = beta === 0 ? "z vodoravno vrvjo" : `z vrvjo, ki oklepa z vodoravnico kot β = ${beta}° (glej sliko),`;
    const answers = [own(ans("S", "S", "kN", R.S))];
    if (beta) answers.push(ans("N1", "N_1", "kN", R.N1));
    answers.push(own(ans("F", "F", "kN", R.F)));
    const F1 = f1 === f2 ? "f" : "f_1", F2 = f1 === f2 ? "f" : "f_2";

    return {
      title: this.title,
      text: [
        `Kvader 1 s težo G_1 = ${q(G1, "kN")} leži na kvadru 2 s težo G_2 = ${q(G2, "kN")} in je ${rope} privezan na steno. ${fText}`,
        `S kolikšno vodoravno silo F moramo vleči kvader 2, da ga premaknemo? Izračunajte tudi silo v vrvi S${beta ? " in normalno silo N_1 med kvadroma" : ""} v tem mejnem stanju.`,
      ],
      figure(fig) {
        const x2 = 1.8, x1 = 2.3, w1 = 1.9, yr = 1.45; // block 2 / block 1 left faces, rope height
        const yw = yr + x1 * Math.tan(rad(beta)); // rope end on the wall
        fig.ground([0, Math.max(2.4, yw + 0.5)], [0, 0]);
        fig.ground([0, 0], [x2 + 4.6, 0]);
        fig.rect(x2, 0, 3.4, 1); // block 2
        fig.rect(x1, 1, w1, 0.9); // block 1
        fig.line([x1, yr], [0, yw]);
        if (beta) {
          fig.dashed([x1, yr], [x1 - 0.9, yr]);
          fig.angle([x1, yr], 180 - beta, 180, "β", 30);
        }
        fig.label([x1 + w1 / 2, 1.45], `G_1 = ${q(G1, "kN")}`, { dy: 4 });
        fig.label([x2 + 1.7, 0.5], `G_2 = ${q(G2, "kN")}`, { dy: 4 });
        fig.label([x1 + w1, 1], f1 === f2 ? `f = ${num(f1)}` : `f_1 = ${num(f1)}`, { dx: 6, dy: -6, anchor: "start" });
        fig.label([x2, 0], f1 === f2 ? `f = ${num(f1)}` : `f_2 = ${num(f2)}`, { dx: -6, dy: -6, anchor: "end" });
        fig.force([x2 + 3.4, 0.5], 0, { tail: true, world: 0.9, label: "F" });
      },
      answers,
      solution: [
        "Kvader 2 se giblje v desno (stran od stene), zato trenje na kvader 2 deluje v levo, na kvader 1 pa (zakon akcije in reakcije) v desno. Kvader 1 miruje, ker ga drži vrv.",
        beta
          ? `Kvader 1: ΣF_x = 0: T_1 − S cos β = 0; ΣF_y = 0: N_1 + S sin β − G_1 = 0; T_1 = ${F1}·N_1.`
          : `Kvader 1: ΣF_y = 0: N_1 = G_1 = ${q(G1, "kN")}; ΣF_x = 0: S = T_1 = ${F1}·N_1.`,
        beta
          ? `→ S cos β = ${F1}(G_1 − S sin β) → S = ${F1}·G_1/(cos β + ${F1} sin β) = ${num(R.S)} kN, N_1 = G_1 − S sin β = ${num(R.N1)} kN, T_1 = ${num(R.T1)} kN.`
          : `→ S = T_1 = ${num(f1)}·${num(G1)} = ${num(R.S)} kN.`,
        `Kvader 2: ΣF_y = 0: N_2 = N_1 + G_2 = ${num(R.N1)} + ${num(G2)} = ${num(R.N2)} kN; trenje s tlemi T_2 = ${F2}·N_2 = ${num(R.T2)} kN.`,
        `ΣF_x = 0: F − T_1 − T_2 = 0 → F = ${num(R.T1)} + ${num(R.T2)} = ${num(R.F)} kN.`,
      ],
      solutionFigure(fig) {
        // Both blocks drawn apart, with the forces of the limit state.
        fig.rect(0, 1.8, 1.6, 0.9);
        fig.rect(-0.8, 0, 3.2, 1);
        fig.force([0, 2.25], 180 - beta, { tail: true, len: 50, label: "S", cls: "fig-force.fig-unknown" });
        fig.force([0.8, 2.25], -90, { tail: true, len: 34, label: "G_1", labelSide: -1 });
        fig.force([0.4, 1.8], 90, { len: 30, label: "N_1", cls: "fig-force.fig-unknown" });
        fig.force([0.9, 1.8], 0, { tail: true, len: 40, label: "T_1", cls: "fig-force.fig-unknown", labelSide: -1 });
        fig.force([1.6, 1], -90, { len: 30, label: "N_1", cls: "fig-force.fig-unknown", labelSide: -1 });
        fig.force([1.2, 1], 180, { tail: true, len: 40, label: "T_1", cls: "fig-force.fig-unknown" });
        fig.force([2.4, 0.5], 0, { tail: true, len: 44, label: "F" });
        fig.force([1.6, 0.5], -90, { tail: true, len: 34, label: "G_2" });
        fig.force([0.8, 0], 90, { len: 34, label: "N_2", cls: "fig-force.fig-unknown", labelSide: -1 });
        fig.force([0, 0], 180, { tail: true, len: 44, label: "T_2", cls: "fig-force.fig-unknown" });
      },
    };
  },
};
