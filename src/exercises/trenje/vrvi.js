// Trenje vrvi (rope friction, Euler–Eytelwein): a rope about to slip over a
// fixed rough drum or post has S_1 = S_2·e^{f·δ} (δ in radians), the bigger
// force S_1 on the side the rope would move to.
//   klanec   block A on a rough incline, rope parallel to the slope over a
//            fixed drum at the top (wrap δ = 90° + α), weight B hanging:
//            largest B (block about to go up; 23.6.2015: A = 500 N, 30°,
//            f = 0,4, δ = 120° → N = 433,01, T = 173,2, S = 423,2,
//            B = 978,1 N) or smallest B (block about to slide down).
//   steber   weight Q held by a rope round a fixed post, both ends hanging
//            down (δ = π + n·2π): the force to hold / to start lifting it,
//            or the number of turns needed to hold it with a given force.

import { ans, num, q, rad } from "../kit.js";
import { cornerWheel, dir, drawWedge, mul, own, slopeBlock } from "./common.js";

export function solveVrvKlanec({ A, alpha, f1, f2, max }) {
  const s = Math.sin(rad(alpha)), c = Math.cos(rad(alpha));
  const delta = rad(90 + alpha);
  const N = A * c;
  const T = f1 * N;
  const S = max ? A * s + T : A * s - T;
  const e = Math.exp(f2 * delta);
  return { N, T, S, delta, e, B: max ? S * e : S / e };
}

export function solveSteber({ Q, f, n, F }) {
  if (F === undefined) {
    const delta = Math.PI * (1 + 2 * n);
    const e = Math.exp(f * delta);
    return { delta, e, Fmin: Q / e, Fmax: Q * e };
  }
  // Q ≤ F·e^{f δ}: δ ≥ ln(Q/F)/f, δ = π + n·2π.
  const need = Math.log(Q / F) / f;
  const nReal = (need - Math.PI) / (2 * Math.PI);
  const turns = Math.max(0, Math.ceil(nReal));
  const delta = Math.PI * (1 + 2 * turns);
  return { need, nReal, n: turns, delta, Fhold: Q / Math.exp(f * delta) };
}

export const trenjeVrvi = {
  id: "trenje-vrvi",
  group: "statika",
  title: "Trenje vrvi",
  desc: "Vrv čez nepomičen boben ali stebriček: S_1 = S_2·e^{fδ}",

  generate(r) {
    for (;;) {
      const kind = r.pick(["klanec", "klanec", "steber", "ovoji"]);
      if (kind === "klanec") {
        const max = r.chance(0.6);
        const alpha = r.step(15, 50, 5);
        const f1 = r.step(0.1, 0.5, 0.05);
        const f2 = r.step(0.1, 0.5, 0.05);
        // The smallest B only exists if the block would slide down alone.
        if (!max && Math.tan(rad(alpha)) - f1 < 0.15) continue;
        return { kind, max, A: r.step(200, 1000, 50), alpha, f1, f2 };
      }
      const f = r.step(0.1, 0.4, 0.05);
      const Q = r.step(200, 2000, 100);
      if (kind === "steber") return { kind, Q, f, n: r.int(0, 2) };
      const F = r.step(10, 100, 10);
      const R = solveSteber({ Q, f, F });
      const frac = R.nReal - Math.floor(R.nReal);
      if (R.nReal < 0.2 || R.nReal > 3.8 || frac < 0.15 || frac > 0.85) continue;
      return { kind, Q, f, F };
    }
  },

  build(p) {
    return p.kind === "klanec" ? buildKlanec.call(this, p) : buildSteber.call(this, p);
  },
};

