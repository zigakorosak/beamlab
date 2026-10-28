// Uklon tlačenih palic (Euler / Tetmajer), three exam types:
//   nosilnost  given column (length, supports, section): I_min, i, λ,
//              F_cr and F_dop = F_cr/ν
//   dolzina    given section and load: the largest allowed length
//   premer     solid round steel column: the required diameter (assume
//              Euler, check λ, else redo with Tetmajer)
// L_eff = β·L (β = 1 členek–členek, 2 vpeto–prosto, 0,7 vpeto–členek,
// 0,5 vpeto–vpeto), i = √(I_min/A), λ = L_eff/i.
// Steel: E = 210 GPa, Euler for λ ≥ 105, Tetmajer σ_K = 310 − 1,14λ MPa
// for 60 ≤ λ < 105. Timber: E = 10 GPa, Euler for λ ≥ 100, Tetmajer
// σ_K = 29,3 − 0,194λ MPa. Working units: kN, cm, kN/cm² (×10 = MPa).

import { ans, num, q } from "../kit.js";
import { guide, section } from "./figs.js";

export const MATERIALS = {
  jeklo: { name: "jeklo", E: 21000, lamE: 105, lamLo: 60, a: 310, b: 1.14 },
  les: { name: "les", E: 1000, lamE: 100, lamLo: 30, a: 29.3, b: 0.194 },
};

export const CASES = {
  1: "spodaj in zgoraj členkasto podprt (zgornja podpora je pomična v navpični smeri)",
  2: "spodaj vpet, zgoraj prost",
  0.7: "spodaj vpet, zgoraj členkasto podprt (pomičen v navpični smeri)",
  0.5: "spodaj vpet, zgoraj vpet z vodilom (pomik v navpični smeri je prost, zasuk ni mogoč)",
};
const BETA = [1, 2, 0.7, 0.5];

/** A, I_min [cm², cm⁴] of a section (dims in cm), with a line for the solution. */
export function props(sec) {
  if (sec.kind === "rect") {
    const lo = Math.min(sec.b, sec.h), hi = Math.max(sec.b, sec.h);
    return { A: sec.b * sec.h, I: (hi * lo ** 3) / 12, how: `A = b·h = ${num(sec.b * sec.h)} cm², I_{min} = ${num(hi)}·${num(lo)}³/12` };
  }
  if (sec.kind === "circle") return { A: (Math.PI * sec.d ** 2) / 4, I: (Math.PI * sec.d ** 4) / 64, how: `A = πd²/4 = ${num((Math.PI * sec.d ** 2) / 4)} cm², I = πd⁴/64` };
  if (sec.kind === "tube") {
    const d = sec.D - 2 * sec.t;
    return {
      A: (Math.PI * (sec.D ** 2 - d ** 2)) / 4,
      I: (Math.PI * (sec.D ** 4 - d ** 4)) / 64,
      how: `d = D − 2t = ${num(d)} cm, A = π(D² − d²)/4 = ${num((Math.PI * (sec.D ** 2 - d ** 2)) / 4)} cm², I = π(D⁴ − d⁴)/64`,
    };
  }
  // Symmetric I: the weak axis is the web's axis.
  const { B, H, tf, tw } = sec;
  const hw = H - 2 * tf;
  const A = 2 * B * tf + hw * tw;
  const Iz = (2 * tf * B ** 3) / 12 + (hw * tw ** 3) / 12;
  const Iy = (B * H ** 3 - (B - tw) * hw ** 3) / 12;
  return {
    A,
    I: Math.min(Iz, Iy),
    Iy,
    Iz,
    how: `A = 2·B·t_f + h_w·t_w = ${num(A)} cm² (h_w = ${num(hw)} cm); močna os I_y = (BH³ − (B − t_w)h_w³)/12 = ${num(Iy)} cm⁴, šibka os I_z = 2·t_f B³/12 + h_w t_w³/12`,
  };
}

