// okvir-posevni: inclined members.
//   "veja"   a branch clamped in the trunk, 30° above the horizontal on
//            28.6.2006: a weight G at a horizontal distance from the root
//            (sometimes also the branch's own weight per metre, or a second
//            weight at the tip). Asked: N, T, M at the root (exam:
//            N = −400 N, T = 692,8 N, M = −960 Nm).
//   "streha" an inclined beam (roof rafter, stair) pinned at the bottom A,
//            held at the top B by a roller (vertical reaction), a smooth
//            wall (horizontal reaction) or a rope; loaded by q per metre
//            of the horizontal projection (snow) and maybe a point force.
//            Asked: reactions, N at A, M_max and where it is.

import { ans, num, q, rad, nearZero } from "../kit.js";
import { solveFrame, maxAbsM } from "./frame.js";
import { drawDiagrams } from "./drawFrame.js";
import { DASHED_TEXT, clean, drawFrameModel, reactionAnswers } from "./common.js";
import { CONVENTION, fieldLines, reactionLines, resultantLines } from "./text.js";

export function vejaModel(p) {
  const sx = p.mirror ? -1 : 1;
  const t = Math.tan(rad(p.alpha));
  const nodes = { O: [0, 0], P: [sx * p.p, p.p * t] };
  const dashed = sx > 0 ? "right" : "left"; // the lower side of the branch
  const members = [{ id: "OP", a: "O", b: "P", dashed }];
  if (p.tip > p.p + 1e-9) {
    nodes.K = [sx * p.tip, p.tip * t];
    members.push({ id: "PK", a: "P", b: "K", dashed });
  }
  const loads = [{ type: "force", node: "P", F: p.G, angle: -90, label: p.G2 ? "G_1" : "G" }];
  if (p.G2) loads.push({ type: "force", node: "K", F: p.G2, angle: -90, label: "G_2" });
  if (p.qw) for (const m of members) loads.push({ type: "dist", member: m.id, q: p.qw, angle: -90, per: "length", label: "q" });
  return { nodes, members, supports: [{ node: "O", type: "clamp" }], loads };
}

export function strehaModel(p) {
  const sx = p.mirror ? -1 : 1;
  const nodes = { A: [0, 0], B: [sx * p.a, p.h] };
  const members = [sx > 0 ? { id: "AB", a: "A", b: "B", dashed: "right" } : { id: "BA", a: "B", b: "A", dashed: "right" }];
  const supports = [{ node: "A", type: "pin" }];
  if (p.sup === "rollerV") supports.push({ node: "B", type: "roller", angle: 90 });
  if (p.sup === "rollerH") supports.push({ node: "B", type: "roller", angle: sx > 0 ? 180 : 0 }); // the wall pushes back
  if (p.sup === "rope") supports.push({ node: "B", type: "roller", angle: p.ropeDir, names: ["S"] });
  const loads = [{ type: "dist", member: members[0].id, q: p.q, angle: -90, per: "projection", label: "q" }];
  if (p.F) {
    const L = Math.hypot(p.a, p.h);
    const at = sx > 0 ? (p.c / p.a) * L : ((p.a - p.c) / p.a) * L;
    loads.push({ type: "force", member: members[0].id, at, F: p.F, angle: -90, label: "F" });
  }
  return { nodes, members, supports, loads };
}

