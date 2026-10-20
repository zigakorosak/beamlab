// What Build and the game share: the horizontal scale (metres → px) and the
// stack of solved diagram bands under the model band.

import { sampleDiagram, momentExtrema } from "../core/solver.js";
import { BAND_HEIGHT, drawDiagram, keyLabels } from "./diagramView.js";

export const MARGIN_L = 72;
export const MARGIN_R = 44;

/** x (metres, from `from`) → px, for a board `width` px wide showing from…to. */
export function makeScale(width, from, to) {
  const ppm = Math.max(8, (width - MARGIN_L - MARGIN_R) / (to - from));
  return { ppm, X: (x) => MARGIN_L + (x - from) * ppm, inv: (px) => from + (px - MARGIN_L) / ppm };
}

/** The diagram's function on a solution: sol.N / sol.V / sol.M. */
export const diagramFn = (sol, kind) => sol[kind];

/**
 * Draw the solved diagrams `kinds` (e.g. ["V", "M"]) one under another,
 * starting at `top`. X maps beam x (0…L) to px.
 * Returns { nodes, height, bands: { [kind]: { top, yOf, mid } } }.
 */
export function solutionBands(sol, kinds, { X, top, momentSide, faint = false }) {
  const nodes = [];
  const bands = {};
  let y = top;
  for (const kind of kinds) {
    const band =
      kind === "w"
        ? { kind, points: sol.deflection, labels: [] }
        : {
            kind,
            points: sampleDiagram(sol, sol[kind]),
            labels: keyLabels(sol, sol[kind], kind === "M" ? momentExtrema(sol) : []),
          };
    const d = drawDiagram({ ...band, X, top: y, x0: 0, x1: sol.L, flip: kind === "M" && momentSide === "tension", faint });
    nodes.push(d.g);
    bands[kind] = { top: y, yOf: d.yOf, mid: d.mid };
    y += BAND_HEIGHT;
  }
  return { nodes, height: y - top, bands };
}