function buildKlanec(p) {
  const { A, alpha, f1, f2, max } = p;
  const R = solveVrvKlanec(p);
  const d = 90 + alpha;
  const L = 4, w = 0.95, h = 0.6;
  const blk = slopeBlock(alpha, 0.4 * L, w, h);
  return {
    title: this.title,
    text: [
      `Telo A s težo G_A = ${q(A, "N")} leži na klancu z naklonom α = ${alpha}°; koeficient trenja med telesom in klancem je f_1 = ${num(f1)}. Vrv, vzporedna s klancem, je speljana čez nepomičen (nevrtljiv) boben na vrhu klanca, na njenem drugem koncu visi breme B. Vrv oklepa boben s kotom δ = ${d}°, koeficient trenja med vrvjo in bobnom je f_2 = ${num(f2)}.`,
      max
        ? "Kolikšna je največja teža bremena B, pri kateri sistem še miruje? Izračunajte tudi normalno silo N in silo trenja T med telesom in klancem ter silo v vrvi S ob telesu A v tem mejnem stanju."
        : "Kolikšna je najmanjša teža bremena B, pri kateri sistem še miruje (telo A ne zdrsne navzdol)? Izračunajte tudi normalno silo N in silo trenja T med telesom in klancem ter silo v vrvi S ob telesu A v tem mejnem stanju.",
    ],
    figure(fig) {
      drawWedge(fig, alpha, L);
      fig.polygon(blk.pts);
      fig.label(blk.top, `A: ${q(A, "N")}`, { dx: -14, dy: -8, anchor: "end" });
      fig.label(mul(dir(alpha), 0.78 * L), `f_1 = ${num(f1)}`, { dx: 8, dy: 16, anchor: "start" });
      const r = 0.32;
      const wh = cornerWheel(alpha, L, h / 2, r);
      fig.line(blk.up, wh.touch);
      fig.line(wh.c, mul(dir(alpha), L), "fig-member"); // bracket of the fixed drum
      fig.circle(wh.c, r);
      fig.arc(wh.c, r, 0, alpha + 90);
      fig.hinge(wh.c);
      fig.label([wh.leave[0], wh.c[1] + r], `δ = ${d}°, f_2 = ${num(f2)}`, { dy: -8, anchor: "end" });
      fig.line(wh.leave, [wh.leave[0], wh.c[1] - 1.2]);
      fig.rect(wh.leave[0] - 0.25, wh.c[1] - 1.7, 0.5, 0.5);
      fig.label([wh.leave[0] + 0.25, wh.c[1] - 1.45], "B", { dx: 8, dy: 4, anchor: "start" });
    },
    answers: [ans("N", "N", "N", R.N), own(ans("T", "T", "N", R.T)), own(ans("S", "S", "N", R.S)), own(ans("B", max ? "B_{max}" : "B_{min}", "N", R.B))],
    solution: [
      max
        ? "Mejno stanje: telo A se pravkar začne gibati navzgor po klancu, vrv drsi po bobnu proti bremenu B. Trenje na telo deluje navzdol po klancu, večja sila v vrvi je na strani bremena."
        : "Mejno stanje: telo A se pravkar začne gibati navzdol po klancu, vrv drsi po bobnu proti telesu A. Trenje na telo deluje navzgor po klancu, večja sila v vrvi je na strani telesa A.",
      "Prosto telo A: teža G_A, normalna sila N, trenje T = f_1·N, sila vrvi S vzdolž klanca.",
      `ΣF_y = 0 (pravokotno na klanec): N = G_A cos α = ${num(A)}·${num(Math.cos(rad(alpha)))} = ${num(R.N)} N.`,
      `T = f_1·N = ${num(f1)}·${num(R.N)} = ${num(R.T)} N.`,
      max
        ? `ΣF_x = 0 (vzdolž klanca): S − G_A sin α − T = 0 → S = ${num(A * Math.sin(rad(alpha)))} + ${num(R.T)} = ${num(R.S)} N.`
        : `ΣF_x = 0 (vzdolž klanca): S − G_A sin α + T = 0 → S = ${num(A * Math.sin(rad(alpha)))} − ${num(R.T)} = ${num(R.S)} N.`,
      `Kot ovijanja v radianih: δ = ${d}° = ${num(R.delta)} rad; e^{f₂δ} = e^{${num(f2 * R.delta)}} = ${num(R.e)}.`,
      max
        ? `Vrv na bobnu: B = S·e^{f₂δ} = ${num(R.S)}·${num(R.e)} = ${num(R.B)} N.`
        : `Vrv na bobnu: S = B·e^{f₂δ} → B = S / e^{f₂δ} = ${num(R.S)} / ${num(R.e)} = ${num(R.B)} N.`,
    ],
  };
}

