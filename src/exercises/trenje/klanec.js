// Telo na klancu s trenjem (block on a rough incline), four exam variants:
//   vzporedna   force parallel to the slope: smallest force that stops the
//               block sliding down, largest before it slides up
//   vodoravna   the same with a horizontal force
//   pravokotna  force perpendicular to the top face pressing the block onto
//               the board (11.4.2007: m = 3 kg, 35°, f = 0,4 → 18,093 N)
//   dva         block on the incline tied over a smooth pulley to a hanging
//               weight B: the range of B for rest
// Coulomb: T ≤ f·N, T against the impending motion. Every case has
// tan α > f, so without help the block would slide down (F_min > 0).

import { ans, G as g, num, q, rad, round } from "../kit.js";
import { add, cornerWheel, dir, drawWedge, mul, own, slopeBlock } from "./common.js";

const KINDS = ["vzporedna", "vodoravna", "pravokotna", "dva"];

/** All the numbers of one task (shared by build() and the tests). */
export function solveKlanec({ kind, alpha, f, G, m }) {
  const W = kind === "pravokotna" ? m * g : G;
  const s = Math.sin(rad(alpha)), c = Math.cos(rad(alpha));
  if (kind === "vzporedna" || kind === "dva") {
    return { W, N: W * c, Fmin: W * (s - f * c), Fmax: W * (s + f * c) };
  }
  if (kind === "vodoravna") {
    // F horizontal: along the slope F·cos α, into the slope F·sin α.
    const Fmin = (W * (s - f * c)) / (c + f * s);
    const Fmax = (W * (s + f * c)) / (c - f * s);
    return { W, Fmin, Fmax, Nmin: W * c + Fmin * s, Nmax: W * c + Fmax * s };
  }
  // pravokotna: N = G cos α + F, impending slide down: G sin α = f·N.
  const Fmin = W * (s / f - c);
  return { W, Fmin, N: W * c + Fmin };
}

