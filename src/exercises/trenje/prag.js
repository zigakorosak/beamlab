// Kolo čez prag (wheel over a step of height h). At the instant the wheel
// leaves the ground it touches only the step's edge E. α is the angle
// between the line C–E (centre to edge) and the vertical:
//   cos α = (r − h)/r.
//   vodoravna   horizontal force at the axle: the contact force must pass
//               through C (no moment about C), so it is purely normal:
//               F = G tan α, R = G / cos α.
//   najmanjsa   smallest force at the axle: perpendicular to C–E, i.e. at
//               α above the horizontal: F = G sin α, R = G cos α.
//   pogon       driven wheel (torque M_t, no force at the axle): the
//               contact force must balance G alone, so it is vertical;
//               it leans from the normal by α, hence f ≥ tan α, and
//               M_t = T·r = G·r·sin α. Exam: d = 90 cm, G = 4 kN,
//               h = 20 cm → cos α = 25/45, α = 56,25°, f = 1,496,
//               M_t = 1496 Nm.

import { ans, angleAns, deg, num, q } from "../kit.js";
import { own } from "./common.js";

export function solvePrag({ d, h, G }) {
  const r = d / 2;
  const cosA = (r - h) / r;
  const a = Math.acos(cosA);
  const sinA = Math.sin(a);
  return {
    r,
    cosA,
    sinA,
    alpha: deg(a),
    F: G * Math.tan(a),
    R: G / cosA,
    Fmin: G * sinA,
    Rmin: G * cosA,
    f: Math.tan(a),
    Mt: G * 1000 * (r / 100) * sinA, // Nm (G in kN, r in cm)
    N: G * cosA,
    T: G * sinA,
  };
}

