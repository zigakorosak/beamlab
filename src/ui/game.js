// Practice: the game screen, laid out like GeoQuiz's / Anatomy Quiz's:
//
//   header: "Beam 2 / 5"  [Shear]  "Score: 3"  "41.2s"  [Confirm/Next]  [☰]
//
// Each beam (round) is one or more stages, by task:
//   reactions        enter every reaction component (signed, as drawn)
//   N / V / M        draw the diagram with draggable dots (diagramEditor.js)
//   full             reactions → (N, if a force has an axial part) → V → M
// A stage is answered → Confirm → result (right values in green, the exact
// diagram over the player's, the equilibrium equations) → Next. One point
// per stage that's entirely right.

import { generateProblem, BEAM_TYPES } from "../core/generator.js";
import { momentExtrema, solve } from "../core/solver.js";
import { equilibriumSteps } from "../core/explain.js";
import { loadSettings } from "../core/settings.js";
import { fmt, parseNumber } from "../core/format.js";
import { closeEnough, isExact } from "../core/grading.js";
import { drawModel, MODEL_BAND } from "../render/beamView.js";
import { BAND_HEIGHT } from "../render/diagramView.js";
import { makeScale, solutionBands } from "../render/board.js";
import { s } from "../render/svg.js";
import { h } from "./dom.js";
import { createHamburgerMenu } from "./hamburgerMenu.js";
import { createDiagramEditor } from "./diagramEditor.js";
import { boxText, selectOnFocus, wheelSteps } from "./inputKit.js";

// After the last stage, the report's buttons ignore clicks this long (ms),
// so a quick second click on "See Results" doesn't skip the report.
const REPORT_GUARD_MS = 500;

const STAGE_NAMES = { reactions: "Reactions", N: "Axial force", V: "Shear force", M: "Bending moment" };

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

// The last pointer kind, so selecting a dot by touch doesn't pop up the
// phone keyboard (focusing the value box would).
let lastPointer = "mouse";
document.addEventListener("pointerdown", (e) => (lastPointer = e.pointerType), true);

