// Tankostenske tlačne posode (t ≪ d, d = notranji premer):
//   valj:   σ_ob = p d/(2t), σ_aks = p d/(4t) (zaprta posoda)
//   krogla: σ = p d/(4t) v vseh smereh v steni
// Radial stress neglected (ravninsko stanje v steni), so
//   von Mises σ_ekv = √(σ_1² − σ_1σ_2 + σ_2²) (valj: √3/2·σ_ob, krogla: σ),
//   največja normalna napetost / Tresca (σ_3 = 0): σ_ekv = σ_1.
// Three exam types: napetosti (check), debelina (required t), tlak (allowed p).
// Units: p in MPa (or bar, 1 bar = 0,1 MPa), d in mm, t in mm, σ in MPa.

import { ans, num, q } from "../kit.js";

const MISES_CYL = Math.sqrt(3) / 2; // σ_ekv/σ_ob for σ_aks = σ_ob/2

export const posoda = {
  id: "tlacna-posoda",
  group: "trdnost",
  title: "Tankostenska tlačna posoda",
  desc: "Valj ali krogla pod notranjim tlakom: σ_ob, σ_aks, potrebna debelina, dopustni tlak",

  generate(r) {
    for (;;) {
      const p = {
        kind: r.pick(["napetosti", "debelina", "tlak"]),
        shape: r.chance(0.65) ? "valj" : "krogla",
        bar: r.chance(0.5),
        p: 0,
        d: r.step(400, 3000, 100),
        t: r.step(4, 20, 1),
        sdop: r.pick([100, 120, 140, 150, 160]),
      };
      p.p = p.bar ? r.step(5, 60, 1) : r.step(0.5, 6, 0.1);
      const pM = p.bar ? p.p / 10 : p.p;
      const s1 = (pM * p.d) / (2 * p.t);
      if (p.kind === "napetosti" && (s1 < 20 || s1 > 300)) continue;
      if (p.kind === "debelina") {
        const t = (pM * p.d) / (2 * p.sdop);
        if (t < 2 || t > 40) continue;
      }
      if (p.d / p.t < 20) continue;
      return p;
    }
  },

  build(p) {
    const pM = p.bar ? p.p / 10 : p.p;
    const pText = p.bar ? `p = ${num(p.p)} bar` : `p = ${q(p.p, "MPa")}`;
    const valj = p.shape === "valj";
    const shapeText = valj
      ? `Zaprta valjasta posoda z notranjim premerom d = ${p.d} mm`
      : `Krogelna posoda z notranjim premerom d = ${p.d} mm`;
    const pLine = p.bar ? `Tlak v MPa: p = ${num(p.p)} bar = ${num(pM)} MPa (1 bar = 0,1 MPa).` : null;
    const note = "Posodo obravnavajte kot tankostensko (radialno napetost v steni zanemarite).";
    let text, answers, solution;
    if (p.kind === "napetosti") {
      const sOb = (pM * p.d) / (2 * p.t), sAx = (pM * p.d) / (4 * p.t);
      if (valj) {
        const mis = Math.sqrt(sOb ** 2 - sOb * sAx + sAx ** 2);
        const F = (pM * Math.PI * p.d ** 2) / 4 / 1000;
        text = [
          `${shapeText} in debelino stene t = ${p.t} mm je pod notranjim tlakom ${pText}. ${note}`,
          "Izračunajte obodno in osno (aksialno) napetost v steni, primerjalno napetost po von Misesu in silo tlaka na pokrov posode.",
        ];
        answers = [ans("sob", "σ_{ob}", "MPa", sOb), ans("sax", "σ_{aks}", "MPa", sAx), ans("mis", "σ_{ekv}", "MPa", mis, { note: "von Mises" }), ans("F", "F_{pokrov}", "kN", F)];
        solution = [
          pLine,
          `σ_{ob} = p d/(2t) = ${num(pM)}·${p.d}/(2·${p.t}) = ${num(sOb)} MPa.`,
          `σ_{aks} = p d/(4t) = ${num(sAx)} MPa = σ_{ob}/2 (zato razpoke nastanejo vzdolžno).`,
          `Von Mises (σ_1 = σ_{ob}, σ_2 = σ_{aks}, σ_3 ≈ 0): σ_{ekv} = √(σ_1² − σ_1σ_2 + σ_2²) = ${num(mis)} MPa (= √3/2·σ_{ob}).`,
          `Sila na pokrov: F = p·πd²/4 = ${num(pM)}·π·${p.d}²/4 = ${num(F * 1000)} N = ${num(F)} kN (kontrola: F = σ_{aks}·π d t = ${num((sAx * Math.PI * p.d * p.t) / 1000)} kN).`,
        ];
      } else {
        const F = (pM * Math.PI * p.d ** 2) / 4 / 1000;
        text = [
          `${shapeText} in debelino stene t = ${p.t} mm je pod notranjim tlakom ${pText}. ${note}`,
          "Izračunajte napetost v steni, primerjalno napetost po von Misesu in silo, ki jo prenaša zvar po ekvatorju (polovici krogle drži skupaj).",
        ];
        answers = [ans("s", "σ", "MPa", sAx), ans("mis", "σ_{ekv}", "MPa", sAx, { note: "von Mises" }), ans("F", "F_{zvar}", "kN", F)];
        solution = [
          pLine,
          `Ravnotežje polovice krogle: p·πd²/4 = σ·π d t → σ = p d/(4t) = ${num(pM)}·${p.d}/(4·${p.t}) = ${num(sAx)} MPa (enako v vseh smereh v steni).`,
          `Von Mises (σ_1 = σ_2 = σ, σ_3 ≈ 0): σ_{ekv} = √(σ² − σ² + σ²) = σ = ${num(sAx)} MPa.`,
          `Sila v zvaru: F = p·πd²/4 = ${num(F)} kN.`,
        ];
      }
    } else if (p.kind === "debelina") {
      const tN = valj ? (pM * p.d) / (2 * p.sdop) : (pM * p.d) / (4 * p.sdop);
      const tM = valj ? MISES_CYL * tN : tN;
      text = [
        `${shapeText} bo pod notranjim tlakom ${pText}. Dopustna napetost materiala je σ_{dop} = ${p.sdop} MPa. ${note}`,
        valj
          ? "Določite potrebno debelino stene a) po hipotezi največje normalne napetosti (σ_{ob} ≤ σ_{dop}) in b) po von Misesu."
          : "Določite potrebno debelino stene (po hipotezi največje normalne napetosti; po von Misesu dobimo enako, ker je σ_1 = σ_2) in jo primerjajte s potrebno debelino valjaste posode z enakim premerom in tlakom (σ_{ob} ≤ σ_{dop}).",
      ];
      answers = valj
        ? [ans("tN", "t_{σ,max}", "mm", tN), ans("tM", "t_{Mises}", "mm", tM)]
        : [ans("t", "t_{krogla}", "mm", tN), ans("tv", "t_{valj}", "mm", 2 * tN)];
      solution = [
        pLine,
        valj
          ? `a) σ_{ob} = p d/(2t) ≤ σ_{dop} → t ≥ p d/(2σ_{dop}) = ${num(pM)}·${p.d}/(2·${p.sdop}) = ${num(tN)} mm.`
          : `Krogla: σ = p d/(4t) ≤ σ_{dop} → t ≥ p d/(4σ_{dop}) = ${num(pM)}·${p.d}/(4·${p.sdop}) = ${num(tN)} mm.`,
        ...(valj
          ? [
              "b) σ_{aks} = σ_{ob}/2 → σ_{ekv} = √(σ_{ob}² − σ_{ob}²/2 + σ_{ob}²/4) = (√3/2)·σ_{ob} = (√3/2)·p d/(2t) ≤ σ_{dop}.",
              `t ≥ (√3/2)·p d/(2σ_{dop}) = 0,866·${num(tN)} = ${num(tM)} mm.`,
            ]
          : [`Valj: σ_{ob} = p d/(2t) ≤ σ_{dop} → t ≥ p d/(2σ_{dop}) = ${num(2 * tN)} mm — krogla potrebuje pol tanjšo steno.`]),
        "V praksi izberemo prvo večjo standardno debelino pločevine.",
      ];
    } else {
      const pN = valj ? (2 * p.t * p.sdop) / p.d : (4 * p.t * p.sdop) / p.d;
      const pMis = valj ? pN / MISES_CYL : pN;
      const unit = p.bar ? "bar" : "MPa";
      const k = p.bar ? 10 : 1;
      text = [
        `${shapeText} ima debelino stene t = ${p.t} mm. Dopustna napetost materiala je σ_{dop} = ${p.sdop} MPa. ${note}`,
        valj
          ? `Določite največji dopustni notranji tlak (v ${unit}) a) po hipotezi največje normalne napetosti in b) po von Misesu.`
          : `Določite največji dopustni notranji tlak (v ${unit}) in ga primerjajte z dopustnim tlakom valjaste posode z enakim premerom in debelino stene (σ_{ob} ≤ σ_{dop}).`,
      ];
      answers = valj ? [ans("pN", "p_{σ,max}", unit, pN * k), ans("pM", "p_{Mises}", unit, pMis * k)] : [ans("p", "p_{krogla}", unit, pN * k), ans("pv", "p_{valj}", unit, (pN / 2) * k)];
      solution = [
        valj
          ? `a) σ_{ob} = p d/(2t) ≤ σ_{dop} → p ≤ 2tσ_{dop}/d = 2·${p.t}·${p.sdop}/${p.d} = ${num(pN)} MPa${p.bar ? ` = ${num(pN * 10)} bar` : ""}.`
          : `σ = p d/(4t) ≤ σ_{dop} → p ≤ 4tσ_{dop}/d = 4·${p.t}·${p.sdop}/${p.d} = ${num(pN)} MPa${p.bar ? ` = ${num(pN * 10)} bar` : ""}.`,
        ...(valj
          ? [`b) σ_{ekv} = (√3/2)·p d/(2t) ≤ σ_{dop} → p ≤ 2tσ_{dop}/(0,866·d) = ${num(pMis)} MPa${p.bar ? ` = ${num(pMis * 10)} bar` : ""}.`]
          : [`Valj: p ≤ 2tσ_{dop}/d = ${num(pN / 2)} MPa${p.bar ? ` = ${num(pN * 5)} bar` : ""} — krogla prenese dvakrat večji tlak.`]),
      ];
    }
    return {
      title: this.title,
      text,
      figure(f) {
        drawVessel(f, p, valj);
      },
      answers,
      solution: solution.filter(Boolean),
    };
  },
};

