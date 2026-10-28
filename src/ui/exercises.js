// Izpitne naloge (exam exercises): a topic menu and the exercise runner.
//
//   renderExerciseMenu   Poskusni izpit + every topic, grouped Statika /
//                        Trdnost (registry.js).
//   renderExercise       one task at a time: the statement and figure as on
//                        the exam sheet, a box per result, Preveri grades
//                        them (approximate is right, grading.js), Rešitev
//                        shows the worked solution.
//     { mode: "topic", id }   endless tasks of one topic
//     { mode: "exam" }        a mock exam: 3 tasks (statics, N-T-M,
//                             strength) for 30 + 35 + 35 points, timed.
//
// All text here is Slovenian, like the exams.

import { EXERCISES, GROUPS, byId } from "../exercises/registry.js";
import { num, plain, richParts, rng } from "../exercises/kit.js";
import { figure } from "../exercises/draw.js";
import { answerOk } from "../core/grading.js";
import { parseNumber } from "../core/format.js";
import { h } from "./dom.js";
import { selectOnFocus, wheelNumber } from "./inputKit.js";

const EXAM_POINTS = [30, 35, 35];
const EXAM_MINUTES = 90;

/** Light markup (A_y, M_{max}) as HTML. */
export function rich(text) {
  return richParts(String(text)).map(([t, kind]) => (kind ? h(kind, {}, t) : t));
}

export function renderExerciseMenu(root, navigate) {
  const groups = GROUPS.map((g) => {
    const items = EXERCISES.filter((e) => e.group === g.id);
    if (!items.length) return null;
    return h(
      "section.topic-group",
      {},
      h("h2", {}, g.title),
      h(
        "div.topic-grid",
        {},
        items.map((e) =>
          h(
            "button.menu-option.topic-option",
            { type: "button", onclick: () => navigate("exercise", { mode: "topic", id: e.id }) },
            h("span", {}, e.title),
            h("span.wizard-option-desc", {}, e.desc),
          ),
        ),
      ),
    );
  });
  root.append(
    h(
      "div.menu-screen.wizard-screen.topics-screen",
      {},
      h("button.wizard-back", { type: "button", onclick: () => navigate("home") }, "← Nazaj"),
      h("h1", {}, "Izpitne naloge"),
      h("p.wizard-subtitle", {}, "Naloge kot na izpitih iz Osnov mehanike: vsakič nove številke, rezultati se preverijo, rešitev po korakih."),
      h(
        "button.menu-option.topic-option.topic-exam",
        { type: "button", onclick: () => navigate("exercise", { mode: "exam" }) },
        h("span", {}, "Poskusni izpit"),
        h("span.wizard-option-desc", {}, `3 naloge (statika, notranje sile, trdnost), ${EXAM_POINTS.join(" + ")} točk, ${EXAM_MINUTES} minut`),
      ),
      groups,
    ),
  );
}

