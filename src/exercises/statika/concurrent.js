// Sile s skupnim prijemališčem (concurrent forces), two exam classics:
//   sile-f4        three known forces on a point; find F4 (size and angle)
//                  that keeps it in equilibrium (24.8.2016, 28.6.2006).
//   sile-vozlisce  a weight hangs from a knot held by two ropes/bars in
//                  known directions; find both forces (23.6.2015, 1.6.2006).

import { ans, angleAns, deg, num, q, rad } from "../kit.js";

const comp = (F, a) => [F * Math.cos(rad(a)), F * Math.sin(rad(a))];
const norm360 = (a) => ((a % 360) + 360) % 360;

export const sileF4 = {
  id: "sile-f4",
  group: "statika",
  title: "Ravnotežje sil v točki",
  desc: "Tri sile s skupnim prijemališčem: določi četrto, da bo ravnotežje",

  generate(r) {
    for (;;) {
      const angles = [];
      while (angles.length < 3) {
        const a = r.step(0, 345, 15);
        if (angles.every((b) => Math.abs(((a - b + 540) % 360) - 180) >= 40)) angles.push(a);
      }
      const forces = angles.map((a) => ({ F: r.step(2, 12, 1), a }));
      const R = forces.reduce((acc, f) => acc.map((v, i) => v + comp(f.F, f.a)[i]), [0, 0]);
      // φ not next to 0°/360°, where an answer of 359,8 vs 0,2 would be graded wrong.
      const phi = norm360(deg(Math.atan2(-R[1], -R[0])));
      if (Math.hypot(...R) > 2 && phi > 2 && phi < 358) return { forces };
    }
  },

  build({ forces }) {
    let Rx = 0;
    let Ry = 0;
    for (const f of forces) {
      const [x, y] = comp(f.F, f.a);
      Rx += x;
      Ry += y;
    }
    const F4 = Math.hypot(Rx, Ry);
    const phi = norm360(deg(Math.atan2(-Ry, -Rx)));
    const names = forces.map((_, i) => `F_${i + 1}`);

    return {
      title: this.title,
      text: [
        `Na točko delujejo sile ${forces.map((f, i) => `${names[i]} = ${q(f.F, "kN")}`).join(", ")} pod koti, ki so na sliki merjeni od osi x v nasprotni smeri urinega kazalca.`,
        "S kolikšno jakostjo in pod kakšnim kotom φ (od osi x, v nasprotni smeri urinega kazalca) mora delovati sila F_4, da bo doseženo ravnotežje?",
      ],
      figure(f) {
        // Arrow lengths to scale; F4 is not drawn (its direction is the question).
        const Fmax = Math.max(...forces.map((x) => x.F));
        f.bounds([[-1.15, -1.15], [1.15, 1.15]]);
        f.dashed([-1.1, 0], [1.1, 0]);
        // Below the axis' end, or (when a force's label is there, e.g. one at 345°) above or past it.
        f.label([1.12, 0], "x", { dx: 4, dy: 18, anchor: "start", alts: [[4, -8, "start"], [8, 4, "start"]] });
        f.angle([0, 0], 0, 360, "", 14);
        forces.forEach((force, i) => {
          const len = 0.35 + (0.65 * force.F) / Fmax;
          const label = `${names[i]} = ${q(force.F, "kN")}, ${force.a}°`;
          // Along the x axis a label past the tip would lie on the dashed axis: lift it above.
          const c = Math.cos((force.a * Math.PI) / 180);
          if (Math.abs(Math.sin((force.a * Math.PI) / 180)) < 0.2) {
            f.force([0, 0], force.a, { tail: true, world: len });
            f.label([len * c, len * Math.sin((force.a * Math.PI) / 180)], label, { dx: c > 0 ? 4 : -4, dy: -9, anchor: c > 0 ? "start" : "end", cls: "fig-force-label" });
          } else f.force([0, 0], force.a, { tail: true, world: len, label, labelAt: "auto" }); // past the tip, unless another label is there
        });
        f.hinge([0, 0]);
      },
      answers: [ans("F4", "F_4", "kN", F4), angleAns("phi", "φ", phi, { note: "0° ≤ φ < 360°" })],
      solution: [
        "Komponente sil: F_{ix} = F_i·cos α_i, F_{iy} = F_i·sin α_i.",
        ...forces.map((f, i) => {
          const [x, y] = comp(f.F, f.a);
          return `${names[i]}: (${num(x)}; ${num(y)}) kN`;
        }),
        `Rezultanta znanih sil: R_x = ΣF_{ix} = ${num(Rx)} kN, R_y = ΣF_{iy} = ${num(Ry)} kN.`,
        `Ravnotežje: F_4 = −R → F_{4x} = ${num(-Rx)} kN, F_{4y} = ${num(-Ry)} kN.`,
        `F_4 = √(F_{4x}² + F_{4y}²) = ${num(F4)} kN.`,
        `φ = atan2(F_{4y}, F_{4x}) = ${num(phi)}° (pazi na kvadrant).`,
      ],
    };
  },
};

