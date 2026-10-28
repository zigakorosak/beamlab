// Lestev (ladder) on rough ground (point B) leaning against a smooth wall
// (point A, horizontal reaction only), a worker standing on it.
//   koef    worker at distance a along the ladder: B_x, B_y and the
//           smallest friction coefficient f_min so the ladder doesn't slip
//           (exam: Q = 150 N, L = 4 m, 60°, P = 1000 N at 3 m →
//           B_x = 476,13 N, B_y = 1150 N, f = 0,4142)
//   visina  f is given: how far along the ladder can the worker climb
// The ladder's foot tends to slide away from the wall, so friction at B
// points towards the wall.

import { ans, num, q, rad } from "../kit.js";
import { own } from "./common.js";

export function solveLestev({ Q, P, L, alpha, a, f }) {
  const s = Math.sin(rad(alpha)), c = Math.cos(rad(alpha));
  const By = Q + P;
  if (a !== undefined) {
    // ΣM_B = 0: A·L sin α − Q·(L/2) cos α − P·a cos α = 0
    const A = ((Q * L) / 2 + P * a) * c / (L * s);
    return { A, Bx: A, By, f: A / By };
  }
  // Limit: B_x = f·B_y = A, then the moment equation gives the position x.
  const A = f * By;
  const x = (A * L * s - (Q * L * c) / 2) / (P * c);
  return { A, Bx: A, By, x };
}

