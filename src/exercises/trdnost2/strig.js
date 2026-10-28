// Strižne napetosti v nosilcu: τ(z) = T·S*(z)/(I·b(z)) (Žuravski).
// A simple beam gives the largest shear force T, the section (cm) gives
//   pravokotnik  τ_max = 1,5·T/A, τ(y) = T/(2I)·(h²/4 − y²)
//   krog         τ_max = 4/3·T/A, τ(y) = T·(r² − y²)/(3I)
//   I-prerez     τ_max on the neutral axis, τ in the web at the flange junction
//   T-prerez     centroid first, then τ on the neutral axis and at the junction
// Units: kN, cm → kN/cm², answers in MPa (1 kN/cm² = 10 MPa).

import { ans, num, q } from "../kit.js";
import { section } from "./figs.js";

/** Shear stresses [kN/cm²] for T [kN] on a section (cm). */
export function shear(sec, T, y0 = 0) {
  if (sec.kind === "rect") {
    const { b, h } = sec;
    const A = b * h, I = (b * h ** 3) / 12;
    const S0 = (b * h * h) / 8, Sy = (b / 2) * (h * h / 4 - y0 * y0);
    return { A, I, S0, Sy, b0: b, tmax: (T * S0) / (I * b), ty: (T * Sy) / (I * b) };
  }
  if (sec.kind === "circle") {
    const r = sec.d / 2;
    const A = Math.PI * r * r, I = (Math.PI * r ** 4) / 4;
    const S0 = (2 / 3) * r ** 3, Sy = (2 / 3) * (r * r - y0 * y0) ** 1.5, by = 2 * Math.sqrt(r * r - y0 * y0);
    return { A, I, S0, Sy, by, tmax: (T * S0) / (I * 2 * r), ty: (T * Sy) / (I * by) };
  }
  if (sec.kind === "I") {
    const { B, H, tf, tw } = sec;
    const hw = H - 2 * tf;
    const A = 2 * B * tf + hw * tw;
    const I = (B * H ** 3 - (B - tw) * hw ** 3) / 12;
    const Sf = B * tf * (H / 2 - tf / 2);
    const S0 = Sf + (tw * (hw / 2) ** 2) / 2;
    return { A, I, Sf, S0, tmax: (T * S0) / (I * tw), tj: (T * Sf) / (I * tw), tjf: (T * Sf) / (I * B) };
  }
  // T: flange B × tf on top, web tw × hw below; yc measured from the top.
  const { B, tf, hw, tw } = sec;
  const H = tf + hw;
  const Af = B * tf, Aw = hw * tw, A = Af + Aw;
  const yc = (Af * tf / 2 + Aw * (tf + hw / 2)) / A;
  const I = (B * tf ** 3) / 12 + Af * (yc - tf / 2) ** 2 + (tw * hw ** 3) / 12 + Aw * (tf + hw / 2 - yc) ** 2;
  const Sf = Af * (yc - tf / 2);
  const S0 = (tw * (H - yc) ** 2) / 2; // the part below the neutral axis
  const S0top = Sf + (tw * (yc - tf) ** 2) / 2; // the part above (check)
  return { A, I, yc, Sf, S0, S0top, tmax: (T * S0) / (I * tw), tj: (T * Sf) / (I * tw) };
}

/** Beam: largest |T| and a text for it. */
export function beamShear(b) {
  if (b.kind === "point") {
    const A = (b.F * (b.L - b.a)) / b.L, Bv = (b.F * b.a) / b.L;
    return { T: Math.max(A, Bv), A, B: Bv, how: `A = F(L − a)/L = ${num(A)} kN, B = F·a/L = ${num(Bv)} kN → T_{max} = ${num(Math.max(A, Bv))} kN (ob ${A === Bv ? "obeh podporah" : A > Bv ? "podpori A" : "podpori B"}).` };
  }
  if (b.kind === "udl") {
    const T = (b.q * b.L) / 2;
    return { T, how: `A = B = qL/2 = ${num(b.q)}·${num(b.L)}/2 = ${num(T)} kN → T_{max} = ${num(T)} kN (ob podporah).` };
  }
  return { T: b.F, how: `Konzola: T = F = ${num(b.F)} kN v vseh prerezih.` };
}

