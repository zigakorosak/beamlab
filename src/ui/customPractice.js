// Custom practice: one screen of checkboxes and amounts instead of the
// quick wizard's one-choice-per-step. The choices are kept between visits
// (localStorage), and also travel in the game config, so the game's
// ☰ → Back reopens the form as it was.
//
// Also home to the beam-count slider, shared with the quick wizard.

import { BEAM_TYPES, LOAD_KINDS, MAX_PER_KIND, generateCustomProblem } from "../core/generator.js";
import { h } from "./dom.js";
import { wheelSteps } from "./inputKit.js";

const STORAGE_KEY = "beamlab-custom";
export const MAX_BEAMS = 50;

const TASK_CHOICES = [
  { id: "full", label: "Full solution", desc: "Reactions, then N (if needed), V and M" },
  { id: "reactions", label: "Support reactions" },
  { id: "V", label: "Shear force diagram" },
  { id: "M", label: "Bending moment diagram" },
];

const TYPE_CHOICES = BEAM_TYPES.filter((t) => t.id !== "mixed");

const defaults = () => ({
  tasks: ["full"],
  types: ["simple", "cantilever", "overhang"],
  loads: { point: 2, inclined: 0, udl: 1, tri: 0, moment: 0 },
  vary: true,
  whole: false,
  rounds: 5,
});

export function loadCustom() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && typeof stored === "object") {
      const d = defaults();
      return { ...d, ...stored, loads: { ...d.loads, ...stored.loads } };
    }
  } catch {
    // Unavailable or garbled: start from the defaults.
  }
  return defaults();
}

function saveCustom(custom) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // Storage unavailable: the choices just won't survive a reload.
  }
}

/** A "how many beams" slider, 1 … MAX_BEAMS: drag it, or scroll over it. */
export function beamCountSlider(value, onChange) {
  const input = h("input.count-slider", { type: "range", min: 1, max: MAX_BEAMS, step: 1, value, "aria-label": "Number of beams" });
  const out = h("output.count-value", {}, String(value));
  const set = (v) => {
    v = Math.min(MAX_BEAMS, Math.max(1, Math.round(v)));
    input.value = v;
    out.textContent = String(v);
    onChange(v);
  };
  input.addEventListener("input", () => set(Number(input.value)));
  wheelSteps(input, (dir) => set(Number(input.value) + dir));
  return h("div.count-row", {}, input, out);
}

function checkbox(checked, onChange, ...label) {
  const input = h("input", { type: "checkbox", checked });
  input.addEventListener("change", () => onChange(input.checked));
  return h("label.check-row", {}, input, h("span.check-label", {}, ...label));
}

/** −  n  + : 1 … MAX_PER_KIND, also on the wheel. */
function amountStepper(value, onChange, enabled) {
  const out = h("span.amount-value", {}, String(value));
  const set = (v) => {
    v = Math.min(MAX_PER_KIND, Math.max(1, v));
    out.textContent = String(v);
    minus.disabled = !enabled() || v <= 1;
    plus.disabled = !enabled() || v >= MAX_PER_KIND;
    onChange(v);
  };
  const minus = h("button.amount-button", { type: "button", "aria-label": "Fewer", onclick: () => set(Number(out.textContent) - 1) }, "−");
  const plus = h("button.amount-button", { type: "button", "aria-label": "More", onclick: () => set(Number(out.textContent) + 1) }, "+");
  const el = h("span.amount", {}, minus, out, plus);
  wheelSteps(el, (dir) => enabled() && set(Number(out.textContent) + dir));
  el.refresh = () => set(Number(out.textContent));
  return el;
}

export function renderCustomPractice(root, { initial, onBack, onStart }) {
  const c = structuredClone(initial ?? loadCustom());
  // Each kind's last amount, so unticking and ticking again keeps it.
  const amounts = Object.fromEntries(LOAD_KINDS.map(({ id }) => [id, c.loads[id] || 1]));

  const error = h("p.custom-error", { role: "status" });
  const start = h("button.action-button.custom-start", { type: "button" }, "Start");

  const problem = () => {
    if (!c.tasks.length) return "Tick at least one task.";
    if (!c.types.length) return "Tick at least one kind of beam.";
    if (!LOAD_KINDS.some(({ id }) => c.loads[id] > 0)) return "Tick at least one kind of load.";
    return "";
  };
  const changed = () => {
    saveCustom(c);
    const msg = problem();
    error.textContent = msg;
    start.disabled = Boolean(msg);
  };

  const toggleList = (key, id) => (on) => {
    c[key] = on ? [...c[key], id] : c[key].filter((x) => x !== id);
    changed();
  };

  const section = (title, ...children) => h("section.custom-section", {}, h("h2", {}, title), ...children);

  const loadRows = LOAD_KINDS.map(({ id, label }) => {
    const stepper = amountStepper(
      amounts[id],
      (v) => {
        amounts[id] = v;
        if (c.loads[id] > 0) c.loads[id] = v;
        changed();
      },
      () => c.loads[id] > 0,
    );
    const row = h(
      "div.load-row",
      {},
      checkbox(
        c.loads[id] > 0,
        (on) => {
          c.loads[id] = on ? amounts[id] : 0;
          row.classList.toggle("load-row--off", !on);
          stepper.refresh();
        },
        label,
      ),
      stepper,
    );
    row.classList.toggle("load-row--off", !(c.loads[id] > 0));
    stepper.refresh();
    return row;
  });

  start.addEventListener("click", () => {
    if (problem()) return;
    // One trial beam: the choices may not fit on any beam at all.
    if (!generateCustomProblem(c)) {
      error.textContent = "These loads don't fit on the chosen beams: pick fewer, or allow half metres.";
      return;
    }
    const { rounds, ...custom } = c;
    onStart({ custom, rounds }, c);
  });

  root.replaceChildren(
    h(
      "div.menu-screen.wizard-screen.custom-screen",
      {},
      h("button.wizard-back", { type: "button", onclick: onBack }, "← Back"),
      h("h1", {}, "Custom practice"),
      h("p.wizard-subtitle", {}, "Every beam is made from your choices"),
      section(
        "Tasks (each beam gets one of these)",
        TASK_CHOICES.map((t) =>
          checkbox(c.tasks.includes(t.id), toggleList("tasks", t.id), t.label, t.desc ? h("span.check-desc", {}, t.desc) : null),
        ),
      ),
      section(
        "Beams",
        TYPE_CHOICES.map((t) => checkbox(c.types.includes(t.id), toggleList("types", t.id), t.label, h("span.check-desc", {}, t.desc))),
      ),
      section(
        "Loads on each beam",
        loadRows,
        checkbox(c.vary, (on) => ((c.vary = on), changed()), "Vary the amounts", h("span.check-desc", {}, "Each beam gets 1 up to the number chosen")),
        checkbox(c.whole, (on) => ((c.whole = on), changed()), "Whole metres only", h("span.check-desc", {}, "Lengths and positions in whole metres")),
      ),
      section("How many beams", beamCountSlider(c.rounds, (v) => ((c.rounds = v), changed()))),
      error,
      start,
    ),
  );
  changed();
}
