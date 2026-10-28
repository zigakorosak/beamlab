// Porušitvene hipoteze (notes §11, snov.md §8): the equivalent stress by
// Tresca (σ1 − σ3; for σ and τ: √(σ² + 4τ²)) and von Mises
// (√(½[(σ1−σ2)² + (σ2−σ3)² + (σ3−σ1)²]); for σ and τ: √(σ² + 3τ²)).
//   sigma-tau     σ and τ in a point (bending + shear/torsion), σ_pl →
//                 σ_ekv by both and the safety factors ν = σ_pl/σ_ekv
//   ravninsko     σx, σy, τxy → σ1, σ2 (σ3 = 0 in the third direction!),
//                 σ_ekv by both, check against σ_dop
//   dopustni-tau  σ known, σ_dop → the largest τ by each hypothesis

import { ans, num } from "../kit.js";
import { par, planeStress, stressElement } from "./element.js";

export const hipoteze = {
  id: "hipoteze",
  group: "trdnost",
  title: "Porušitvene hipoteze",
  desc: "Ekvivalentna napetost po Trescu in von Misesu, varnost, dopustna τ",

  generate(r) {
    for (;;) {
      const kind = r.pick(["sigma-tau", "ravninsko", "ravninsko", "dopustni-tau"]);
      if (kind === "sigma-tau") {
        const sigma = r.pick([-1, 1]) * r.step(20, 180, 10);
        const tau = r.pick([-1, 1]) * r.step(10, 100, 5);
        const spl = r.pick([235, 240, 355]);
        const eq = Math.sqrt(sigma ** 2 + 4 * tau ** 2);
        if (spl / eq < 0.8 || spl / eq > 5) continue;
        return { kind, sigma, tau, spl };
      }
      if (kind === "ravninsko") {
        const sx = r.step(-100, 140, 10), sy = r.step(-100, 140, 10), txy = r.step(-80, 80, 10);
        const st = planeStress(sx, sy, txy);
        if (st.R < 20 || Math.max(Math.abs(st.s1), Math.abs(st.s2)) < 40) continue;
        return { kind, sx, sy, txy, sdop: r.pick([120, 140, 160, 180]) };
      }
      const sdop = r.pick([120, 140, 160, 180]);
      const sigma = r.step(10, sdop * 0.85, 10);
      return { kind, sigma, sdop };
    }
  },

  build(p) {
    if (p.kind === "sigma-tau") return sigmaTau.call(this, p);
    if (p.kind === "ravninsko") return plane.call(this, p);
    return allowedTau.call(this, p);
  },
};

const MSG = "Pogoj: σ_{ekv} ≤ σ_{dop}.";

function sigmaTau({ sigma, tau, spl }) {
  const T = Math.sqrt(sigma ** 2 + 4 * tau ** 2);
  const M = Math.sqrt(sigma ** 2 + 3 * tau ** 2);
  return {
    title: hipoteze.title,
    text: [
      `V nevarni točki nosilca delujeta normalna napetost σ = ${num(sigma)} MPa in strižna napetost τ = ${num(tau)} MPa (slika; druge napetosti so nič). Meja plastičnosti materiala je σ_{pl} = ${spl} MPa.`,
      "Izračunajte ekvivalentno napetost po Trescovi hipotezi (največje strižne napetosti) in po von Misesovi hipotezi (energija spremembe oblike) ter pripadajoča koeficienta varnosti ν = σ_{pl}/σ_{ekv}.",
    ],
    figure(f) {
      stressElement(f, { sx: sigma, txy: tau, labels: { sx: `σ = ${num(Math.abs(sigma))}`, txy: `τ = ${num(Math.abs(tau))}` } });
    },
    answers: [
      ans("T", "σ_{ekv,Tresca}", "MPa", T),
      ans("M", "σ_{ekv,Mises}", "MPa", M),
      ans("nT", "ν_{Tresca}", "", spl / T),
      ans("nM", "ν_{Mises}", "", spl / M),
    ],
    solution: [
      "Ravninsko stanje σ_x = σ, σ_y = 0, τ_{xy} = τ: σ_{1,2} = σ/2 ± √((σ/2)² + τ²), σ_3 = 0 (σ_1 > 0 > σ_2).",
      `Tresca: σ_{ekv} = σ_1 − σ_2 = √(σ² + 4τ²) = √(${par(sigma)}² + 4·${par(tau)}²) = ${num(T)} MPa`,
      `von Mises: σ_{ekv} = √(σ² + 3τ²) = √(${par(sigma)}² + 3·${par(tau)}²) = ${num(M)} MPa`,
      `ν_{Tresca} = σ_{pl}/σ_{ekv} = ${spl}/${num(T)} = ${num(spl / T)}, ν_{Mises} = ${spl}/${num(M)} = ${num(spl / M)}`,
      `${spl / T < 1 ? "Po Trescu je ν < 1: material bi se plastificiral. " : ""}Trescova hipoteza je strožja (večja σ_{ekv}, manjši ν).`,
    ],
  };
}