export const trenjeKlanec = {
  id: "trenje-klanec",
  group: "statika",
  title: "Telo na klancu s trenjem",
  desc: "Najmanjša in največja sila, da telo na hrapavem klancu miruje",

  generate(r) {
    for (;;) {
      const kind = r.pick(KINDS);
      const alpha = r.step(20, 60, 5);
      const f = r.step(0.1, 0.6, 0.05);
      const t = Math.tan(rad(alpha));
      if (t - f < 0.15) continue; // the block must slide by itself, clearly
      if (kind === "vodoravna" && f * t > 0.65) continue; // else no F_max (self-locking)
      if (kind === "pravokotna") {
        if (alpha > 45) continue; // a brick on a board: moderate slopes
        return { kind, alpha, f, m: r.int(2, 12) };
      }
      return { kind, alpha, f, G: r.step(100, 1000, 50) };
    }
  },

  build(p) {
    const { kind, alpha, f } = p;
    const R = solveKlanec(p);
    const W = R.W;
    const fs = num(f);
    const sa = `sin ${alpha}°`, ca = `cos ${alpha}°`;
    const intro =
      kind === "pravokotna"
        ? `Opeka z maso m = ${q(p.m, "kg")} leži na deski, ki je nagnjena za kot α = ${alpha}° glede na vodoravnico. Koeficient trenja med opeko in desko je f = ${fs} (g = 9,81 m/s²).`
        : kind === "dva"
          ? `Telo A s težo G = ${q(W, "N")} leži na klancu z naklonom α = ${alpha}°; koeficient trenja med telesom in klancem je f = ${fs}. Na telo je pritrjena vrv, vzporedna s klancem, ki teče prek gladkega (idealnega) škripca na vrhu klanca; na njenem drugem koncu visi breme B.`
          : `Telo s težo G = ${q(W, "N")} leži na klancu z naklonom α = ${alpha}°. Koeficient trenja med telesom in klancem je f = ${fs}.`;
    const ask = {
      vzporedna: [
        "Na telo deluje sila F, vzporedna s klancem in usmerjena navzgor po klancu (glej sliko).",
        "Izračunajte normalno silo N med telesom in klancem, najmanjšo silo F_{min}, pri kateri telo še ne zdrsne navzdol, in največjo silo F_{max}, pri kateri telo še ne zdrsne navzgor po klancu.",
      ],
      vodoravna: [
        "Na telo deluje vodoravna sila F, ki ga potiska proti klancu (glej sliko).",
        "Izračunajte najmanjšo vodoravno silo F_{min}, pri kateri telo še ne zdrsne navzdol, in največjo vodoravno silo F_{max}, pri kateri telo še ne zdrsne navzgor po klancu.",
      ],
      pravokotna: [
        "Opeko pritiskamo ob desko s silo F, ki deluje pravokotno na zgornjo ploskev opeke (glej sliko).",
        "Izračunajte težo opeke G, najmanjšo silo F_{min}, pri kateri opeka še ne zdrsne po deski, in normalno silo N med opeko in desko pri tej sili.",
      ],
      dva: [
        "Določite normalno silo N med telesom A in klancem ter najmanjšo (B_{min}) in največjo (B_{max}) težo bremena B, pri kateri sistem še miruje.",
      ],
    }[kind];

    const answers = {
      vzporedna: [ans("N", "N", "N", R.N), own(ans("Fmin", "F_{min}", "N", R.Fmin)), own(ans("Fmax", "F_{max}", "N", R.Fmax))],
      vodoravna: [own(ans("Fmin", "F_{min}", "N", R.Fmin)), own(ans("Fmax", "F_{max}", "N", R.Fmax))],
      pravokotna: [ans("G", "G", "N", W), own(ans("Fmin", "F_{min}", "N", R.Fmin)), own(ans("N", "N", "N", R.N))],
      dva: [ans("N", "N", "N", R.N), own(ans("Bmin", "B_{min}", "N", R.Fmin)), own(ans("Bmax", "B_{max}", "N", R.Fmax))],
    }[kind];

    const check = `Brez dodatne sile bi telo zdrsnilo: tan α = ${num(Math.tan(rad(alpha)))} > f = ${fs}.`;
    const fbd = "Prosto telo: teža G (navpično navzdol), normalna sila N (pravokotno na klanec), sila trenja T (vzdolž klanca, nasproti teženemu zdrsu), sila F. Osi: x vzdolž klanca navzgor, y pravokotno na klanec.";
    const solution = {
      vzporedna: [
        fbd,
        `ΣF_y = 0: N − G·${ca} = 0 → N = ${num(W)}·${num(Math.cos(rad(alpha)))} = ${num(R.N)} N.`,
        check,
        `a) F_{min}: telo teži navzdol, trenje T = f·N deluje navzgor po klancu. ΣF_x = 0: F + f·N − G·${sa} = 0 → F_{min} = G(sin α − f cos α) = ${num(R.Fmin)} N.`,
        `b) F_{max}: telo teži navzgor, trenje deluje navzdol po klancu. ΣF_x = 0: F − f·N − G·${sa} = 0 → F_{max} = G(sin α + f cos α) = ${num(R.Fmax)} N.`,
        `Telo miruje za ${num(R.Fmin)} N ≤ F ≤ ${num(R.Fmax)} N.`,
      ],
      vodoravna: [
        fbd,
        `Vodoravna sila ima komponento F·${ca} vzdolž klanca (navzgor) in F·${sa} pravokotno na klanec (pritiska telo ob klanec): N = G·${ca} + F·${sa}.`,
        check,
        `a) F_{min} (zdrs navzdol, T navzgor): ΣF_x = 0: F cos α + f(G cos α + F sin α) − G sin α = 0 → F_{min} = G(sin α − f cos α)/(cos α + f sin α) = ${num(R.Fmin)} N (N = ${num(R.Nmin)} N).`,
        `b) F_{max} (zdrs navzgor, T navzdol): ΣF_x = 0: F cos α − f(G cos α + F sin α) − G sin α = 0 → F_{max} = G(sin α + f cos α)/(cos α − f sin α) = ${num(R.Fmax)} N (N = ${num(R.Nmax)} N).`,
        `Pogoj cos α − f sin α = ${num(Math.cos(rad(alpha)) - f * Math.sin(rad(alpha)))} > 0 je izpolnjen, zato F_{max} obstaja. Telo miruje za ${num(R.Fmin)} N ≤ F ≤ ${num(R.Fmax)} N.`,
      ],
      pravokotna: [
        `G = m·g = ${p.m}·9,81 = ${num(W)} N.`,
        "Prosto telo: G navpično, sila F in normalna sila N pravokotno na desko, trenje T vzdolž deske navzgor (opeka teži navzdol).",
        check,
        `ΣF_y = 0 (pravokotno na desko): N − G·${ca} − F = 0 → N = G cos α + F.`,
        `ΣF_x = 0 (vzdolž deske): T − G·${sa} = 0 → T = G sin α = ${num(W * Math.sin(rad(alpha)))} N.`,
        `Mejno stanje T = f·N: G sin α = f(G cos α + F) → F_{min} = G(sin α / f − cos α) = ${num(W)}·(${num(Math.sin(rad(alpha)))}/${fs} − ${num(Math.cos(rad(alpha)))}) = ${num(R.Fmin)} N.`,
        `N = G cos α + F_{min} = G sin α / f = ${num(R.N)} N.`,
      ],
      dva: [
        "Breme B: ravnotežje da silo v vrvi S = B. Gladki škripec ne spremeni sile v vrvi.",
        `Telo A: ΣF_y = 0: N = G·${ca} = ${num(R.N)} N.`,
        check,
        `a) B_{min}: telo A teži navzdol po klancu, trenje T = f·N deluje navzgor. ΣF_x = 0: S + f·N − G sin α = 0 → B_{min} = G(sin α − f cos α) = ${num(R.Fmin)} N.`,
        `b) B_{max}: telo A teži navzgor, trenje deluje navzdol. ΣF_x = 0: S − f·N − G sin α = 0 → B_{max} = G(sin α + f cos α) = ${num(R.Fmax)} N.`,
        `Sistem miruje za ${num(R.Fmin)} N ≤ B ≤ ${num(R.Fmax)} N.`,
      ],
    }[kind];

    const L = 4, w = 0.95, h = 0.6;
    const blockAt = kind === "dva" ? 0.45 * L : 0.4 * L;
    const blk = slopeBlock(alpha, blockAt, w, h);
    const weight = kind === "pravokotna" ? `m = ${q(p.m, "kg")}` : kind === "dva" ? `A: G = ${q(W, "N")}` : `G = ${q(W, "N")}`;

    return {
      title: this.title,
      text: [intro, ...ask],
      figure(fig) {
        drawWedge(fig, alpha, L);
        fig.polygon(blk.pts);
        if (kind === "vodoravna") fig.label(blk.top, weight, { dx: -10, dy: -12, anchor: "end" });
        else fig.label(blk.down, weight, { dx: -14, dy: -4, anchor: "end" });
        fig.label(add(mul(dir(alpha), 0.75 * L), mul(blk.n, -0.12)), `f = ${fs}`, { dx: 6, dy: 8, anchor: "start" });
        if (kind === "vzporedna") fig.force(blk.up, alpha, { tail: true, world: 0.7, label: "F" });
        if (kind === "vodoravna") fig.force(blk.down, 0, { world: 0.7, label: "F", labelSide: 1 });
        if (kind === "pravokotna") fig.force(blk.top, alpha - 90, { world: 0.7, label: "F", labelSide: -1 });
        if (kind === "dva") {
          const r = 0.28;
          const wh = cornerWheel(alpha, L, h / 2, r);
          fig.line(blk.up, wh.touch);
          fig.arc(wh.c, r, 0, alpha + 90);
          fig.line(wh.leave, [wh.leave[0], wh.c[1] - 1.1]);
          fig.line(wh.c, mul(dir(alpha), L), "fig-member"); // pulley bracket
          fig.circle(wh.c, r);
          fig.hinge(wh.c);
          fig.rect(wh.leave[0] - 0.2, wh.c[1] - 1.6, 0.4, 0.5);
          fig.label([wh.leave[0] + 0.2, wh.c[1] - 1.35], "B", { dx: 8, dy: 4, anchor: "start" });
        }
      },
      answers,
      solution,
      solutionFigure(fig) {
        // Free body for the "slides down" limit; T flips for the other one.
        const b = slopeBlock(alpha, 0, w, h);
        fig.polygon(b.pts);
        fig.dashed(add(b.pts[0], mul(b.u, -0.4)), add(b.pts[1], mul(b.u, 0.4)));
        fig.force(b.centre, -90, { tail: true, len: 55, label: "G" });
        fig.force(b.bottom, alpha + 90, { len: 45, label: "N", cls: "fig-force.fig-unknown", labelSide: -1 });
        fig.force(add(b.bottom, mul(b.u, 0.3)), alpha, { tail: true, len: 45, label: "T", cls: "fig-force.fig-unknown", labelSide: -1 });
        if (kind === "vzporedna" || kind === "dva") fig.force(b.up, alpha, { tail: true, len: 50, label: kind === "dva" ? "S" : "F" });
        if (kind === "vodoravna") fig.force(b.down, 0, { len: 50, label: "F" });
        if (kind === "pravokotna") fig.force(b.top, alpha - 90, { len: 50, label: "F", labelSide: -1 });
        fig.bounds([[-1.3, -1.1], [2.3, 1.9]]);
        fig.label([b.pts[0][0], b.pts[0][1]], `meja zdrsa navzdol, α = ${round(alpha, 3)}°`, { dy: 40, anchor: "start" });
      },
    };
  },
};
