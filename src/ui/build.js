// Build: the sandbox. Drag a beam, supports and loads from the palette onto
// the grid; the reactions and the N / V / M diagrams (and the deflected
// shape) update live, also while dragging.
//
//   header:  "Build"  [Examples] [↶] [↷]  [Practice this]  [☰]
//   body:    palette | board (grid + model + diagram bands)
//                     | status line (determinacy, hover readout)
//                     | inspector card for the selected element
//
// Pointer handling, all on the board's SVG:
// - a palette tile is dragged with window-level listeners; while it's over
//   the board the would-be model is rendered as a preview, and dropping
//   commits it. A tap on a tile (no drag) adds the element at a default spot.
// - board elements carry data-kind / data-id (/ data-handle), see
//   render/beamView.js. Press + move drags (beam ends, distributed-load
//   corners: also its intensity), press + release without moving selects.
// Every committed change goes on the undo stack and into localStorage.

import { cloneModel, emptyModel, fitToBeam, near, newId, SUPPORT_TYPES, LOAD_LABELS } from "../core/model.js";
import { solve } from "../core/solver.js";
import { loadSettings } from "../core/settings.js";
import { fmt, parseNumber } from "../core/format.js";
import { EXAMPLES } from "../core/examples.js";
import { drawModel, MODEL_BAND } from "../render/beamView.js";
import { DIAGRAMS } from "../render/diagramView.js";
import { makeScale, solutionBands } from "../render/board.js";
import { s, arrow, momentArc } from "../render/svg.js";
import { h } from "./dom.js";
import { createHamburgerMenu } from "./hamburgerMenu.js";
import { openPopup } from "./popup.js";

const STORAGE_KEY = "beamlab-build";
const DRAG_THRESHOLD = 4; // px before a press becomes a drag
const MIN_VIEW = 12; // metres of grid shown at least (on a wide screen, or with no beam yet)
const NARROW = 700; // px: below this the grid just fits the beam

const TILES = [
  { id: "beam", label: "Beam" },
  { id: "pin", label: "Pinned" },
  { id: "roller", label: "Roller" },
  { id: "fixed", label: "Fixed" },
  { id: "hinge", label: "Hinge" },
  { id: "point", label: "Force" },
  { id: "udl", label: "Uniform load" },
  { id: "tri", label: "Triangular" },
  { id: "moment", label: "Moment" },
];

function tileIcon(id) {
  const svg = s("svg.tile-icon", { viewBox: "0 0 48 32", "aria-hidden": "true" });
  const beam = () => s("rect.icon-beam", { x: 4, y: 13, width: 40, height: 5, rx: 1 });
  switch (id) {
    case "beam":
      svg.append(beam());
      break;
    case "pin":
      svg.append(s("path.icon-line", { d: "M24 8 L15 22 H33 Z" }), s("path.icon-line", { d: "M12 26 H36" }));
      break;
    case "roller":
      svg.append(
        s("path.icon-line", { d: "M24 6 L16 18 H32 Z" }),
        s("circle.icon-line", { cx: 19, cy: 22, r: 3 }),
        s("circle.icon-line", { cx: 29, cy: 22, r: 3 }),
        s("path.icon-line", { d: "M12 27 H36" }),
      );
      break;
    case "fixed":
      svg.append(
        s("path.icon-line", { d: "M18 4 V28 M18 8 L12 13 M18 15 L12 20 M18 22 L12 27" }),
        s("rect.icon-beam", { x: 18, y: 13, width: 24, height: 5, rx: 1 }),
      );
      break;
    case "hinge":
      svg.append(beam(), s("circle.icon-hinge", { cx: 24, cy: 15.5, r: 5 }));
      break;
    case "point":
      svg.append(arrow(24, 2, 24, 28, { cls: "icon-load", size: 9 }));
      break;
    case "udl":
      svg.append(s("rect.icon-dist", { x: 6, y: 8, width: 36, height: 8 }));
      for (const x of [10, 24, 38]) svg.append(arrow(x, 9, x, 27, { cls: "icon-load", size: 6 }));
      break;
    case "tri":
      svg.append(s("path.icon-dist", { d: "M6 27 L42 6 L42 27 Z" }));
      for (const [x, y] of [[24, 17], [38, 9]]) svg.append(arrow(x, y, x, 27, { cls: "icon-load", size: 6 }));
      break;
    case "moment":
      svg.append(momentArc(24, 18, 10, true, { cls: "icon-moment" }));
      break;
  }
  return svg;
}

