// Upogib: normal stresses from bending, the strength problem of most
// recent exams.
//   upogib-napetost        a beam with a given section: M_max and where,
//                          I (and W or the centroid), σ in the top and
//                          bottom fibre (σ = M·z/I, z down from the
//                          centroid, M > 0 = tension at the bottom).
//   upogib-dimenzioniranje σ_max = M_max/W ≤ σ_dop: the size of a b = k₁x,
//                          h = k₂x rectangle, the diameter of a tube with a
//                          given wall, or the largest allowed load F.
//
// Units as on the exams: M in kNm (×100 → kNcm), section in cm (tubes in
// mm), stresses computed in kN/cm² and answered in MPa (1 kN/cm² = 10 MPa).

import { ans, num, q, round } from "../kit.js";
import { SHAPES, bbox, drawSection, sectionProps } from "./section.js";
import { sectionLines } from "./steps.js";
import { analyse, beamText, crowded, drawBeam, drawMoment, momentLines, randomBeam } from "./beams.js";

/** { shape, a } → section; "Tflip" is the ⊥ (flange at the bottom). */
export function bendSection({ shape, a }) {
  if (shape === "Tflip") return SHAPES.T(...a, true);
  return SHAPES[shape](...a);
}

/** Extreme-fibre stresses (kN/cm²) for M (kNm): σ = M·z/I, z down from the centroid. */
export function fibreStress(P, M) {
  const Mc = M * 100; // kNcm
  return { top: (-Mc * P.eTop) / P.Ix, bot: (Mc * P.eBot) / P.Ix };
}

function randomBendSection(r) {
  const i = (lo, hi) => r.int(lo, hi);
  const shape = r.pick(["rect", "hollowRect", "I", "notchedI", "T", "Tflip", "U", "Hrot", "circle", "tube"]);
  switch (shape) {
    case "rect": {
      const b = r.pick([8, 10, 12, 14, 15, 16, 20]);
      return { shape, a: [b, b + i(4, 20)] };
    }
    case "hollowRect": {
      // An opening at least 4 cm wide (B = 10, t = 5 left none).
      const B = i(10, 20), t = i(2, Math.min(5, Math.floor((B - 4) / 2))), H = B + i(0, 12);
      return { shape, a: [B, H, B - 2 * t, H - 2 * t] };
    }
    case "I": {
      const tw = i(1, 3);
      return { shape, a: [tw + 2 * i(3, 8), i(1, 3), tw, i(10, 26)] };
    }
    case "notchedI": {
      const n = i(2, 5), w = i(2, 5), hn = i(4, 12), t = i(2, 5);
      return { shape, a: [2 * n + w, hn + 2 * t, n, hn] };
    }
    case "T":
    case "Tflip": {
      const tw = i(2, 4);
      return { shape, a: [tw + 2 * i(2, 8), i(2, 4), tw, i(6, 18)] };
    }
    case "U": {
      const tw = i(2, 3);
      return { shape, a: [2 * tw + i(6, 14), i(2, 4), tw, i(6, 15)] };
    }
    case "Hrot":
      return { shape, a: [i(3, 6), i(10, 20), i(10, 25), i(3, 6)] };
    case "circle":
      return { shape, a: [2 * i(5, 15)] };
    case "tube": {
      const D = 2 * i(5, 15);
      return { shape, a: [D, i(1, Math.min(3, Math.floor(D / 4)))] };
    }
  }
}

/** Beam on the left, its cross-section on the right, scaled to sit beside it. */
function drawBeamAndSection(f, beam, sec, dimText) {
  drawBeam(f, beam);
  const box = bbox(sec);
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const L = beam.L;
  f.byWidth(
    500,
    // A phone: the section under the beam, bigger (beside it, its dimensions ran into each other).
    (g) => {
      const scale = Math.min((0.36 * L) / h, (0.8 * L) / w);
      // (Far enough down that its top dimension clears the beam's dimension chain, two rows of it.)
      drawSection(g, sec, { at: [L / 2 - (box.x0 + w / 2) * scale, -0.7 * L - box.y1 * scale], scale, dimText });

    },
    (g) => {
      const scale = Math.min((0.42 * L) / h, (0.3 * L) / w);
      const x0 = L + 0.5 * L;
      drawSection(g, sec, { at: [x0 - box.x0 * scale, -box.y0 * scale - (h * scale) / 2], scale, dimText });
    },
  );
}


