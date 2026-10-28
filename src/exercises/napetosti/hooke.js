// Osno obremenjene palice, Hookov zakon (notes §10, "statično nedoločen
// sistem palic/cevi"): equilibrium + compatibility + ΔL = N·L/(E·A) + α_T·ΔT·L.
//   stopnicasta  a stepped bar clamped at one end, forces at the step and
//                at the free end: N, σ in both parts and the total ΔL
//                (statically determinate).
//   vpeta        the stepped bar clamped at both ends, a force at the step
//                and maybe heating ΔT: ΔL1 + ΔL2 = 0 (statically indeterminate).
//   cev          a steel rod inside an aluminium tube under a rigid plate:
//                a force F (maybe the rod shorter by a gap δ) or heating ΔT.
// Units inside: kN, cm, kN/cm² (E = 21000 kN/cm² = 210 GPa); answers in
// kN, MPa (1 kN/cm² = 10 MPa) and mm.

import { ans, num, q } from "../kit.js";

const STEEL = { E: 21000, a: 1.2e-5, name: "jeklo" };
const ALU = { E: 7000, a: 2.3e-5, name: "aluminij" };
const GPa = (E) => num(E / 100); // kN/cm² → GPa
const sci = (a) => `${num(a * 1e5)}·10^{−5} K^{−1}`;

/** Bar drawn on the x axis from x0 to x1 with height h (world). */
const seg = (f, x0, x1, h) => f.rect(x0, -h / 2, x1 - x0, h);

/**
 * Axial force F (signed, + = to the right) at x on the axis. At the free
 * end the arrow is outside the bar with its text above; at the step it lies
 * on the axis inside the bar and its text goes above the bar (top).
 */
function axial(f, x, F, label, top = null) {
  if (top === null) {
    if (F < 0) f.force([x, 0], 180, { len: 44, label, labelSide: -1 });
    else f.force([x, 0], 0, { tail: true, len: 44, label });
    return;
  }
  f.force([x, 0], F > 0 ? 0 : 180, { tail: true, len: 44 });
  f.label([x, top], label, { dy: -6 });
}

export const hookePalice = {
  id: "hooke-palice",
  group: "trdnost",
  title: "Osno obremenjene palice (Hooke)",
  desc: "Stopničasta palica, obojestransko vpeta palica, palica v cevi; ΔT, reža δ",

  generate(r) {
    for (;;) {
      const kind = r.pick(["stopnicasta", "vpeta", "vpeta", "cev", "cev"]);
      if (kind === "stopnicasta" || kind === "vpeta") {
        const A1 = r.step(2, 20, 1), A2 = r.step(2, 20, 1);
        if (A1 === A2) continue;
        const L1 = r.step(0.5, 2, 0.5), L2 = r.step(0.5, 2, 0.5);
        if (kind === "stopnicasta") {
          const F1 = r.pick([-1, 1]) * r.step(5, 60, 5), F2 = r.pick([-1, 1]) * r.step(5, 60, 5);
          if (Math.abs(F1 + F2) < 5) continue;
          return { kind, A1, A2, L1, L2, F1, F2 };
        }
        const F = r.pick([-1, 1]) * r.step(10, 100, 10);
        const dT = r.chance(0.5) ? r.step(10, 40, 5) : 0;
        const t = vpeta({ A1, A2, L1, L2, F, dT });
        if (Math.abs(t.N1) < 3 || Math.abs(t.N2) < 3) continue;
        return { kind, A1, A2, L1, L2, F, dT };
      }
      const As = r.step(2, 10, 1), Aa = r.step(4, 20, 1), L = r.step(0.5, 2, 0.5);
      const mode = r.pick(["F", "F", "gap", "dT"]);
      if (mode === "dT") return { kind, As, Aa, L, F: 0, delta: 0, dT: r.step(20, 80, 10) };
      const F = r.step(20, 200, 10);
      if (mode === "F") return { kind, As, Aa, L, F, delta: 0, dT: 0 };
      const delta = r.step(0.05, 0.4, 0.05);
      const ka = (ALU.E * Aa) / (L * 100);
      // The plate must reach the rod (and not just barely).
      if (F < 1.3 * ka * (delta / 10)) continue;
      return { kind, As, Aa, L, F, delta, dT: 0 };
    }
  },

  build(p) {
    if (p.kind === "stopnicasta") return stepped.call(this, p);
    if (p.kind === "vpeta") return clamped.call(this, p);
    return tube.call(this, p);
  },
};

