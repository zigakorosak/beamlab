// Poševni prerez (lepilni spoj): a bar in tension or compression is cut
// (glued) along a plane that makes the angle β with the bar's axis.
//   napetosti   the stress vector p on the cut and its components σ_n, τ_n
//               (exam: 3×3 cm, F = 4,5 kN, β = 20°; 2×2 cm, F = 20 kN, 30°)
//   dopustna    the largest tensile force F for the glue's allowed σ_n, τ_n
// Uniaxial σx = F/A. The cut's normal makes θ = 90° − β with the axis, so
// p = σx·cos θ = σx·sin β, σ_n = σx·sin²β, τ_n = σx·sin β·cos β
// (the same as σ_N, τ_N of notes §8 with σy = τxy = 0 and φ = θ).

import { ans, num, q, rad } from "../kit.js";

const U = "kN/cm²";

export const posevniPrerez = {
  id: "posevni-prerez",
  group: "trdnost",
  title: "Poševni prerez (lepilni spoj)",
  desc: "Palica v nategu/tlaku, poševna ravnina: σ_n, τ_n ali največja sila za lepilo",

  generate(r) {
    for (;;) {
      const square = r.chance(0.6);
      const b = r.step(2, 6, 1);
      const h = square ? b : r.step(3, 8, 1);
      if (!square && h === b) continue;
      const beta = r.step(15, 75, 5);
      if (r.chance(0.6)) {
        const F = r.chance(0.3) ? r.step(2, 20, 0.5) : r.step(5, 60, 1);
        // A glued joint: |σx| between 0,3 and 6 kN/cm² (the exams: 0,5 and 5).
        if (F / (b * h) < 0.3 || F / (b * h) > 6) continue;
        return { kind: "napetosti", b, h, beta, F, tension: r.chance(0.7) };
      }
      const sdop = r.step(0.3, 2, 0.1);
      const tdop = r.step(0.2, 1.5, 0.1);
      const s = Math.sin(rad(beta)), c = Math.cos(rad(beta));
      const Fs = (sdop * b * h) / (s * s), Ft = (tdop * b * h) / (s * c);
      if (Math.abs(Fs - Ft) < 0.1 * Math.max(Fs, Ft)) continue;
      return { kind: "dopustna", b, h, beta, sdop, tdop, tension: true };
    }
  },

  build(p) {
    const { b, h, beta } = p;
    const A = b * h;
    const sb = Math.sin(rad(beta)), cb = Math.cos(rad(beta));
    const square = b === h;
    const sec = square ? `kvadratnim prerezom a × a = ${num(b)} × ${num(h)} cm` : `pravokotnim prerezom b × h = ${num(b)} × ${num(h)} cm`;
    const where = `Ravnina lepilnega spoja oklepa z osjo palice kot β = ${beta}° (kot med ravnino in osjo, ne med normalo in osjo; glej sliko).`;
    const Fl = "F"; // the value is in the text (long labels clip on a phone)

    const figure = (f) => {
      const Ld = Math.max(5 * h, h / Math.tan(rad(beta)) + 3 * h);
      const m = Ld / 2;
      f.rect(0, -h / 2, Ld, h);
      f.dashed([-0.04 * Ld, 0], [1.04 * Ld, 0]);
      const k = h / 2 / sb;
      f.line([m - k * cb, -h / 2], [m + k * cb, h / 2], "fig-rope");
      f.label([m + k * cb, h / 2], "lepilni spoj", { dx: 4, dy: -8, anchor: "start", cls: "fig-name", alts: [[-4, -8, "end"], [0, -22, "middle"]] });

      f.angle([m, 0], 0, beta, "β", 34);
      const out = p.tension;
      // Text above each arrow (labelSide: left of the arrow's direction).
      f.force([Ld, 0], out ? 0 : 180, { tail: out, len: 46, label: Fl, labelSide: out ? 1 : -1 });
      f.force([0, 0], out ? 180 : 0, { tail: out, len: 46, label: Fl, labelSide: out ? -1 : 1 });
      // The cross-section, below the bar.
      const y0 = -h / 2 - 0.9 * h - h;
      const x0 = m - b / 2;
      f.rect(x0, y0, b, h);
      f.label([x0, y0 + h], "prerez", { dx: -8, dy: 0, anchor: "end", cls: "fig-name" });
      f.dim([x0, y0], [x0 + b, y0], `${square ? "a" : "b"} = ${num(b)} cm`, 18);
      f.dim([x0 + b, y0], [x0 + b, y0 + h], `${square ? "a" : "h"} = ${num(h)} cm`, 18);
    };

    const geom = [
      `A = ${square ? "a²" : "b·h"} = ${num(A)} cm²`,
      `Normala lepilne ravnine oklepa z osjo palice kot θ = 90° − β = ${90 - beta}°.`,
    ];

    if (p.kind === "napetosti") {
      const sx = ((p.tension ? 1 : -1) * p.F) / A;
      const pv = Math.abs(sx) * sb;
      const sn = sx * sb * sb;
      const tn = Math.abs(sx) * sb * cb;
      return {
        title: this.title,
        text: [
          `Palica s ${sec} je obremenjena z osno ${p.tension ? "natezno" : "tlačno"} silo F = ${q(p.F, "kN")}. ${where}`,
          `Izračunajte normalno napetost σ_x v prečnem prerezu, velikost napetostnega vektorja p na ravnini spoja ter njegovo normalno komponento σ_n (nateg +, tlak −) in strižno komponento τ_n (velikost). Napetosti v ${U}.`,
        ],
        figure,
        answers: [ans("sx", "σ_x", U, sx), ans("p", "p", U, pv), ans("sn", "σ_n", U, sn), ans("tn", "τ_n", U, tn)],
        solution: [
          ...geom,
          `σ_x = ${p.tension ? "" : "−"}F/A = ${p.tension ? "" : "−"}${num(p.F)}/${num(A)} = ${num(sx)} ${U} (enoosno stanje, σ_y = τ_{xy} = 0).`,
          `Napetostni vektor na ravnini spoja: p = |σ_x|·cos θ = |σ_x|·sin β = ${num(Math.abs(sx))}·${num(sb)} = ${num(pv)} ${U} (v smeri osi palice).`,
          `σ_n = σ_x·cos²θ = σ_x·sin²β = ${num(sx)}·${num(sb * sb)} = ${num(sn)} ${U}`,
          `τ_n = |σ_x|·sin θ·cos θ = |σ_x|·sin β·cos β = ${num(Math.abs(sx))}·${num(sb)}·${num(cb)} = ${num(tn)} ${U}`,
          `Kontrola: √(σ_n² + τ_n²) = ${num(Math.hypot(sn, tn))} = p ✓ (isto da σ_N, τ_N iz §8 pri φ = θ = ${90 - beta}°).`,
        ],
      };
    }

    const { sdop, tdop } = p;
    const Fs = (sdop * A) / (sb * sb);
    const Ft = (tdop * A) / (sb * cb);
    const Fmax = Math.min(Fs, Ft);
    return {
      title: this.title,
      text: [
        `Palica s ${sec} je obremenjena z osno natezno silo F. ${where}`,
        `Lepilo prenese največjo normalno napetost σ_{n,dop} = ${num(sdop)} ${U} in največjo strižno napetost τ_{n,dop} = ${num(tdop)} ${U}. Izračunajte silo F_σ, pri kateri je dosežena σ_{n,dop}, silo F_τ, pri kateri je dosežena τ_{n,dop}, in največjo dopustno silo F_{max}.`,
      ],
      figure,
      answers: [ans("Fs", "F_σ", "kN", Fs), ans("Ft", "F_τ", "kN", Ft), ans("Fmax", "F_{max}", "kN", Fmax)],
      solution: [
        ...geom,
        "σ_x = F/A; na ravnini spoja σ_n = σ_x·sin²β in τ_n = σ_x·sin β·cos β.",
        `Pogoj σ_n ≤ σ_{n,dop}: F_σ = σ_{n,dop}·A/sin²β = ${num(sdop)}·${num(A)}/${num(sb * sb)} = ${num(Fs)} kN`,
        `Pogoj τ_n ≤ τ_{n,dop}: F_τ = τ_{n,dop}·A/(sin β·cos β) = ${num(tdop)}·${num(A)}/${num(sb * cb)} = ${num(Ft)} kN`,
        `Veljati morata oba pogoja: F_{max} = min(F_σ, F_τ) = ${num(Fmax)} kN (merodajna je ${Fs < Ft ? "normalna" : "strižna"} napetost).`,
      ],
    };
  },
};