function plane({ sx, sy, txy, sdop }) {
  const st = planeStress(sx, sy, txy);
  const pr = [st.s1, st.s2, 0].sort((a, b) => b - a);
  const T = pr[0] - pr[2];
  const M = Math.sqrt(st.s1 ** 2 - st.s1 * st.s2 + st.s2 ** 2);
  const sameSign = st.s2 > 0 || st.s1 < 0;
  const ok = (v) => (v <= sdop ? "≤ σ_{dop} ✓ ustreza" : "> σ_{dop} ✗ ne ustreza");
  return {
    title: hipoteze.title,
    text: [
      `V točki je ravninsko napetostno stanje, prikazano na sliki (velikosti v MPa, puščice kažejo dejanske smeri; v tretji smeri, pravokotno na ravnino, napetosti ni). Dopustna napetost je σ_{dop} = ${sdop} MPa.`,
      "Izračunajte glavni napetosti σ_1 ≥ σ_2 v ravnini in ekvivalentno napetost po Trescovi in po von Misesovi hipotezi. Ali točka ustreza?",
    ],
    figure(f) {
      stressElement(f, { sx, sy, txy, labels: { sx: num(Math.abs(sx)), sy: num(Math.abs(sy)), txy: num(Math.abs(txy)) } });
    },
    answers: [
      ans("s1", "σ_1", "MPa", st.s1),
      ans("s2", "σ_2", "MPa", st.s2),
      ans("T", "σ_{ekv,Tresca}", "MPa", T),
      ans("M", "σ_{ekv,Mises}", "MPa", M),
    ],
    solution: [
      `σ_x = ${num(sx)}, σ_y = ${num(sy)}, τ_{xy} = ${num(txy)} MPa.`,
      `σ_{1,2} = (σ_x + σ_y)/2 ± √(((σ_x − σ_y)/2)² + τ_{xy}²) = ${num(st.C)} ± ${num(st.R)} → σ_1 = ${num(st.s1)} MPa, σ_2 = ${num(st.s2)} MPa.`,
      `Tretja glavna napetost je 0. Urejeno: ${pr.map((v) => num(v)).join(" ≥ ")} MPa.`,
      sameSign
        ? `Tresca: σ_{ekv} = σ_{max} − σ_{min} = ${num(pr[0])} − (${num(pr[2])}) = ${num(T)} MPa. Pozor: σ_1 in σ_2 imata enak predznak, zato σ_{ekv} ni σ_1 − σ_2 (in ne √((σ_x − σ_y)² + 4τ_{xy}²)), ampak največja glavna napetost minus 0.`
        : `Tresca: σ_{ekv} = σ_1 − σ_2 = √((σ_x − σ_y)² + 4τ_{xy}²) = ${num(T)} MPa (σ_1 > 0 > σ_2).`,
      `von Mises: σ_{ekv} = √(σ_1² − σ_1σ_2 + σ_2²) = ${num(M)} MPa (= √(σ_x² − σ_xσ_y + σ_y² + 3τ_{xy}²)).`,
      `${MSG} Tresca: ${num(T)} ${ok(T)}; von Mises: ${num(M)} ${ok(M)}.`,
    ],
  };
}

function allowedTau({ sigma, sdop }) {
  const tT = Math.sqrt(sdop ** 2 - sigma ** 2) / 2;
  const tM = Math.sqrt((sdop ** 2 - sigma ** 2) / 3);
  return {
    title: hipoteze.title,
    text: [
      `V točki gredi, obremenjene z upogibom in torzijo, je normalna napetost σ = ${num(sigma)} MPa (slika). Dopustna napetost materiala je σ_{dop} = ${sdop} MPa.`,
      "Kolikšna je lahko največja strižna napetost τ v tej točki po Trescovi in kolikšna po von Misesovi hipotezi?",
    ],
    figure(f) {
      stressElement(f, { sx: sigma, txy: 1, labels: { sx: `σ = ${num(sigma)}`, txy: "τ = ?" } });
    },
    answers: [ans("tT", "τ_{dop,Tresca}", "MPa", tT), ans("tM", "τ_{dop,Mises}", "MPa", tM)],
    solution: [
      `Tresca: √(σ² + 4τ²) ≤ σ_{dop} → τ ≤ √(σ_{dop}² − σ²)/2 = √(${sdop}² − ${num(sigma)}²)/2 = ${num(tT)} MPa`,
      `von Mises: √(σ² + 3τ²) ≤ σ_{dop} → τ ≤ √((σ_{dop}² − σ²)/3) = ${num(tM)} MPa`,
      "Von Mises dopušča večjo τ (Tresca je konservativnejša).",
    ],
  };
}