export const okvirPosevni = {
  id: "okvir-posevni",
  group: "statika",
  title: "Poševni nosilec in veja",
  desc: "Poševna konzola (veja) ali poševni nosilec z obtežbo po tlorisni projekciji: N, T, M",

  generate(r) {
    for (;;) {
      let p;
      if (r.chance(0.45)) {
        const pp = r.step(0.6, 2.5, 0.1);
        p = { kind: "veja", mirror: r.chance(0.4), alpha: r.step(15, 60, 5), p: pp, tip: r.chance(0.6) ? pp + r.step(0.3, 1.2, 0.1) : pp, G: r.step(200, 1500, 50) };
        if (p.tip > p.p && r.chance(0.3)) p.G2 = r.step(100, 800, 50);
        else if (r.chance(0.3)) p.qw = r.step(20, 150, 10);
      } else {
        p = { kind: "streha", mirror: r.chance(0.4), a: r.step(2, 6, 0.5), h: r.step(1, 4, 0.5), q: r.int(1, 6), sup: r.pick(["rollerV", "rollerH", "rope", "rope"]) };
        if (p.sup === "rope") {
          const d = r.pick([45, 60, 75, 90]);
          // The rope rises from B, leaning either way.
          p.ropeDir = r.chance(0.5) ? d : 180 - d;
          // Not nearly along the beam (the rope force would be many times the load).
          const beam = (Math.atan2(p.h, (p.mirror ? -1 : 1) * p.a) * 180) / Math.PI;
          const gap = Math.abs((((p.ropeDir - beam) % 180) + 270) % 180 - 90);
          if (gap < 20) continue;
        }
        if (r.chance(0.4)) {
          p.F = r.int(2, 10);
          p.c = r.step(0.5, p.a - 0.5, 0.5);
        }
      }
      let ex;
      try {
        ex = this.build(p);
      } catch {
        continue;
      }
      if (ex.answers.some((a) => Math.abs(a.value) > 1e-6 && Math.abs(a.value) < 0.02 * Math.max(...ex.answers.filter((b) => b.unit === a.unit).map((b) => Math.abs(b.value))))) continue;
      if (ex.slack) continue;
      return p;
    }
  },

  build(p) {
    return p.kind === "veja" ? buildVeja.call(this, p) : buildStreha.call(this, p);
  },
};

