// Ravnotežje togega telesa s stiki brez trenja (contact problems), three
// exam classics:
//   palica-polvalj  a uniform rod pinned on the ground leans on a smooth
//                   fixed half-cylinder; the rod is tangent to it, so the
//                   contact force is normal to the rod and passes through the
//                   centre: sin φ = r/d (22.5.2013, 28.1.2015).
//   nosilec-valj    a horizontal beam pinned at a wall carries a hanging
//                   half-cylinder that rests on a half-cylinder lying on the
//                   ground; the contact force acts along the line of centres,
//                   cos φ = e/(r_1 + r_2) (9.9.2016).
//   krogla-vrv      a sphere hangs on a cord against a smooth wall, or in the
//                   corner of two walls; the cord's line passes through the
//                   centre (1.6.2015 and the corner variant).

import { ans, deg, num, q, rad } from "../kit.js";
import { iso } from "../draw.js";

const gText = (g) => (g === 10 ? "g = 10 m/s²" : "g = 9,81 m/s²");

// ---------------------------------------------------------------------------

/** Rod on a half-cylinder: all the numbers of the solution. */
export function solvePalicaPolvalj({ L, m, r, d, g }) {
  const G = m * g;
  const phi = Math.asin(r / d);
  const b = Math.sqrt(d * d - r * r); // pin → tangent point along the rod
  // ΣM_A = 0: B·b − G·(L/2)·cos φ = 0  (B normal to the rod)
  const B = (G * (L / 2) * Math.cos(phi)) / b;
  const Ax = B * Math.sin(phi); // towards the half-cylinder
  const Ay = G - B * Math.cos(phi); // upwards
  return { G, phi, b, B, Ax, Ay, A: Math.hypot(Ax, Ay), f: Math.tan(phi) };
}

