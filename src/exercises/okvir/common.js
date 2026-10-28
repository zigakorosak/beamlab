// Shared pieces of the frame exercises: drawing the loads of a frame
// model, the answer boxes of reactions, and the solution's common lines.

import { ans, num, q } from "../kit.js";
import { s } from "../../render/svg.js";
import { dashedFibre } from "./drawFrame.js";
import { textWidth } from "../draw.js";

const near = (a, b, tol = 12) => Math.abs((((a - b) % 360) + 540) % 360 - 180) < tol;

/** Where a load acts. */
export function loadPoint(model, l) {
  if (l.node) return model.nodes[l.node];
  const m = model.members.find((x) => x.id === l.member);
  const A = model.nodes[m.a], B = model.nodes[m.b];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  return [A[0] + ((B[0] - A[0]) * l.at) / L, A[1] + ((B[1] - A[1]) * l.at) / L];
}

/** Directions (deg) of the members leaving point p. */
function memberDirs(model, p) {
  const out = [];
  for (const m of model.members) {
    const A = model.nodes[m.a], B = model.nodes[m.b];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const t = ((p[0] - A[0]) * (B[0] - A[0]) + (p[1] - A[1]) * (B[1] - A[1])) / (L * L);
    const off = Math.abs((p[0] - A[0]) * (B[1] - A[1]) - (p[1] - A[1]) * (B[0] - A[0])) / L;
    if (off > 1e-6 || t < -1e-6 || t > 1 + 1e-6) continue;
    const d = (Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI;
    if (t < 1 - 1e-6) out.push(d);
    if (t > 1e-6) out.push(d + 180);
  }
  return out;
}

/**
 * Members, dashed fibres and loads of a frame model. `units`: force and
 * length units for the labels.
 */
export function drawFrameModel(f, model, { fu = "kN", qu = "kN/m", mu = "kNm", extraDirs = {} } = {}) {
  for (const m of model.members) {
    const A = model.nodes[m.a], B = model.nodes[m.b];
    f.member(A, B);
  }
  for (const m of model.members) {
    const A = model.nodes[m.a], B = model.nodes[m.b];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const e = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    dashedFibre(f, A, B, m.dashed === "left" ? [-e[1], e[0]] : [e[1], -e[0]]);
  }
  const written = new Set();
  for (const l of model.loads) {
    if (l.type === "dist") {
      const m = model.members.find((x) => x.id === l.member);
      const A = model.nodes[m.a], B = model.nodes[m.b];
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const P = (sv) => [A[0] + ((B[0] - A[0]) * sv) / L, A[1] + ((B[1] - A[1]) * sv) / L];
      // One label for the same load spread over several members.
      const text = written.has(`${l.label}=${l.q}`) ? undefined : `${l.label} = ${q(l.q, qu)}`;
      written.add(`${l.label}=${l.q}`);
      const horiz = typeof l.angle === "number" && Math.abs(Math.cos((l.angle * Math.PI) / 180)) > 0.7;
      f.dist(P(l.from ?? 0), P(l.to ?? L), { angle: l.angle, label: horiz ? undefined : text, h0: 24, h1: 24 });
      if (horiz && text) {
        // Arrows along a column: the label beside their tails, not on them.
        const dir = Math.cos((l.angle * Math.PI) / 180) > 0 ? 1 : -1;
        // (Or, something there, further along or further out.)
        const an = dir > 0 ? "end" : "start";
        f.label(P(((l.from ?? 0) + (l.to ?? L)) / 2), text, { dx: -dir * 32, dy: 4, anchor: an, cls: "fig-force-label", alts: [[-dir * 32, 22, an], [-dir * 32, -14, an], [-dir * 32, 40, an], [-dir * 32, -32, an], [-dir * 44, 4, an]] });
        f.custom([P(0)], () => s("g"), 40 + 7 * text.length);
      }
    } else if (l.type === "force") {
      const p = loadPoint(model, l);
      const dirs = [...memberDirs(model, p), ...(extraDirs[l.node] ?? [])];
      // Tip at the point unless the shaft would lie on a member; then start there.
      const tail = dirs.some((d) => near(d, l.angle + 180, 25));
      // Longer when it shares the member with a distributed load, so the labels don't meet.
      const crowded = model.loads.some((o) => o.type === "dist" && (o.member === l.member || (l.node && model.members.some((m) => m.id === o.member && (m.a === l.node || m.b === l.node)))));
      // Horizontal arrows carry the label above the shaft (less room needed
      // on narrow screens), the others past their far end.
      const horizontal = Math.abs(Math.sin((l.angle * Math.PI) / 180)) < 0.3;
      // Above the shaft, unless a member or bar rises over that side.
      const shaft = tail ? l.angle : l.angle + 180;
      const up = !dirs.some((d) => Math.sin((d * Math.PI) / 180) > 0.2 && Math.abs((((d - shaft) % 360) + 540) % 360 - 180) < 75);
      const right = Math.cos((l.angle * Math.PI) / 180) > 0;
      // A couple's arc at the same node would cross the shaft's label: a
      // longer arrow moves the label out past the arc.
      const withCouple = model.loads.some((o) => o.type === "moment" && l.node && o.node === l.node);
      // (If that's on something after all — another load's label, the picture's edge — the clearest of the other places.)
      // (A horizontal one at least as long as its label beside it, so the label clears the member at its tip.)
      const label = `${l.label} = ${q(l.F, fu)}`;
      const len = Math.max(withCouple ? 88 : crowded ? 62 : 50, horizontal ? textWidth(label) * 1.05 + 12 : 0);
      f.force(p, l.angle, { label, len, tail, labelAt: "auto", prefer: horizontal ? "side" : "end", labelSide: right === up ? 1 : -1 });

    } else if (l.type === "moment") {
      const p = loadPoint(model, l);
      f.moment(p, l.M > 0);
      // Label on the side with fewer members leaving the node.
      const dirs = memberDirs(model, p).map((d) => Math.cos((d * Math.PI) / 180));
      const side = dirs.filter((c) => c > 0.3).length < dirs.filter((c) => c < -0.3).length ? 1 : -1;
      const text = `${l.label} = ${q(Math.abs(l.M), mu)}`;
      const dy = model.loads.some((o) => o.type === "force" && o.node === l.node) ? 32 : -20;
      const an = (sd) => (sd > 0 ? "start" : "end");
      // (Or, a force's arrow or label there, another corner round the arc.)
      f.label(p, text, { dx: side * 24, dy, anchor: an(side), cls: "fig-force-label", alts: [[side * 24, dy > 0 ? -20 : 32, an(side)], [-side * 24, dy, an(-side)], [-side * 24, dy > 0 ? -20 : 32, an(-side)], [side * 24, dy > 0 ? 44 : -32, an(side)]] });
      f.custom([p], () => s("g"), 32 + 7 * text.length); // room for the label beside the arc
    }
  }
}

/** Round-off noise to an exact 0. */
export const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);

