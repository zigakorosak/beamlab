// Torzija tankostenskih prerezov: the same tube closed (Bredt) and slit
// open along its length.
//   zaprt:  τ = M_T/(2 A_m t), A_m = area inside the MIDLINE,
//           I_T = 4 A_m²/∮ds/t
//   odprt:  I_t = Σ s_i t_i³/3, τ_max = M_T t_max/I_t
// Sections: a circular tube (outer D, wall t) or a rectangular box (outer
// B × H, flanges t_1, webs t_2). Dimensions in mm, M_T in kNm, τ in MPa.

import { ans, num, q } from "../kit.js";
import { svgText } from "../draw.js";

/** Midline geometry: segments [{ s, t }] (lengths in mm) and A_m [mm²]. */
export function thinWalled(p) {
  if (p.kind === "cev") {
    const rm = (p.D - p.t) / 2;
    return { rm, Am: Math.PI * rm * rm, segs: [{ s: 2 * Math.PI * rm, t: p.t }] };
  }
  const b = p.B - p.t2, h = p.H - p.t1; // midline: half a wall off each outer edge
  return { b, h, Am: b * h, segs: [{ s: b, t: p.t1 }, { s: b, t: p.t1 }, { s: h, t: p.t2 }, { s: h, t: p.t2 }] };
}

export function torsionThin(p) {
  const g = thinWalled(p);
  const M = p.M * 1e6; // Nmm
  const tmin = Math.min(...g.segs.map((x) => x.t)), tmax = Math.max(...g.segs.map((x) => x.t));
  const tauZ = M / (2 * g.Am * tmin);
  const intDs = g.segs.reduce((a, x) => a + x.s / x.t, 0);
  const ITz = (4 * g.Am ** 2) / intDs;
  const ITo = g.segs.reduce((a, x) => a + (x.s * x.t ** 3) / 3, 0);
  const tauO = (M * tmax) / ITo;
  return { ...g, tmin, tmax, tauZ, intDs, ITz, ITo, tauO, ratio: ITz / ITo };
}

export const tankostenski = {
  id: "torzija-tankostenski",
  group: "trdnost",
  title: "Torzija tankostenskih prerezov",
  desc: "Zaprt prerez (Bredt, A_m znotraj sredinčnice) proti odprtemu (prerezanemu) prerezu",

  generate(r) {
    for (;;) {
      const p = r.chance(0.45)
        ? { kind: "cev", D: r.step(60, 200, 10), t: r.step(2, 8, 1), M: r.step(0.2, 3, 0.1) }
        : { kind: "skatla", B: r.step(60, 200, 10), H: r.step(80, 250, 10), t1: r.step(3, 10, 1), t2: r.step(3, 10, 1), M: r.step(0.2, 3, 0.1) };
      if (p.kind === "cev" && p.D / p.t < 15) continue;
      if (p.kind === "skatla" && (Math.min(p.B, p.H) / Math.max(p.t1, p.t2) < 10 || p.H === p.B)) continue;
      const x = torsionThin(p);
      if (x.tauZ < 3 || x.tauO > 250) continue;
      return p;
    }
  },

  build(p) {
    const x = torsionThin(p);
    const cev = p.kind === "cev";
    const secText = cev
      ? `cev z zunanjim premerom D = ${p.D} mm in debelino stene t = ${p.t} mm`
      : `pravokotna škatla z zunanjima merama B = ${p.B} mm (širina) in H = ${p.H} mm (višina); debelina vodoravnih sten je t_1 = ${p.t1} mm, navpičnih t_2 = ${p.t2} mm`;
    return {
      title: this.title,
      text: [
        `Tankostenski nosilec je obremenjen s torzijskim momentom M_T = ${q(p.M, "kNm")}. Prerez je ${secText}.`,
        `Primerjajte a) zaprt prerez in b) enak prerez, ki je po vsej dolžini prerezan (odprt${cev ? "" : "; reža je v eni od navpičnih sten"}).`,
        "Izračunajte ploščino A_m, ki jo oklepa sredinčnica, največjo strižno napetost v zaprtem in v odprtem prerezu ter razmerje torzijskih vztrajnostnih momentov I_{T,zaprt}/I_{t,odprt}.",
      ],
      figure(f) {
        drawPair(f, p);
      },
      answers: [
        ans("Am", "A_m", "cm²", x.Am / 100),
        ans("tz", "τ_{max,zaprt}", "MPa", x.tauZ),
        ans("to", "τ_{max,odprt}", "MPa", x.tauO),
        ans("ratio", "I_{T,zaprt}/I_{t,odprt}", "", x.ratio),
      ],
      solution: [
        cev
          ? `Sredinčnica: r_m = (D − t)/2 = (${p.D} − ${p.t})/2 = ${num(x.rm)} mm; A_m = π r_m² = ${num(x.Am)} mm² = ${num(x.Am / 100)} cm².`
          : `Sredinčnica je pol debeline stene od zunanjega roba: b = B − t_2 = ${num(x.b)} mm, h = H − t_1 = ${num(x.h)} mm; A_m = b·h = ${num(x.Am)} mm² = ${num(x.Am / 100)} cm².`,
        `a) Zaprt prerez (1. Bredtova enačba): τ_{max} = M_T/(2 A_m t_{min}) = ${num(p.M * 1e6)}/(2·${num(x.Am)}·${num(x.tmin)}) = ${num(x.tauZ)} MPa.`,
        cev
          ? `∮ds/t = 2π r_m/t = ${num(x.intDs)}; I_T = 4A_m²/∮ds/t = ${num(x.ITz)} mm⁴.`
          : `∮ds/t = 2b/t_1 + 2h/t_2 = ${num(x.intDs)}; I_T = 4A_m²/∮ds/t = ${num(x.ITz)} mm⁴ (2. Bredtova enačba).`,
        cev
          ? `b) Odprt prerez (ena lamela dolžine s = 2π r_m = ${num(x.segs[0].s)} mm): I_t = s t³/3 = ${num(x.ITo)} mm⁴.`
          : `b) Odprt prerez (lamele po sredinčnici): I_t = Σ s_i t_i³/3 = (2·${num(x.b)}·${p.t1}³ + 2·${num(x.h)}·${p.t2}³)/3 = ${num(x.ITo)} mm⁴.`,
        `τ_{max} = M_T t_{max}/I_t = ${num(p.M * 1e6)}·${num(x.tmax)}/${num(x.ITo)} = ${num(x.tauO)} MPa.`,
        `Razmerje: I_{T,zaprt}/I_{t,odprt} = ${num(x.ITz)}/${num(x.ITo)} = ${num(x.ratio)}; napetost v odprtem prerezu je ${num(x.tauO / x.tauZ)}-krat večja. Zaprt prerez je pri torziji neprimerno boljši.`,
      ],
    };
  },
};