/** F_cr [kN] of a column: { lam, Fcr, euler, sigma [kN/cm²] }. */
export function critical(mat, A, I, Leff) {
  const i = Math.sqrt(I / A);
  const lam = Leff / i;
  if (lam >= mat.lamE) {
    const Fcr = (Math.PI ** 2 * mat.E * I) / Leff ** 2;
    return { i, lam, Fcr, euler: true, sigma: Fcr / A };
  }
  const sigma = (mat.a - mat.b * lam) / 10;
  return { i, lam, Fcr: sigma * A, euler: false, sigma };
}

const secText = (s) =>
  s.kind === "rect"
    ? `pravokotnega prereza b × h = ${num(s.b)} cm × ${num(s.h)} cm`
    : s.kind === "circle"
      ? `polnega krožnega prereza s premerom d = ${num(s.d)} cm`
      : s.kind === "tube"
        ? `cevnega prereza z zunanjim premerom D = ${num(s.D)} cm in debelino stene t = ${num(s.t)} cm`
        : `I-prereza (višina H = ${num(s.H)} cm, pasnici B × t_f = ${num(s.B)} × ${num(s.tf)} cm, stojina t_w = ${num(s.tw)} cm; zaokrožitve zanemarite)`;

const matText = (m) =>
  m.name === "jeklo"
    ? "Material je jeklo: E = 210 GPa; za λ ≥ 105 velja Eulerjeva enačba, za 60 ≤ λ < 105 Tetmajerjeva σ_K = 310 − 1,14·λ (MPa)."
    : "Material je les: E = 10 GPa; za λ ≥ 100 velja Eulerjeva enačba, za λ < 100 Tetmajerjeva σ_K = 29,3 − 0,194·λ (MPa).";

/** Round to a "nice" exam value: 2 significant digits, last one 0 or 5. */
function nice(v) {
  const e = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.max(e * 5, Math.round(v / (5 * e)) * 5 * e);
}

function randomSection(r, mat) {
  if (mat.name === "les") {
    const b = r.step(8, 20, 2);
    return { kind: "rect", b, h: b + r.step(0, 10, 2) };
  }
  const k = r.pick(["rect", "circle", "tube", "tube", "I", "I"]);
  if (k === "rect") {
    const b = r.step(3, 10, 1);
    return { kind: "rect", b, h: b + r.step(0, 8, 1) };
  }
  if (k === "circle") return { kind: "circle", d: r.step(3, 14, 1) };
  if (k === "tube") return { kind: "tube", D: r.step(5, 20, 1), t: r.step(0.3, 1, 0.1) };
  const H = r.step(10, 30, 2);
  return { kind: "I", H, B: Math.max(6, Math.round(H * r.pick([0.5, 0.6, 0.8, 1]))), tf: r.step(0.8, 1.6, 0.1), tw: r.step(0.5, 1, 0.1) };
}

const awayFromBorder = (mat, lam) => Math.abs(lam - mat.lamE) >= 4 && lam >= mat.lamLo + 2 && lam <= 250;