/** Directions (deg) taken up at each node by members, loads and supports. */
function occupied(model, node, extra = []) {
  const p = model.nodes[node];
  const dirs = [...memberDirs(model, p), ...extra];
  for (const l of model.loads) {
    if (l.type === "force" && (l.node === node || (!l.node && Math.hypot(...loadPoint(model, l).map((v, i) => v - p[i])) < 1e-9))) {
      const tail = memberDirs(model, p).some((d) => near(d, l.angle + 180, 25));
      const shaft = tail ? l.angle : l.angle + 180;
      dirs.push(shaft, shaft + 30, shaft - 30); // the shaft and its label
    }
    if (l.type === "moment" && l.node === node) dirs.push(20, 45, 70, 90, 110, 135, 160);
    if (l.type === "dist") {
      const m = model.members.find((x) => x.id === l.member);
      if (m.a !== node && m.b !== node) continue;
      const other = model.nodes[m.a === node ? m.b : m.a];
      const md = (Math.atan2(other[1] - p[1], other[0] - p[0]) * 180) / Math.PI;
      const from = typeof l.angle === "number" ? l.angle + 180 : 90;
      // The load's arrows fill the wedge between the member and their tails.
      const diff = ((((from - md) % 360) + 540) % 360) - 180;
      dirs.push(md + diff / 3, md + (2 * diff) / 3, from);
    }
  }
  for (const sp of model.supports) if (sp.node === node && !sp.names?.includes("S")) dirs.push(250, 270, 290);
  return dirs;
}

