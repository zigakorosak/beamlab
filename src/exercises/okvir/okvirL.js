// okvir-l: an L-shaped frame (column + beam), the classic N-T-M exam frame.
//   layout "top":    the beam sits on the column (corner at the top), as
//                    on 22.5.2013 (pin at the beam's end, roller under the
//                    column, q on the column) and 7.3.2013 (pin under the
//                    column, a bar from a wall to the corner).
//   layout "bottom": the beam lies on the supports and the column stands
//                    on it at one end (6.7.2016: roller under the corner,
//                    pin at the beam's end, F at the top of the column).
// Loads: q on the beam, q on the column, a horizontal force at the corner
// (or the column's top), a vertical force on the beam. Asked: reactions,
// M at the corner, N in the beam, and M_ekstr in the beam (or N in the
// column). The dashed fibre runs continuously round the corner, along the
// bottom of the beam.

import { ans, num, q, nearZero } from "../kit.js";
import { solveFrame, maxAbsM } from "./frame.js";
import { bar, drawDiagrams } from "./drawFrame.js";
import { DASHED_TEXT, clean, drawFrameModel, labelNodes, reactionAnswers } from "./common.js";
import { CONVENTION, fieldLines, nodeLine, reactionLines, resultantLines } from "./text.js";

const SUPPORTS = { top: ["pinEnd", "pinEnd", "pinBase", "rollerH", "strut", "strut"], bottom: ["rollerCorner", "pinCorner"] };

/** The frame model of a parameter set (pure). */
export function lFrameModel(p) {
  const sx = p.mirror ? -1 : 1;
  const X = (x) => sx * x;
  const top = p.layout === "top";
  // Corner, the column's other end, the beam's other end.
  const C = top ? [0, p.h] : [0, 0];
  const K = top ? [0, 0] : [0, p.h];
  const D = top ? [X(p.a), p.h] : [X(p.a), 0];
  let names;
  if (top) {
    names = { pinEnd: { K: "B", C: "C", D: "A" }, pinBase: { K: "A", C: "C", D: "B" }, rollerH: { K: "B", C: "C", D: "A" }, strut: { K: "B", C: "C", D: "D" } }[p.sup];
  } else names = { K: "C", C: "A", D: "B" };
  const nodes = { [names.K]: K, [names.C]: C, [names.D]: D };
  const col = top ? { a: names.K, b: names.C } : { a: names.C, b: names.K }; // bottom → top
  const beam = p.mirror ? { a: names.D, b: names.C } : { a: names.C, b: names.D }; // left → right
  // Column's dashed side: towards the beam for "top" (inside), away for "bottom".
  const colRight = top ? !p.mirror : p.mirror;
  const members = [
    { id: col.a + col.b, ...col, dashed: colRight ? "right" : "left" },
    { id: beam.a + beam.b, ...beam, dashed: "right" },
  ];
  const colId = members[0].id, beamId = members[1].id;

  const supports = [];
  let anchor = null;
  if (top && p.sup === "pinEnd") supports.push({ node: "A", type: "pin" }, { node: "B", type: "roller", angle: 90 });
  if (top && p.sup === "pinBase") supports.push({ node: "A", type: "pin" }, { node: "B", type: "roller", angle: 90 });
  if (top && p.sup === "rollerH") supports.push({ node: "A", type: "pin" }, { node: "B", type: "roller", angle: 0 });
  if (top && p.sup === "strut") {
    const ang = p.mirror ? p.beta : 180 - p.beta; // from the corner up, away from the beam
    const dx = p.ls, dy = p.ls * Math.tan((p.beta * Math.PI) / 180);
    anchor = [C[0] - sx * dx, C[1] + dy];
    supports.push({ node: "B", type: "pin" }, { node: "C", type: "roller", angle: ang, names: ["S"] });
  }
  if (!top && p.sup === "rollerCorner") supports.push({ node: "B", type: "pin" }, { node: "A", type: "roller", angle: 90 });
  if (!top && p.sup === "pinCorner") supports.push({ node: "A", type: "pin" }, { node: "B", type: "roller", angle: 90 });

  const many = [p.qb, p.qc].filter(Boolean).length > 1;
  const manyF = [p.Fh, p.Fv].filter(Boolean).length > 1;
  const loads = [];
  if (p.qb) loads.push({ type: "dist", member: beamId, q: p.qb, angle: -90, label: many ? "q_1" : "q" });
  if (p.qc) loads.push({ type: "dist", member: colId, q: p.qc, angle: p.qcDir > 0 ? 0 : 180, label: many ? "q_2" : "q" });
  if (p.Fh) loads.push({ type: "force", node: top ? names.C : names.K, F: p.Fh, angle: p.FhDir > 0 ? 0 : 180, label: manyF ? "F_1" : "F" });
  if (p.Fv) loads.push({ type: "force", member: beamId, at: p.mirror ? p.a - p.Fvx : p.Fvx, F: p.Fv, angle: -90, label: manyF ? "F_2" : "F" });

  return { nodes, members, supports, loads, colId, beamId, corner: names.C, colTop: names.K, beamEnd: names.D, anchor };
}