function buildVeja(p) {
  const model = vejaModel(p);
  const sol = solveFrame(model);
  const sx = p.mirror ? -1 : 1;
  const root = sol.members.OP.start;
  const names = Object.fromEntries(Object.keys(model.nodes).map((k) => [k, k]));
  const extras = [];
  if (p.G2) extras.push(`Na koncu veje (K, ${q(p.tip, "m")} vodoravno od korena) visi še breme G_2 = ${q(p.G2, "N")}.`);
  if (p.qw) extras.push(`Upoštevajte lastno težo veje q = ${q(p.qw, "N/m")} (na meter dolžine veje).`);
  else extras.push("Lastno težo veje zanemarite.");
  return {
    title: this.title,
    text: [
      `Veja drevesa izrašča iz debla v točki O (togo vpetje) pod kotom ${90 - p.alpha}° glede na navpično deblo (${p.alpha}° nad vodoravnico)${p.tip > p.p ? ` in je vodoravno dolga ${q(p.tip, "m")}` : ""}. Na vejo v točki P, ${q(p.p, "m")} vodoravno od debla, deluje navpična sila (teža, navzdol) ${p.G2 ? "G_1" : "G"} = ${q(p.G, "N")}.`,
      ...extras,
      "Izračunajte osno silo N, prečno silo T in upogibni moment M v veji tik ob deblu (točka O). Narišite diagrame N, T, M za vejo.",
      `${DASHED_TEXT} Koordinata s teče od debla proti vrhu veje; T je pozitiven, kadar zunanji del veje deluje na notranjega v smeri proti črtkanim vlaknom.`,
    ],
    figure(f) {
      // Trunk (not part of the model): from the ground up past the root.
      f.member([0, -1.2], [0, 0.9]);
      f.ground([-0.5, -1.2], [0.5, -1.2]); // hatched below, in the ground
      drawFrameModel(f, model, { fu: "N", qu: "N/m", mu: "Nm" });
      f.label([0, 0], "O", { dx: -sx * 12, dy: 14, cls: "fig-name" });
      f.label(model.nodes.P, "P", { dx: sx * 10, dy: 18, cls: "fig-name" });
      if (model.nodes.K) f.label(model.nodes.K, "K", { dx: sx * 12, dy: 4, cls: "fig-name" });
      f.angle([0, 0], sx > 0 ? p.alpha : 90, sx > 0 ? 90 : 180 - p.alpha, `${90 - p.alpha}°`, 30);
      f.line(model.nodes.P, [sx * p.p, 0], "fig-dashed");
      f.dim([Math.min(0, sx * p.p), 0], [Math.max(0, sx * p.p), 0], `${num(p.p)} m`, 30);
      // Room above the branch for the weights' arrows and labels.
      f.bounds([[0, Math.max(...Object.values(model.nodes).map((n) => n[1])) + 0.3 * p.tip]]);
    },
    answers: [
      ans("N", "N_O", "N", clean(root.N), { note: "nateg +" }),
      ans("T", "T_O", "N", clean(root.T)),
      ans("M", "M_O", "Nm", clean(root.M), { note: "+ nateg črtkanih vlaken" }),
    ],
    solution: [
      CONVENTION,
      `Enotski vektor osi veje e = (${num(sx * Math.cos(rad(p.alpha)))}; ${num(Math.sin(rad(p.alpha)))}), normala proti črtkanim (spodnjim) vlaknom n = (${num(sx * Math.sin(rad(p.alpha)))}; ${num(-Math.cos(rad(p.alpha)))}).`,
      `Prerez tik ob deblu, opazujemo zunanji del veje. Vsaka navpična sila F razpade na komponento vzdolž osi F·sin ${p.alpha}° (tlak, ker kaže proti deblu) in pravokotno komponento F·cos ${p.alpha}°.`,
      ...resultantLines(sol, { fu: "N" }),
      ...fieldLines(sol, model.members.map((m) => m.id), { fu: "N", mu: "Nm" }),
      `V točki O: N = ${num(root.N)} N, T = ${num(root.T)} N, M = ${num(root.M)} Nm (moment = −vsota sil × vodoravna ročica; zgornja vlakna so v nategu).`,
      // The clamp's couple is not M_O (the internal moment): it can have the opposite sign.
      `Reakcije vpetja (deblo deluje na vejo): ${sol.reactions.map((x) => (x.kind === "M" ? `moment vpetja ${num(clean(x.value))} Nm (+ v nasprotni smeri urinega kazalca)` : `${x.name} = ${num(clean(x.value))} N`)).join(", ")}.`,
    ],
    solutionFigure(f) {
      drawDiagrams(f, sol, { names, nodes: model.nodes, units: { N: "N", T: "N", M: "Nm" } });
    },
  };
}

