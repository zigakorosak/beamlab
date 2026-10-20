// The player's own diagram: a band with a dot just left and just right of
// every key point (where the diagram can jump), plus a dot in the middle of
// each segment where the curve bends (V under a varying load, M under any
// distributed load). Dots are dragged up and down (snapping to `step`) or
// typed in; the curve between them is straight, or a parabola through the
// middle dot. Grading compares each dot with the exact value.
//
// The game owns the SVG and re-renders it; the editor draws into it
// (draw) and handles the pointer (attach).

import { maxAbs, momentExtrema, sampleDiagram } from "../core/solver.js";
import { niceStep, fmt } from "../core/format.js";
import { closeEnough } from "../core/grading.js";
import { s } from "../render/svg.js";
import { DIAGRAMS, drawDiagram, keyLabels } from "../render/diagramView.js";

const SIDE_OFFSET = 7; // px between a key point's left and right dots
const PICK_RADIUS = 26; // px: a press this close to a dot's column grabs it

export function createDiagramEditor({ sol, model, kind, momentSide }) {
  const fn = sol[kind];
  const flip = kind === "M" && momentSide === "tension";
  const trueMax = Math.max(maxAbs(sol, fn), 1e-6);
  const gridStep = niceStep((trueMax * 1.3) / 4);
  const scaleMax = Math.ceil((trueMax * 1.3) / gridStep) * gridStep;
  const step = niceStep(scaleMax / 40);
  // Approximate is right (grading.js); never stricter than one snap step.
  const ok = (d) => closeEnough(d.value, d.answer, trueMax, step);

  // ---- Dots
  const xs = sol.xs;
  const dists = model.loads.filter((l) => l.type === "dist");
  const bends = (a, b) =>
    dists.some(
      (d) => d.x1 <= a + 1e-9 && d.x2 >= b - 1e-9 && (kind === "M" ? d.q1 !== 0 || d.q2 !== 0 : d.q1 !== d.q2),
    );
  const dots = [];
  for (let i = 0; i < xs.length; i++) {
    if (i > 0) dots.push({ x: xs[i], side: "-" });
    if (i < xs.length - 1) {
      dots.push({ x: xs[i], side: "+" });
      if (kind !== "N" && bends(xs[i], xs[i + 1])) dots.push({ x: (xs[i] + xs[i + 1]) / 2, side: "mid" });
    }
  }
  for (const d of dots) {
    d.value = 0;
    d.answer = d.side === "mid" ? fn(d.x) : fn(d.x, d.side);
  }

  let selected = 0;
  let revealed = false;
  let geom = null; // { X, mid, k, top, height } from the last draw

  const valueToY = (v) => geom.mid + (flip ? 1 : -1) * v * geom.k;
  const yToValue = (y) => ((y - geom.mid) / (flip ? 1 : -1)) / geom.k;
  const dotX = (d) => geom.X(d.x) + (d.side === "-" ? -SIDE_OFFSET : d.side === "+" ? SIDE_OFFSET : 0);
  const clampSnap = (v) => Math.max(-scaleMax, Math.min(scaleMax, Math.round(v / step) * step));

  /** The player's curve as [[x, v]…], jumps as repeated x. */
  function curve() {
    const pts = [];
    const at = (x, side) => dots.find((d) => d.side === side && Math.abs(d.x - x) < 1e-9);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i];
      const b = xs[i + 1];
      const va = at(a, "+").value;
      const vb = at(b, "-").value;
      const midDot = dots.find((d) => d.side === "mid" && d.x > a && d.x < b);
      if (!midDot) {
        pts.push([a, va], [b, vb]);
        continue;
      }
      // Parabola through (a, va), (m, vm), (b, vb).
      const m = midDot.x;
      const vm = midDot.value;
      const n = 24;
      for (let j = 0; j <= n; j++) {
        const x = a + ((b - a) * j) / n;
        const la = ((x - m) * (x - b)) / ((a - m) * (a - b));
        const lm = ((x - a) * (x - b)) / ((m - a) * (m - b));
        const lb = ((x - a) * (x - m)) / ((b - a) * (b - m));
        pts.push([x, va * la + vm * lm + vb * lb]);
      }
    }
    return pts;
  }

  function draw({ X, top, height }) {
    const band = drawDiagram({ kind, X, top, height, points: curve(), x0: 0, x1: sol.L, flip, scaleMax });
    geom = { X, mid: band.mid, k: band.k, top, height };
    const g = s("g.editor", {}, band.g);
    g.classList.add("is-editable");

    // Value grid, labelled on the right.
    const grid = s("g.value-grid");
    for (let v = -scaleMax; v <= scaleMax + 1e-9; v += gridStep) {
      if (Math.abs(v) < 1e-9) continue;
      const y = valueToY(v);
      grid.append(
        s("line", { x1: X(0), y1: y, x2: X(sol.L), y2: y }),
        s("text", { x: X(sol.L) + 12, y: y + 4, text: fmt(v) }),
      );
    }
    band.g.insertBefore(grid, band.g.querySelector(".axis")); // over the band's background, under the curve

    // Guides down from the key points, so the dots line up with the beam.
    for (const x of xs) g.append(s("line.key-guide", { x1: X(x), y1: top + 6, x2: X(x), y2: top + height - 6 }));

    if (revealed) {
      const sol2 = drawDiagram({
        kind,
        X,
        top,
        height,
        points: sampleDiagram(sol, fn),
        labels: keyLabels(sol, fn, kind === "M" ? momentExtrema(sol) : []),
        x0: 0,
        x1: sol.L,
        flip,
        scaleMax,
      });
      sol2.g.classList.add("is-solution");
      // Only the solution's curve and labels, not a second background/axis/title.
      for (const el of [...sol2.g.children]) if (!el.matches(".diagram-line, .diagram-fill, .value-label, .peak-dot")) el.remove();
      g.append(sol2.g);
    }

    dots.forEach((d, i) => {
      const cls = revealed ? (ok(d) ? ".is-correct" : ".is-wrong") : "";
      const px = dotX(d);
      const py = valueToY(d.value);
      if (i === selected && !revealed) g.append(s("circle.dot-ring", { cx: px, cy: py, r: 11 }));
      g.append(s(`circle.dot${cls}${d.side === "mid" ? ".is-mid" : ""}`, { cx: px, cy: py, r: 6, dataset: { dot: i } }));
    });
    if (!revealed) {
      const d = dots[selected];
      const px = dotX(d);
      const py = valueToY(d.value);
      g.append(s("text.dot-value", { x: px + (d.side === "-" ? -12 : 12), y: py - 10, "text-anchor": d.side === "-" ? "end" : "start", text: fmt(d.value) }));
    }
    return g;
  }

  /** Wire pointer input on `svg`; `redraw` re-renders the board. Returns a detach function. */
  function attach(svg, redraw, onSelect) {
    let dragging = false;
    const local = (e) => {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e) => {
      if (revealed || !geom || e.button !== 0) return;
      const p = local(e);
      if (p.y < geom.top || p.y > geom.top + geom.height) return;
      let idx = e.target.dataset?.dot !== undefined ? Number(e.target.dataset.dot) : -1;
      if (idx < 0) {
        let best = PICK_RADIUS;
        dots.forEach((d, i) => {
          const dist = Math.abs(dotX(d) - p.x);
          if (dist < best) {
            best = dist;
            idx = i;
          }
        });
      }
      if (idx < 0) return;
      e.preventDefault();
      selected = idx;
      dragging = true;
      svg.setPointerCapture(e.pointerId);
      // A press on the band (not on the dot) moves the dot there at once.
      if (e.target.dataset?.dot === undefined) dots[idx].value = clampSnap(yToValue(p.y));
      onSelect?.(e);
      redraw();
    };
    const onMove = (e) => {
      if (!dragging) return;
      dots[selected].value = clampSnap(yToValue(local(e).y));
      onSelect?.(e);
      redraw();
    };
    const onUp = (e) => {
      dragging = false;
      if (svg.hasPointerCapture?.(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    // The wheel over the band steps the selected dot (up = higher).
    const onWheel = (e) => {
      if (revealed || !geom || dragging) return;
      const p = local(e);
      if (p.y < geom.top || p.y > geom.top + geom.height) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      dots[selected].value = clampSnap(dots[selected].value + (d < 0 ? 1 : -1) * step);
      onSelect?.(e);
      redraw();
    };
    const handlers = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp, wheel: onWheel };
    for (const [type, fn] of Object.entries(handlers)) svg.addEventListener(type, fn, { passive: false });
    return () => {
      for (const [type, fn] of Object.entries(handlers)) svg.removeEventListener(type, fn, { passive: false });
    };
  }

  return {
    kind,
    meta: DIAGRAMS[kind],
    step,
    dots,
    get selected() {
      return selected;
    },
    select(i) {
      selected = (i + dots.length) % dots.length;
    },
    nudge(dir) {
      dots[selected].value = clampSnap(dots[selected].value + dir * step);
    },
    setValue(v) {
      dots[selected].value = Math.max(-scaleMax * 2, Math.min(scaleMax * 2, v));
    },
    /** "just left of x = 2 m" etc. */
    describe(i = selected) {
      const d = dots[i];
      const where = d.side === "-" ? "just left of" : d.side === "+" ? "just right of" : "halfway, at";
      return `${where} x = ${fmt(d.x)} m`;
    },
    grade() {
      revealed = true;
      const right = dots.filter(ok).length;
      return { right, total: dots.length, ok: right === dots.length };
    },
    draw,
    attach,
  };
}