export const uklon = {
  id: "uklon",
  group: "trdnost",
  title: "Uklon tlačene palice",
  desc: "Euler / Tetmajer: L_eff = βL, i, λ, F_cr, F_dop; največja dolžina ali potrebni premer",

  generate(r) {
    const kind = r.pick(["nosilnost", "nosilnost", "dolzina", "premer"]);
    for (;;) {
      const beta = r.pick(BETA);
      const nu = r.pick([2, 2.5, 3, 3.5]);
      if (kind === "premer") {
        const p = { kind, mat: "jeklo", beta, nu, L: r.step(1, 6, 0.5), F: nice(10 ** (1 + r.next() * 2.3)) };
        const x = solveDiameter(p);
        if (x && awayFromBorder(MATERIALS.jeklo, x.lam) && x.d >= 1.5 && x.d <= 30) return p;
        continue;
      }
      const mat = r.chance(0.25) ? "les" : "jeklo";
      const sec = randomSection(r, MATERIALS[mat]);
      if (sec.kind === "tube" && sec.D / sec.t < 8) continue;
      if (sec.kind === "I" && (sec.B < 3 * sec.tw || sec.H < 6 * sec.tf)) continue;
      if (kind === "nosilnost") {
        const p = { kind, mat, sec, beta, nu, L: r.step(1, 8, 0.5) };
        const { A, I } = props(sec);
        const c = critical(MATERIALS[mat], A, I, beta * p.L * 100);
        if (awayFromBorder(MATERIALS[mat], c.lam)) return p;
        continue;
      }
      const { A } = props(sec);
      const m = MATERIALS[mat];
      const Fy = (A * m.a) / 10 / nu; // kN at λ = 0
      const F = nice(Fy * 10 ** (-0.2 - r.next() * 1.4));
      const p = { kind, mat, sec, beta, nu, F };
      const x = solveLength(p);
      if (x && awayFromBorder(m, x.lam) && x.L >= 0.5 && x.L <= 15) return p;
    }
  },

  build(p) {
    if (p.kind === "nosilnost") return buildCapacity(p);
    if (p.kind === "dolzina") return buildLength(p);
    return buildDiameter(p);
  },
};

/** Largest length for a given section and load (null: λ would be below the Tetmajer range). */
export function solveLength({ mat: mk, sec, beta, nu, F }) {
  const mat = MATERIALS[mk];
  const { A, I } = props(sec);
  const i = Math.sqrt(I / A);
  const need = nu * F;
  const LeffE = Math.PI * Math.sqrt((mat.E * I) / need);
  const lamE = LeffE / i;
  if (lamE >= mat.lamE) return { A, I, i, need, LeffE, lamE, euler: true, lam: lamE, Leff: LeffE, L: LeffE / beta / 100 };
  const sigma = (need / A) * 10; // MPa
  const lam = (mat.a - sigma) / mat.b;
  if (lam < mat.lamLo) return null;
  const Leff = lam * i;
  return { A, I, i, need, LeffE, lamE, euler: false, sigma, lam, Leff, L: Leff / beta / 100 };
}

/** Required diameter of a solid round steel column [cm]. */
export function solveDiameter({ beta, nu, L, F }) {
  const mat = MATERIALS.jeklo;
  const Le = beta * L * 100;
  const need = nu * F;
  const IE = (need * Le ** 2) / (Math.PI ** 2 * mat.E);
  const dE = ((64 * IE) / Math.PI) ** 0.25;
  const lamE = (4 * Le) / dE;
  if (lamE >= mat.lamE) return { Le, need, IE, dE, lamE, euler: true, d: dE, lam: lamE };
  // Tetmajer: (a − bλ)/10·πd²/4 = νF with λ = 4L_eff/d → a d² − 4b L_eff d − 40νF/π = 0
  const a = mat.a, b4 = 4 * mat.b * Le, c = (40 * need) / Math.PI;
  const d = (b4 + Math.sqrt(b4 ** 2 + 4 * a * c)) / (2 * a);
  const lam = (4 * Le) / d;
  if (lam < mat.lamLo) return null;
  return { Le, need, IE, dE, lamE, euler: false, d, lam, c };
}

function columnFigure(f, p, L = 1) {
  // Column drawn 3 world units tall, whatever its length.
  const Hc = 3;
  f.member([0, 0], [0, Hc]);
  const top = [0, Hc];
  if (p.beta === 1) {
    f.pin([0, 0], 90);
    f.roller(top, 180);
  } else if (p.beta === 2) {
    f.fixed([0, 0], 90);
  } else if (p.beta === 0.7) {
    f.fixed([0, 0], 90);
    f.roller(top, 180);
  } else {
    f.fixed([0, 0], 90);
    guide(f, [0, Hc - 0.35], 0.02);
  }
  f.force(top, -90, { label: p.F ? `F = ${q(p.F, "kN")}` : "F", len: 46, labelSide: -1 });
  f.dim([0, 0], top, typeof L === "number" ? `L = ${q(L, "m")}` : L, -56);
  if (p.sec) {
    const sec = p.sec;
    const big = sec.kind === "rect" ? Math.max(sec.b, sec.h) : sec.kind === "circle" ? sec.d : sec.kind === "tube" ? sec.D : Math.max(sec.H, sec.B);
    const k = 1.15 / big;
    section(f, sec, [2.1, Hc * 0.55], k, { axis: false });
  } else {
    f.circle([1.9, Hc * 0.55], 0.45);
    f.dim([1.45, Hc * 0.55], [2.35, Hc * 0.55], "d = ?", 0);
  }
}