function buildStreha(p) {
  const model = strehaModel(p);
  const sol = solveFrame(model);
  const sx = p.mirror ? -1 : 1;
  const mr = Object.values(sol.members)[0];
  const atA = mr.a === "A" ? mr.start : mr.end;
  const atB = mr.a === "B" ? mr.start : mr.end;
  const best = maxAbsM(sol);
  const P = [mr.A[0] + mr.e[0] * best.s, mr.A[1] + mr.e[1] * best.s];
  const xMax = Math.abs(P[0]);
  const S = sol.R.S;
  const L = Math.hypot(p.a, p.h);
  const supText = {
    rollerV: "V točki B je nosilec pomično podprt z navpično reakcijo.",
    rollerH: "V točki B se nosilec brez trenja naslanja na navpično steno (vodoravna reakcija).",
    rope: `V točki B ga drži vrv, ki oklepa z vodoravnico kot ${p.ropeDir > 90 ? 180 - p.ropeDir : p.ropeDir}°.`,
  }[p.sup];
  const names = { A: "A", B: "B" };
  return {
    title: this.title,
    slack: p.sup === "rope" && !(S > 0.2),
    text: [
      `Poševni nosilec AB je v točki A nepomično podprt. ${supText} Vodoravna razdalja med A in B je ${q(p.a, "m")}, višinska ${q(p.h, "m")}.`,
      `Nosilec je obremenjen z navpično zvezno obtežbo q = ${q(p.q, "kN/m")} na meter tlorisne (vodoravne) projekcije${p.F ? ` in z navpično silo F = ${q(p.F, "kN")} na vodoravni razdalji ${q(p.c, "m")} od A` : ""}.`,
      `Izračunajte reakcije, osno silo v nosilcu ob podpori A ter največji upogibni moment in njegovo vodoravno oddaljenost od A. Narišite diagrame N, T, M.`,
      DASHED_TEXT,
    ],
    figure(f) {
      drawFrameModel(f, model);
      f.pin([0, 0], 90);
      const B = model.nodes.B;
      if (p.sup === "rollerV") f.roller(B, 90);
      if (p.sup === "rollerH") f.roller(B, sx > 0 ? 180 : 0);
      if (p.sup === "rope") {
        const len = Math.max(1, 0.35 * Math.max(p.a, p.h));
        const end = [B[0] + len * Math.cos(rad(p.ropeDir)), B[1] + len * Math.sin(rad(p.ropeDir))];
        f.line(B, end, "fig-rope");
        f.ground([end[0] + 0.5, end[1]], [end[0] - 0.5, end[1]]);
        const ang = p.ropeDir > 90 ? 180 - p.ropeDir : p.ropeDir;
        if (ang !== 90) f.angle(B, p.ropeDir > 90 ? p.ropeDir : 0, p.ropeDir > 90 ? 180 : p.ropeDir, `${ang}°`, 24);
      }
      f.label([0, 0], "A", { dx: -sx * 16, dy: 4, cls: "fig-name" });
      f.label(B, "B", { dx: sx * 16, dy: p.sup === "rollerV" ? -6 : 18, cls: "fig-name" });
      f.dim([Math.min(0, B[0]), 0], [Math.max(0, B[0]), 0], `${num(p.a)} m`, 46);
      f.dim([B[0], 0], B, `${num(p.h)} m`, sx > 0 ? 46 : -46);
      f.line([B[0], 0], [0, 0], "fig-thin");
    },
    answers: nearZero(
      [
        ...reactionAnswers(sol, { bar: p.sup === "rope" ? "S" : null }).map((a) => (a.key === "S" ? { ...a, note: "sila v vrvi" } : a)),
        ans("NA", "N_A", "kN", clean(atA.N), { note: "osna sila ob A, nateg +" }),
        ans("Mmax", "M_{max}", "kNm", clean(best.M), { note: "+ nateg spodnjih (črtkanih) vlaken" }),
        ans("x", "x_{max}", "m", xMax, { note: "vodoravno od A" }),
      ],
      [...sol.reactions.map((r) => r.name), "NA"],
    ),
    solution: [
      CONVENTION,
      `Dolžina nosilca L = √(${num(p.a)}² + ${num(p.h)}²) = ${num(L)} m, nagib α = ${num((Math.atan2(p.h, p.a) * 180) / Math.PI)}°. Obtežba na meter tlorisa: rezultanta Q = q·${num(p.a)} = ${num(p.q * p.a)} kN (na meter dolžine nosilca je to q·cos α = ${num((p.q * p.a) / L)} kN/m).`,
      ...resultantLines(sol),
      ...reactionLines(sol, "A"),
      ...fieldLines(sol, [mr.id]),
      `Ob A: N = ${num(atA.N)} kN, ob B: N = ${num(atB.N)} kN.`,
      `Največji upogibni moment M = ${num(best.M)} kNm pri s = ${num(best.s)} m (vodoravno ${num(xMax)} m od A).`,
    ],
    solutionFigure(f) {
      drawDiagrams(f, sol, { names, nodes: model.nodes });
    },
  };
}