export const palicaPolvalj = {
  id: "palica-polvalj",
  group: "statika",
  title: "Drog na polvalju",
  desc: "Drog, členkasto pritrjen na tla, sloni na gladkem polvalju: reakcije in trenje",

  generate(rnd) {
    for (;;) {
      const L = rnd.step(1.5, 4, 0.5);
      const r = rnd.step(0.4, 1.2, 0.1);
      const gap = rnd.chance(0.5); // dimension the gap (28.1.2015) or the centre (22.5.2013)
      const d = gap ? Math.round((r + rnd.step(0.3, 2.5, 0.1)) * 10) / 10 : rnd.step(0.8, 3.5, 0.1);
      if (d <= r + 0.25) continue;
      const phi = deg(Math.asin(r / d));
      const b = Math.sqrt(d * d - r * r);
      if (phi < 12 || phi > 40) continue;
      if (b > L - 0.2 || L > 1.8 * d) continue; // contact well inside the rod, no long overhang
      const g = rnd.chance(0.2) ? 10 : 9.81;
      return { L, m: rnd.step(10, 200, 10), r, d, g, gap, askF: rnd.chance(0.6) };
    }
  },

  build(p) {
    const { L, m, r, d, g, gap, askF } = p;
    const R = solvePalicaPolvalj(p);
    const c = Math.cos(R.phi), sn = Math.sin(R.phi);
    const dText = gap ? `Polvalj leži na tleh tako, da je razdalja od členka A do roba polvalja ${q(d - r, "m")}` : `Središče polvalja je od členka A oddaljeno ${q(d, "m")}`;
    const answers = [ans("B", "B", "N", R.B), ans("Ax", "A_x", "N", R.Ax), ans("Ay", "A_y", "N", R.Ay)];
    if (askF) answers.push(ans("f", "f", "", R.f, { scale: R.f }));

    return {
      title: this.title,
      text: [
        `Homogen drog dolžine L = ${q(L, "m")} in mase m = ${q(m, "kg")} je v točki A členkasto pritrjen na tla in se v točki B naslanja na gladek polvalj s polmerom r = ${q(r, "m")}. ${dText} (glej sliko). Trenja ni, ${gText(g)}.`,
        `Izračunajte velikost sile B, s katero polvalj deluje na drog, in velikosti komponent reakcije v členku A (A_x vodoravno, A_y navpično).${askF ? " Kolikšen bi moral biti najmanj koeficient trenja f med polvaljem in tlemi, če polvalj ne bi bil pritrjen? Teža polvalja je zanemarljiva." : ""}`,
      ],
      figure(f) {
        const P = [R.b * c, R.b * sn];
        const E = [L * c, L * sn];
        const C = [d, 0];
        f.ground([-0.35, 0], [Math.max(d + r, E[0]) + 0.3, 0]);
        f.sector(C, r, 0, 180);
        f.member([0, 0], E);
        f.hinge([0, 0]); // pinned to the ground (členek), as on the exam sheets
        f.point([0, 0], "A", { dx: -8, dy: -8, anchor: "end", dot: false });
        f.point(P, "B", { dx: -6, dy: -12, anchor: "end" });
        f.point(C, "", {});
        const rp = [d + r * Math.cos(rad(40)), r * Math.sin(rad(40))];
        f.line(C, rp, "fig-thin");
        f.label([(C[0] + rp[0]) / 2, (C[1] + rp[1]) / 2], `r = ${q(r, "m")}`, { dx: 10, dy: 12, anchor: "start" });
        f.label([0.3 * L * c, 0.3 * L * sn], `m = ${q(m, "kg")}`, { dx: 6, dy: 20, anchor: "start" });
        f.dim([0, 0], E, `L = ${q(L, "m")}`, -34);
        if (gap) f.dim([0, 0], [d - r, 0], q(d - r, "m"), 30);
        else f.dim([0, 0], C, q(d, "m"), 30);
      },
      answers,
      solution: [
        `Teža droga: G = m·g = ${num(m)}·${num(g)} = ${num(R.G)} N, prijemlje na sredini droga (L/2 = ${num(L / 2)} m od A).`,
        `Drog je tangenta na polvalj, zato je polmer do dotikališča B pravokoten na drog: sin φ = r/d = ${num(r)}/${num(d)} → φ = ${num(deg(R.phi))}° (d = ${num(d)} m je razdalja A–središče).`,
        `Razdalja A–B vzdolž droga: b = √(d² − r²) = ${num(R.b)} m (< L, dotikališče je na drogu).`,
        "Gladek stik: sila B je pravokotna na drog (kaže skozi središče polvalja).",
        `ΣM_A = 0: B·b − G·(L/2)·cos φ = 0 → B = ${num(R.G)}·${num(L / 2)}·${num(c)}/${num(R.b)} = ${num(R.B)} N.`,
        `ΣF_x = 0: A_x − B·sin φ = 0 → A_x = ${num(R.B)}·${num(sn)} = ${num(R.Ax)} N (proti polvalju).`,
        `ΣF_y = 0: A_y + B·cos φ − G = 0 → A_y = ${num(R.G)} − ${num(R.B)}·${num(c)} = ${num(R.Ay)} N${R.Ay >= 0 ? " (navzgor)" : " (navzdol)"}.`,
        ...(askF
          ? [
              "Na polvalj deluje drog z nasprotno silo B: vodoravna komponenta B·sin φ ga potiska stran, navpična B·cos φ ga pritiska na tla (lastne teže ni).",
              `Polvalj miruje, če B·sin φ ≤ f·B·cos φ → f ≥ tan φ = ${num(R.f)}.`,
            ]
          : []),
      ],
    };
  },
};

// ---------------------------------------------------------------------------

/** Beam with a hanging half-cylinder on a half-cylinder. */
export function solveNosilecValj({ L, a, m, mn, r1, r2, e, g = 9.81 }) {
  const G = m * g;
  const Gn = mn * g;
  const phi = Math.acos(e / (r1 + r2)); // line of centres vs horizontal
  // ΣM_A = 0: B·sin φ·a − G·a − G_n·L/2 = 0 (B passes through the upper centre)
  const B = (G * a + (Gn * L) / 2) / (a * Math.sin(phi));
  const Ax = B * Math.cos(phi);
  const Ay = G + Gn - B * Math.sin(phi); // upwards; = G_n·(1 − L/2a) ≥ 0 for a ≥ L/2
  return { G, Gn, phi, B, Ax, Ay, H: (r1 + r2) * Math.sin(phi) };
}