// Both sections side by side: a) closed, b) slit open. World units = mm.
function drawPair(f, p) {
  const cev = p.kind === "cev";
  const W = cev ? p.D : p.B, H = cev ? p.D : p.H;
  const gap = W * 0.9;
  const cx = [W / 2, W / 2 + W + gap];
  // Thin walls are drawn thicker than to scale so they stay visible.
  const tMax = cev ? p.t : Math.max(p.t1, p.t2);
  const vis = (t) => t * Math.max(1, (Math.min(W, H) * 0.05) / tMax);
  for (const [i, open] of [[0, false], [1, true]]) {
    const c = [cx[i], 0];
    if (cev) ring(f, c, p.D / 2, vis(p.t), open);
    else box(f, c, p.B, p.H, vis(p.t1), vis(p.t2), open);
    f.label([c[0], -H / 2], open ? "b) odprt" : "a) zaprt", { dy: 36 });
  }
  const c = [cx[0], 0];
  if (cev) {
    f.dim([c[0] - W / 2, H / 2], [c[0] + W / 2, H / 2], `D = ${p.D} mm`, -16);
    f.label([c[0] + (W / 2) * 0.72, -(H / 2) * 0.72], `t = ${p.t} mm`, { dx: 8, dy: 10, anchor: "start" });
  } else {
    f.dim([c[0] - W / 2, H / 2], [c[0] + W / 2, H / 2], `B = ${p.B} mm`, -16);
    f.dim([c[0] - W / 2, -H / 2], [c[0] - W / 2, H / 2], `H = ${p.H} mm`, -18);
    f.label([c[0], H / 2 - vis(p.t1)], `t_1 = ${p.t1} mm`, { dy: 16 });
    // Inside, by the right web, or (a low box on a phone, t_1's label in the way) outside it.
    f.custom([[c[0] + W / 2, 0]], (T) => {
      const t = svgText(T.X(c[0] + W / 2 - vis(p.t2)) - 6, T.Y(0) + 4, `t_2 = ${p.t2} mm`, { class: "fig-label", "text-anchor": "end" });
      t.alts = [[Number(t.getAttribute("x")), T.Y(0) + 4, "end"], [T.X(c[0] + W / 2) + 6, T.Y(0) + 4, "start"]];
      return t;
    });
  }
}

function ring(f, c, R, t, open) {
  const a0 = open ? 4 : 0, a1 = open ? 356 : 360;
  const n = 72;
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    outer.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
    inner.push([c[0] + (R - t) * Math.cos(a), c[1] + (R - t) * Math.sin(a)]);
  }
  if (open) f.polygon([...outer, ...inner.reverse()]);
  else {
    f.circle(c, R);
    f.circle(c, R - t, "fig-hole");
  }
}

function box(f, c, B, H, t1, t2, open) {
  const x0 = c[0] - B / 2, x1 = c[0] + B / 2, y0 = c[1] - H / 2, y1 = c[1] + H / 2;
  if (!open) {
    f.rect(x0, y0, B, H);
    f.rect(x0 + t2, y0 + t1, B - 2 * t2, H - 2 * t1, "fig-hole");
    return;
  }
  // Slit in the right web, at mid-height.
  const g = Math.max(H * 0.04, 2);
  f.polygon([
    [x1, c[1] + g], [x1, y1], [x0, y1], [x0, y0], [x1, y0], [x1, c[1] - g],
    [x1 - t2, c[1] - g], [x1 - t2, y0 + t1], [x0 + t2, y0 + t1], [x0 + t2, y1 - t1], [x1 - t2, y1 - t1], [x1 - t2, c[1] + g],
  ]);
}