function figureBar(f, { A1, A2, L1, L2 }, walls) {
  const Am = Math.max(A1, A2);
  const h1 = 0.36 * Math.sqrt(A1 / Am), h2 = 0.36 * Math.sqrt(A2 / Am);
  const Lt = L1 + L2, H = 0.3;
  seg(f, 0, L1, h1);
  seg(f, L1, Lt, h2);
  f.dashed([-0.1, 0], [Lt + (walls === 2 ? 0.1 : 0), 0]);
  f.ground([0, H], [0, -H]);
  if (walls === 2) f.ground([Lt, -H], [Lt, H]);
  f.label([L1 / 2, -h1 / 2], `A_1 = ${num(A1)} cm²`, { dy: 14 });
  f.label([L1 + L2 / 2, -h2 / 2], `A_2 = ${num(A2)} cm²`, { dy: 14 });
  f.dim([0, -H], [L1, -H], `L_1 = ${num(L1)} m`, 18);
  f.dim([L1, -H], [Lt, -H], `L_2 = ${num(L2)} m`, 18);
  return { Lt, H, top: Math.max(h1, h2) / 2 };
}

function stepped({ A1, A2, L1, L2, F1, F2 }) {
  const E = STEEL.E;
  const N2 = F2, N1 = F1 + F2;
  const d1 = (N1 * L1 * 100) / (E * A1) * 10, d2 = (N2 * L2 * 100) / (E * A2) * 10; // mm
  const dL = d1 + d2;
  const dir = (F) => (F > 0 ? "v desno (stran od stene)" : "v levo (proti steni)");
  return {
    title: hookePalice.title,
    text: [
      `Jeklena stopničasta palica (E = 210 GPa) je na levem koncu vpeta v steno. Na stiku obeh delov deluje osna sila F_1 = ${q(Math.abs(F1), "kN")} ${dir(F1)}, na prostem koncu pa F_2 = ${q(Math.abs(F2), "kN")} ${dir(F2)}.`,
      "Izračunajte osni sili N_1, N_2 in normalni napetosti σ_1, σ_2 v obeh delih (nateg +, tlak −) ter spremembo dolžine palice ΔL (podaljšek +, skrček −).",
    ],
    figure(f) {
      const { Lt, top } = figureBar(f, { A1, A2, L1, L2 }, 1);
      axial(f, L1, F1, "F_1", top); // values in the text
      axial(f, Lt, F2, "F_2");
    },
    answers: [
      ans("N1", "N_1", "kN", N1),
      ans("N2", "N_2", "kN", N2),
      ans("s1", "σ_1", "MPa", (N1 / A1) * 10),
      ans("s2", "σ_2", "MPa", (N2 / A2) * 10),
      ans("dL", "ΔL", "mm", dL, { scale: Math.max(Math.abs(d1), Math.abs(d2)) }),
    ],
    solution: [
      "Prerez v delu 2 (desni del prosto telo): N_2 = F_2 (sila v desno je natezna).",
      `N_2 = ${num(N2)} kN; prerez v delu 1: N_1 = F_1 + F_2 = ${num(F1)} + ${F2 < 0 ? `(${num(F2)})` : num(F2)} = ${num(N1)} kN (predznaki: v desno +).`,
      `σ_1 = N_1/A_1 = ${num(N1)}/${num(A1)} = ${num(N1 / A1)} kN/cm² = ${num((N1 / A1) * 10)} MPa`,
      `σ_2 = N_2/A_2 = ${num(N2)}/${num(A2)} = ${num(N2 / A2)} kN/cm² = ${num((N2 / A2) * 10)} MPa`,
      `ΔL_1 = N_1L_1/(EA_1) = ${num(N1)}·${num(L1 * 100)}/(21000·${num(A1)}) cm = ${num(d1)} mm`,
      `ΔL_2 = N_2L_2/(EA_2) = ${num(N2)}·${num(L2 * 100)}/(21000·${num(A2)}) cm = ${num(d2)} mm`,
      `ΔL = ΔL_1 + ΔL_2 = ${num(dL)} mm (E = 210 GPa = 21000 kN/cm²).`,
    ],
  };
}