export const nosilecValj = {
  id: "nosilec-valj",
  group: "statika",
  title: "Nosilec na polvalju",
  desc: "Nosilec s polvaljem se naslanja na drug polvalj: reakcije (sila v smeri središč)",

  generate(rnd) {
    for (;;) {
      const L = rnd.step(3, 6, 0.5);
      const a = rnd.chance(0.5) ? L : rnd.step(Math.ceil(L) / 2, L - 0.5, 0.5); // a ≥ L/2, multiple of 0.5
      const r1 = rnd.step(0.5, 1.5, 0.1);
      const r2 = rnd.chance(0.5) ? r1 : rnd.step(0.5, 1.5, 0.1);
      const e = rnd.chance(0.4) ? Math.min(r1, r2) : rnd.step(0.3, 1.8, 0.1);
      const cosp = e / (r1 + r2);
      if (cosp < 0.25 || cosp > 0.8) continue;
      const side = rnd.pick([-1, 1]); // lower centre towards the wall (−1) or away
      const phi = Math.acos(cosp);
      const H = (r1 + r2) * Math.sin(phi);
      if (H - r1 < 0.1) continue; // the hanging body must clear the ground
      if (side < 0 && a - e - r2 < 0.4) continue;
      if (a - r1 < 0.3) continue;
      const mn = rnd.chance(0.5) ? 0 : rnd.step(20, 100, 10);
      if (mn === 0 && a === L && rnd.chance(0.5)) continue; // the exam case (A_y = 0) less often
      return { L, a, m: rnd.step(100, 400, 10), mn, r1, r2, e, side, g: 9.81 };
    }
  },

  build(p) {
    const { L, a, m, mn, r1, r2, e, side } = p;
    const R = solveNosilecValj(p);
    const same = r1 === r2;
    const sp = Math.sin(R.phi), cp = Math.cos(R.phi);
    const rr = same ? `polmera r = ${q(r1, "m")}` : `polmera r_1 = ${q(r1, "m")}`;
    return {
      title: this.title,
      text: [
        `Vodoraven nosilec dolžine ${q(L, "m")} je v točki A členkasto pritrjen na steno. ${a === L ? "Na njegovem prostem koncu" : `Na razdalji ${q(a, "m")} od A`} je nanj pritrjen polvalj ${rr} in mase m = ${q(m, "kg")} (ravna ploskev ob nosilcu, središče na osi nosilca). Polvalj se v točki B naslanja na nepomičen polvalj ${same ? "enakega polmera" : `s polmerom r_2 = ${q(r2, "m")}`}, ki leži na tleh; njegovo središče je vodoravno zamaknjeno za ${q(e, "m")} ${side < 0 ? "proti steni" : "stran od stene"}.`,
        `${mn ? `Masa nosilca je ${q(mn, "kg")}` : "Masa nosilca je zanemarljiva"}, trenja ni, g = 9,81 m/s². Izračunajte velikosti reakcijskih sil v A (A_x, A_y) in v stiku B.`,
      ],
      figure(f) {
        const H = R.H;
        const O1 = [a, H], O2 = [a + side * e, 0];
        const xr = Math.max(L, a + r1, O2[0] + r2) + 0.4;
        f.ground([0, H + 0.7], [0, -0.0]);
        f.ground([0, 0], [xr, 0]);
        f.sector(O2, r2, 0, 180);
        f.sector(O1, r1, 180, 360);
        f.member([0, H], [L, H]);
        f.pin([0, H], 0);
        f.point([0, H], "A", { dx: 6, dy: -10, dot: false });
        f.point(O1, "", {});
        f.point(O2, "", {});
        const Bp = [O2[0] + (O1[0] - O2[0]) * (r2 / (r1 + r2)), O1[1] * (r2 / (r1 + r2))];
        f.point(Bp, "B", { dx: side < 0 ? 8 : -8, dy: 4, anchor: side < 0 ? "start" : "end" });
        f.label([a, H - r1 * 0.45], "m", { dx: side < 0 ? 12 : -12 });
        // radii: upper to the lower side away from the contact, lower at 135° / 45°
        const k1 = rad(side < 0 ? 300 : 240);
        const p1 = [a + r1 * Math.cos(k1), H + r1 * Math.sin(k1)];
        f.line(O1, p1, "fig-thin");
        f.label(p1, same ? "r" : "r_1", { dx: side < 0 ? 10 : -10, dy: 6 });
        const k2 = rad(side < 0 ? 140 : 40);
        const p2 = [O2[0] + r2 * Math.cos(k2), r2 * Math.sin(k2)];
        f.line(O2, p2, "fig-thin");
        f.label(p2, same ? "r" : "r_2", { dx: side < 0 ? -10 : 10, dy: -2 });
        f.dashed(O1, [a, 0]);
        f.dim([0, H], [L, H], q(L, "m"), -24);
        if (a !== L) f.dim([0, H], [a, H], q(a, "m"), -48);
        const lo = side < 0 ? [O2, [a, 0]] : [[a, 0], O2];
        f.dim(lo[0], lo[1], q(e, "m"), -26);
      },
      answers: [ans("Ax", "A_x", "N", R.Ax), ans("Ay", "A_y", "N", Math.abs(R.Ay)), ans("B", "B", "N", R.B)],
      solution: [
        `Teža polvalja: G = m·g = ${num(m)}·9,81 = ${num(R.G)} N; prijemlje pod središčem, na razdalji ${num(a)} m od A.${mn ? ` Teža nosilca: G_n = ${num(R.Gn)} N na sredini (${num(L / 2)} m od A).` : ""}`,
        `Gladek stik dveh krožnih ploskev: sila B leži na zveznici obeh središč. Razdalja središč je r_1 + r_2 = ${num(r1 + r2)} m, vodoravni zamik ${num(e)} m → cos φ = ${num(e)}/${num(r1 + r2)}, φ = ${num(deg(R.phi))}° (kot zveznice z vodoravnico).`,
        `ΣM_A = 0: B·sin φ·${num(a)} − G·${num(a)}${mn ? ` − G_n·${num(L / 2)}` : ""} = 0 → B = ${num(R.B)} N.`,
        `ΣF_x = 0: A_x = B·cos φ = ${num(R.B)}·${num(cp)} = ${num(R.Ax)} N (${side < 0 ? "B potiska nosilec stran od stene, A_x ga drži k steni" : "B potiska nosilec proti steni, A_x deluje stran od stene"}).`,
        `ΣF_y = 0: A_y = G${mn ? " + G_n" : ""} − B·sin φ = ${num(R.G + R.Gn)} − ${num(R.B * sp)} = ${num(R.Ay)} N${Math.abs(R.Ay) < 1e-6 ? "" : " (navzgor)"}.`,
      ],
    };
  },
};