export function renderGame(root, navigate, config, backState) {
  const settings = loadSettings();
  const goBack = () => (backState === "build" ? navigate("build") : navigate("wizard", backState));

  // ---------- DOM
  const screen = h("div.game-screen");
  const progress = h("span.game-progress");
  const stageChip = h("span.stage-chip");
  const scoreEl = h("span.game-score");
  const timerEl = h("span.game-timer");
  const actionButton = h("button.action-button", { type: "button" }, "Confirm");
  const menu = createHamburgerMenu(
    screen,
    [
      h("button.exit-button", { type: "button", onclick: () => navigate("game", config, backState) }, "Restart"),
      h("button.exit-button", { type: "button", onclick: goBack }, "Back"),
      h("button.exit-button", { type: "button", onclick: () => navigate("home") }, "Home"),
    ],
    { label: "Game menu" },
  );
  const header = h("div.game-header", {}, progress, stageChip, scoreEl, timerEl, actionButton, menu);
  const promptEl = h("div.round-prompt");
  const svg = s("svg.board", { role: "img", "aria-label": "Beam" });
  const boardWrap = h("div.board-wrap", {}, svg);
  const answerArea = h("div.answer-area");
  const feedbackArea = h("div.feedback-area");
  const roundScroll = h("div.round-scroll", {}, promptEl, boardWrap, answerArea, feedbackArea);
  screen.append(header, roundScroll);
  root.append(screen);

  // ---------- State
  let round = -1;
  let model, sol, stages, stageIndex, phase; // phase: answering | result | summary
  let editor = null;
  let reactionInputs = [];
  let score = 0;
  let maxScore = 0;
  const records = [];
  let roundStart = 0;
  let timerId = null;

  const stage = () => stages[stageIndex];

  function nextRound() {
    round++;
    if (round >= config.rounds) return showSummary();
    model = config.models ? structuredClone(config.models[round % config.models.length]) : generateProblem(config.type, config.level);
    sol = solve(model);
    stages =
      config.task === "full" ? ["reactions", ...(sol.hasAxial ? ["N"] : []), "V", "M"] : [config.task];
    stageIndex = 0;
    const label = config.models ? "Your beam" : (BEAM_TYPES.find((t) => t.id === model.kind)?.label ?? "Beam");
    records.push({ label, stages: [], time: 0 });
    roundStart = performance.now();
    clearInterval(timerId);
    timerId = setInterval(tick, 100);
    startStage();
  }

  function tick() {
    timerEl.textContent = seconds(performance.now() - roundStart);
  }

  function startStage() {
    phase = "answering";
    editor = null;
    detachEditor?.();
    detachEditor = null;
    reactionInputs = [];
    const st = stage();
    if (st !== "reactions") {
      editor = createDiagramEditor({ sol, model, kind: st, momentSide: settings.momentSide });
    }
    progress.textContent = `Beam ${round + 1} / ${config.rounds}`;
    stageChip.textContent = STAGE_NAMES[st];
    stageChip.hidden = stages.length < 2;
    scoreEl.textContent = `Score: ${score}`;
    actionButton.textContent = "Confirm";
    feedbackArea.replaceChildren();
    renderPrompt();
    renderAnswer();
    renderBoard();
    roundScroll.scrollTop = 0;
  }

  function renderPrompt() {
    const st = stage();
    const momentWay = settings.momentSide === "tension" ? "drawn on the tension side (below the axis)" : "drawn above the axis";
    const lines = {
      reactions: [
        "Find the support reactions.",
        "Positive as drawn: horizontal →, vertical ↑, moments ↺ (counterclockwise). In kN and kNm; a negative value means the other way.",
      ],
      N: ["Draw the axial force diagram N(x).", "Tension is positive. Drag the dots, or pick one and type its value."],
      V: [
        "Draw the shear force diagram V(x).",
        "V is positive when the forces left of the cut push up. Each key point has a dot just left and just right of it, for jumps. Drag the dots, or pick one and type its value.",
      ],
      M: [
        "Draw the bending moment diagram M(x).",
        `Sagging is positive, ${momentWay}. Middle dots shape the curve under distributed loads.`,
      ],
    }[st];
    promptEl.replaceChildren(h("div.prompt-title", {}, lines[0]), h("div.prompt-sub", {}, lines[1]));
  }

  // ---------- Board: beam, earlier diagrams (solved), the current editor
  function renderBoard() {
    const width = Math.max(320, boardWrap.clientWidth);
    // Room on both sides for a fixed support's moment arrow and its label.
    const { X } = makeScale(width, -1.4, sol.L + 1.4);
    const st = stage();
    svg.replaceChildren();
    const reactionsKnown = st !== "reactions" || phase === "result";
    svg.append(
      drawModel(model, {
        X,
        reactions: reactionsKnown ? sol.reactions : null,
        unknowns: !reactionsKnown,
        resultants: st === "reactions" && phase === "result",
      }),
    );
    let y = MODEL_BAND.height;
    // Diagrams finished earlier on this beam stay up, solved, as help.
    const done = stages.slice(0, stageIndex).filter((k) => k !== "reactions");
    if (done.length) {
      const b = solutionBands(sol, done, { X, top: y, momentSide: settings.momentSide, faint: true });
      svg.append(...b.nodes);
      y += b.height;
    }
    if (editor) {
      svg.append(editor.draw({ X, top: y, height: BAND_HEIGHT + 30 }));
      y += BAND_HEIGHT + 30;
    }
    svg.setAttribute("width", width);
    svg.setAttribute("height", y + 8);
    svg.setAttribute("viewBox", `0 0 ${width} ${y + 8}`);
  }

  let detachEditor = null;
  function bindEditor() {
    detachEditor?.();
    detachEditor = editor?.attach(
      svg,
      () => {
        renderBoard();
        syncValueBox();
      },
      () => {
        // Selecting a dot readies its value for typing over.
        syncValueBox(true);
        focusValue();
      },
    );
  }

  // ---------- Answer widgets
  let valueInput = null;
  let valueLabel = null;
  function renderAnswer() {
    answerArea.replaceChildren();
    valueInput = null;
    if (stage() === "reactions") {
      const rows = [];
      for (const r of sol.reactions) {
        const comps = { pin: ["x", "y"], roller: ["y"], fixed: ["x", "y", "m"] }[r.type];
        for (const c of comps) {
          const name = c === "m" ? `M${r.name}` : `${r.name}${c}`;
          const input = h("input.reaction-input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: false, "aria-label": name });
          selectOnFocus(input);
          // 1 kN a notch, 0.1 with Shift.
          wheelSteps(input, (dir, e) => {
            if (phase !== "answering") return;
            const v = (parseNumber(input.value) ?? 0) + dir * (e.shiftKey ? 0.1 : 1);
            input.value = boxText(Math.round(v * 1e6) / 1e6);
            input.focus({ preventScroll: true });
            input.select();
          });
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const i = reactionInputs.findIndex((ri) => ri.input === input);
              if (i < reactionInputs.length - 1 && phase === "answering") reactionInputs[i + 1].input.focus();
              else onAction();
            }
          });
          const answer = { x: r.Rx, y: r.Ry, m: r.M }[c];
          const result = h("span.reaction-result");
          reactionInputs.push({ name, input, answer, result, unit: c === "m" ? "kNm" : "kN" });
          rows.push(
            h(
              "label.reaction-row",
              {},
              h("span.reaction-name", {}, name),
              input,
              h("span.unit", {}, c === "m" ? "kNm" : "kN"),
              result,
            ),
          );
        }
      }
      answerArea.append(h("div.reaction-form", {}, rows));
      // Focus without scrolling the board out of view on phones.
      reactionInputs[0]?.input.focus({ preventScroll: true });
      return;
    }
    valueLabel = h("span.value-where");
    valueInput = h("input.reaction-input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: false, "aria-label": "Value of the selected dot" });
    selectOnFocus(valueInput);
    wheelSteps(valueInput, (dir) => {
      if (phase !== "answering") return;
      editor.nudge(dir);
      renderBoard();
      syncValueBox(true);
      focusValue(true);
    });
    valueInput.addEventListener("input", () => {
      const v = parseNumber(valueInput.value);
      if (v === null || phase !== "answering") return;
      editor.setValue(v);
      renderBoard();
    });
    valueInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAction();
      } else if (e.key === "Tab") {
        e.preventDefault();
        editor.select(editor.selected + (e.shiftKey ? -1 : 1));
        renderBoard();
        syncValueBox(true);
        focusValue();
      } else if (e.key in BOX_KEYS && phase === "answering") {
        // Same keys as on the board: ← → pick a dot, ↑ ↓ move it.
        e.preventDefault();
        BOX_KEYS[e.key]();
        renderBoard();
        syncValueBox(true);
        focusValue();
      }
    });
    const nudge = (dir) => () => {
      if (phase !== "answering") return;
      editor.nudge(dir);
      renderBoard();
      syncValueBox(true);
      focusValue();
    };
    const pick = (dir) => () => {
      if (phase !== "answering") return;
      editor.select(editor.selected + dir);
      renderBoard();
      syncValueBox(true);
      focusValue();
    };
    answerArea.append(
      h(
        "div.value-box",
        {},
        h("button.tool-button", { type: "button", "aria-label": "Previous dot", onclick: pick(-1) }, "‹"),
        h("div.value-main", {}, valueLabel, h("div.value-entry", {}, valueInput, h("span.unit", {}, editor.meta.unit))),
        h("button.tool-button", { type: "button", "aria-label": "Lower", onclick: nudge(-1) }, "−"),
        h("button.tool-button", { type: "button", "aria-label": "Higher", onclick: nudge(1) }, "+"),
        h("button.tool-button", { type: "button", "aria-label": "Next dot", onclick: pick(1) }, "›"),
      ),
    );
    bindEditor();
    syncValueBox(true);
  }

  function syncValueBox(force = false) {
    if (!valueInput || !editor) return;
    valueLabel.textContent = `Dot ${editor.selected + 1} of ${editor.dots.length}: ${editor.describe()}`;
    if (force || document.activeElement !== valueInput) valueInput.value = boxText(editor.dots[editor.selected].value);
  }

  /** Put the caret in the value box with its text selected, ready to type
   *  over (not after a touch, unless `always`: that would open the keyboard). */
  function focusValue(always = false) {
    if (!valueInput || phase !== "answering" || (lastPointer === "touch" && !always)) return;
    valueInput.focus({ preventScroll: true });
    valueInput.select();
  }

  const BOX_KEYS = {
    ArrowUp: () => editor.nudge(1),
    ArrowDown: () => editor.nudge(-1),
    ArrowRight: () => editor.select(editor.selected + 1),
    ArrowLeft: () => editor.select(editor.selected - 1),
  };

  // ---------- Confirm / Next
  function onAction() {
    if (phase === "answering") confirm();
    else if (phase === "result") advance();
  }
  actionButton.addEventListener("click", onAction);

  function confirm() {
    const st = stage();
    let right;
    let total;
    if (st === "reactions") {
      total = reactionInputs.length;
      right = 0;
      const scale = Math.max(...reactionInputs.map((ri) => Math.abs(ri.answer)));
      for (const ri of reactionInputs) {
        const v = parseNumber(ri.input.value) ?? 0;
        const ok = closeEnough(v, ri.answer, scale);
        if (ok) right++;
        ri.input.readOnly = true;
        ri.input.classList.add(ok ? "input--correct" : "input--wrong");
        // Close enough still shows the exact value.
        ri.result.textContent = ok ? (isExact(v, ri.answer) ? "✓" : `✓ ${fmt(ri.answer)}`) : `✗ ${fmt(ri.answer)}`;
        ri.result.classList.add(ok ? "summary-correct" : "summary-wrong");
      }
    } else {
      ({ right, total } = editor.grade());
      if (valueInput) valueInput.readOnly = true;
    }
    const ok = right === total;
    maxScore++;
    if (ok) score++;
    records[records.length - 1].stages.push({ stage: st, ok, right, total });
    phase = "result";
    scoreEl.textContent = `Score: ${score}`;
    const last = stageIndex === stages.length - 1;
    actionButton.textContent = last ? (round === config.rounds - 1 ? "See Results" : "Next beam") : "Next";
    if (last) {
      clearInterval(timerId);
      records[records.length - 1].time = performance.now() - roundStart;
    }

    const msg = ok
      ? "Correct!"
      : st === "reactions"
        ? `${right} of ${total} right — the correct values are next to yours.`
        : `${right} of ${total} dots right — green is right, red is off. The exact diagram is drawn over yours.`;
    const fb = [h(`div.answer-feedback.${ok ? "summary-correct" : "summary-wrong"}`, {}, msg)];
    if (st === "reactions") fb.push(h("pre.steps", {}, equilibriumSteps(model, sol).join("\n")));
    if (st === "M") {
      const peak = peakNote();
      if (peak) fb.push(h("div.answer-note", {}, peak));
    }
    feedbackArea.replaceChildren(...fb);
    renderBoard();
    actionButton.focus({ preventScroll: true });
  }

  function peakNote() {
    let best = null;
    for (const x of sol.xs)
      for (const side of ["-", "+"]) {
        const v = sol.M(x, side);
        if (!best || Math.abs(v) > Math.abs(best.value)) best = { x, value: v };
      }
    for (const e of momentExtrema(sol)) if (Math.abs(e.value) > Math.abs(best.value)) best = e;
    return best ? `Largest |M| = ${fmt(Math.abs(best.value))} kNm at x = ${fmt(best.x)} m.` : null;
  }

  function advance() {
    if (stageIndex < stages.length - 1) {
      stageIndex++;
      startStage();
    } else {
      nextRound();
    }
  }

  // ---------- Summary
  function showSummary() {
    phase = "summary";
    clearInterval(timerId);
    const totalTime = records.reduce((t, r) => t + r.time, 0);
    const list = h(
      "ul.summary-list",
      {},
      records.map((r, i) =>
        h(
          "li",
          {},
          h("span.summary-round", {}, `${i + 1}. ${r.label} (${seconds(r.time)}): `),
          r.stages.map((st, j) =>
            h(
              `span.${st.ok ? "summary-correct" : "summary-wrong"}`,
              {},
              `${j ? " · " : ""}${STAGE_NAMES[st.stage]} ${st.ok ? "✓" : `✗ ${st.right}/${st.total}`}`,
            ),
          ),
        ),
      ),
    );
    const summary = h(
      "div.game-summary.game-summary--guarded",
      {},
      h("h2", {}, "Game Over"),
      h("p.summary-score", {}, `You scored ${score} / ${maxScore}`),
      h("p.summary-time", {}, `Total ${seconds(totalTime)} · ${seconds(totalTime / Math.max(1, records.length))} per beam`),
      list,
      h("button.action-button", { type: "button", onclick: () => navigate("game", config, backState) }, "Play Again"),
      h("button", { type: "button", onclick: goBack }, "Back"),
      h("button", { type: "button", onclick: () => navigate("home") }, "Home"),
    );
    setTimeout(() => summary.classList.remove("game-summary--guarded"), REPORT_GUARD_MS);
    screen.replaceChildren(summary);
  }

  // ---------- Keys
  const onKey = (e) => {
    if (phase === "summary") return;
    const inInput = e.target.closest?.("input");
    if (e.key === "Enter" && !inInput) {
      e.preventDefault();
      onAction();
      return;
    }
    if (!editor || phase !== "answering" || inInput) return;
    if (BOX_KEYS[e.key]) {
      e.preventDefault();
      BOX_KEYS[e.key]();
      renderBoard();
      syncValueBox(true);
      focusValue();
    }
  };
  document.addEventListener("keydown", onKey);

  const ro = new ResizeObserver(() => {
    if (phase !== "summary" && sol) renderBoard();
  });
  ro.observe(boardWrap);

  nextRound();

  return () => {
    detachEditor?.();
    clearInterval(timerId);
    document.removeEventListener("keydown", onKey);
    ro.disconnect();
  };
}