function buildSteber(p) {
  const { Q, f } = p;
  const ovoji = p.kind === "ovoji";
  const R = solveSteber(p);
  const n = ovoji ? R.n : p.n;
  const turns = (k) => (k === 1 ? "1 poln ovoj" : k === 2 ? "2 polna ovoja" : `${k} polni ovoji`);
  const intro = `Breme s težo Q = ${q(Q, "N")} visi na vrvi, ki je speljana čez nepomičen valjast stebriček (drog). Oba konca vrvi visita navpično navzdol, zato je kot ovijanja δ = π + n·2π, kjer je n število polnih ovojev vrvi okoli stebrička. Koeficient trenja med vrvjo in stebričkom je f = ${num(f)}.`;
  const text = ovoji
    ? [intro, `Na drugem koncu vrvi lahko vlečemo s silo največ F = ${q(p.F, "N")}. Najmanj koliko polnih ovojev n potrebujemo, da breme obdržimo? Kolikšna sila F_{min} zadošča za držanje bremena pri tem številu ovojev?`]
    : [
        intro,
        `Vrv je okoli stebrička ovita ${n === 0 ? "le čez zgornjo polovico (n = 0)" : `s ${n === 1 ? "polovico in 1 polnim ovojem" : "polovico in 2 polnima ovojema"} (n = ${n})`}. Izračunajte kot ovijanja δ v radianih, najmanjšo silo F_{min}, s katero breme še držimo, in ${n === 0 ? "največjo silo F_{max}, pri kateri se breme še ne začne dvigati." : "razmerje e^{fδ}."}`,
      ];
  const answers = ovoji
    ? [ans("n", "n", "", R.n, { tol: 0.4 }), own(ans("Fmin", "F_{min}", "N", R.Fhold))]
    : [ans("delta", "δ", "rad", R.delta), own(ans("Fmin", "F_{min}", "N", R.Fmin)), n === 0 ? own(ans("Fmax", "F_{max}", "N", R.Fmax)) : own(ans("e", "e^{fδ}", "", R.e))];
  const solution = ovoji
    ? [
        "Breme teži navzdol, vrv bi drsela proti bremenu: večja sila je Q, manjša F. Mejno stanje: Q = F·e^{fδ}.",
        `Potrebni kot ovijanja: δ ≥ ln(Q/F)/f = ln(${num(Q)}/${num(p.F)})/${num(f)} = ${num(R.need)} rad.`,
        `δ = π + n·2π → n ≥ (δ − π)/(2π) = ${num(R.nReal)} → najmanj n = ${R.n} (${turns(R.n)}).`,
        `Pri n = ${R.n}: δ = ${num(R.delta)} rad, F_{min} = Q·e^{−fδ} = ${num(Q)}·e^{−${num(f * R.delta)}} = ${num(R.Fhold)} N ≤ ${num(p.F)} N.`,
      ]
    : [
        `δ = π + ${n}·2π = ${num(R.delta)} rad; e^{fδ} = e^{${num(f * R.delta)}} = ${num(R.e)}.`,
        `Držanje (breme teži navzdol, vrv bi drsela proti bremenu, večja sila je Q): Q = F_{min}·e^{fδ} → F_{min} = ${num(Q)}/${num(R.e)} = ${num(R.Fmin)} N.`,
        n === 0
          ? `Začetek dviganja (vrv bi drsela proti nam, večja sila je F): F_{max} = Q·e^{fδ} = ${num(Q)}·${num(R.e)} = ${num(R.Fmax)} N.`
          : `Z vsakim dodatnim ovojem se razmerje pomnoži z e^{2πf} = ${num(Math.exp(2 * Math.PI * f))}.`,
      ];
  return {
    title: this.title,
    text,
    figure(fig) {
      const r = 0.5;
      fig.circle([0, 0], r);
      fig.arc([0, 0], r, 0, 180);
      fig.hinge([0, 0]);
      fig.line([-r, 0], [-r, -1.6]);
      fig.rect(-r - 0.35, -2.2, 0.7, 0.6);
      fig.label([-r - 0.35, -1.9], `Q = ${q(Q, "N")}`, { dx: -8, dy: 4, anchor: "end" });
      fig.line([r, 0], [r, -1.3]);
      fig.force([r, -1.3], -90, { tail: true, world: 0.6, label: ovoji ? `F = ${q(p.F, "N")}` : "F", labelSide: -1 });
      fig.label([0, r], ovoji ? `f = ${num(f)}, n = ?` : `f = ${num(f)}, n = ${n}`, { dy: -12 });
    },
    answers,
    solution,
  };
}
