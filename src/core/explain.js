// The worked equilibrium equations shown after a reactions answer: what a
// student would write on paper. ΣFx, ΣFy, ΣM about the first support, and
// for each hinge "M = 0" from the part to its right. Distributed loads go
// in as their resultants (listed first).
//
// Moments are counterclockwise positive, forces up/right positive, the
// reactions' assumed directions as drawn (Ax →, Ay ↑, MA ↺).

import { distResultant, pointComponents } from "./model.js";
import { fmt } from "./format.js";

/** "a + b − 3" from [{ sign, text }]. */
function sum(terms) {
  if (!terms.length) return "0";
  return terms
    .map((t, i) => (i === 0 ? (t.sign < 0 ? "−" : "") + t.text : `${t.sign < 0 ? " − " : " + "}${t.text}`))
    .join("");
}

const forceTerm = (value, text) => ({ sign: Math.sign(value) || 1, text: text ?? fmt(Math.abs(value)) });

export function equilibriumSteps(model, sol) {
  const lines = [];
  const reactions = sol.reactions;

  const dists = model.loads.filter((l) => l.type === "dist").map((l) => ({ load: l, ...distResultant(l) }));
  for (const d of dists) {
    const { load } = d;
    const shape =
      load.q1 === load.q2
        ? `${fmt(load.q1)} kN/m × ${fmt(load.x2 - load.x1)} m`
        : `½ · (${fmt(load.q1)} + ${fmt(load.q2)}) kN/m × ${fmt(load.x2 - load.x1)} m`;
    lines.push(`Resultant: ${shape} = ${fmt(d.F)} kN at x = ${fmt(d.x)} m`);
  }

  // Everything as point actions: { x, fx, fy } and couples.
  const points = [];
  const couples = [];
  for (const l of model.loads) {
    if (l.type === "point") points.push({ x: l.x, ...pointComponents(l) });
    if (l.type === "moment") couples.push({ x: l.x, c: l.value });
  }
  const forces = [...points, ...dists.map((d) => ({ x: d.x, fx: 0, fy: -d.F }))];

  // ΣFx
  const fxTerms = [];
  for (const r of reactions) if (r.type !== "roller") fxTerms.push(forceTerm(1, `${r.name}x`));
  for (const f of forces) if (Math.abs(f.fx) > 1e-9) fxTerms.push(forceTerm(f.fx));
  lines.push(`ΣFx = 0:  ${sum(fxTerms)} = 0`);

  // ΣFy
  const fyTerms = reactions.map((r) => forceTerm(1, `${r.name}y`));
  for (const f of forces) if (Math.abs(f.fy) > 1e-9) fyTerms.push(forceTerm(f.fy));
  lines.push(`ΣFy = 0:  ${sum(fyTerms)} = 0`);

  // ΣM about a point, for the actions with x in [from, to].
  const momentEq = (forces, x0, from, to, skipName) => {
    const terms = [];
    const inPart = (x) => x >= from - 1e-9 && x <= to + 1e-9;
    for (const r of reactions) {
      if (!inPart(r.x)) continue;
      if (r.type === "fixed") terms.push(forceTerm(1, `M${r.name}`));
      const arm = r.x - x0;
      if (Math.abs(arm) > 1e-9 && r.name !== skipName) terms.push(forceTerm(arm, `${r.name}y·${fmt(Math.abs(arm))}`));
    }
    for (const f of forces) {
      if (!inPart(f.x)) continue;
      const arm = f.x - x0;
      if (Math.abs(arm) > 1e-9 && Math.abs(f.fy) > 1e-9)
        terms.push(forceTerm(f.fy * arm, `${fmt(Math.abs(f.fy))}·${fmt(Math.abs(arm))}`));
    }
    for (const c of couples) if (inPart(c.x)) terms.push(forceTerm(c.c));
    return sum(terms);
  };

  const first = reactions[0];
  lines.push(`ΣM about ${first.name} = 0 (↺ +):  ${momentEq(forces, first.x, -Infinity, Infinity, first.name)} = 0`);

  // Distributed loads that straddle a hinge are split there.
  for (const g of [...model.hinges].sort((a, b) => a.x - b.x)) {
    const rightDists = model.loads
      .filter((l) => l.type === "dist" && l.x2 > g.x + 1e-9)
      .map((l) => {
        const x1 = Math.max(l.x1, g.x);
        const q = (x) => l.q1 + ((l.q2 - l.q1) * (x - l.x1)) / (l.x2 - l.x1);
        const d = distResultant({ x1, x2: l.x2, q1: q(x1), q2: l.q2 });
        return { x: d.x, fx: 0, fy: -d.F };
      });
    const eq = momentEq([...points, ...rightDists], g.x, g.x + 1e-6, Infinity);
    lines.push(`Hinge at x = ${fmt(g.x)} m, part to its right, ΣM = 0:  ${eq} = 0`);
  }

  if (sol.degree > 0)
    lines.push(
      `Statically indeterminate (degree ${sol.degree}): these equations alone aren't enough. The missing ${
        sol.degree === 1 ? "condition comes" : "conditions come"
      } from how the beam deforms (force method, or tables of fixed-end moments).`,
    );
  return lines;
}