// ---------------------------------------------------------------------------

/** Sphere on a cord against one wall or in a corner of two walls. */
export function solveKroglaVrv({ corner, r, l, G }) {
  const a = corner ? r * Math.SQRT2 : r; // horizontal distance centre – cord's anchor line
  const phi = Math.asin(a / (l + r)); // cord vs vertical
  const S = G / Math.cos(phi);
  const H = G * Math.tan(phi);
  return { a, phi, S, H, N: corner ? H / Math.SQRT2 : H };
}

export const kroglaVrv = {
  id: "krogla-vrv",
  group: "statika",
  title: "Krogla na vrvici ob steni",
  desc: "Krogla visi na vrvici ob gladki steni (ali v kotu dveh sten): sila v vrvici in reakcije",

  generate(rnd) {
    for (;;) {
      const corner = rnd.chance(0.4);
      const r = rnd.step(4, 20, 1);
      const l = rnd.step(5, 50, 5);
      const a = corner ? r * Math.SQRT2 : r;
      const phi = deg(Math.asin(a / (l + r)));
      if (!(phi >= 8 && phi <= 55)) continue;
      const byMass = rnd.chance(0.5);
      const m = rnd.step(2, 30, 1);
      const G = byMass ? m * 9.81 : rnd.step(50, 400, 10);
      return { corner, r, l, G, m: byMass ? m : null };
    }
  },

  build(p) {
    const { corner, r, l, G, m } = p;
    const R = solveKroglaVrv(p);
    const load = m ? `mase m = ${q(m, "kg")} (g = 9,81 m/s²)` : `s težo G = ${q(G, "N")}`;
    const phiDeg = deg(R.phi);
    return {
      title: this.title,
      text: corner
        ? [
            `Krogla s polmerom r = ${q(r, "cm")} ${load} visi na vrvici dolžine l = ${q(l, "cm")}, ki je pritrjena v kotu, na stičnici dveh navpičnih, med seboj pravokotnih gladkih sten. Krogla se dotika obeh sten, podaljšek vrvice gre skozi središče krogle.`,
            "Izračunajte silo v vrvici S in velikost sile N, s katero krogla pritiska na vsako od sten. Trenja ni.",
          ]
        : [
            `Krogla s polmerom r = ${q(r, "cm")} ${load} visi ob navpični gladki steni na vrvici dolžine l = ${q(l, "cm")}, ki je pritrjena na steno. Podaljšek vrvice gre skozi središče krogle.`,
            "Izračunajte silo v vrvici S in velikost reakcije stene N. Trenja ni.",
          ],
      figure: corner
        ? (f) => {
            // Oblique view of the corner (walls x = 0 and y = 0, edge along z)
            // and, on the right, the plan view (tloris).
            const zc = r + 4, zt = zc + (l + r) * Math.cos(R.phi);
            const W = 2.4 * r + 6, D = 2.4 * r + 6, top = zt + 4;
            const P = (x, y, z) => iso([x, y, z]);
            f.polygon([P(0, 0, 0), P(0, W, 0), P(0, W, top), P(0, 0, top)], "fig-thin");
            f.polygon([P(0, 0, 0), P(D, 0, 0), P(D, 0, top), P(0, 0, top)], "fig-thin");
            const C = P(r, r, zc);
            const k = l / (l + r);
            const Tp = P(k * r, k * r, zt - k * (zt - zc));
            f.line(P(0, 0, zt), Tp, "fig-rope");
            f.circle(C, r);
            f.dashed(Tp, C);
            f.hinge(P(0, 0, zt));
            f.point(C, "", {});
            const mid = P((k * r) / 2, (k * r) / 2, zt - (k * (zt - zc)) / 2);
            f.label(mid, `l = ${q(l, "cm")}`, { dx: 10, anchor: "start" });
            f.label([C[0] + r, C[1]], `r = ${q(r, "cm")}`, { dx: 8, dy: -4, anchor: "start" });
            f.label([C[0] + r, C[1]], m ? `m = ${q(m, "kg")}` : `G = ${q(G, "N")}`, { dx: 8, dy: 14, anchor: "start" });
            // plan view: the corner at the top left, the sphere touching both walls
            const X0 = W + 2.2 * r + 4, Y0 = top - 2;
            const a = 2.6 * r;
            f.ground([X0 + a, Y0], [X0, Y0]);
            f.ground([X0, Y0], [X0, Y0 - a]);
            f.circle([X0 + r, Y0 - r], r);
            f.point([X0 + r, Y0 - r], "", {});
            f.dashed([X0, Y0], [X0 + r, Y0 - r]);
            f.hinge([X0, Y0]);
            f.line([X0 + r, Y0 - r], [X0 + 2 * r, Y0 - r], "fig-thin");
            f.label([X0 + 1.5 * r, Y0 - r], "r", { dy: -4 });
            f.label([X0 + a / 2, Y0 - a], "tloris", { dy: 16 });
          }
        : (f) => {
            const yt = (l + r) * Math.cos(R.phi);
            const top = yt + Math.max(4, 0.3 * (l + r));
            f.ground([0, -r - 4], [0, top]);
            const C = [R.a, 0];
            const T = [0, yt];
            const k = l / (l + r);
            const Sp = [k * r, yt * (1 - k)];
            f.line(T, Sp, "fig-rope");
            f.circle(C, r);
            f.dashed(Sp, C);
            f.hinge(T);
            f.point(C, "", {});
            f.label([Sp[0] / 2, (T[1] + Sp[1]) / 2], `l = ${q(l, "cm")}`, { dx: 10, anchor: "start" });
            const rp = [r + r * Math.cos(rad(-30)), r * Math.sin(rad(-30))];
            f.line(C, rp, "fig-thin");
            f.label(rp, `r = ${q(r, "cm")}`, { dx: 8, dy: 8, anchor: "start" });
            f.label([r, -r], m ? `m = ${q(m, "kg")}` : `G = ${q(G, "N")}`, { dy: 18 });
          },
      answers: [ans("S", "S", "N", R.S), ans("N", "N", "N", R.N)],
      solution: [
        ...(m ? [`G = m·g = ${num(m)}·9,81 = ${num(G)} N.`] : []),
        `Na kroglo delujejo teža G, sila vrvice S (v smeri vrvice, skozi središče) in ${corner ? "sili obeh sten" : "sila stene"} (pravokotno na steno, skozi središče): vse sile gredo skozi središče krogle.`,
        corner
          ? `Središče je od obeh sten oddaljeno r, od stičnice sten pa vodoravno a = r·√2 = ${num(R.a)} cm. Vrvica s podaljškom do središča meri l + r = ${num(l + r)} cm.`
          : `Središče je od stene oddaljeno r = ${num(r)} cm, vrvica s podaljškom do središča meri l + r = ${num(l + r)} cm.`,
        `Kot vrvice z navpičnico: sin φ = ${corner ? "a" : "r"}/(l + r) = ${num(R.a)}/${num(l + r)} → φ = ${num(phiDeg)}°.`,
        `ΣF_z = 0: S·cos φ = G → S = ${num(G)}/${num(Math.cos(R.phi))} = ${num(R.S)} N.`,
        corner
          ? `Vodoravna komponenta vrvice H = S·sin φ = G·tan φ = ${num(R.H)} N leži v simetrali kota; uravnovešata jo pravokotni sili sten: N = H/√2 = ${num(R.N)} N (vsaka stena).`
          : `ΣF_x = 0: N = S·sin φ = G·tan φ = ${num(R.N)} N.`,
      ],
    };
  },
};
