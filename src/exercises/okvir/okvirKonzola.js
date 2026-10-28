// okvir-konzola: a frame clamped at the base (30.1.2012): a column
// clamped at A, a beam attached at height h_B (B) cantilevering sideways,
// loads q on the beam, a vertical force at its end, a horizontal force at
// the column's top and a couple at B. Asked: the clamp reactions A_x, A_y,
// M_A and the moments of the three members meeting at B, the exam's
// "kontrola momentov v točki B" (26 − 9 − 22 + 5 = 0 on 30.1.2012).

import { ans, num, q, nearZero } from "../kit.js";
import { solveFrame, maxAbsM } from "./frame.js";
import { drawDiagrams } from "./drawFrame.js";
import { DASHED_TEXT, clean, drawFrameModel, labelNodes, reactionAnswers } from "./common.js";
import { CONVENTION, fieldLines, nodeLine, reactionLines, resultantLines } from "./text.js";

export function konzolaModel(p) {
  const sx = p.mirror ? -1 : 1;
  const top = p.hb >= p.H - 1e-9; // beam at the very top: a plain L cantilever
  const nodes = { A: [0, 0], B: [0, p.hb], D: [sx * p.b, p.hb] };
  if (!top) nodes.C = [0, p.H];
  const members = [{ id: "AB", a: "A", b: "B", dashed: sx > 0 ? "right" : "left" }];
  if (!top) members.push({ id: "BC", a: "B", b: "C", dashed: sx > 0 ? "right" : "left" });
  members.push(sx > 0 ? { id: "BD", a: "B", b: "D", dashed: "right" } : { id: "DB", a: "D", b: "B", dashed: "right" });
  const beamId = members[members.length - 1].id;
  const loads = [];
  if (p.q) loads.push({ type: "dist", member: beamId, q: p.q, angle: -90, label: "q" });
  const two = p.Fh && p.Fv;
  if (p.Fh) loads.push({ type: "force", node: top ? "B" : "C", F: p.Fh, angle: p.FhDir > 0 ? 0 : 180, label: two ? "F_1" : "F" });
  if (p.Fv) loads.push({ type: "force", node: "D", F: p.Fv, angle: -90, label: two ? "F_2" : "F" });
  if (p.M0) loads.push({ type: "moment", node: "B", M: p.M0, label: "M_0" });
  return { nodes, members, supports: [{ node: "A", type: "clamp" }], loads, beamId, top };
}