function loadModel() {
  try {
    const m = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (m && Array.isArray(m.supports) && Array.isArray(m.loads) && Array.isArray(m.hinges)) return m;
  } catch {
    // fall through
  }
  return null;
}

function saveModel(model) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Storage unavailable — the beam just won't survive a reload.
  }
}

/** Which collection an id lives in, and the item. */
function findItem(model, id) {
  if (id === "beam") return model.beam ? { kind: "beam", item: model.beam } : null;
  for (const [kind, list] of [["support", model.supports], ["hinge", model.hinges], ["load", model.loads]]) {
    const item = list.find((x) => x.id === id);
    if (item) return { kind, item, list };
  }
  return null;
}

export function renderBuild(root, navigate) {
  const settings = loadSettings();
  const snapStep = settings.snap;
  const snap = (x) => Math.round(x / snapStep) * snapStep;
  const round = (x) => Math.round(x * 1000) / 1000;

  let model = loadModel() ?? emptyModel();
  let preview = null; // a model shown mid-drag, not committed yet
  let selected = null;
  const undoStack = [];
  const redoStack = [];
  const show = { reactions: true, N: true, V: true, M: true, w: false };
  let viewLock = null; // metres of grid shown, frozen while dragging so the scale holds still
  let scale = null;
  let sol = null;
  let hoverX = null;

  // ---------- DOM
  const screen = h("div.game-screen.build-screen");
  const undoBtn = h("button.tool-button", { type: "button", title: "Undo (Ctrl+Z)", "aria-label": "Undo" }, "↶");
  const redoBtn = h("button.tool-button", { type: "button", title: "Redo (Ctrl+Y)", "aria-label": "Redo" }, "↷");
  const examplesBtn = h("button.tool-button", { type: "button" }, "Examples");
  const practiceBtn = h("button.action-button", { type: "button", title: "Solve this beam yourself" }, "Practice this");
  const menu = createHamburgerMenu(
    screen,
    [
      h("button.exit-button", { type: "button", onclick: () => commit(emptyModel()) }, "Clear all"),
      h("button.exit-button", { type: "button", onclick: () => navigate("settings", "build") }, "Settings"),
      h("button.exit-button", { type: "button", onclick: () => navigate("help") }, "How to play"),
      h("button.exit-button", { type: "button", onclick: () => navigate("home") }, "Home"),
    ],
    { label: "Build menu" },
  );
  const header = h(
    "div.game-header",
    {},
    h("span.build-title", {}, "Build"),
    examplesBtn,
    undoBtn,
    redoBtn,
    h("span.header-spacer"),
    practiceBtn,
    menu,
  );

  const tiles = TILES.map((t) =>
    h("button.palette-tile", { type: "button", dataset: { tile: t.id }, title: t.label }, tileIcon(t.id), h("span", {}, t.label)),
  );
  const palette = h("div.palette", {}, tiles);

  const toggles = h("div.view-toggles");
  const svg = s("svg.board", { role: "img", "aria-label": "Beam and diagrams" });
  const boardWrap = h("div.board-wrap", {}, svg);
  const status = h("div.status-line");
  const inspector = h("div.inspector", { hidden: true });
  const workspace = h("div.workspace", {}, toggles, boardWrap, status, inspector);
  screen.append(header, h("div.build-body", {}, palette, workspace));
  root.append(screen);

  // ---------- Model changes
  function commit(next, select = selected) {
    undoStack.push(cloneModel(model));
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
    model = next;
    selected = select && findItem(model, select) ? select : null;
    saveModel(model);
    render();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(cloneModel(model));
    model = undoStack.pop();
    if (selected && !findItem(model, selected)) selected = null;
    saveModel(model);
    render();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(cloneModel(model));
    model = redoStack.pop();
    if (selected && !findItem(model, selected)) selected = null;
    saveModel(model);
    render();
  }
  function removeSelected() {
    if (!selected) return;
    const next = cloneModel(model);
    if (selected === "beam") return commit(emptyModel(), null);
    const found = findItem(next, selected);
    if (!found) return;
    found.list.splice(found.list.indexOf(found.item), 1);
    commit(next, null);
  }

  // ---------- Adding from the palette
  /** The model with tile `id` dropped at world x `wx`, or null if it can't go there. */
  function withTile(base, id, wx) {
    const m = cloneModel(base);
    if (id === "beam") {
      if (m.beam) return null;
      const L = 6;
      m.beam = { x0: Math.max(0, snap(wx - L / 2)), length: L };
      return { model: m, id: "beam" };
    }
    if (!m.beam) return null;
    const L = m.beam.length;
    const rel = wx - m.beam.x0;
    if (rel < -1 || rel > L + 1) return null;
    const x = round(Math.min(L, Math.max(0, snap(rel))));
    const newIdFor = { pin: "s", roller: "s", fixed: "s", hinge: "g" }[id] ?? "l";
    const nid = newId(newIdFor);
    if (id === "pin" || id === "roller" || id === "fixed") {
      const at = id === "fixed" ? (x < L / 2 ? 0 : L) : x;
      m.supports = m.supports.filter((sp) => !near(sp.x, at)); // replaces whatever was there
      m.supports.push({ id: nid, type: id, x: at });
      // A hinge can't share a point with a fixed support.
      if (id === "fixed") m.hinges = m.hinges.filter((g) => !near(g.x, at));
    } else if (id === "hinge") {
      const hx = round(Math.min(L - snapStep, Math.max(snapStep, x)));
      if (hx <= 0 || hx >= L || m.hinges.some((g) => near(g.x, hx))) return null;
      if (m.supports.some((sp) => sp.type === "fixed" && near(sp.x, hx))) return null;
      m.hinges.push({ id: nid, x: hx });
    } else if (id === "point") {
      m.loads.push({ id: nid, type: "point", x, value: 10, angle: 0 });
    } else if (id === "moment") {
      m.loads.push({ id: nid, type: "moment", x, value: 10 });
    } else {
      const len = Math.min(2, L);
      const x1 = round(Math.min(x, L - len));
      const tri = id === "tri";
      m.loads.push({ id: nid, type: "dist", x1, x2: round(x1 + len), q1: tri ? 0 : 5, q2: tri ? 10 : 5 });
    }
    return { model: m, id: nid };
  }

  // ---------- Rendering
  function viewSpan(m) {
    if (viewLock) return viewLock;
    if (!m.beam) return MIN_VIEW;
    const min = boardWrap.clientWidth < NARROW ? 0 : MIN_VIEW;
    return Math.max(min, m.beam.x0 + m.beam.length + 1.5);
  }

  function render() {
    const m = preview ?? model;
    const width = Math.max(320, boardWrap.clientWidth);
    const span = viewSpan(m);
    scale = makeScale(width, 0, span);
    const { X } = scale;
    sol = m.beam ? solve(m) : { ok: false, error: "Drag a beam onto the grid to start." };

    const kinds = [];
    if (sol.ok) {
      if (show.N && sol.hasAxial) kinds.push("N");
      if (show.V) kinds.push("V");
      if (show.M) kinds.push("M");
      if (show.w) kinds.push("w");
    }

    svg.replaceChildren();
    // Grid: a line every snap step, stronger every metre.
    const grid = s("g.grid");
    const gTop = 12;
    const gBottom = MODEL_BAND.height - 18;
    const minor = Math.max(snapStep, scale.ppm * snapStep < 10 ? 1 : snapStep);
    for (let i = 0; i * minor <= span + 1e-9; i++) {
      const x = i * minor;
      const major = Math.abs(x - Math.round(x)) < 1e-9;
      grid.append(s(`line${major ? ".major" : ""}`, { x1: X(x), y1: gTop, x2: X(x), y2: gBottom }));
    }
    svg.append(grid);

    const Xm = (x) => X(m.beam.x0 + x);
    if (m.beam) {
      svg.append(
        drawModel(m, {
          X: Xm,
          selectedId: selected,
          reactions: sol.ok && show.reactions ? sol.reactions : null,
          handles: true,
        }),
      );
    } else {
      svg.append(
        s("text.board-hint", {
          x: width / 2,
          y: MODEL_BAND.beamY,
          "text-anchor": "middle",
          text: "Drag a beam here from the palette",
        }),
      );
    }

    let height = MODEL_BAND.height;
    if (kinds.length) {
      const bands = solutionBands(sol, kinds, { X: Xm, top: height, momentSide: settings.momentSide });
      svg.append(...bands.nodes);
      height += bands.height;
    }
    svg.append(s("line.crosshair", { x1: 0, y1: 0, x2: 0, y2: height, visibility: "hidden" }));
    svg.setAttribute("width", width);
    svg.setAttribute("height", height + 8);
    svg.setAttribute("viewBox", `0 0 ${width} ${height + 8}`);

    renderStatus();
    renderToggles();
    renderInspector();
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
    practiceBtn.disabled = !sol.ok;
    for (const t of tiles) t.disabled = t.dataset.tile === "beam" ? Boolean(model.beam) : !model.beam;
    for (const t of tiles) t.title = t.dataset.tile === "beam" && model.beam ? "One beam at a time: drag its ends to resize it" : t.querySelector("span").textContent;
    if (hoverX !== null) showHover(hoverX);
  }

  function renderStatus() {
    status.classList.toggle("is-error", !sol.ok);
    if (!sol.ok) {
      status.textContent = sol.error;
      return;
    }
    const d = sol.degree;
    status.textContent =
      d === 0 ? "Statically determinate" : `Statically indeterminate (degree ${d}) — the reactions need more than ΣF = 0, ΣM = 0`;
  }

  function showHover(x) {
    const line = svg.querySelector(".crosshair");
    const m = preview ?? model;
    if (!line || !sol?.ok || !m.beam || x < 0 || x > m.beam.length) {
      line?.setAttribute("visibility", "hidden");
      if (sol) renderStatus();
      return;
    }
    const px = scale.X(m.beam.x0 + x);
    line.setAttribute("x1", px);
    line.setAttribute("x2", px);
    line.setAttribute("y1", MODEL_BAND.height);
    line.setAttribute("visibility", "visible");
    const parts = [`x = ${fmt(x)} m`];
    if (sol.hasAxial) parts.push(`N = ${fmt(sol.N(x))} kN`);
    parts.push(`V = ${fmt(sol.V(x))} kN`, `M = ${fmt(sol.M(x))} kNm`);
    status.classList.remove("is-error");
    status.textContent = parts.join("   ");
  }

  function renderToggles() {
    toggles.replaceChildren(
      ...[
        ["reactions", "Reactions"],
        ["N", "N"],
        ["V", "V"],
        ["M", "M"],
        ["w", "Deflection"],
      ].map(([key, label]) =>
        h(
          `button.view-toggle${show[key] ? ".is-active" : ""}`,
          {
            type: "button",
            title: key === "reactions" ? "Show the support reactions" : DIAGRAMS[key].name + (key === "N" ? " (only when a force has an axial part)" : ""),
            "aria-pressed": String(show[key]),
            onclick: () => {
              show[key] = !show[key];
              render();
            },
          },
          label,
        ),
      ),
    );
  }

  // ---------- Inspector (the selected element's numbers)
  function field(label, value, unit, onCommit, { min = -Infinity, max = Infinity } = {}) {
    const input = h("input.inspector-input", { type: "text", inputmode: "decimal", value: fmt(value, 3).replace("−", "-"), spellcheck: false });
    const apply = () => {
      const v = parseNumber(input.value);
      if (v === null || v < min || v > max) {
        input.classList.add("is-invalid");
        return;
      }
      input.classList.remove("is-invalid");
      onCommit(v);
    };
    input.addEventListener("change", apply);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
    return h("label.inspector-field", {}, h("span", {}, label), input, h("span.unit", {}, unit));
  }

  function edit(mutate) {
    const next = cloneModel(model);
    const found = findItem(next, selected);
    if (!found) return;
    mutate(found.item, next);
    if (next.beam) fitToBeam(next);
    commit(next);
  }

  function renderInspector() {
    const found = selected ? findItem(preview ?? model, selected) : null;
    // Don't rebuild under the user's typing: same element and a field has focus.
    if (found && inspector.dataset.for === selected && inspector.contains(document.activeElement)) return;
    inspector.hidden = !found;
    inspector.dataset.for = found ? selected : "";
    if (!found) return inspector.replaceChildren();
    const { kind, item } = found;
    const L = (preview ?? model).beam.length;
    const rows = [];
    let title = "";
    const pos = (key = "x") =>
      field("Position", item[key], "m", (v) => edit((it) => (it[key] = v)), { min: 0, max: L });
    if (kind === "beam") {
      title = "Beam";
      rows.push(field("Length", item.length, "m", (v) => edit((it) => (it.length = v)), { min: 0.5, max: 50 }));
    } else if (kind === "support") {
      title = SUPPORT_TYPES[item.type].label;
      rows.push(
        h(
          "div.inspector-choices",
          {},
          Object.entries(SUPPORT_TYPES).map(([type, t]) =>
            h(
              `button.choice${item.type === type ? ".is-active" : ""}`,
              {
                type: "button",
                onclick: () =>
                  edit((it, m) => {
                    it.type = type;
                    if (type === "fixed") it.x = it.x < L / 2 ? 0 : L;
                    m.supports = m.supports.filter((o) => o === it || !near(o.x, it.x));
                  }),
              },
              t.short,
            ),
          ),
        ),
      );
      if (item.type !== "fixed") rows.push(pos());
    } else if (kind === "hinge") {
      title = "Hinge";
      rows.push(pos(), h("p.inspector-note", {}, "Moment is zero here: the beam can bend freely at a hinge."));
    } else if (item.type === "point") {
      title = LOAD_LABELS.point;
      rows.push(
        field("Force", item.value, "kN", (v) => edit((it) => (it.value = v)), { min: 0 }),
        field("Angle", item.angle, "°", (v) => edit((it) => (it.angle = ((((v + 180) % 360) + 360) % 360) - 180))),
        h(
          "div.inspector-choices",
          {},
          [
            ["↓", 0],
            ["↑", 180],
            ["→", 90],
            ["←", -90],
            ["↘", 45],
            ["↙", -45],
          ].map(([sym, a]) =>
            h(`button.choice${item.angle === a ? ".is-active" : ""}`, { type: "button", title: `${a}°`, onclick: () => edit((it) => (it.angle = a)) }, sym),
          ),
        ),
        pos(),
      );
    } else if (item.type === "moment") {
      title = LOAD_LABELS.moment;
      rows.push(
        field("Moment", Math.abs(item.value), "kNm", (v) => edit((it) => (it.value = Math.sign(it.value || 1) * v)), { min: 0 }),
        h(
          "div.inspector-choices",
          {},
          [
            ["↺ counterclockwise", 1],
            ["↻ clockwise", -1],
          ].map(([label, sign]) =>
            h(
              `button.choice${Math.sign(item.value) === sign ? ".is-active" : ""}`,
              { type: "button", onclick: () => edit((it) => (it.value = sign * Math.abs(it.value))) },
              label,
            ),
          ),
        ),
        pos(),
      );
    } else {
      title = LOAD_LABELS.dist;
      rows.push(
        field("From", item.x1, "m", (v) => edit((it) => (it.x1 = Math.min(v, it.x2 - 0.1))), { min: 0, max: L }),
        field("To", item.x2, "m", (v) => edit((it) => (it.x2 = Math.max(v, it.x1 + 0.1))), { min: 0, max: L }),
        field("q at start", item.q1, "kN/m", (v) => edit((it) => (it.q1 = v))),
        field("q at end", item.q2, "kN/m", (v) => edit((it) => (it.q2 = v))),
        h("p.inspector-note", {}, "Downward is positive. Or drag the corner handles."),
      );
    }
    inspector.replaceChildren(
      h("div.inspector-head", {}, h("span.inspector-title", {}, title), h("button.inspector-close", { type: "button", "aria-label": "Close", onclick: () => ((selected = null), render()) }, "×")),
      ...rows,
      h("button.inspector-delete", { type: "button", onclick: removeSelected }, kind === "beam" ? "Delete beam (clears all)" : "Delete"),
    );
  }

  // ---------- Board pointer handling
  const worldX = (e) => {
    const r = svg.getBoundingClientRect();
    return scale.inv(e.clientX - r.left);
  };
  let drag = null;

  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const target = e.target.closest("[data-kind]");
    if (!target) {
      selected = null;
      render();
      return;
    }
    drag = {
      kind: target.dataset.kind,
      id: target.dataset.id,
      handle: target.dataset.handle ?? null,
      x0: e.clientX,
      y0: e.clientY,
      wx0: worldX(e),
      start: cloneModel(model),
      moved: false,
    };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  svg.addEventListener("pointermove", (e) => {
    if (!drag) {
      const m = model;
      if (m.beam) {
        hoverX = worldX(e) - m.beam.x0;
        showHover(hoverX);
      }
      return;
    }
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      // Freeze the scale while dragging. Stretching the beam gets room to
      // grow: at least MIN_VIEW (a narrow screen zooms out for it).
      viewLock = drag.handle === "end" ? Math.max(MIN_VIEW, viewSpan(model)) : viewSpan(model);
      selected = drag.id;
    }
    preview = dragged(drag, worldX(e), e.clientX - drag.x0, e.clientY - drag.y0);
    hoverX = null;
    render();
  });

  const endDrag = (e, cancelled = false) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    viewLock = null;
    if (d.moved) {
      const next = preview;
      preview = null;
      if (next && !cancelled) commit(next, d.id);
      else render();
    } else {
      selected = d.id;
      render();
    }
    if (svg.hasPointerCapture?.(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  };
  svg.addEventListener("pointerup", (e) => endDrag(e));
  svg.addEventListener("pointercancel", (e) => endDrag(e, true));
  svg.addEventListener("pointerleave", () => {
    if (drag) return;
    hoverX = null;
    showHover(-1);
  });

  /** The model after dragging `d` to world x `wx`, having moved (dxPx, dy) px. */
  function dragged(d, wx, dxPx, dy) {
    const m = cloneModel(d.start);
    const b = m.beam;
    const L = b.length;
    const span = viewLock;
    const rel = (x) => round(Math.min(L, Math.max(0, snap(x - b.x0))));
    const dx = snap(wx - d.wx0);
    if (d.kind === "beam") {
      if (d.handle === "end") {
        // Relative to where it started: the view may have zoomed out under
        // the pointer when the drag began (narrow screens).
        b.length = round(Math.min(span - b.x0, Math.max(snapStep * 2, snap(L + dxPx / scale.ppm))));
        return fitToBeam(m);
      }
      if (d.handle === "start") {
        const end = b.x0 + L;
        const nx0 = round(Math.min(end - snapStep * 2, Math.max(0, snap(wx))));
        const shift = nx0 - b.x0;
        b.x0 = nx0;
        b.length = round(end - nx0);
        for (const sp of m.supports) sp.x = round(sp.x - shift);
        for (const g of m.hinges) g.x = round(g.x - shift);
        for (const l of m.loads) {
          if (l.type === "dist") [l.x1, l.x2] = [round(l.x1 - shift), round(l.x2 - shift)];
          else l.x = round(l.x - shift);
        }
        return fitToBeam(m);
      }
      b.x0 = round(Math.min(span - L, Math.max(0, d.start.beam.x0 + dx)));
      return m;
    }
    const found = findItem(m, d.id);
    if (!found) return m;
    const it = found.item;
    if (d.kind === "support") {
      let x = rel(wx);
      if (it.type === "fixed") x = x < L / 2 ? 0 : L;
      if (m.supports.some((o) => o !== it && near(o.x, x))) return m;
      if (it.type === "fixed" && m.hinges.some((g) => near(g.x, x))) return m;
      it.x = x;
    } else if (d.kind === "hinge") {
      const x = round(Math.min(L - snapStep, Math.max(snapStep, snap(wx - b.x0))));
      if (m.hinges.some((o) => o !== it && near(o.x, x))) return m;
      if (m.supports.some((sp) => sp.type === "fixed" && near(sp.x, x))) return m;
      it.x = x;
    } else if (it.type === "dist") {
      if (d.handle) {
        // Corner: along the beam moves that end, up/down changes its q
        // (1 kN/m per 4 px, in steps of 0.5).
        const end = d.handle === "end1" ? 1 : 2;
        const startItem = findItem(d.start, d.id).item;
        const q0 = startItem[`q${end}`];
        it[`q${end}`] = Math.round((q0 - dy / 4) * 2) / 2;
        const x = rel(wx);
        if (end === 1) it.x1 = Math.min(x, round(it.x2 - snapStep));
        else it.x2 = Math.max(x, round(it.x1 + snapStep));
      } else {
        const len = it.x2 - it.x1;
        const startItem = findItem(d.start, d.id).item;
        const x1 = round(Math.min(L - len, Math.max(0, startItem.x1 + dx)));
        it.x1 = x1;
        it.x2 = round(x1 + len);
      }
    } else {
      it.x = rel(wx);
    }
    return m;
  }

  // ---------- Palette drag & drop
  let paletteDrag = null;
  for (const tile of tiles) {
    tile.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || tile.disabled) return;
      e.preventDefault();
      const ghost = h("div.drag-ghost", {}, tileIcon(tile.dataset.tile));
      ghost.style.left = `${e.clientX}px`;
      ghost.style.top = `${e.clientY}px`;
      paletteDrag = { id: tile.dataset.tile, ghost, x0: e.clientX, y0: e.clientY, moved: false, result: null };
      viewLock = viewSpan(model);
      window.addEventListener("pointermove", onPaletteMove);
      window.addEventListener("pointerup", onPaletteUp);
      window.addEventListener("pointercancel", onPaletteCancel);
    });
  }

  function onPaletteMove(e) {
    const d = paletteDrag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      document.body.append(d.ghost);
    }
    d.ghost.style.left = `${e.clientX}px`;
    d.ghost.style.top = `${e.clientY}px`;
    const r = boardWrap.getBoundingClientRect();
    const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    d.result = over ? withTile(model, d.id, worldX(e)) : null;
    d.ghost.classList.toggle("is-invalid", over && !d.result);
    d.ghost.classList.toggle("is-placed", Boolean(d.result));
    preview = d.result?.model ?? null;
    render();
  }

  function onPaletteUp() {
    const d = paletteDrag;
    stopPaletteDrag();
    if (!d) return;
    if (!d.moved) {
      // A tap: drop it somewhere sensible.
      const b = model.beam;
      const wx = d.id === "beam" ? MIN_VIEW / 2 : b ? b.x0 + b.length / 2 : 0;
      const res = withTile(model, d.id, wx);
      if (res) commit(res.model, res.id);
      return;
    }
    preview = null;
    if (d.result) commit(d.result.model, d.result.id);
    else render();
  }

  function onPaletteCancel() {
    stopPaletteDrag();
    preview = null;
    render();
  }

  function stopPaletteDrag() {
    paletteDrag?.ghost.remove();
    paletteDrag = null;
    viewLock = null;
    window.removeEventListener("pointermove", onPaletteMove);
    window.removeEventListener("pointerup", onPaletteUp);
    window.removeEventListener("pointercancel", onPaletteCancel);
  }

  // ---------- Header buttons, keys, resize
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  examplesBtn.addEventListener("click", () => {
    let close = null;
    const list = h(
      "div.example-list",
      {},
      EXAMPLES.map((ex) =>
        h(
          "button.menu-option.wizard-option",
          {
            type: "button",
            onclick: () => {
              close();
              commit(ex.build(), null);
            },
          },
          h("span", {}, ex.label),
          h("span.wizard-option-desc", {}, ex.desc),
        ),
      ),
    );
    close = openPopup({ title: "Examples", content: list, hint: "Replaces the current beam (Undo brings it back)." });
  });
  practiceBtn.addEventListener("click", () => {
    if (!sol?.ok) return;
    navigate("game", { task: "full", type: "custom", level: "custom", rounds: 1, models: [cloneModel(model)] }, "build");
  });

  const onKey = (e) => {
    if (e.target.closest?.("input, textarea")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      if (selected) {
        e.preventDefault();
        removeSelected();
      }
    } else if (e.key === "Escape") {
      selected = null;
      render();
    }
  };
  document.addEventListener("keydown", onKey);

  const ro = new ResizeObserver(() => render());
  ro.observe(boardWrap);
  render();

  return () => {
    document.removeEventListener("keydown", onKey);
    stopPaletteDrag();
    ro.disconnect();
  };
}