/** Both ends clamped, force F at the step (+ = right), heating ΔT. */
export function vpeta({ A1, A2, L1, L2, F, dT }) {
  const E = STEEL.E, a = STEEL.a;
  const f1 = (L1 * 100) / (E * A1), f2 = (L2 * 100) / (E * A2); // cm/kN
  const th = a * dT * (L1 + L2) * 100; // free thermal elongation, cm
  // Node at the step: −N1 + N2 + F = 0; compatibility: N1 f1 + N2 f2 + th = 0.
  const N1 = (F * f2 - th) / (f1 + f2);
  const N2 = N1 - F;
  const u = (N1 * f1 + a * dT * L1 * 100) * 10; // mm, displacement of the step
  return { N1, N2, u, f1, f2, th };
}

function clamped(p) {
  const { A1, A2, L1, L2, F, dT } = p;
  const { N1, N2, u, f1, f2, th } = vpeta(p);
  return {
    title: hookePalice.title,
    text: [
      `Jeklena stopničasta palica (E = 210 GPa, α_T = ${sci(STEEL.a)}) je na obeh koncih togo vpeta. Na stiku obeh delov deluje osna sila F = ${q(Math.abs(F), "kN")} ${F > 0 ? "v desno" : "v levo"}${dT ? `, poleg tega palico enakomerno segrejemo za ΔT = ${dT} K` : ""}.`,
      "Izračunajte osni sili N_1, N_2 in napetosti σ_1, σ_2 v obeh delih (nateg +, tlak −) ter pomik u stika obeh delov (v desno +).",
    ],
    figure(f) {
      const { Lt, H, top } = figureBar(f, p, 2);
      axial(f, L1, F, "F", top);
      if (dT) f.label([L1 > L2 ? L1 / 2 : L1 + L2 / 2, H], `ΔT = +${dT} K`, { dy: -14 });
    },
    answers: [
      ans("N1", "N_1", "kN", N1),
      ans("N2", "N_2", "kN", N2),
      ans("s1", "σ_1", "MPa", (N1 / A1) * 10),
      ans("s2", "σ_2", "MPa", (N2 / A2) * 10),
      ans("u", "u", "mm", u, { scale: Math.max(Math.abs(N1 * f1), Math.abs(N2 * f2), th) * 10 }),
    ],
    solution: [
      "Neznanki sta dve (N_1, N_2), ravnotežna enačba ena → statično nedoločeno; dodamo pogoj kompatibilnosti.",
      "Ravnotežje stika (vozlišča med deloma): −N_1 + N_2 + F = 0 → N_2 = N_1 − F (F v desno +).",
      `Kompatibilnost (konca se ne premakneta): ΔL_1 + ΔL_2 = 0, ΔL_i = N_iL_i/(EA_i)${dT ? " + α_TΔT·L_i" : ""}.`,
      `L_1/(EA_1) = ${num(f1 * 1e5)}·10^{−5} cm/kN, L_2/(EA_2) = ${num(f2 * 1e5)}·10^{−5} cm/kN${dT ? `, α_TΔT(L_1 + L_2) = ${num(th)} cm` : ""}.`,
      `N_1·L_1/(EA_1) + (N_1 − F)·L_2/(EA_2)${dT ? " + α_TΔT(L_1 + L_2)" : ""} = 0 → N_1 = ${num(N1)} kN, N_2 = N_1 − F = ${num(N2)} kN.`,
      `σ_1 = N_1/A_1 = ${num((N1 / A1) * 10)} MPa, σ_2 = N_2/A_2 = ${num((N2 / A2) * 10)} MPa.`,
      `Pomik stika: u = ΔL_1 = N_1L_1/(EA_1)${dT ? " + α_TΔT·L_1" : ""} = ${num(u)} mm (= −ΔL_2 ✓).`,
    ],
  };
}