export function renderExercise(root, navigate, config) {
  const random = rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const exam = config.mode === "exam";

  // The tasks of a mock exam, one per slot (a slot with no topics yet is skipped).
  const plan = exam
    ? [1, 2, 3]
        .map((slot) => EXERCISES.filter((e) => e.slot === slot))
        .filter((list) => list.length)
        .map((list) => random.pick(list))
    : null;
  const results = []; // exam: { title, points, max }
  let index = 0;
  let current = null; // { def, task, checked, inputs }
  const started = performance.now();

  // ---------- Layout
  const counter = h("span.game-progress");
  const timerEl = h("span.game-timer");
  const scoreEl = h("span.game-score");
  const body = h("div.exercise-body");
  const screen = h(
    "div.exercise-screen",
    {},
    h(
      "header.game-header.exercise-header",
      {},
      h("button.tool-button", { type: "button", onclick: () => navigate("exercises") }, "← Naloge"),
      counter,
      exam ? scoreEl : null,
      exam ? timerEl : null,
    ),
    body,
  );
  root.append(screen);

  let timerId = null;
  if (exam) {
    const tick = () => {
      const left = EXAM_MINUTES * 60 - (performance.now() - started) / 1000;
      const m = Math.floor(Math.abs(left) / 60);
      const s = Math.floor(Math.abs(left) % 60);
      timerEl.textContent = `${left < 0 ? "−" : ""}${m}:${String(s).padStart(2, "0")}`;
      timerEl.classList.toggle("is-late", left < 0);
    };
    tick();
    timerId = setInterval(tick, 1000);
  }

  function next() {
    if (exam && index >= plan.length) return summary();
    const def = exam ? plan[index] : byId(config.id);
    const task = def.build(def.generate(random));
    current = { def, task, checked: false, inputs: [] };
    show();
  }

  function show() {
    const { def, task } = current;
    counter.textContent = exam ? `Naloga ${index + 1} / ${plan.length} · ${EXAM_POINTS[index]} točk` : def.title;
    scoreEl.textContent = `Točke: ${num(results.reduce((t, r) => t + r.points, 0), 3)}`;

    const fig = h("div.exercise-figure");
    const form = h("div.answer-list");
    const feedback = h("div.exercise-feedback");
    const solFig = h("div.exercise-figure.solution-figure");
    const solution = h(
      "div.solution-block",
      { hidden: true },
      h("ol.solution-steps", {}, task.solution.map((line) => h("li", {}, rich(line)))),
      task.solutionFigure ? solFig : null,
    );
    const checkBtn = h("button.action-button", { type: "button", onclick: check }, "Preveri");
    const solBtn = h("button.secondary-button", { type: "button", onclick: toggleSolution }, "Pokaži rešitev");
    const nextBtn = h("button.secondary-button", { type: "button", onclick: advance }, exam ? (index === plan.length - 1 ? "Zaključi izpit" : "Naslednja naloga") : "Nova naloga");

    current.inputs = task.answers.map((a) => {
      const input = h("input.reaction-input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: false, "aria-label": plain(a.label) });
      selectOnFocus(input);
      // Keep every typed digit (and the decimal comma): answers can be 0,0588.
      wheelNumber(input, a.step ?? 1, () => !current.checked, (v) => String(v).replace(".", ","));
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const i = current.inputs.findIndex((x) => x.input === input);
        if (i < current.inputs.length - 1 && !current.checked) current.inputs[i + 1].input.focus();
        else if (!current.checked) check();
        else advance();
      });
      const result = h("span.reaction-result");
      form.append(
        h(
          "label.reaction-row.answer-row",
          {},
          h("span.reaction-name", {}, rich(a.label), " ="),
          input,
          h("span.unit", {}, a.unit ?? ""),
          result,
          a.note ? h("span.answer-hint", {}, rich(a.note)) : null,
        ),
      );
      return { a, input, result };
    });

    body.replaceChildren(
      h("h2.exercise-title", {}, task.title ?? def.title),
      h("div.exercise-text", {}, task.text.map((p) => h("p", {}, rich(p)))),
      task.figure ? fig : null,
      h("div.exercise-answers", {}, h("h3", {}, "Rezultati"), form),
      h("div.exercise-actions", {}, checkBtn, solBtn, nextBtn),
      feedback,
      solution,
    );
    body.scrollTop = 0;
    drawFigure();
    current.inputs[0]?.input.focus({ preventScroll: true });

    function toggleSolution() {
      if (exam && !current.checked) check();
      solution.hidden = !solution.hidden;
      solBtn.textContent = solution.hidden ? "Pokaži rešitev" : "Skrij rešitev";
      if (!solution.hidden) solution.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function check() {
      if (current.checked) return;
      current.checked = true;
      let right = 0;
      for (const { a, input, result } of current.inputs) {
        const v = parseNumber(input.value);
        const ok = v !== null && answerOk(v, a);
        if (ok) right++;
        input.readOnly = true;
        input.classList.add(ok ? "input--correct" : "input--wrong");
        // Close but not exact (to the printed digits): show the exact value too.
        result.textContent = ok ? (num(v) === num(a.value) ? "✓" : `✓ ${num(a.value)}`) : `✗ ${num(a.value)}`;
        result.classList.add(ok ? "summary-correct" : "summary-wrong");
      }
      const total = current.inputs.length;
      if (exam) {
        const max = EXAM_POINTS[index];
        results.push({ title: def.title, points: (max * right) / total, max, right, total });
        scoreEl.textContent = `Točke: ${num(results.reduce((t, r) => t + r.points, 0), 3)}`;
      }
      feedback.replaceChildren(
        h(
          `div.answer-feedback.${right === total ? "summary-correct" : "summary-wrong"}`,
          {},
          right === total ? "Vse pravilno!" : `Pravilno ${right} od ${total}. Pravilne vrednosti so poleg tvojih; poglej rešitev.`,
        ),
      );
      checkBtn.disabled = true;
      nextBtn.classList.add("action-button");
      nextBtn.focus({ preventScroll: true });
    }

    function advance() {
      if (exam && !current.checked) check();
      index++;
      next();
    }

    function drawFigure() {
      const width = Math.min(760, Math.max(280, body.clientWidth - 32));
      for (const [draw, el, tall] of [[task.figure, fig, 0.62], [task.solutionFigure, solFig, 1.1]]) {
        if (!draw) continue;
        const f = figure();
        draw(f);
        // Phones get a taller box than the width alone would give, or the drawing ends up tiny.
        // The solution's diagrams may stack up on a phone: let them grow taller there.
        const cap = tall > 1 ? (width < 600 ? 1000 : 720) : 440;
        el.replaceChildren(f.render(width, Math.min(cap, Math.max(tall > 1 ? 420 : 300, Math.round(width * (width < 600 && tall > 1 ? 2.4 : tall))))));
      }
    }
    current.redraw = drawFigure;
  }

  function summary() {
    clearInterval(timerId);
    const got = results.reduce((t, r) => t + r.points, 0);
    const max = results.reduce((t, r) => t + r.max, 0);
    const secs = Math.round((performance.now() - started) / 1000);
    const pct = max ? (100 * got) / max : 0;
    body.replaceChildren(
      h(
        "div.game-summary",
        {},
        h("h2", {}, "Konec izpita"),
        h("p.summary-score", {}, `${num(got, 3)} / ${max} točk (${Math.round(pct)} %)`),
        h("p.summary-time", {}, `Čas: ${Math.floor(secs / 60)} min ${secs % 60} s`),
        h("p.summary-time", {}, pct >= 50 ? "Opravljeno (meja 50 %)." : "Ni opravljeno (meja 50 %)."),
        h(
          "ul.summary-list",
          {},
          results.map((r, i) =>
            h("li", {}, h("span.summary-round", {}, `${i + 1}. ${r.title}: `), h(`span.${r.right === r.total ? "summary-correct" : "summary-wrong"}`, {}, `${num(r.points, 3)} / ${r.max} (${r.right}/${r.total} rezultatov)`)),
          ),
        ),
        h("button.action-button", { type: "button", onclick: () => navigate("exercise", { mode: "exam" }) }, "Nov izpit"),
        h("button", { type: "button", onclick: () => navigate("exercises") }, "Nazaj na naloge"),
      ),
    );
  }

  let lastWidth = 0;
  const ro = new ResizeObserver(() => {
    if (body.clientWidth === lastWidth) return; // height changes (feedback, solution) don't need a redraw
    lastWidth = body.clientWidth;
    current?.redraw?.();
  });
  ro.observe(body);
  next();

  return () => {
    clearInterval(timerId);
    ro.disconnect();
  };
}