function buildCapacity(p) {
  const mat = MATERIALS[p.mat];
  const { A, I, how } = props(p.sec);
  const Leff = p.beta * p.L * 100;
  const c = critical(mat, A, I, Leff);
  const Fdop = c.Fcr / p.nu;
  return {
    title: uklon.title,
    text: [
      `Steber dolžine L = ${q(p.L, "m")} je ${CASES[p.beta]}. Narejen je iz ${secText(p.sec)}.`,
      `${matText(mat)} Zahtevani varnostni faktor proti uklonu je ν = ${num(p.nu)}.`,
      "Izračunajte najmanjši vztrajnostni moment prereza, vztrajnostni polmer, vitkost, kritično silo in dopustno tlačno silo stebra.",
    ],
    figure(f) {
      columnFigure(f, p, p.L);
    },
    answers: [
      ans("I", "I_{min}", "cm⁴", I),
      ans("i", "i_{min}", "cm", c.i),
      ans("lam", "λ", "", c.lam),
      ans("Fcr", "F_{cr}", "kN", c.Fcr),
      ans("Fdop", "F_{dop}", "kN", Fdop),
    ],
    solution: [
      `Uklonska dolžina: β = ${num(p.beta)} → L_{eff} = βL = ${num(p.beta)}·${num(p.L * 100)} cm = ${num(Leff)} cm.`,
      `Prerez: ${how} = ${num(I)} cm⁴ (uklon okoli šibkejše osi).`,
      `i = √(I_{min}/A) = √(${num(I)}/${num(A)}) = ${num(c.i)} cm.`,
      `λ = L_{eff}/i = ${num(Leff)}/${num(c.i)} = ${num(c.lam)}.`,
      c.euler
        ? `λ ≥ ${mat.lamE} → elastični uklon (Euler): F_{cr} = π²EI_{min}/L_{eff}² = π²·${mat.E}·${num(I)}/${num(Leff)}² = ${num(c.Fcr)} kN (σ_{cr} = ${num(c.sigma * 10)} MPa).`
        : `λ < ${mat.lamE} → Tetmajer: σ_K = ${num(mat.a)} − ${num(mat.b)}·${num(c.lam)} = ${num(c.sigma * 10)} MPa = ${num(c.sigma)} kN/cm²; F_{cr} = σ_K·A = ${num(c.sigma)}·${num(A)} = ${num(c.Fcr)} kN.`,
      `F_{dop} = F_{cr}/ν = ${num(c.Fcr)}/${num(p.nu)} = ${num(Fdop)} kN.`,
    ],
  };
}

