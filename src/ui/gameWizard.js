// The Practice flow: a sequence of choice screens, worded and laid out like
// GeoQuiz's wizard, ending in a game config handed to the game screen:
//   quick:  task → beam type → difficulty → rounds → play
//   custom: one form of checkboxes and amounts → play (customPractice.js)
//
// Steps are named ({ name }) rather than closures, so the whole position —
// config, history, current step — can be handed to the game and back
// again: the game's ☰ → Back returns to the last step with every earlier
// choice (and the Back chain behind it) intact, as in GeoQuiz.

import { BEAM_TYPES, LEVELS } from "../core/generator.js";
import { choiceScreen } from "./screenKit.js";
import { h } from "./dom.js";
import { beamCountSlider, loadCustom, renderCustomPractice } from "./customPractice.js";

export const TASKS = [
  { id: "full", label: "Full solution", desc: "Reactions, then the diagrams: N (with an inclined force), V and M" },
  { id: "reactions", label: "Support reactions", desc: "Find the reaction forces and moments" },
  { id: "V", label: "Shear force diagram", desc: "Reactions given: draw V(x)" },
  { id: "M", label: "Bending moment diagram", desc: "Reactions given: draw M(x)" },
];

const ROUNDS = [3, 5, 10];

export function renderWizard(root, navigate, resume = null) {
  const config = { ...(resume?.config ?? {}) };
  const history = [...(resume?.history ?? [])];
  let current = resume?.current ?? { name: "mode" };

  const show = () => steps[current.name](current);
  const go = (step) => {
    history.push(current);
    current = step;
    show();
  };
  const back = () => {
    const prev = history.pop();
    if (!prev) return navigate("home");
    current = prev;
    show();
  };
  const screen = (opts) => choiceScreen(root, { onBack: back, ...opts });

  const play = () => navigate("game", { ...config }, { config: { ...config }, history: [...history], current });

  const steps = {
    mode() {
      screen({
        title: "Practice",
        options: [
          { label: "Quick practice", desc: "Pick a task, a beam and the loads", onSelect: () => go({ name: "task" }) },
          {
            label: "Custom practice",
            desc: "Tick any mix of tasks, beams and loads, and how many of each",
            onSelect: () => go({ name: "custom" }),
          },
        ],
      });
    },
    custom() {
      renderCustomPractice(root, {
        initial: config.customForm ?? loadCustom(),
        onBack: back,
        onStart: (game, form) => {
          for (const k of ["task", "type", "level"]) delete config[k];
          Object.assign(config, game, { customForm: form });
          play();
        },
      });
    },
    task() {
      screen({
        title: "What do you want to practise?",
        options: TASKS.map((t) => ({
          label: t.label,
          desc: t.desc,
          onSelect: () => {
            delete config.custom;
            config.task = t.id;
            go({ name: "type" });
          },
        })),
      });
    },
    type() {
      screen({
        title: "Choose a beam",
        options: BEAM_TYPES.map((t) => ({
          label: t.label,
          desc: t.desc,
          onSelect: () => {
            config.type = t.id;
            go({ name: "level" });
          },
        })),
      });
    },
    level() {
      screen({
        title: "Choose the loads",
        options: LEVELS.map((l) => ({
          label: l.label,
          desc: l.desc,
          onSelect: () => {
            config.level = l.id;
            go({ name: "rounds" });
          },
        })),
      });
    },
    rounds() {
      let custom = config.rounds ?? 7;
      screen({
        title: "How many beams?",
        options: ROUNDS.map((n) => ({
          label: String(n),
          onSelect: () => {
            config.rounds = n;
            play();
          },
        })),
        footer: h(
          "section.custom-count",
          {},
          h("h2", {}, "Or any number"),
          beamCountSlider(custom, (v) => (custom = v)),
          h("button.menu-option.wizard-option", { type: "button", onclick: () => ((config.rounds = custom), play()) }, h("span", {}, "Start")),
        ),
      });
    },
  };
  show();
}