export const strig = {
  id: "strig-nosilec",
  group: "trdnost",
  title: "Strižne napetosti v nosilcu",
  desc: "τ = T S*/(I b): pravokotnik, krog, I- in T-prerez; τ_max in τ na dani višini",

  generate(r) {
    for (;;) {
      const L = r.step(2, 6, 0.5);
      const bk = r.pick(["point", "point", "udl", "cant"]);
      const beam =
        bk === "point"
          ? { kind: bk, L, F: r.step(10, 120, 5), a: r.step(0.5, L - 0.5, 0.5) }
          : bk === "udl"
            ? { kind: bk, L, q: r.step(5, 40, 1) }
            : { kind: bk, L: r.step(1, 3, 0.5), F: r.step(5, 60, 5) };
      const sk = r.pick(["rect", "circle", "I", "T"]);
      let sec, y0 = 0;
      if (sk === "rect") {
        const b = r.step(6, 20, 1);
        sec = { kind: "rect", b, h: b + r.step(4, 20, 2) };
        y0 = r.step(1, Math.floor(sec.h / 2 - 1), 1);
      } else if (sk === "circle") {
        sec = { kind: "circle", d: r.step(8, 24, 2) };
        y0 = r.step(1, sec.d / 2 - 1, 1);
      } else if (sk === "I") {
        const H = r.step(16, 40, 2);
        sec = { kind: "I", H, B: r.step(8, Math.min(24, H), 2), tf: r.step(1, 2, 0.5), tw: r.step(0.6, 1.4, 0.2) };
      } else {
        sec = { kind: "T", B: r.step(8, 20, 2), tf: r.step(1, 3, 0.5), hw: r.step(8, 24, 2), tw: r.step(1, 3, 0.5) };
        if (sec.tw >= sec.B / 2) continue;
        if (shear(sec, 1).yc <= sec.tf + 0.3) continue; // neutral axis in the web
      }
      if (y0 <= 0 && (sk === "rect" || sk === "circle")) continue;
      const p = { beam, sec, y0 };
      const t = shear(sec, beamShear(beam).T).tmax * 10;
      if (t >= 1 && t <= 150) return p;
    }
  },

  build(p) {
    const { beam, sec, y0 } = p;
    const bs = beamShear(beam);
    const T = bs.T;
    const x = shear(sec, T, y0);
    const M = (v) => v * 10; // kN/cm² → MPa
    const beamText =
      beam.kind === "point"
        ? `Prostoležeči nosilec razpona L = ${q(beam.L, "m")} je obremenjen s silo F = ${q(beam.F, "kN")} na razdalji a = ${q(beam.a, "m")} od podpore A.`
        : beam.kind === "udl"
          ? `Prostoležeči nosilec razpona L = ${q(beam.L, "m")} je obremenjen z enakomerno zvezno obtežbo q = ${q(beam.q, "kN/m")}.`
          : `Konzola dolžine L = ${q(beam.L, "m")} je na prostem koncu obremenjena s silo F = ${q(beam.F, "kN")}.`;
    const secText =
      sec.kind === "rect"
        ? `pravokoten, b × h = ${num(sec.b)} cm × ${num(sec.h)} cm`
        : sec.kind === "circle"
          ? `poln krog s premerom d = ${num(sec.d)} cm`
          : sec.kind === "I"
            ? `simetričen I-prerez: višina H = ${num(sec.H)} cm, pasnici ${num(sec.B)} × ${num(sec.tf)} cm, stojina debeline ${num(sec.tw)} cm`
            : `T-prerez: zgornja pasnica ${num(sec.B)} × ${num(sec.tf)} cm, stojina ${num(sec.tw)} × ${num(sec.hw)} cm (debelina × višina)`;
    const base = [beamText, `Prečni prerez nosilca je ${secText} (glej sliko).`];
    let ask, answers, sol;
    if (sec.kind === "rect" || sec.kind === "circle") {
      ask = `Izračunajte največjo prečno silo, vztrajnostni moment prereza, največjo strižno napetost in strižno napetost na višini y = ${q(y0, "cm")} nad nevtralno osjo.`;
      answers = [ans("T", "T_{max}", "kN", T), ans("I", "I", "cm⁴", x.I), ans("tmax", "τ_{max}", "MPa", M(x.tmax)), ans("ty", "τ(y)", "MPa", M(x.ty))];
      sol =
        sec.kind === "rect"
          ? [
              `I = bh³/12 = ${num(x.I)} cm⁴, A = ${num(x.A)} cm².`,
              `Na nevtralni osi: S* = b·(h/2)·(h/4) = ${num(x.S0)} cm³; τ_{max} = T S*/(I b) = ${num(T)}·${num(x.S0)}/(${num(x.I)}·${num(sec.b)}) = ${num(x.tmax)} kN/cm² = ${num(M(x.tmax))} MPa (= 1,5·T/A).`,
              `Na višini y: S*(y) = b/2·(h²/4 − y²) = ${num(x.Sy)} cm³; τ(y) = T S*/(I b) = ${num(x.ty)} kN/cm² = ${num(M(x.ty))} MPa.`,
            ]
          : [
              `I = πd⁴/64 = ${num(x.I)} cm⁴, A = πd²/4 = ${num(x.A)} cm².`,
              `Na nevtralni osi: S* = 2r³/3 = ${num(x.S0)} cm³, b = d; τ_{max} = T S*/(I d) = ${num(x.tmax)} kN/cm² = ${num(M(x.tmax))} MPa (= 4/3·T/A).`,
              `Na višini y: S*(y) = ⅔(r² − y²)^{3/2} = ${num(x.Sy)} cm³, b(y) = 2√(r² − y²) = ${num(x.by)} cm; τ(y) = T S*/(I b) = ${num(x.ty)} kN/cm² = ${num(M(x.ty))} MPa.`,
            ];
    } else if (sec.kind === "I") {
      ask = "Izračunajte največjo prečno silo, vztrajnostni moment prereza, strižno napetost na nevtralni osi ter v stojini in v pasnici na stiku pasnice in stojine.";
      answers = [
        ans("T", "T_{max}", "kN", T),
        ans("I", "I", "cm⁴", x.I),
        ans("tmax", "τ_{max}", "MPa", M(x.tmax)),
        ans("tj", "τ_{stojina}", "MPa", M(x.tj)),
        ans("tjf", "τ_{pasnica}", "MPa", M(x.tjf)),
      ];
      const hw = sec.H - 2 * sec.tf;
      sol = [
        `I = (B H³ − (B − t_w) h_w³)/12 = (${num(sec.B)}·${num(sec.H)}³ − ${num(sec.B - sec.tw)}·${num(hw)}³)/12 = ${num(x.I)} cm⁴.`,
        `Stik pasnice in stojine: S* = B t_f (H/2 − t_f/2) = ${num(sec.B)}·${num(sec.tf)}·${num(sec.H / 2 - sec.tf / 2)} = ${num(x.Sf)} cm³.`,
        `V stojini (b = t_w = ${num(sec.tw)} cm): τ = T S*/(I t_w) = ${num(x.tj)} kN/cm² = ${num(M(x.tj))} MPa; v pasnici (b = B): τ = ${num(x.tjf)} kN/cm² = ${num(M(x.tjf))} MPa — skok zaradi spremembe širine.`,
        `Nevtralna os: S* = ${num(x.Sf)} + t_w (h_w/2)²/2 = ${num(x.S0)} cm³; τ_{max} = T S*/(I t_w) = ${num(x.tmax)} kN/cm² = ${num(M(x.tmax))} MPa.`,
      ];
    } else {
      ask = "Izračunajte največjo prečno silo, lego težišča (od zgornjega roba), vztrajnostni moment prereza, strižno napetost na nevtralni osi in v stojini na stiku s pasnico.";
      answers = [
        ans("T", "T_{max}", "kN", T),
        ans("yc", "y_T", "cm", x.yc),
        ans("I", "I", "cm⁴", x.I),
        ans("tmax", "τ_{max}", "MPa", M(x.tmax)),
        ans("tj", "τ_{stik}", "MPa", M(x.tj)),
      ];
      const Af = sec.B * sec.tf, Aw = sec.hw * sec.tw;
      sol = [
        `Težišče od zgornjega roba: y_T = (A_1·t_f/2 + A_2·(t_f + h_w/2))/(A_1 + A_2) = (${num(Af)}·${num(sec.tf / 2)} + ${num(Aw)}·${num(sec.tf + sec.hw / 2)})/${num(x.A)} = ${num(x.yc)} cm.`,
        `I = B t_f³/12 + A_1 (y_T − t_f/2)² + t_w h_w³/12 + A_2 (t_f + h_w/2 − y_T)² = ${num(x.I)} cm⁴.`,
        `Nevtralna os (del pod njo): S* = t_w (H − y_T)²/2 = ${num(x.S0)} cm³ (kontrola z delom nad osjo: ${num(x.S0top)} cm³).`,
        `τ_{max} = T S*/(I t_w) = ${num(T)}·${num(x.S0)}/(${num(x.I)}·${num(sec.tw)}) = ${num(x.tmax)} kN/cm² = ${num(M(x.tmax))} MPa.`,
        `Stik (pasnica nad rezom): S* = A_1 (y_T − t_f/2) = ${num(x.Sf)} cm³; v stojini τ = T S*/(I t_w) = ${num(x.tj)} kN/cm² = ${num(M(x.tj))} MPa.`,
      ];
    }
    return {
      title: this.title,
      text: [...base, ask],
      figure(f) {
        drawBeam(f, beam);
        const big = sec.kind === "rect" ? Math.max(sec.b, sec.h) : sec.kind === "circle" ? sec.d : sec.kind === "I" ? Math.max(sec.H, sec.B) : Math.max(sec.tf + sec.hw, sec.B);
        const drawSec = (g, k, cx, cy) => {
          section(g, sec, [cx, cy], k, { axis: sec.kind !== "T" });
          if ((sec.kind === "rect" || sec.kind === "circle") && y0) {
            const w = sec.kind === "rect" ? sec.b / 2 : Math.sqrt((sec.d / 2) ** 2 - y0 ** 2);
            g.line([cx - w * k, cy + y0 * k], [cx + w * k, cy + y0 * k], "fig-thin");
            // (A circle's chord near its top or bottom: the level drawn on out
            // past the circle's side, its name there, not on the rim.)
            const out = sec.kind === "circle" ? sec.d / 2 : w;
            if (out > w) g.line([cx - out * k, cy + y0 * k], [cx - w * k, cy + y0 * k], "fig-dashed");
            g.label([cx - out * k, cy + y0 * k], `y = ${num(y0)} cm`, { dx: -6, dy: 4, anchor: "end" });
          }
        };
        f.byWidth(
          500,
          // A phone: the section under the beam, bigger (beside it, its labels ran into the supports and each other).
          (g) => {
            const k = (Math.max(beam.L, 3) * 0.4) / big;
            drawSec(g, k, beam.L / 2, -0.55 * Math.max(beam.L, 3) - (k * big) / 2);
          },
          (g) => {
            const k = (Math.max(beam.L, 3) * 0.32) / big;
            drawSec(g, k, beam.L + 1.4 + (k * (sec.kind === "circle" ? sec.d : sec.kind === "rect" ? sec.b : sec.B)) / 2, -0.15);
          },
        );

      },
      answers,
      solution: [`Največja prečna sila: ${bs.how}`, ...sol],
    };
  },
};

function drawBeam(f, b) {
  f.member([0, 0], [b.L, 0]);
  if (b.kind === "cant") {
    f.fixed([0, 0], 0);
    f.force([b.L, 0], -90, { label: `F = ${q(b.F, "kN")}` });
  } else {
    f.pin([0, 0]);
    f.roller([b.L, 0]);
    f.label([0, 0], "A", { dx: -12, dy: -8, anchor: "end" });
    f.label([b.L, 0], "B", { dx: 12, dy: -8, anchor: "start" });
    if (b.kind === "point") {
      f.force([b.a, 0], -90, { label: `F = ${q(b.F, "kN")}` });
      f.dim([0, 0], [b.a, 0], `a = ${q(b.a, "m")}`, 40, { beside: true }); // a short a: its label past the end

    } else f.dist([0, 0], [b.L, 0], { label: `q = ${q(b.q, "kN/m")}` });
  }
  f.dim([0, 0], [b.L, 0], `L = ${q(b.L, "m")}`, b.kind === "point" ? 66 : 40);
}
