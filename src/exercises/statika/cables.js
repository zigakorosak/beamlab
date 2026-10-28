// Parabolična vrv (a cable under a load q uniform along the horizontal):
//   vrv-parabola   four exam set-ups, one exercise:
//     simetricna   supports at the same height, span L, sag f
//                  → H, V, S_max, angle at the support (22.5.2013)
//     skripec      same height, the right end runs over a smooth pulley and
//                  carries a weight Q: given f → H, V, Q; or given Q → H, f
//                  (21.1.2013)
//     sila         different heights, known force S_B and its angle at the
//                  lower support B → H, vertex, h, b, S_max (29.1.2009)
//     visina       different heights h, depth b of the vertex below B
//                  → H, vertex, S_max, angle at A
//
// From the notes (Vrvni sistemi): with the vertex at the origin
// z(x) = q·x²/(2H), the vertical force at distance x from the vertex is
// V = q·x, and S = √(H² + V²) is largest at the support farther from the
// vertex (the higher one). A is always the left, higher support.

import { ans, angleAns, deg, num, q as qty } from "../kit.js";

const VARIANTS = ["simetricna", "skripec", "sila", "visina"];

export function solveCable(params) {
  const { variant, q } = params;
  let H, l, xA, xB;
  if (variant === "simetricna" || variant === "skripec") {
    l = params.l;
    xA = xB = l / 2;
    if (params.f !== undefined) H = (q * l * l) / (8 * params.f);
    else {
      const V = (q * l) / 2;
      H = Math.sqrt(params.Q ** 2 - V ** 2);
    }
  } else if (variant === "sila") {
    l = params.l;
    const a = (params.alpha * Math.PI) / 180;
    H = params.S * Math.cos(a);
    xB = (params.S * Math.sin(a)) / q;
    xA = l - xB;
  } else {
    // visina: z_A = b + h, z_B = b; x = √(2H z / q) and x_A + x_B = l
    l = params.l;
    const sA = Math.sqrt(params.b + params.h), sB = Math.sqrt(params.b);
    H = (q * l * l) / (2 * (sA + sB) ** 2);
    xA = (l * sA) / (sA + sB);
    xB = l - xA;
  }
  const zA = (q * xA * xA) / (2 * H);
  const zB = (q * xB * xB) / (2 * H);
  const VA = q * xA, VB = q * xB;
  const SA = Math.hypot(H, VA), SB = Math.hypot(H, VB);
  return { H, l, xA, xB, zA, zB, h: zA - zB, b: zB, f: zB, VA, VB, SA, SB, Smax: Math.max(SA, SB), alphaA: deg(Math.atan(VA / H)), alphaB: deg(Math.atan(VB / H)) };
}

