// The player's own diagram: a band with a dot just left and just right of
// every key point (where the diagram can jump), plus a dot in the middle of
// each segment where the curve bends (V under a varying load, M under any
// distributed load). Dots are dragged up and down (snapping to `step`) or
// typed in; the curve between them is straight, or a parabola through the
// middle dot. Grading compares each dot with the exact value.
//
// With `autoMid` (Settings, the default), M gets no middle dots: the bend
// under a distributed load follows from the load alone (M minus the
// straight line between its ends depends only on the load on that piece),
// so the player sets the key points and the curve bulges by itself.
//
// Grabbing the line (away from the dots) drags that whole segment. Double
// clicking (or double tapping) a key point's pair of dots links them: they
// move as one (no jump there) until another double click unlinks them.
//
// The game owns the SVG and re-renders it; the editor draws into it
// (draw) and handles the pointer (attach) on a transparent HTML layer over
// its band: Chromium ignores touch-action inside an <svg>, so a touch drag
// there turned into a page scroll (pointercancel) after its first move.
// The layer has touch-action: none; the rest of the board still scrolls.

import { maxAbs, momentExtrema, sampleDiagram } from "../core/solver.js";
import { niceStep, fmt } from "../core/format.js";
import { closeEnough } from "../core/grading.js";
import { s } from "../render/svg.js";
import { DIAGRAMS, drawDiagram, keyLabels } from "../render/diagramView.js";

const SIDE_OFFSET = 7; // px between a key point's left and right dots
const PICK_RADIUS = 26; // px: a press this close to a dot's column grabs it
const DOT_HIT = 12; // px: a press this close to a dot grabs that dot
const LINE_HIT = { mouse: 8, touch: 14 }; // px: a press this close to the line grabs the segment
const DOUBLE_MS = 400; // two taps on one pair this close together link / unlink it
const TAP_SLOP = 6; // px: a press that moved less is a tap