/** Node names placed where nothing else is (members, loads, supports). */
export function labelNodes(f, model, { names, extra = {}, px = 15 } = {}) {
  for (const [node, p] of Object.entries(model.nodes)) {
    const name = names?.[node] ?? node;
    if (!name) continue;
    const dirs = occupied(model, node, extra[node] ?? []);
    let best = 45, score = -1;
    for (let a = 0; a < 360; a += 15) {
      const gapDeg = dirs.length ? Math.min(...dirs.map((d) => Math.abs((((a - d) % 360) + 540) % 360 - 180))) : 180;
      // Prefer the diagonals a little: they keep clear of arrows and lines.
      const s = gapDeg + (a % 90 === 45 ? 8 : 0);
      if (s > score) {
        score = s;
        best = a;
      }
    }
    const c = Math.cos((best * Math.PI) / 180), sn = Math.sin((best * Math.PI) / 180);
    const r = model.loads.some((l) => l.type === "moment" && l.node === node) ? px + 13 : px; // clear of the moment's arc
    // (The clearest direction by angle; or, a load's label there in the picture, the next clearest.)
    const at = (a) => {
      const c = Math.cos((a * Math.PI) / 180), sn = Math.sin((a * Math.PI) / 180);
      return [c * r, -sn * r + 5, c > 0.35 ? "start" : c < -0.35 ? "end" : "middle"];
    };
    const gapOf = (a) => (dirs.length ? Math.min(...dirs.map((d) => Math.abs((((a - d) % 360) + 540) % 360 - 180))) : 180);
    const others = [];
    for (let a = 0; a < 360; a += 45) if (a !== best && gapOf(a) >= 30) others.push(a);
    others.sort((x, y) => gapOf(y) - gapOf(x));
    f.label(p, name, { dx: c * r, dy: -sn * r + 5, anchor: c > 0.35 ? "start" : c < -0.35 ? "end" : "middle", cls: "fig-name", alts: others.map(at) });
  }
}

/** Answer boxes for the reactions, with the positive direction stated. */
export function reactionAnswers(sol, { fu = "kN", mu = "kNm", bar = null } = {}) {
  return sol.reactions.map((r) => {
    if (r.kind === "M") return ans(r.name, r.name, mu, clean(r.value), { note: "+ v nasprotni smeri urinega kazalca" });
    if (r.name === bar) return ans(r.name, r.name, fu, clean(r.value), { note: "sila v palici, nateg +" });
    const dirs = { 0: "+ v desno", 90: "+ navzgor", 180: "+ v levo", 270: "+ navzdol", "-90": "+ navzdol" };
    return ans(r.name, r.name, fu, clean(r.value), { note: dirs[r.angle] ?? `+ v smeri ${num(r.angle)}° od osi x` });
  });
}

/** The given loads as a sentence fragment list. */
export function describeLoads(model, words, { fu = "kN", qu = "kN/m", mu = "kNm" } = {}) {
  return model.loads.map((l) => {
    if (l.type === "dist") return `zvezna obtežba ${l.label} = ${q(l.q, qu)} ${words[l.label] ?? ""}`.trim();
    if (l.type === "force") return `sila ${l.label} = ${q(l.F, fu)} ${words[l.label] ?? ""}`.trim();
    return `moment ${l.label} = ${q(Math.abs(l.M), mu)} ${words[l.label] ?? ""}`.trim();
  });
}

export const DASHED_TEXT = "Črtkana črta ob palicah označuje »spodnja« (črtkana) vlakna: upogibni moment M je pozitiven, kadar so ta vlakna v nategu; osna sila N je pozitivna pri nategu.";