export const okvirL = {
  id: "okvir-l",
  group: "statika",
  title: "Okvir v obliki črke L",
  desc: "Steber in prečka, nepomična in pomična podpora (ali palica): reakcije, M v vogalu, diagrami N, T, M",

  generate(r) {
    for (;;) {
      const layout = r.chance(0.65) ? "top" : "bottom";
      const p = {
        layout,
        mirror: r.chance(0.35),
        a: r.step(2, 6, 0.5),
        h: r.step(1.5, 4, 0.5),
        sup: r.pick(SUPPORTS[layout]),
      };
      if (p.sup === "strut") {
        p.beta = r.pick([30, 45, 45, 60]);
        p.ls = r.step(1, 2, 0.5);
      }
      const want = layout === "top" ? r.pick([["qb"], ["qc"], ["qb", "Fh"], ["qc", "Fh"], ["qb", "Fv"], ["qb", "qc"], ["Fh", "Fv"], ["qb", "Fh"]]) : r.pick([["Fh", "qb"], ["Fh", "qb"], ["Fh", "Fv"], ["Fh", "qc"], ["qb", "qc"]]);
      if (want.includes("qb")) p.qb = r.int(1, 6);
      if (want.includes("qc")) {
        p.qc = r.int(1, 6);
        p.qcDir = r.chance(0.5) ? 1 : -1;
      }
      if (want.includes("Fh")) {
        p.Fh = r.int(2, 15);
        p.FhDir = r.chance(0.5) ? 1 : -1;
      }
      if (want.includes("Fv")) {
        p.Fv = r.int(2, 15);
        p.Fvx = r.step(0.5, p.a - 0.5, 0.5);
      }
      let ex;
      try {
        ex = this.build(p);
      } catch {
        continue; // degenerate support system
      }
      const vals = ex.answers.map((a) => Math.abs(a.value));
      // No silly near-zero non-zero answers, something to bend.
      if (vals.some((v) => v > 1e-6 && v < 0.05)) continue;
      if (Math.abs(ex.maxM) < 1) continue;
      // An extreme worth asking: not tiny, not the corner moment again.
      const mext = ex.answers.find((a) => a.key === "Mext"), mc = ex.answers.find((a) => a.key === "Mc");
      if (mext && (Math.abs(mext.value) < 0.05 * Math.abs(ex.maxM) || Math.abs(mext.value - mc.value) < 0.02 * Math.abs(ex.maxM))) continue;
      return p;
    }
  },

  build(p) {
    const model = lFrameModel(p);
    const sol = solveFrame(model);
    const top = p.layout === "top";
    const beam = sol.members[model.beamId];
    const col = sol.members[model.colId];
    const C = model.corner;
    // Corner values: at the corner end of each member.
    const atCorner = (mr) => (mr.a === C ? mr.start : mr.end);
    const Mc = atCorner(beam).M;
    const Nbeam = atCorner(beam).N;
    const Ncol = atCorner(col).N;
    const ext = beam.extremes[0];
    const xExt = ext ? (beam.a === C ? ext.s : beam.L - ext.s) : null;

    const supText = {
      pinEnd: `Okvir je v točki A (konec prečke) nepomično podprt, v točki B (vznožje stebra) pa pomično podprt z navpično reakcijo.`,
      pinBase: `Okvir je v točki A (vznožje stebra) nepomično podprt, v točki B (konec prečke) pa pomično podprt z navpično reakcijo.`,
      rollerH: `Okvir je v točki A (konec prečke) nepomično podprt, v točki B (vznožje stebra) pa pomično podprt z vodoravno reakcijo.`,
      strut: `Okvir je v točki B (vznožje stebra) nepomično podprt, v vogalu C pa ga drži členkasto pritrjena palica AC pod kotom ${p.beta}° glede na vodoravnico.`,
      rollerCorner: `Okvir je v vogalu A pomično podprt z navpično reakcijo, v točki B (konec prečke) pa nepomično podprt.`,
      pinCorner: `Okvir je v vogalu A nepomično podprt, v točki B (konec prečke) pa pomično podprt z navpično reakcijo.`,
    }[p.sup];
    const loadText = [];
    for (const l of model.loads) {
      if (l.type === "dist") loadText.push(`zvezna obtežba ${l.label} = ${q(l.q, "kN/m")} ${l.member === model.beamId ? "po vsej prečki (navpično navzdol)" : `po vsem stebru (vodoravno v ${l.angle === 0 ? "desno" : "levo"})`}`);
      else if (l.node) loadText.push(`vodoravna sila ${l.label} = ${q(l.F, "kN")} v ${l.angle === 0 ? "desno" : "levo"} ${top ? "v vogalu C" : "na vrhu stebra (C)"}`);
      else loadText.push(`navpična sila ${l.label} = ${q(l.F, "kN")} (navzdol) na prečki, ${num(p.Fvx)} m od vogala`);
    }

    const answers = [
      ...reactionAnswers(sol, { bar: p.sup === "strut" ? "S" : null }),
      ans("Mc", `M_${C}`, "kNm", clean(Mc), { note: "v vogalu" }),
      ans("Nb", `N_{${model.beamId}}`, "kN", clean(Nbeam), { note: "osna sila v prečki ob vogalu" }),
      ext ? ans("Mext", "M_{ekstr}", "kNm", clean(ext.M), { note: "v prečki, kjer je T = 0" }) : ans("Nc", `N_{${model.colId}}`, "kN", clean(Ncol), { note: "osna sila v stebru ob vogalu" }),
    ];
    // Reactions and corner forces can come out 0 (or nearly): 1 % of the largest one.
    nearZero(answers, answers.map((a) => a.key));

    const names = Object.fromEntries(Object.keys(model.nodes).map((k) => [k, k]));
    const sx = p.mirror ? -1 : 1;
    const pivot = model.supports.find((s) => s.type === "pin").node;
    return {
      title: this.title,
      maxM: maxAbsM(sol).M,
      text: [
        `Okvir v obliki črke L sestavljata steber višine ${q(p.h, "m")} in prečka dolžine ${q(p.a, "m")}, togo spojena v vogalu ${C}. ${supText}`,
        `Obtežba: ${loadText.join("; ")}.`,
        `Izračunajte reakcije (komponente v smeri osi x in y${p.sup === "strut" ? " ter silo v palici AC" : ""}), upogibni moment v vogalu ${C}, osno silo v prečki in ${ext ? "ekstremni upogibni moment v prečki" : "osno silo v stebru"}. Narišite diagrame N, T, M.`,
        DASHED_TEXT,
      ],
      figure(f) {
        drawFrameModel(f, model, { extraDirs: model.anchor ? { [C]: [sx > 0 ? 180 - p.beta : p.beta] } : {} });
        for (const s of model.supports) {
          const P = model.nodes[s.node];
          if (s.names?.[0] === "S") continue;
          if (s.type === "pin") f.pin(P, 90);
          else f.roller(P, s.angle === 90 ? 90 : sx > 0 ? 0 : 180);
        }
        const extra = {};
        // The height's dimension line leaves the beam's far end sideways.
        for (const [name, P] of Object.entries(model.nodes)) if (Math.abs(P[0] - sx * p.a) < 1e-9 && Math.abs(P[1] - p.h) < 1e-9) extra[name] = sx > 0 ? [0] : [180];
        // A roller against a wall sits beside its node, not below it.
        for (const s of model.supports) if (s.type !== "pin" && s.angle !== 90 && !s.names?.includes("S")) extra[s.node] = [...(extra[s.node] ?? []), ...(sx > 0 ? [160, 180, 200] : [-20, 0, 20])];
        if (model.anchor) {
          bar(f, model.nodes[C], model.anchor, sx > 0 ? 0 : 180);
          f.label(model.anchor, "A", { dx: sx * 14, dy: -10, cls: "fig-name" });
          f.angle(model.nodes[C], sx > 0 ? 180 - p.beta : 0, sx > 0 ? 180 : p.beta, `${p.beta}°`, 30);
          extra[C] = [...(extra[C] ?? []), sx > 0 ? 180 - p.beta : p.beta, sx > 0 ? 180 - p.beta / 2 : p.beta / 2];
        }
        labelNodes(f, model, { extra });
        // Dimensions: beam length along the ground, column height at the beam's far end.
        f.dim([Math.min(0, sx * p.a), 0], [Math.max(0, sx * p.a), 0], `${num(p.a)} m`, 46);
        f.dim([sx * p.a, 0], [sx * p.a, p.h], `${num(p.h)} m`, sx > 0 ? 46 : -46);
      },
      answers,
      solution: [
        CONVENTION,
        ...resultantLines(sol),
        ...reactionLines(sol, pivot),
        ...fieldLines(sol, [model.colId, model.beamId]),
        `Vogal ${C}: M_${C} = ${num(Mc)} kNm (v obeh odsekih enak, ker v vogalu ne deluje zunanji moment), N v prečki ${num(Nbeam)} kN, N v stebru ${num(Ncol)} kN.`,
        ...(ext ? [`Ekstrem v prečki: T = 0 na razdalji ${num(xExt)} m od vogala ${C} → M_{ekstr} = ${num(ext.M)} kNm.`] : []),
        nodeLine(sol, C),
      ].filter(Boolean),
      solutionFigure(f) {
        drawDiagrams(f, sol, { names, nodes: model.nodes });
      },
    };
  },
};