export const vrvParabola = {
  id: "vrv-parabola",
  group: "statika",
  title: "Parabolična vrv",
  desc: "Vrv pod enakomerno obtežbo: H, lega temena, največja sila v vrvi",

  generate(r) {
    for (;;) {
      const variant = r.pick(VARIANTS);
      const q = r.pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50]);
      let params;
      if (variant === "simetricna") {
        const l = r.step(10, 80, 5);
        params = { variant, q, l, f: r.step(Math.max(0.5, Math.ceil(l / 20 / 0.5) * 0.5), l / 6, 0.5) };
      } else if (variant === "skripec") {
        const l = r.step(2, 40, 1);
        if (r.chance(0.5)) {
          const st = l < 6 ? 0.05 : 0.5;
          params = { variant, q, l, f: r.step(Math.max(st, Math.ceil(l / 25 / st) * st), l / 6, st) };
        }
        else {
          // A round weight that gives a sag between l/25 and l/6.
          const V = (q * l) / 2;
          const H = (q * l) / (8 * (r.int(5, 25) / 100));
          const st = Math.hypot(H, V) < 50 ? 1 : 5;
          const Q = Math.round(Math.hypot(H, V) / st) * st;
          params = { variant, q, l, Q };
        }
      } else if (variant === "sila") {
        // Pick the geometry, then state S_B and α_B rounded as on the exam.
        const xB = r.step(5, 30, 5);
        const xA = xB + r.step(5, 40, 5);
        const H = r.step(100, 3000, 50);
        const VB = q * xB;
        params = { variant, q, l: xA + xB, S: Math.round(Math.hypot(H, VB) * 1000) / 1000, alpha: Math.round(deg(Math.atan(VB / H)) * 100) / 100 };
      } else {
        params = { variant, q, l: r.step(20, 80, 5), h: r.step(1, 10, 0.5), b: r.step(1, 6, 0.5) };
      }
      const s = solveCable(params);
      if (!(s.H > 0) || !(s.xB > 0) || !(s.xA > 0)) continue;
      // A cable that looks like one: deepest point l/30 … l/4 below A.
      const depth = Math.max(s.zA, s.zB);
      if (depth < s.l / 30 || depth > s.l / 4) continue;
      if (variant === "sila" && s.h < 0.5) continue;
      // Both supports clearly above the vertex (else the sketch is a crowd).
      if (s.zB < 0.12 * s.zA) continue;
      return params;
    }
  },

  build(params) {
    const { variant, q } = params;
    const s = solveCable(params);
    const Q = (v) => qty(v, "N");
    const common = `Vrv je obremenjena z enakomerno zvezno obtežbo q = ${qty(q, "N/m")} (po vodoravni projekciji), lastno težo vrvi zanemarimo.`;
    let text, answers, solution;
    const sumS = (x, V) => `√(H² + V²) = √(${num(s.H)}² + ${num(V)}²)`;

    if (variant === "simetricna") {
      text = [
        `Vrv je vpeta med podporama A in B na enaki višini, razpetina je L = ${qty(s.l, "m")}, poves na sredini je f = ${qty(params.f, "m")}. ${common}`,
        "Izračunajte vodoravno komponento sile v vrvi H, navpično komponento V in največjo silo v vrvi S_{max} ter kot α, ki ga vrv oklepa z vodoravnico ob podpori.",
      ];
      answers = [ans("H", "H", "N", s.H), ans("V", "V", "N", s.VA), ans("Smax", "S_{max}", "N", s.Smax), angleAns("alpha", "α", s.alphaA)];
      solution = [
        `Teme parabole je na sredini: x_A = x_B = L/2 = ${num(s.xA)} m.`,
        `z(x) = q·x²/(2H) → f = q·(L/2)²/(2H) → H = q·L²/(8f) = ${num(q)}·${num(s.l)}²/(8·${num(params.f)}) = ${num(s.H)} N.`,
        `V = q·L/2 = ${num(q)}·${num(s.xA)} = ${num(s.VA)} N.`,
        `S_{max} = ${sumS(0, s.VA)} = ${num(s.Smax)} N (na obeh podporah).`,
        `tg α = V/H = ${num(s.VA / s.H)} → α = ${num(s.alphaA)}°.`,
      ];
    } else if (variant === "skripec") {
      const intro = `Vrv je pritrjena v točki A, na drugi strani pa je speljana čez majhen gladek škripec B na enaki višini (razpetina l = ${qty(s.l, "m")}); na koncu vrvi visi utež s težo Q. ${common}`;
      if (params.f !== undefined) {
        text = [intro, `Poves vrvi na sredini je f = ${qty(params.f, "m")}. Izračunajte H, navpično komponento sile ob podpori V in težo uteži Q.`];
        answers = [ans("H", "H", "N", s.H), ans("V", "V", "N", s.VB), ans("Q", "Q", "N", s.SB)];
        solution = [
          `Simetrija: teme je na sredini, x = l/2 = ${num(s.xB)} m.`,
          `H = q·l²/(8f) = ${num(q)}·${num(s.l)}²/(8·${num(params.f)}) = ${num(s.H)} N.`,
          `V = q·l/2 = ${num(s.VB)} N.`,
          `Škripec je gladek, zato je sila v vrvi pred in za njim enaka: Q = S_B = ${sumS(0, s.VB)} = ${num(s.SB)} N.`,
        ];
      } else {
        text = [`${intro.replace("s težo Q", `s težo Q = ${Q(params.Q)}`)}`, "Izračunajte vodoravno komponento sile v vrvi H, poves vrvi na sredini f in kot α med vrvjo in vodoravnico ob podpori."];
        answers = [ans("H", "H", "N", s.H), ans("f", "f", "m", s.f), angleAns("alpha", "α", s.alphaB)];
        solution = [
          `Škripec je gladek: sila v vrvi ob B je enaka teži uteži, S_B = Q = ${Q(params.Q)}.`,
          `Simetrija: V = q·l/2 = ${num(q)}·${num(s.xB)} = ${num(s.VB)} N.`,
          `H = √(Q² − V²) = √(${num(params.Q)}² − ${num(s.VB)}²) = ${num(s.H)} N.`,
          `f = q·(l/2)²/(2H) = q·l²/(8H) = ${num(s.f)} m.`,
          `tg α = V/H = ${num(s.VB / s.H)} → α = ${num(s.alphaB)}°.`,
        ];
      }
    } else if (variant === "sila") {
      text = [
        `Vrv je vpeta v podporah A in B, B je nižje od A. Vodoravna razdalja med podporama je l = ${qty(s.l, "m")}. ${common}`,
        `Sila v vrvi ob podpori B je S_B = ${num(params.S, 7)} N in oklepa z vodoravnico kot α_B = ${num(params.alpha, 5)}°.`,
        "Izračunajte H, vodoravno razdaljo x_B od B do temena, višinsko razliko podpor h, globino temena b pod podporo B in največjo silo v vrvi S_{max}.",
      ];
      answers = [ans("H", "H", "N", s.H), ans("xB", "x_B", "m", s.xB), ans("h", "h", "m", s.h), ans("b", "b", "m", s.b), ans("Smax", "S_{max}", "N", s.Smax)];
      solution = [
        `H = S_B·cos α_B = ${num(params.S, 7)}·cos ${num(params.alpha, 5)}° = ${num(s.H)} N; V_B = S_B·sin α_B = ${num(s.VB)} N.`,
        `V_B = q·x_B → x_B = V_B/q = ${num(s.VB)}/${num(q)} = ${num(s.xB)} m; x_A = l − x_B = ${num(s.xA)} m.`,
        `b = z_B = q·x_B²/(2H) = ${num(q)}·${num(s.xB)}²/(2·${num(s.H)}) = ${num(s.b)} m.`,
        `z_A = q·x_A²/(2H) = ${num(s.zA)} m → h = z_A − z_B = ${num(s.h)} m.`,
        `Največja sila je ob višji podpori A: V_A = q·x_A = ${num(s.VA)} N, S_{max} = ${sumS(0, s.VA)} = ${num(s.Smax)} N.`,
      ];
    } else {
      text = [
        `Vrv je vpeta v podporah A in B; podpora A je za h = ${qty(params.h, "m")} višje od B, vodoravna razdalja med podporama je l = ${qty(s.l, "m")}. Najnižja točka vrvi (teme) je b = ${qty(params.b, "m")} pod podporo B. ${common}`,
        "Izračunajte vodoravno komponento sile v vrvi H, vodoravno razdaljo x_A od A do temena, največjo silo v vrvi S_{max} in kot α_A med vrvjo in vodoravnico ob podpori A.",
      ];
      answers = [ans("H", "H", "N", s.H), ans("xA", "x_A", "m", s.xA), ans("Smax", "S_{max}", "N", s.Smax), angleAns("alphaA", "α_A", s.alphaA)];
      solution = [
        `Teme v izhodišču: z = q·x²/(2H) → x = √(2H·z/q). Višini podpor nad temenom: z_A = b + h = ${num(s.zA)} m, z_B = b = ${num(s.zB)} m.`,
        `x_A + x_B = l → √(2H/q)·(√z_A + √z_B) = l → H = q·l²/(2(√z_A + √z_B)²) = ${num(q)}·${num(s.l)}²/(2·(${num(Math.sqrt(s.zA))} + ${num(Math.sqrt(s.zB))})²) = ${num(s.H)} N.`,
        `x_A = l·√z_A/(√z_A + √z_B) = ${num(s.xA)} m, x_B = l − x_A = ${num(s.xB)} m.`,
        `Največja sila je ob višji podpori A: V_A = q·x_A = ${num(s.VA)} N, S_{max} = ${sumS(0, s.VA)} = ${num(s.Smax)} N.`,
        `tg α_A = V_A/H = ${num(s.VA / s.H)} → α_A = ${num(s.alphaA)}°.`,
      ];
    }

    return {
      title: this.title,
      text,
      figure(f) {
        drawCable(f, params, s);
      },
      answers,
      solution,
    };
  },
};