function buildLength(p) {
  const mat = MATERIALS[p.mat];
  const x = solveLength(p);
  const { how } = props(p.sec);
  return {
    title: uklon.title,
    text: [
      `Steber iz ${secText(p.sec)} je ${CASES[p.beta]} in obremenjen s tlačno silo F = ${q(p.F, "kN")}.`,
      `${matText(mat)} Zahtevani varnostni faktor proti uklonu je ν = ${num(p.nu)}.`,
      "Izračunajte vztrajnostni polmer, vitkost pri največji dovoljeni dolžini in največjo dovoljeno dolžino stebra L_{max}.",
    ],
    figure(f) {
      columnFigure(f, p, "L = ?");
    },
    answers: [
      ans("i", "i_{min}", "cm", x.i),
      ans("lam", "λ", "", x.lam),
      ans("L", "L_{max}", "m", x.L),
    ],
    solution: [
      `Prerez: ${how} = ${num(x.I)} cm⁴; i = √(I_{min}/A) = ${num(x.i)} cm.`,
      `Zahtevana kritična sila: F_{cr} = ν·F = ${num(p.nu)}·${num(p.F)} = ${num(x.need)} kN.`,
      `1. predpostavka — Euler: L_{eff} = π√(EI_{min}/F_{cr}) = π√(${mat.E}·${num(x.I)}/${num(x.need)}) = ${num(x.LeffE)} cm → λ = ${num(x.LeffE)}/${num(x.i)} = ${num(x.lamE)}.`,
      x.euler
        ? `λ = ${num(x.lamE)} ≥ ${mat.lamE}: predpostavka drži, velja Euler.`
        : `λ = ${num(x.lamE)} < ${mat.lamE}: Euler ne velja, računamo s Tetmajerjem: σ_K = F_{cr}/A = ${num(x.need)}/${num(x.A)} kN/cm² = ${num(x.sigma)} MPa; λ = (${num(mat.a)} − σ_K)/${num(mat.b)} = ${num(x.lam)} (v območju Tetmajerja).`,
      `L_{eff} = λ·i = ${num(x.Leff)} cm; β = ${num(p.beta)} → L_{max} = L_{eff}/β = ${num(x.Leff / p.beta)} cm = ${num(x.L)} m.`,
    ],
  };
}

function buildDiameter(p) {
  const mat = MATERIALS.jeklo;
  const x = solveDiameter(p);
  const Le = x.Le;
  return {
    title: uklon.title,
    text: [
      `Jeklen steber polnega krožnega prereza dolžine L = ${q(p.L, "m")} je ${CASES[p.beta]} in obremenjen s tlačno silo F = ${q(p.F, "kN")}.`,
      `${matText(mat)} Zahtevani varnostni faktor proti uklonu je ν = ${num(p.nu)}.`,
      "Določite potrebni premer d stebra (izračunana vrednost) in pripadajočo vitkost λ.",
    ],
    figure(f) {
      columnFigure(f, p, p.L);
    },
    answers: [ans("d", "d", "mm", x.d * 10), ans("lam", "λ", "", x.lam)],
    solution: [
      `L_{eff} = βL = ${num(p.beta)}·${num(p.L * 100)} = ${num(Le)} cm; potrebna kritična sila F_{cr} = νF = ${num(x.need)} kN.`,
      "Krog: I = πd⁴/64, A = πd²/4, i = d/4, λ = 4L_{eff}/d.",
      `1. predpostavka — Euler: I_{potr} = F_{cr}L_{eff}²/(π²E) = ${num(x.IE)} cm⁴ → d = ∜(64I/π) = ${num(x.dE)} cm; λ = 4·${num(Le)}/${num(x.dE)} = ${num(x.lamE)}.`,
      x.euler
        ? `λ ≥ 105: Euler velja, d = ${num(x.d)} cm = ${num(x.d * 10)} mm.`
        : `λ < 105: Euler ne velja (premer bi bil premajhen). Ponovimo s Tetmajerjem: (310 − 1,14·4L_{eff}/d)/10 · πd²/4 = F_{cr} → 31d² − 0,456·L_{eff}·d − 4F_{cr}/π = 0.`,
      ...(x.euler
        ? []
        : [
            `31d² − ${num(0.456 * Le)}·d − ${num(x.c / 10)} = 0 → d = ${num(x.d)} cm = ${num(x.d * 10)} mm (pozitivna rešitev; enako dobimo z iteracijo: izberemo d, izračunamo λ in σ_K, popravimo d = √(4F_{cr}/(πσ_K)) in ponavljamo).`,
            `Kontrola: λ = 4·${num(Le)}/${num(x.d)} = ${num(x.lam)} — v območju Tetmajerja (60 ≤ λ < 105).`,
          ]),
    ],
  };
}