/** The section part of the solution, for a section symmetric about the vertical axis. */
function bendSectionLines(sec, P) {
  const L = sectionLines(sec, P, { x: false });
  L.push(`Razdalji skrajnih vlaken od težiščne osi: e_{zg} = ${num(P.ymax)} − ${num(P.yT)} = ${num(P.eTop)} cm, e_{sp} = ${num(P.yT)} − ${num(P.ymin)} = ${num(P.eBot)} cm.`);
  return L;
}

const symmetric = (P) => Math.abs(P.eTop - P.eBot) < 1e-6 * (P.eTop + P.eBot);

export const upogibNapetost = {
  id: "upogib-napetost",
  group: "trdnost",
  title: "Upogibne napetosti v nosilcu",
  desc: "M_max iz obtežbe, I in W prereza, σ v zgornjem in spodnjem robu",

  generate(r) {
    for (;;) {
      const beam = randomBeam(r);
      const an = analyse(beam);
      if (!an.unique || Math.abs(an.crit.value) < 1) continue;
      const sp = randomBendSection(r);
      const P = sectionProps(bendSection(sp));
      const s = fibreStress(P, an.crit.value);
      const smax = 10 * Math.max(Math.abs(s.top), Math.abs(s.bot));
      if (smax < 1 || smax > 300) continue;
      return { beam, ...sp };
    }
  },

  build(params) {
    const { beam } = params;
    const sec = bendSection(params);
    const P = sectionProps(sec);
    const an = analyse(beam);
    const M = an.crit.value;
    const s = fibreStress(P, M);
    const sym = symmetric(P);
    const W = P.Ix / Math.max(P.eTop, P.eBot);

    const solution = [...momentLines(beam, an), ...bendSectionLines(sec, P)];
    if (sym) solution.push(`Odpornostni moment: W = I/e = ${num(P.Ix)}/${num(P.eTop)} = ${num(W)} cm³.`);
    solution.push(
      "Napetost σ = M·z/I, z merimo navzdol od težiščne osi (zgoraj z = −e_{zg}, spodaj z = +e_{sp}); 1 kNm = 100 kNcm, 1 kN/cm² = 10 MPa.",
      `σ_{zg} = ${num(M * 100)}·(−${num(P.eTop)})/${num(P.Ix)} = ${num(s.top)} kN/cm² = ${num(10 * s.top)} MPa (${s.top > 0 ? "nateg" : "tlak"})`,
      `σ_{sp} = ${num(M * 100)}·${num(P.eBot)}/${num(P.Ix)} = ${num(s.bot)} kN/cm² = ${num(10 * s.bot)} MPa (${s.bot > 0 ? "nateg" : "tlak"})`,
    );
    if (sym) solution.push(`Kontrola: |σ| = |M|/W = ${num(Math.abs(M) * 100)}/${num(W)} = ${num((Math.abs(M) * 100) / W)} kN/cm².`);
    else {
      // A T or U: the moment of the other sign may give a larger stress elsewhere.
      const other = M > 0 ? an.neg : an.pos;
      if (Math.abs(other.value) > 1e-6) {
        const so = fibreStress(P, other.value);
        const tMax = Math.max(s.top, s.bot), cMin = Math.min(s.top, s.bot);
        const tO = Math.max(so.top, so.bot), cO = Math.min(so.top, so.bot);
        if (tO > tMax + 1e-9 || cO < cMin - 1e-9)
          solution.push(
            `Opomba: prerez ni simetričen glede na vodoravno os. Pri x = ${num(other.x)} m je M = ${num(other.value)} kNm (nasproten predznak): tam je σ_{zg} = ${num(10 * so.top)} MPa, σ_{sp} = ${num(10 * so.bot)} MPa — ${tO > tMax + 1e-9 && cO < cMin - 1e-9 ? "večja natezna in večja tlačna" : tO > tMax + 1e-9 ? "večja natezna" : "večja tlačna"} napetost kot pri M_{max}. Pri dimenzioniranju je treba preveriti oba ekstrema M.`,
          );
      }
    }

    return {
      title: this.title,
      text: [
        `${beamText(beam)} Prečni prerez nosilca je na sliki (mere v cm).`,
        `Izračunajte največji upogibni moment M_{max} (največji |M|, s predznakom; M > 0 pomeni nateg spodaj) in mesto x, kjer nastopi (od levega konca), vztrajnostni moment I prereza glede na vodoravno težiščno os, ${sym ? "odpornostni moment W" : "lego težišča y_T (od spodnjega roba prereza)"} ter normalni napetosti v zgornjem in spodnjem robu prereza na mestu M_{max} (v MPa, nateg +, tlak −).`,
      ],
      figure(f) {
        drawBeamAndSection(f, beam, sec);
      },
      answers: [
        ans("M", "M_{max}", "kNm", M),
        ans("x", "x", "m", an.crit.x, { tol: 0.1, note: "od levega konca" }),
        sym ? ans("W", "W", "cm³", W) : ans("yT", "y_T", "cm", P.yT - P.ymin, { note: "od spodnjega roba" }),
        ans("I", "I", "cm⁴", P.Ix),
        ans("st", "σ_{zg}", "MPa", 10 * s.top),
        ans("sb", "σ_{sp}", "MPa", 10 * s.bot),
      ],
      solution,
      solutionFigure(f) {
        drawBeam(f, beam, { dims: false });
        // A phone has the height to spare: the diagram further down and taller.
        f.byWidth(
          500,
          (g) => drawMoment(g, beam, an, { y0: -0.65 * beam.L, height: 0.3 * beam.L }),
          (g) => drawMoment(g, beam, an, { y0: -0.3 * beam.L, height: 0.16 * beam.L }),
        );
      },
    };
  },
};