export const trenjePrag = {
  id: "trenje-prag",
  group: "statika",
  title: "Kolo čez prag",
  desc: "Sila ali moment, da kolo prevalimo čez stopnico, in potrebno trenje",

  generate(r) {
    for (;;) {
      const kind = r.pick(["vodoravna", "najmanjsa", "pogon"]);
      const d = r.step(40, 120, 10);
      const h = r.int(4, 40);
      const k = h / (d / 2);
      // Not a pebble, not nearly the axle height; f ≤ √3 for the driven wheel.
      if (k < 0.1 || k > (kind === "pogon" ? 0.5 : 0.6)) continue;
      return { kind, d, h, G: r.int(1, 10) };
    }
  },

  build(p) {
    const { kind, d, h, G } = p;
    const R = solvePrag(p);
    const geo = `cos α = (r − h)/r = (${num(R.r)} − ${num(h)})/${num(R.r)} = ${num(R.cosA)} → α = ${num(R.alpha)}°, sin α = ${num(R.sinA)}.`;
    const intro = `Kolo s premerom d = ${q(d, "cm")} in težo G = ${q(G, "kN")} stoji pred stopnico (pragom) z višino h = ${q(h, "cm")}.`;
    const ask = {
      vodoravna: "V središču kolesa deluje vodoravna sila F. Kolikšna mora biti sila F, da se kolo odlepi od tal in se začne vzpenjati čez rob stopnice? Kolikšna je tedaj reakcija R na robu stopnice?",
      najmanjsa: "Kolo želimo čez stopnico prevaliti s silo F, ki deluje v središču kolesa. Kolikšna je najmanjša potrebna sila F_{min} in pod kakšnim kotom β glede na vodoravnico mora delovati? Kolikšna je tedaj reakcija R na robu stopnice?",
      pogon: "Kolo poganja motor z momentom M_t (v osi kolesa ne deluje nobena druga sila). Izračunajte kot α med zveznico središča kolesa in roba stopnice ter navpičnico, najmanjši koeficient trenja f med kolesom in robom stopnice, pri katerem kolo ne zdrsne, in potrebni moment M_t, da se kolo začne vzpenjati čez stopnico.",
    }[kind];
    const answers = {
      vodoravna: [own(ans("F", "F", "kN", R.F)), own(ans("R", "R", "kN", R.R))],
      najmanjsa: [own(ans("F", "F_{min}", "kN", R.Fmin)), angleAns("beta", "β", R.alpha), own(ans("R", "R", "kN", R.Rmin))],
      pogon: [angleAns("alpha", "α", R.alpha), ans("f", "f_{min}", "", R.f), ans("Mt", "M_t", "Nm", R.Mt)],
    }[kind];
    const start = "V trenutku, ko se kolo odlepi od tal, je reakcija tal enaka nič; kolo se dotika le roba stopnice E.";
    const solution = {
      vodoravna: [
        start,
        geo,
        "Sili F in G prijemljeta v središču C, zato mora tudi reakcija R na robu E potekati skozi C (ΣM_C = 0): R deluje vzdolž zveznice E–C, pod kotom α glede na navpičnico; trenje ni potrebno.",
        `ΣF_y = 0: R cos α − G = 0 → R = G/cos α = ${num(G)}/${num(R.cosA)} = ${num(R.R)} kN.`,
        `ΣF_x = 0: F − R sin α = 0 → F = G·tan α = ${num(G)}·${num(Math.tan((R.alpha * Math.PI) / 180))} = ${num(R.F)} kN.`,
      ],
      najmanjsa: [
        start,
        geo,
        "R gre skozi središče C (ΣM_C = 0), torej vzdolž E–C. Trikotnik sil G, R, F je zaprt; F je najmanjša, ko je pravokotna na smer R, torej pod kotom β = α glede na vodoravnico (poševno navzgor).",
        `F_{min} = G·sin α = ${num(G)}·${num(R.sinA)} = ${num(R.Fmin)} kN, β = ${num(R.alpha)}°.`,
        `R = G·cos α = ${num(G)}·${num(R.cosA)} = ${num(R.Rmin)} kN.`,
      ],
      pogon: [
        start,
        geo,
        "Na kolo delujejo le G, M_t in sila na robu E (normalna N vzdolž E–C in trenje T, pravokotno na E–C). ΣF = 0: rezultanta N in T mora biti navpična in enaka G.",
        `Razstavimo G na smer E–C in pravokotno nanjo: N = G cos α = ${num(R.N)} kN, T = G sin α = ${num(R.T)} kN.`,
        `Kolo ne zdrsne, če T ≤ f·N → f_{min} = T/N = tan α = ${num(R.f)}.`,
        `ΣM_C = 0: M_t − T·r = 0 → M_t = G·r·sin α = ${num(G * 1000)} N·${num(R.r / 100)} m·${num(R.sinA)} = ${num(R.Mt)} Nm.`,
      ],
    }[kind];

    // Figure in metres.
    const rm = d / 200, hm = h / 100;
    const C = [0, rm];
    const xE = rm * R.sinA;
    return {
      title: this.title,
      text: [intro, ask],
      figure(fig) {
        fig.ground([-rm - 0.5 * rm, 0], [xE, 0]);
        fig.ground([xE, 0], [xE, hm]);
        fig.ground([xE, hm], [xE + 0.9 * rm, hm]);
        fig.circle(C, rm);
        fig.hinge(C);
        fig.point(C, "C", { dot: false, dx: -8, dy: 18, anchor: "end" });
        fig.point([xE, hm], "E", { dx: 4, dy: -8 });
        fig.force(C, -90, { tail: true, world: 0.4 * rm, label: `G = ${q(G, "kN")}` });
        if (kind === "vodoravna") fig.force(C, 0, { world: 0.55 * rm, label: "F" });
        if (kind === "pogon") fig.moment(C, false, "M_t");
        fig.dim([-rm, 0], [-rm, 2 * rm], `d = ${q(d, "cm")}`, -22);
        fig.dim([xE + 0.9 * rm, 0], [xE + 0.9 * rm, hm], `h = ${q(h, "cm")}`, 22);
      },
      answers,
      solution,
    };
  },
};