export const okvirKonzola = {
  id: "okvir-konzola",
  group: "statika",
  title: "Vpet okvir (steber s prečko)",
  desc: "Steber vpet v tla, s previsno prečko: reakcije vpetja, momenti v vozlišču, diagrami N, T, M",

  generate(r) {
    for (;;) {
      const H = r.step(2, 5, 0.5);
      const p = {
        mirror: r.chance(0.35),
        H,
        hb: r.chance(0.3) ? H : r.step(1, H - 0.5, 0.5),
        b: r.step(1.5, 4, 0.5),
      };
      const kinds = r.pick([["q", "Fh", "M0"], ["q", "Fh"], ["q", "Fh"], ["Fv", "Fh"], ["q", "M0"], ["Fv", "Fh", "M0"], ["q", "Fv"]]);
      if (kinds.includes("q")) p.q = r.int(1, 6);
      if (kinds.includes("Fh")) {
        p.Fh = r.int(2, 15);
        p.FhDir = r.chance(0.5) ? 1 : -1;
      }
      if (kinds.includes("Fv")) p.Fv = r.int(2, 12);
      if (kinds.includes("M0")) p.M0 = r.int(2, 10) * (r.chance(0.5) ? 1 : -1);
      const ex = this.build(p);
      // No near-zero non-zero answers: a sign error would pass within the 1 % scale.
      if (ex.answers.some((a) => Math.abs(a.value) > 1e-6 && Math.abs(a.value) < Math.max(0.05, 0.02 * Math.max(...ex.answers.filter((b) => b.unit === a.unit).map((b) => Math.abs(b.value)))))) continue;
      if (Math.abs(ex.maxM) < 1) continue;
      return p;
    }
  },

  build(p) {
    const model = konzolaModel(p);
    const sol = solveFrame(model);
    const sx = p.mirror ? -1 : 1;
    const beam = sol.members[model.beamId];
    const AB = sol.members.AB;
    const beamAtB = beam.a === "B" ? beam.start.M : beam.end.M;
    const loadText = [];
    for (const l of model.loads) {
      if (l.type === "dist") loadText.push(`zvezna obtežba ${l.label} = ${q(l.q, "kN/m")} po vsej prečki`);
      else if (l.type === "moment") loadText.push(`moment ${l.label} = ${q(Math.abs(l.M), "kNm")} v vozlišču B (${l.M > 0 ? "v nasprotni smeri urinega kazalca" : "v smeri urinega kazalca"})`);
      else if (l.angle === -90) loadText.push(`navpična sila ${l.label} = ${q(l.F, "kN")} (navzdol) na koncu prečke (D)`);
      else loadText.push(`vodoravna sila ${l.label} = ${q(l.F, "kN")} v ${l.angle === 0 ? "desno" : "levo"} na vrhu stebra (${model.top ? "B" : "C"})`);
    }
    const answers = [
      ...reactionAnswers(sol),
      ans("MAB", "M_{AB}(B)", "kNm", clean(AB.end.M), { note: "v stebru tik pod B" }),
      ans("Mbeam", `M_{${model.beamId}}(B)`, "kNm", clean(beamAtB), { note: "v prečki ob B" }),
      ...(model.top ? [] : [ans("MBC", "M_{BC}(B)", "kNm", clean(sol.members.BC.start.M), { note: "v stebru tik nad B" })]),
    ];
    // Reactions and moments at B can come out 0 (or nearly): 1 % of the largest one.
    nearZero(answers, answers.map((a) => a.key));
    const names = Object.fromEntries(Object.keys(model.nodes).map((k) => [k, k]));
    return {
      title: this.title,
      maxM: maxAbsM(sol).M,
      text: [
        `Steber AB${model.top ? "" : "C"} višine ${q(p.H, "m")} je v točki A vpet v tla. ${model.top ? "Na vrhu stebra (B)" : `Na višini ${q(p.hb, "m")} (točka B)`} je nanj togo pritrjena previsna prečka dolžine ${q(p.b, "m")}.`,
        `Obtežba: ${loadText.join("; ")}.`,
        "Izračunajte reakcije v vpetju A (komponente v smeri osi x in y ter moment M_A) in upogibne momente ob vozlišču B. Narišite diagrame N, T, M.",
        DASHED_TEXT,
      ],
      figure(f) {
        drawFrameModel(f, model);
        f.fixed([0, 0], 90);
        labelNodes(f, model, { extra: { A: [250, 270, 290] } });
        f.dim([Math.min(0, sx * p.b), p.hb], [Math.max(0, sx * p.b), p.hb], `${num(p.b)} m`, 40);
        // Heights at the beam's far end, outside (clear of the column's loads).
        const xd = sx * p.b, off = sx > 0 ? 46 : -46;
        if (model.top) f.dim([xd, 0], [xd, p.H], `${num(p.H)} m`, off);
        // (a chain: a short part's label that doesn't fit moves a row out)
        else f.dimChain([[xd, 0], [xd, p.hb], [xd, p.H]], [`${num(p.hb)} m`, `${num(p.H - p.hb)} m`], off);

      },
      answers,
      solution: [
        CONVENTION,
        ...resultantLines(sol),
        ...reactionLines(sol, "A"),
        ...fieldLines(sol, model.members.map((m) => m.id)),
        nodeLine(sol, "B"),
      ].filter(Boolean),
      solutionFigure(f) {
        drawDiagrams(f, sol, { names, nodes: model.nodes });
      },
    };
  },
};