// ------------------------------------------------------------ dimensioning

/** W of a tube (any consistent unit): π(D⁴ − d⁴)/(32D). */
export const tubeW = (D, t) => (Math.PI * (D ** 4 - (D - 2 * t) ** 4)) / (32 * D);

/** Smallest D with tubeW(D, t) ≥ W (bisection; W grows with D). */
export function tubeDiameter(W, t) {
  let lo = 2 * t, hi = 2 * t + 10;
  while (tubeW(hi, t) < W) hi *= 2;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (tubeW(mid, t) < W) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const xName = (k) => (k === 1 ? "x" : `${k}x`);

/** A beam with loads given as multiples of F (for "the largest F"). */
function randomFBeam(r) {
  const kind = r.pick(["simple", "overhang", "cantilever", "cantilever"]);
  const beam = { kind, loads: [] };
  if (kind === "simple") beam.L = beam.s = r.step(2, 6, 0.5);
  else if (kind === "overhang") {
    beam.s = r.step(2, 5, 0.5);
    beam.L = round(beam.s + r.step(1, 2.5, 0.5));
  } else {
    beam.L = r.step(1, 3.5, 0.5);
    beam.clamp = r.pick(["left", "right"]);
  }
  const L = beam.L;
  const end = kind === "cantilever" ? (beam.clamp === "left" ? L : 0) : kind === "overhang" ? L : r.step(0.5, L - 0.5, 0.5);
  beam.loads.push({ t: "F", x: end, F: 1, name: "F" });
  if (r.chance(0.4)) {
    const x = kind === "cantilever" ? r.step(0.5, L - 0.5, 0.5) : r.step(0.5, kind === "overhang" ? beam.s - 0.5 : L - 0.5, 0.5);
    if (Math.abs(x - end) > 1e-9) beam.loads.push({ t: "F", x, F: 2, name: "2F" });
  }
  return crowded(beam) ? randomFBeam(r) : beam;
}

export const upogibDimenzioniranje = {
  id: "upogib-dimenzioniranje",
  group: "trdnost",
  title: "Dimenzioniranje nosilca na upogib",
  desc: "σ_max = M_max/W ≤ σ_dop: mere prereza ali največja dovoljena sila",

  generate(r) {
    const variant = r.pick(["rect", "rect", "tube", "Fmax", "Fmax"]);
    if (variant === "rect") {
      for (;;) {
        const beam = randomBeam(r, { couples: true });
        if (Math.abs(analyse(beam).crit.value) < 2) continue;
        const k = r.pick([[3, 5], [2, 3], [1, 2], [2, 5], [3, 4], [1, 3]]);
        const unit = r.pick(["kN/cm²", "MPa"]);
        const sdop = unit === "MPa" ? r.step(8, 14, 1) : r.pick([0.8, 0.9, 1, 1.1, 1.2, 1.4]);
        return { variant, beam, k, sdop, unit };
      }
    }
    if (variant === "tube") {
      for (;;) {
        const beam = randomBeam(r, { scale: 0.25, couples: false });
        const M = Math.abs(analyse(beam).crit.value);
        const t = r.int(2, 5), sdop = r.step(120, 240, 20);
        const D = tubeDiameter((M * 1e6) / sdop, t); // mm
        if (M >= 0.3 && D >= 30 && D <= 220 && D > 6 * t) return { variant, beam, t, sdop };
      }
    }
    for (;;) {
      const beam = randomFBeam(r);
      const kind = r.pick(["tube", "rect", "I"]);
      let shape, sdop;
      if (kind === "tube") {
        const D = r.pick([42, 48, 60, 68, 76, 89, 108]);
        shape = { shape: "tube", a: [D, r.int(3, 5)] };
        sdop = r.step(120, 240, 20);
      } else if (kind === "rect") {
        const b = r.pick([8, 10, 12, 14, 16]);
        shape = { shape: "rect", a: [b, b + r.int(4, 16)] };
        sdop = r.step(8, 14, 1);
      } else {
        const tw = r.int(1, 2);
        shape = { shape: "I", a: [tw + 2 * r.int(3, 7), r.int(1, 2), tw, r.int(10, 24)] };
        sdop = r.step(120, 240, 20);
      }
      const p = { variant, beam, ...shape, sdop };
      const F = this.build(p).answers.at(-1);
      if (F.value > 0) return p;
    }
  },

  build(params) {
    const { variant, beam } = params;
    const an = analyse(beam);
    const solution = [];
    let text, answers, sec, dimText;

    if (variant === "rect") {
      const { k, sdop, unit } = params;
      const s = unit === "MPa" ? sdop / 10 : sdop; // kN/cm²
      const M = Math.abs(an.crit.value);
      const Wreq = (M * 100) / s;
      const c = (k[0] * k[1] ** 2) / 6; // W = c·x³
      const x = Math.cbrt(Wreq / c);
      sec = SHAPES.rect(k[0], k[1]);
      dimText = [xName(k[0]), xName(k[1])];
      text = [
        `${beamText(beam)} Nosilec ima pravokotni prerez širine b = ${xName(k[0])} in višine h = ${xName(k[1])}; dopustna napetost je σ_{dop} = ${q(sdop, unit)}.`,
        "Določite največji upogibni moment |M|_{max}, potrebni odpornostni moment W_{potr} in mero x (v cm), da napetosti ne presežejo σ_{dop}.",
      ];
      answers = [ans("M", "|M|_{max}", "kNm", M), ans("W", "W_{potr}", "cm³", Wreq), ans("x", "x", "cm", x)];
      solution.push(
        ...momentLines(beam, an),
        `σ_{max} = |M|_{max}/W ≤ σ_{dop} → W_{potr} = |M|_{max}/σ_{dop} = ${num(M * 100)} kNcm / ${num(s)} kN/cm² = ${num(Wreq)} cm³${unit === "MPa" ? ` (σ_{dop} = ${num(sdop)} MPa = ${num(s)} kN/cm²)` : ""}`,
        `W = b·h²/6 = ${xName(k[0])}·(${xName(k[1])})²/6 = ${num(c)}·x³`,
        `x = ∛(W_{potr}/${num(c)}) = ∛(${num(Wreq / c)}) = ${num(x)} cm`,
        `Prerez: b = ${num(k[0] * x)} cm, h = ${num(k[1] * x)} cm — v praksi zaokrožimo navzgor (npr. ${Math.ceil(k[0] * x)} × ${Math.ceil(k[1] * x)} cm).`,
      );
    } else if (variant === "tube") {
      const { t, sdop } = params;
      const M = Math.abs(an.crit.value);
      const Wreq = (M * 1e6) / sdop; // mm³
      const D = tubeDiameter(Wreq, t);
      sec = SHAPES.tube(10, 1);
      dimText = ["D = ?", `t = ${t} mm`];
      text = [
        `${beamText(beam)} Nosilec je jeklena cev z debelino stene t = ${q(t, "mm")}; dopustna napetost je σ_{dop} = ${q(sdop, "N/mm²")}.`,
        "Določite največji upogibni moment |M|_{max}, potrebni odpornostni moment W_{potr} in najmanjši zunanji premer cevi D (v mm).",
      ];
      answers = [ans("M", "|M|_{max}", "kNm", M), ans("W", "W_{potr}", "cm³", Wreq / 1000), ans("D", "D", "mm", D)];
      solution.push(
        ...momentLines(beam, an),
        `W_{potr} = |M|_{max}/σ_{dop} = ${num(M * 1e6)} Nmm / ${num(sdop)} N/mm² = ${num(Wreq)} mm³ = ${num(Wreq / 1000)} cm³`,
        `Cev: W = π(D⁴ − d⁴)/(32D), d = D − 2t = D − ${2 * t} mm. Enačbo π(D⁴ − (D − ${2 * t})⁴)/(32D) = ${num(Wreq)} rešimo numerično (poskušanje / bisekcija):`,
        `D = ${num(D)} mm (kontrola: W(${num(D)}) = ${num(tubeW(D, t))} mm³) → izberemo prvo večjo standardno cev.`,
      );
    } else {
      const { sdop } = params;
      const mm = params.shape === "tube";
      const secCm = mm ? SHAPES.tube(params.a[0] / 10, params.a[1] / 10) : bendSection(params);
      sec = secCm;
      if (mm) dimText = [`D = ${params.a[0]} mm`, `t = ${params.a[1]} mm`];
      const P = sectionProps(secCm);
      const W = P.Ix / Math.max(P.eTop, P.eBot);
      const s = sdop / 10; // kN/cm²
      const Mdop = (s * W) / 100; // kNm
      const m = Math.abs(an.crit.value); // |M|max per 1 kN of F
      const F = Mdop / m; // kN
      const inN = F < 5;
      const what = mm ? `Nosilec je jeklena cev D = ${params.a[0]} mm, t = ${params.a[1]} mm` : "Prečni prerez nosilca je na sliki (mere v cm)";
      text = [
        `${beamText(beam)} ${what}; dopustna napetost σ_{dop} = ${q(sdop, "N/mm²")}.`,
        "Določite odpornostni moment prereza W, največji dopustni upogibni moment M_{dop} in največjo silo F, ki jo nosilec še prenese.",
      ];
      answers = [ans("W", "W", "cm³", W), ans("Mdop", "M_{dop}", "kNm", Mdop), ans("F", "F_{max}", inN ? "N" : "kN", inN ? F * 1000 : F)];
      solution.push(
        `Moment je sorazmeren s F; z F = 1 kN dobimo reakcije ${an.sol.reactions.map((x) => `${x.name}_y = ${num(x.Ry)}·F${x.type === "fixed" ? `, M_${x.name} = ${num(x.M)}·F [kNm] (pozitiven v nasprotni smeri urinega kazalca)` : ""}`).join(", ")} in največji |M| = ${num(m)}·F [kNm] pri x = ${num(an.crit.x)} m.`,
      );
      if (mm) solution.push(`I = π(D⁴ − d⁴)/64 = π(${params.a[0]}⁴ − ${params.a[0] - 2 * params.a[1]}⁴)/64 = ${num(P.Ix * 1e4)} mm⁴ = ${num(P.Ix)} cm⁴`, `W = I/(D/2) = ${num(W)} cm³ = ${num(W * 1000)} mm³`);
      else solution.push(...bendSectionLines(secCm, P), `W = I/e_{max} = ${num(P.Ix)}/${num(Math.max(P.eTop, P.eBot))} = ${num(W)} cm³`);
      solution.push(
        `M_{dop} = σ_{dop}·W = ${num(s)} kN/cm² · ${num(W)} cm³ = ${num(Mdop * 100)} kNcm = ${num(Mdop)} kNm`,
        `${num(m)}·F ≤ M_{dop} → F_{max} = ${num(Mdop)}/${num(m)} = ${num(F)} kN${inN ? ` = ${num(F * 1000)} N` : ""}`,
      );
    }

    return {
      title: this.title,
      text,
      figure(f) {
        drawBeamAndSection(f, beam, sec, dimText);
      },
      answers,
      solution,
      solutionFigure(f) {
        drawBeam(f, beam, { dims: false });
        const perF = variant === "Fmax";
        const opts = perF ? { fmt: (v) => `${num(v)}·F`, title: "M [kNm], F v kN" } : {};
        // A phone has the height to spare: the diagram further down and taller.
        f.byWidth(
          500,
          (g) => drawMoment(g, beam, an, { y0: -0.65 * beam.L, height: 0.3 * beam.L, ...opts }),
          (g) => drawMoment(g, beam, an, { y0: -0.3 * beam.L, height: 0.16 * beam.L, ...opts }),
        );

      },
    };
  },
};