export const sileVozlisce = {
  id: "sile-vozlisce",
  group: "statika",
  title: "Breme na dveh vrveh",
  desc: "Vozlišče z bremenom drži dve vrvi (palici): sili v obeh",

  generate(r) {
    for (;;) {
      // Directions of the two ropes from the knot, measured from +x.
      const a1 = r.step(100, 165, 5); // up-left
      const a2 = r.step(15, 80, 5); // up-right
      const G = r.step(2, 40, 1);
      if (a1 - a2 >= 40) return { a1, a2, G };
    }
  },

  build({ a1, a2, G }) {
    // S1·(cos a1, sin a1) + S2·(cos a2, sin a2) + (0, −G) = 0
    const c1 = Math.cos(rad(a1)), s1 = Math.sin(rad(a1));
    const c2 = Math.cos(rad(a2)), s2 = Math.sin(rad(a2));
    const det = c1 * s2 - c2 * s1;
    const S1 = (0 * s2 - c2 * G) / det;
    const S2 = (c1 * G - s1 * 0) / det;
    const L = 1;
    const A = [L * c1, L * s1];
    const B = [L * c2 * (s1 / s2), L * s1]; // both anchors at the same height
    return {
      title: this.title,
      text: [
        `Breme s težo G = ${q(G, "kN")} visi v vozlišču, ki ga držita vrvi 1 in 2. Vrv 1 oklepa z vodoravnico kot ${num(180 - a1)}°, vrv 2 pa ${num(a2)}°.`,
        "Izračunajte sili v obeh vrveh.",
      ],
      figure(f) {
        f.ground([B[0] + 0.25, B[1]], [A[0] - 0.25, A[1]]); // ceiling: hatch above
        f.line([0, 0], A, "fig-rope");
        f.line([0, 0], B, "fig-rope");
        f.hinge([0, 0]);
        // Rope names beside the middle of each rope, below it (outside the V).
        const ropeName = (P, name) => {
          const L = Math.hypot(P[0], P[1]) || 1;
          let nx = P[1] / L, ny = -P[0] / L;
          if (ny > 0) { nx = -nx; ny = -ny; }
          f.label([P[0] / 2, P[1] / 2], name, { dx: nx * 12, dy: -ny * 12 + 4 });
        };
        ropeName(A, "1");
        ropeName(B, "2");
        f.force([0, 0], -90, { tail: true, len: 50, label: `G = ${q(G, "kN")}` });
        f.angle(A, a1 + 180, 360, `${num(180 - a1)}°`, 26);
        f.angle(B, 180, 180 + a2, `${num(a2)}°`, 26);
      },
      answers: [ans("S1", "S_1", "kN", S1), ans("S2", "S_2", "kN", S2)],
      solution: [
        "Prerežemo obe vrvi in zapišemo ravnotežje vozlišča (natezni sili S_1, S_2 kažeta od vozlišča proti pritrdišču):",
        `Smeri vrvi merimo od osi +x (v nasprotni smeri urinega kazalca): vrv 1 pod 180° − ${num(180 - a1)}° = ${num(a1)}°, vrv 2 pod ${num(a2)}°.`,
        `ΣF_x = 0: S_1·cos ${a1}° + S_2·cos ${a2}° = 0`,
        `ΣF_y = 0: S_1·sin ${a1}° + S_2·sin ${a2}° − G = 0`,
        `Rešitev sistema: S_1 = ${num(S1)} kN, S_2 = ${num(S2)} kN.`,
        "Kontrola: pozitivni vrednosti pomenita nateg (vrv mora biti napeta).",
      ],
    };
  },
};