/**
 * The cable as on the exam sketch: A on the left, B on the right, vertex
 * below. Heights are exaggerated when the cable is very flat (it's a
 * sketch, the dimensions carry the numbers).
 */
function drawCable(f, params, s) {
  const { variant, q } = params;
  const l = s.l;
  const depth = Math.max(s.zA, s.zB);
  const k = Math.max(1, (0.3 * l) / depth); // vertical exaggeration
  const level = variant === "simetricna" || variant === "skripec";
  const V = s.xA; // vertex x from A
  const z = (x) => k * ((q * (x - V) ** 2) / (2 * s.H)); // height above the vertex, drawn
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const x = (l * i) / 60;
    pts.push([x, z(x)]);
  }
  const A = [0, z(0)], B = [l, z(l)];
  f.polyline(pts, "fig-rope");
  f.pin(A, 270);
  f.label(A, "A", level ? { dx: -16, dy: 4, cls: "fig-name" } : { dx: 14, dy: 12, anchor: "start", cls: "fig-name" });
  const top = Math.max(A[1], B[1]);
  const u = l / 12; // a drawing unit
  // The load's name beside the curve, on the longer side of the vertex.
  if (level) f.label([V + 0.3 * l, z(V + 0.3 * l)], `q = ${qty(q, "N/m")}`, { dy: -10, cls: "fig-force-label" });
  else f.label([V, 0], `q = ${qty(q, "N/m")}`, { dy: 20, cls: "fig-force-label" });
  // Span on top.
  f.dim([0, top + 1.2 * u], [l, top + 1.2 * u], `${variant === "simetricna" ? "L" : "l"} = ${qty(l, "m")}`, -4);

  if (variant === "simetricna" || variant === "skripec") {
    if (variant === "simetricna") {
      f.pin(B, 270);
      f.label(B, "B", { dx: 16, dy: 4, cls: "fig-name" });
    } else drawPulley(f, B, u, params.Q !== undefined ? `Q = ${qty(params.Q, "N")}` : "Q");
    f.dashed(A, B);
    if (params.f !== undefined) f.dim([l / 2, A[1]], [l / 2, 0], `f = ${qty(params.f, "m")}`, -8);
    else f.dim([l / 2, A[1]], [l / 2, 0], "f = ?", -8);
  } else {
    f.pin(B, 270);
    f.label(B, "B", variant === "sila" ? { dx: -18, dy: -6, cls: "fig-name" } : { dx: 16, dy: 4, cls: "fig-name" });
    // Horizontal guide lines at A, B and the vertex, dimensions on the left.
    f.dashed([0, 0], [l + 2 * u, 0]);
    f.dashed([-1.2 * u, B[1]], [l + 2 * u, B[1]]);
    const hTxt = variant === "visina" ? `h = ${qty(params.h, "m")}` : "h = ?";
    const bTxt = variant === "visina" ? `b = ${qty(params.b, "m")}` : "b = ?";
    f.dim([-1.2 * u, B[1]], [-1.2 * u, A[1]], hTxt, 14);
    f.dim([l + 2 * u, B[1]], [l + 2 * u, 0], bTxt, 14);
    if (variant === "sila") {
      const ang = params.alpha;
      // Values in the text; the sketch names them (like the exam's S, α).
      f.force(B, ang, { tail: true, world: 2 * u, label: "S_B", labelAt: "end" });
      f.dashed(B, [l + 2.2 * u, B[1]]);
      f.angle(B, 0, ang, "", 40);
      f.label([l + 2.2 * u, B[1]], "α_B", { dx: 4, dy: 18, anchor: "end", cls: "fig-angle-label" });
    }
  }
}

/** A small pulley at the right end with the rope going down to a weight. */
function drawPulley(f, B, u, label) {
  const r = 0.35 * u;
  const c = [B[0], B[1] - r];
  f.circle(c, r, "fig-body");
  f.hinge(c);
  // Bracket to a wall on the right.
  f.member(c, [c[0] + 1.5 * r + 0.6 * u, c[1]]);
  f.ground([c[0] + 1.5 * r + 0.6 * u, c[1] + 0.8 * u], [c[0] + 1.5 * r + 0.6 * u, c[1] - 0.8 * u]);
  const yW = c[1] - 3 * u;
  f.line([c[0] + r, c[1]], [c[0] + r, yW + 0.6 * u]);
  f.rect(c[0] + r - 0.4 * u, yW - 0.2 * u, 0.8 * u, 0.8 * u);
  f.bounds([[c[0] + r + 3 * u, yW]]); // room for the label
  f.label([c[0] + r + 0.4 * u, yW + 0.2 * u], label, { dx: 8, dy: 4, anchor: "start", cls: "fig-force-label" });
  f.label(B, "B", { dx: -2, dy: -14, cls: "fig-name" });
}