function drawVessel(f, p, valj) {
  const r = 1, t = 0.12;
  if (valj) {
    const L = 3.6;
    // Body with elliptic (torispherical-looking) end caps.
    // Wall: outer and inner outline of a cylinder with hemispherical ends.
    const stadium = (rr) => {
      const pts = [];
      for (let a = -90; a <= 90; a += 6) pts.push([L + rr * Math.cos((a * Math.PI) / 180), rr * Math.sin((a * Math.PI) / 180)]);
      for (let a = 90; a <= 270; a += 6) pts.push([rr * Math.cos((a * Math.PI) / 180), rr * Math.sin((a * Math.PI) / 180)]);
      return pts;
    };
    f.polygon(stadium(r));
    f.polygon(stadium(r - t), "fig-hole");
    f.line([-r * 1.15, 0], [L + r * 1.15, 0], "fig-dashed");
    f.dim([L * 0.62, -r + t], [L * 0.62, r - t], `d = ${p.d} mm`, -18);
    f.label([L * 0.25, r], p.kind === "debelina" ? "t = ?" : `t = ${p.t} mm`, { dy: -10 });
    f.label([L * 0.3, 0], p.kind === "tlak" ? "p = ?" : `p = ${p.bar ? num(p.p) + " bar" : q(p.p, "MPa")}`, { dy: -8 });
  } else {
    f.circle([0, 0], r);
    f.circle([0, 0], r - t, "fig-hole");
    f.line([-r * 1.15, 0], [r * 1.15, 0], "fig-dashed");
    f.dim([-(r - t), 0], [r - t, 0], `d = ${p.d} mm`, -16);
    f.label([0, -r], p.kind === "debelina" ? "t = ?" : `t = ${p.t} mm`, { dy: 18 });
    f.label([0, 0.45 * r], p.kind === "tlak" ? "p = ?" : `p = ${p.bar ? num(p.p) + " bar" : q(p.p, "MPa")}`);
  }
}