/** Steel rod in an aluminium tube: force F (gap δ, rod shorter) or ΔT. */
export function cev({ As, Aa, L, F, delta, dT }) {
  const Lc = L * 100;
  const ks = (STEEL.E * As) / Lc, ka = (ALU.E * Aa) / Lc; // kN/cm
  const d = delta / 10; // cm
  if (dT) {
    const Ns = ((ALU.a - STEEL.a) * dT * Lc) / (1 / ks + 1 / ka);
    return { Ns, Na: -Ns, dL: (Ns / ks + STEEL.a * dT * Lc) * 10, ks, ka };
  }
  const s = (F + ks * d) / (ka + ks); // shortening of the tube, cm
  return { Ns: -ks * (s - d), Na: -ka * s, dL: -s * 10, ks, ka };
}

function tube(p) {
  const { As, Aa, L, F, delta, dT } = p;
  const { Ns, Na, dL, ks, ka } = cev(p);
  const mat = `Jeklena palica (E_j = 210 GPa, α_j = ${sci(STEEL.a)}, A_j = ${num(As)} cm²) stoji v aluminijasti cevi (E_a = 70 GPa, α_a = ${sci(ALU.a)}, A_a = ${num(Aa)} cm²) na togi podlagi.`;
  const load = dT
    ? `Palica in cev sta dolgi L = ${num(L)} m in sta na obeh koncih togo povezani (spodaj s podlago, zgoraj s togo ploščo). Sistem enakomerno segrejemo za ΔT = ${dT} K.`
    : delta
      ? `Cev je dolga L = ${num(L)} m, palica pa je za δ = ${num(delta)} mm krajša. Na togo ploščo, ki leži na cevi, deluje sila F = ${q(F, "kN")}.`
      : `Palica in cev sta dolgi L = ${num(L)} m. Na togo ploščo, ki leži na obeh, deluje sila F = ${q(F, "kN")}.`;
  const sol = dT
    ? [
        "Brez povezave bi se aluminij raztegnil bolj kot jeklo; povezava zahteva enak raztezek → jeklo v nategu, aluminij v tlaku.",
        "Ravnotežje (ni zunanje sile): N_j + N_a = 0.",
        "Kompatibilnost: N_jL/(E_jA_j) + α_jΔT·L = N_aL/(E_aA_a) + α_aΔT·L.",
        `E_jA_j/L = ${num(ks)} kN/cm, E_aA_a/L = ${num(ka)} kN/cm.`,
        `N_j = (α_a − α_j)ΔT·L/(L/(E_jA_j) + L/(E_aA_a)) = ${num((ALU.a - STEEL.a) * 1e5)}·10^{−5}·${dT}·${num(L * 100)}/(${num(1 / ks)} + ${num(1 / ka)}) = ${num(Ns)} kN, N_a = −N_j = ${num(Na)} kN.`,
      ]
    : delta
      ? [
          `Najprej nosi le cev. Da se plošča dotakne palice, mora cev skrajšati za δ: sila F_δ = δ·E_aA_a/L = ${num(delta / 10)}·${num(ka)} = ${num((ka * delta) / 10)} kN < F → pride do stika.`,
          "Ravnotežje: |N_j| + |N_a| = F (obe sili tlačni). Kompatibilnost: skrček cevi s = skrček palice + δ.",
          `|N_a| = (E_aA_a/L)·s, |N_j| = (E_jA_j/L)·(s − δ), E_jA_j/L = ${num(ks)} kN/cm, E_aA_a/L = ${num(ka)} kN/cm.`,
          `s = (F + δ·E_jA_j/L)/(E_aA_a/L + E_jA_j/L) = (${num(F)} + ${num((ks * delta) / 10)})/${num(ka + ks)} = ${num(-dL / 10)} cm = ${num(-dL)} mm.`,
          `N_a = −${num(ka)}·${num(-dL / 10)} = ${num(Na)} kN, N_j = −${num(ks)}·(${num(-dL / 10)} − ${num(delta / 10)}) = ${num(Ns)} kN.`,
        ]
      : [
          "Ravnotežje plošče: N_j + N_a = −F (obe tlačni). Kompatibilnost: enaka skrčka ΔL_j = ΔL_a.",
          `N_jL/(E_jA_j) = N_aL/(E_aA_a); togosti E_jA_j/L = ${num(ks)} kN/cm, E_aA_a/L = ${num(ka)} kN/cm.`,
          `Sila se razdeli v razmerju togosti: N_j = −F·${num(ks)}/${num(ks + ka)} = ${num(Ns)} kN, N_a = −F·${num(ka)}/${num(ks + ka)} = ${num(Na)} kN.`,
        ];
  return {
    title: hookePalice.title,
    text: [
      `${mat} ${load}`,
      "Izračunajte osni sili N_j, N_a in napetosti σ_j, σ_a v palici in cevi (nateg +, tlak −) ter spremembo dolžine cevi ΔL (podaljšek +, skrček −).",
    ],
    figure(f) {
      const top = 3, gap = delta ? 0.18 : 0;
      f.ground([-1.1, 0], [1.1, 0]);
      f.rect(-0.62, 0, 0.17, top);
      f.rect(0.45, 0, 0.17, top);
      f.rect(-0.26, 0, 0.52, top - gap, "fig-body");
      f.rect(-0.8, top, 1.6, 0.16);
      if (F) f.force([0, top + 0.16], -90, { len: 46, label: `F = ${q(F, "kN")}` });
      f.line([0, 1.1], [1.15, 0.7], "fig-thin");
      f.label([1.15, 0.7], `jeklo, A_j = ${num(As)} cm²`, { anchor: "start", dx: 4, dy: 4 });
      f.line([0.53, 2.1], [1.15, 2.1], "fig-thin");
      f.label([1.15, 2.1], `Al cev, A_a = ${num(Aa)} cm²`, { anchor: "start", dx: 4, dy: 4 });
      if (delta) {
        f.line([0, top - gap / 2], [1.15, top - 0.35], "fig-thin");
        f.label([1.15, top - 0.35], `δ = ${num(delta)} mm`, { anchor: "start", dx: 4, dy: 4 });
      }
      if (dT) f.label([0, top + 0.16], `ΔT = +${dT} K`, { dy: -12 });
      f.dim([-0.62, 0], [-0.62, top], `L = ${num(L)} m`, -24);
    },
    answers: [
      ans("Ns", "N_j", "kN", Ns),
      ans("Na", "N_a", "kN", Na),
      ans("ss", "σ_j", "MPa", (Ns / As) * 10),
      ans("sa", "σ_a", "MPa", (Na / Aa) * 10),
      ans("dL", "ΔL", "mm", dL),
    ],
    solution: [
      ...sol,
      `σ_j = N_j/A_j = ${num(Ns)}/${num(As)} = ${num((Ns / As) * 10)} MPa, σ_a = N_a/A_a = ${num(Na)}/${num(Aa)} = ${num((Na / Aa) * 10)} MPa.`,
      dT
        ? `ΔL = N_jL/(E_jA_j) + α_jΔT·L = ${num(dL)} mm (enako za cev ✓).`
        : `ΔL cevi = N_aL/(E_aA_a) = ${num(dL)} mm.`,
    ],
  };
}