export const trenjeLestev = {
  id: "trenje-lestev",
  group: "statika",
  title: "Lestev ob gladki steni",
  desc: "Lestev na hrapavih tleh: potrebni koeficient trenja ali kako visoko lahko splezamo",

  generate(r) {
    for (;;) {
      const kind = r.pick(["koef", "visina"]);
      const L = r.step(3, 6, 0.5);
      const alpha = r.step(50, 75, 5);
      const Q = r.step(100, 300, 50);
      const P = r.step(600, 1000, 50);
      if (kind === "koef") {
        const a = r.step(1, L - 0.5, 0.5);
        const R = solveLestev({ Q, P, L, alpha, a });
        if (R.f < 0.08) continue;
        return { kind, Q, P, L, alpha, a };
      }
      const f = r.step(0.15, 0.5, 0.05);
      const R = solveLestev({ Q, P, L, alpha, f });
      // The worker must get somewhere, but not all the way to the top.
      if (R.x < 0.2 * L || R.x > 0.9 * L) continue;
      return { kind, Q, P, L, alpha, f };
    }
  },

  build(p) {
    const { kind, Q, P, L, alpha } = p;
    const R = solveLestev(p);
    const s = Math.sin(rad(alpha)), c = Math.cos(rad(alpha));
    const koef = kind === "koef";
    const xa = koef ? p.a : R.x; // where the worker stands (in the figure: a generic spot for "visina")
    const xDraw = koef ? p.a : 0.6 * L;
    const B = [-L * c, 0];
    const A = [0, L * s];
    const along = (d) => [B[0] + d * c, d * s];

    return {
      title: this.title,
      text: [
        `Lestev z dolžino L = ${q(L, "m")} in težo Q = ${q(Q, "N")} je naslonjena na gladko navpično steno (točka A) in stoji na hrapavih tleh (točka B); z vodoravnimi tlemi oklepa kot α = ${alpha}°. Na lestvi stoji delavec s težo P = ${q(P, "N")}.`,
        koef
          ? `Delavec stoji na razdalji a = ${q(p.a, "m")} od spodnjega krajišča B (merjeno vzdolž lestve). Izračunajte komponenti reakcije v točki B (B_x, B_y) in najmanjši koeficient trenja f med lestvijo in tlemi, pri katerem lestev še ne zdrsne.`
          : `Koeficient trenja med lestvijo in tlemi je f = ${num(p.f)}. Do katere razdalje x od spodnjega krajišča B (merjeno vzdolž lestve) lahko delavec spleza, da lestev še ne zdrsne? Izračunajte tudi vodoravno komponento reakcije B_x v tem mejnem položaju.`,
      ],
      figure(fig) {
        fig.ground([0, 0], [0, A[1] + 0.6]); // the wall, hatched on its right
        fig.ground([B[0] - 0.6, 0], [0, 0]);
        fig.member(B, A);
        fig.point(B, "B", { dx: -6, dy: 16, anchor: "end" });
        fig.point(A, "A", { dx: 14, dy: -6 });
        fig.angle(B, 0, alpha, `${alpha}°`, 24);
        // Both weights drawn from above (labels over the arrows), so the
        // space between ladder and wall stays free for the dimension a.
        // (values in the text; short labels keep the narrow sketch readable)
        fig.force(along(L / 2), -90, { world: 0.13 * L, label: "Q", labelSide: -1 });
        fig.force(along(xDraw), -90, { world: 0.24 * L, label: "P", labelAt: "end" });
        fig.dim(B, A, `L = ${q(L, "m")}`, -30);
        fig.dim(B, along(xDraw), koef ? `a = ${q(p.a, "m")}` : "x = ?", 26);
        if (!koef) fig.label(B, `f = ${num(p.f)}`, { dx: -16, dy: -6, anchor: "end" });
      },
      answers: koef
        ? [ans("Bx", "B_x", "N", R.Bx), ans("By", "B_y", "N", R.By), ans("f", "f_{min}", "", R.f)]
        : [ans("x", "x", "m", R.x), own(ans("Bx", "B_x", "N", R.Bx))],
      solution: [
        "Prosto telo lestve: v A gladka stena → samo vodoravna reakcija A (od stene); v B reakcija tal B_y (navzgor) in trenje B_x. Noga lestve teži stran od stene, zato B_x kaže proti steni.",
        `ΣF_y = 0: B_y − Q − P = 0 → B_y = ${num(Q)} + ${num(P)} = ${num(R.By)} N.`,
        `ΣM_B = 0: A·L sin α − Q·(L/2) cos α − P·${koef ? "a" : "x"}·cos α = 0.`,
        ...(koef
          ? [
              `A = (Q·L/2 + P·a)·cos α / (L·sin α) = (${num(Q)}·${num(L / 2)} + ${num(P)}·${num(p.a)})·${num(c)} / (${num(L)}·${num(s)}) = ${num(R.A)} N.`,
              `ΣF_x = 0: B_x − A = 0 → B_x = ${num(R.Bx)} N.`,
              `Lestev ne zdrsne, če B_x ≤ f·B_y → f_{min} = B_x / B_y = ${num(R.Bx)} / ${num(R.By)} = ${num(R.f)}.`,
            ]
          : [
              `Mejno stanje: B_x = f·B_y = ${num(p.f)}·${num(R.By)} = ${num(R.Bx)} N, ΣF_x = 0 → A = B_x.`,
              `Iz momentne enačbe: x = (A·L sin α − Q·(L/2) cos α) / (P cos α) = (${num(R.A)}·${num(L)}·${num(s)} − ${num(Q)}·${num(L / 2)}·${num(c)}) / (${num(P)}·${num(c)}) = ${num(xa)} m.`,
              `Ko delavec spleza višje od x = ${num(xa)} m, bi potrebna sila trenja presegla f·B_y in lestev bi zdrsnila.`,
            ]),
      ],
      solutionFigure(fig) {
        fig.member(B, A);
        fig.force(A, 180, { tail: true, len: 50, label: "A", cls: "fig-force.fig-unknown", labelAt: "end" });
        fig.force(B, 90, { len: 50, label: "B_y", cls: "fig-force.fig-unknown", labelAt: "end" });
        fig.force(B, 0, { tail: true, len: 50, label: "B_x", cls: "fig-force.fig-unknown", labelAt: "end" });
        fig.force(along(L / 2), -90, { tail: true, len: 36, label: "Q", labelAt: "end" });
        fig.force(along(xDraw), -90, { tail: true, len: 46, label: "P", labelAt: "end" });
        fig.angle(B, 0, alpha, "α", 26);
      },
    };
  },
};