export function createDiagramEditor({ sol, model, kind, momentSide, autoMid = true }) {
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
  // Segment i's automatic bulge at its middle (autoMid), else 0.
  const bulges = [];
  for (let i = 0; i < xs.length; i++) {
    if (i > 0) dots.push({ x: xs[i], side: "-" });
    if (i < xs.length - 1) {
      dots.push({ x: xs[i], side: "+" });
      bulges[i] = 0;
      if (kind === "N" || !bends(xs[i], xs[i + 1])) continue;
      const m = (xs[i] + xs[i + 1]) / 2;
      if (kind === "M" && autoMid) bulges[i] = fn(m) - (fn(xs[i], "+") + fn(xs[i + 1], "-")) / 2;
      else dots.push({ x: m, side: "mid" });
    }
  }
  for (const d of dots) {
    d.value = 0;
    d.answer = d.side === "mid" ? fn(d.x) : fn(d.x, d.side);
  }

  // Linked pairs, by key point index into xs: both dots share one value.
  const linked = new Set();
  const pairOf = (i) => {
    const d = dots[i];
    if (d.side === "mid") return -1;
    const k = xs.findIndex((x) => Math.abs(x - d.x) < 1e-9);
    if (k <= 0 || k >= xs.length - 1) return -1; // the beam's ends have one dot
    return k;
  };
  const partner = (i) => {
    const d = dots[i];
    return dots.findIndex((o) => o !== d && o.side !== "mid" && Math.abs(o.x - d.x) < 1e-9);
  };
  /** The dots that move with dot i: itself, and its partner when linked. */
  const group = (i) => (linked.has(pairOf(i)) ? [i, partner(i)] : [i]);
  const setDot = (i, v) => {
    for (const j of group(i)) dots[j].value = v;
  };
  function toggleLink(i) {
    const k = pairOf(i);
    if (k < 0) return;
    if (linked.has(k)) linked.delete(k);
    else {
      linked.add(k);
      dots[partner(i)].value = dots[i].value;
    }
  }

  let selected = 0;
  let revealed = false;
  let geom = null; // { X, mid, k, top, height } from the last draw
  let pad = null; // the input layer over the band (attach)
  const placePad = () => {
    if (!pad || !geom) return;
    pad.hidden = revealed;
    pad.style.top = `${geom.top}px`;
    pad.style.height = `${geom.height}px`;
  };

  const valueToY = (v) => geom.mid + (flip ? 1 : -1) * v * geom.k;
  const yToValue = (y) => ((y - geom.mid) / (flip ? 1 : -1)) / geom.k;
  const dotX = (d) => geom.X(d.x) + (d.side === "-" ? -SIDE_OFFSET : d.side === "+" ? SIDE_OFFSET : 0);
  const clampSnap = (v) => Math.max(-scaleMax, Math.min(scaleMax, Math.round(v / step) * step));

  /** Segment i (xs[i] … xs[i+1]): the indices of its dots, left, mid, right. */
  function segmentDots(i) {
    const a = xs[i];
    const b = xs[i + 1];
    const find = (pred) => dots.findIndex(pred);
    return {
      a,
      b,
      left: find((d) => d.side === "+" && Math.abs(d.x - a) < 1e-9),
      mid: find((d) => d.side === "mid" && d.x > a && d.x < b),
      right: find((d) => d.side === "-" && Math.abs(d.x - b) < 1e-9),
    };
  }

  /** The player's value at x on segment i: straight, or a parabola through the middle dot. */
  function segmentValue(i, x) {
    const { a, b, left, mid, right } = segmentDots(i);
    const va = dots[left].value;
    const vb = dots[right].value;
    if (mid < 0 && !bulges[i]) return va + ((vb - va) * (x - a)) / (b - a);
    const m = (a + b) / 2;
    const vm = mid < 0 ? (va + vb) / 2 + bulges[i] : dots[mid].value;
    const la = ((x - m) * (x - b)) / ((a - m) * (a - b));
    const lm = ((x - a) * (x - b)) / ((m - a) * (m - b));
    const lb = ((x - a) * (x - m)) / ((b - a) * (b - m));
    return va * la + vm * lm + vb * lb;
  }

  /** The player's curve as [[x, v]…], jumps as repeated x. */
  function curve() {
    const pts = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const { a, b, mid } = segmentDots(i);
      const n = mid < 0 && !bulges[i] ? 1 : 24;
      for (let j = 0; j <= n; j++) {
        const x = a + ((b - a) * j) / n;
        pts.push([x, segmentValue(i, x)]);
      }
    }
    return pts;
  }

  function draw({ X, top, height }) {
    const band = drawDiagram({ kind, X, top, height, points: curve(), x0: 0, x1: sol.L, flip, scaleMax });
    geom = { X, mid: band.mid, k: band.k, top, height };
    placePad();
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

    // Linked pairs: one capsule around both dots.
    if (!revealed)
      for (const k of linked) {
        const i = dots.findIndex((d) => d.side === "-" && Math.abs(d.x - xs[k]) < 1e-9);
        const y = valueToY(dots[i].value);
        const sel = group(selected).includes(i);
        g.append(s(`rect.dot-pair${sel ? ".is-selected" : ""}`, { x: X(xs[k]) - SIDE_OFFSET - 11, y: y - 11, width: 2 * SIDE_OFFSET + 22, height: 22, rx: 11 }));
      }
    const selectedGroup = group(selected);
    dots.forEach((d, i) => {
      const cls = revealed ? (ok(d) ? ".is-correct" : ".is-wrong") : "";
      const px = dotX(d);
      const py = valueToY(d.value);
      if (selectedGroup.length === 1 && i === selected && !revealed) g.append(s("circle.dot-ring", { cx: px, cy: py, r: 11 }));
      g.append(s(`circle.dot${cls}${d.side === "mid" ? ".is-mid" : ""}`, { cx: px, cy: py, r: 6, dataset: { dot: i } }));
    });
    if (!revealed) {
      const d = dots[selected];
      const px = dotX(d) + (selectedGroup.length > 1 ? (d.side === "-" ? -4 : 4) : 0);
      const py = valueToY(d.value) - (selectedGroup.length > 1 ? 2 : 0);
      g.append(s("text.dot-value", { x: px + (d.side === "-" ? -12 : 12), y: py - 10, "text-anchor": d.side === "-" ? "end" : "start", text: fmt(d.value) }));
    }
    return g;
  }

  /** Wire pointer input on `svg`; `redraw` re-renders the board. Returns a detach function. */
  function attach(svg, redraw, onSelect) {
    // drag: { kind: "dot" } or { kind: "segment", startValue, orig: [[i, v]…] }
    let drag = null;
    let press = null; // { x, y, pair } of the current press, for taps
    let lastTap = null; // { pair, t } of the last tap on a pair's dots
    const local = (e) => {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const inBand = (p) => geom && p.y >= geom.top && p.y <= geom.top + geom.height;
    // The dot under the point, if any (nearest within DOT_HIT).
    const dotAt = (p) => {
      let idx = -1;
      let best = DOT_HIT;
      dots.forEach((d, i) => {
        const dist = Math.hypot(dotX(d) - p.x, valueToY(d.value) - p.y);
        if (dist < best) [best, idx] = [dist, i];
      });
      return idx;
    };
    // The segment whose line passes under the point, if any.
    const segmentAt = (p, pointerType) => {
      const x = (p.x - geom.X(0)) / (geom.X(1) - geom.X(0));
      const i = xs.findIndex((a, j) => j < xs.length - 1 && x >= a && x <= xs[j + 1]);
      if (i < 0) return -1;
      const slop = LINE_HIT[pointerType === "mouse" ? "mouse" : "touch"];
      return Math.abs(valueToY(segmentValue(i, x)) - p.y) <= slop ? i : -1;
    };

    const onDown = (e) => {
      if (revealed || e.button !== 0) return;
      const p = local(e);
      if (!inBand(p)) return;
      let idx = dotAt(p);
      const seg = idx < 0 ? segmentAt(p, e.pointerType) : -1;
      if (seg >= 0) {
        // Grab the whole segment: its dots, and their linked partners.
        const { left, mid, right } = segmentDots(seg);
        const moving = new Set([left, mid, right].filter((j) => j >= 0).flatMap(group));
        drag = { kind: "segment", startValue: yToValue(p.y), orig: [...moving].map((j) => [j, dots[j].value]) };
        selected = left;
        press = null;
      } else {
        if (idx < 0) {
          let best = PICK_RADIUS;
          dots.forEach((d, i) => {
            const dist = Math.abs(dotX(d) - p.x);
            if (dist < best) [best, idx] = [dist, i];
          });
        }
        if (idx < 0) return;
        const pair = pairOf(idx);
        // The second tap on the same pair links / unlinks it.
        if (pair >= 0 && lastTap?.pair === pair && performance.now() - lastTap.t < DOUBLE_MS) {
          toggleLink(idx);
          lastTap = null;
          press = null;
          drag = { kind: "dot" };
        } else {
          press = { ...p, pair };
          drag = { kind: "dot" };
          // A press beside the dot (not on it) moves the dot there at once.
          if (dotAt(p) !== idx) setDot(idx, clampSnap(yToValue(p.y)));
        }
        selected = idx;
      }
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      onSelect?.(e);
      redraw();
    };
    const onMove = (e) => {
      const p = local(e);
      if (!drag) {
        // Hover (mouse): say what a press here would grab.
        if (e.pointerType === "mouse" && !revealed && inBand(p))
          pad.dataset.grab = dotAt(p) >= 0 ? "dot" : segmentAt(p, "mouse") >= 0 ? "line" : "";
        return;
      }
      if (press && Math.hypot(p.x - press.x, p.y - press.y) > TAP_SLOP) press = null;
      if (drag.kind === "segment") {
        const delta = Math.round((yToValue(p.y) - drag.startValue) / step) * step;
        for (const [j, v] of drag.orig) dots[j].value = clampSnap(v + delta);
      } else setDot(selected, clampSnap(yToValue(p.y)));
      onSelect?.(e);
      redraw();
    };
    const onUp = (e) => {
      if (press && press.pair >= 0 && e.type === "pointerup") lastTap = { pair: press.pair, t: performance.now() };
      else if (drag) lastTap = null;
      press = null;
      drag = null;
      if (pad.hasPointerCapture?.(e.pointerId)) pad.releasePointerCapture(e.pointerId);
    };
    const onLeave = () => delete pad.dataset.grab;
    // Right click on a pair links / unlinks it, like a double click.
    const onContextMenu = (e) => {
      e.preventDefault();
      if (revealed) return;
      const p = local(e);
      if (!inBand(p)) return;
      let idx = dotAt(p);
      if (idx < 0) {
        let best = PICK_RADIUS;
        dots.forEach((d, i) => {
          const dist = Math.abs(dotX(d) - p.x);
          if (dist < best) [best, idx] = [dist, i];
        });
      }
      if (idx < 0 || pairOf(idx) < 0) return;
      toggleLink(idx);
      selected = idx;
      onSelect?.(e);
      redraw();
    };
    // Even with touch-action: none, a quick flick on the layer left Chromium
    // a fling that ate the next tap (Confirm did nothing). Touches on the
    // layer are all ours: no scroll, fling or zoom gestures from them.
    const noGesture = (e) => e.cancelable && e.preventDefault();
    // The wheel over the band steps the selected dot (up = higher).
    const onWheel = (e) => {
      if (revealed || drag) return;
      const p = local(e);
      if (!inBand(p)) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d) return;
      e.preventDefault();
      setDot(selected, clampSnap(dots[selected].value + (d < 0 ? 1 : -1) * step));
      onSelect?.(e);
      redraw();
    };
    const handlers = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp, pointerleave: onLeave, wheel: onWheel, contextmenu: onContextMenu, touchstart: noGesture, touchmove: noGesture };
    pad = document.createElement("div");
    pad.className = "editor-pad";
    svg.parentElement.append(pad);
    placePad();
    for (const [type, fn] of Object.entries(handlers)) pad.addEventListener(type, fn, { passive: false });
    return () => {
      pad.remove();
      pad = null;
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
      // ← → step over a linked partner: the pair is one stop.
      const wrap = (j) => (j + dots.length) % dots.length;
      let next = wrap(i);
      if (next !== selected && group(selected).includes(next)) next = wrap(next + (i < selected ? -1 : 1));
      selected = next;
    },
    /** Links or unlinks the selected dot's pair (Space). */
    toggleLink() {
      toggleLink(selected);
    },
    nudge(dir) {
      setDot(selected, clampSnap(dots[selected].value + dir * step));
    },
    setValue(v) {
      setDot(selected, Math.max(-scaleMax * 2, Math.min(scaleMax * 2, v)));
    },
    /** "just left of x = 2 m" etc. */
    describe(i = selected) {
      const d = dots[i];
      if (group(i).length > 1) return `both sides of x = ${fmt(d.x)} m (linked)`;
      const where = d.side === "-" ? "just left of" : d.side === "+" ? "just right of" : "halfway, at";
      return `${where} x = ${fmt(d.x)} m`;
    },
    grade() {
      revealed = true;
      const right = dots.filter(ok).length;
      return { right, total: dots.length, ok: right === dots.length };
    },
    /** The player's curve as [[x, v]…] (tests). */
    curve,
    draw,
    attach,
  };
}
