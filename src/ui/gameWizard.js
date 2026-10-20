// The Practice flow: a sequence of choice screens, worded and laid out like
// GeoQuiz's wizard, ending in a game config handed to the game screen:
//   task → beam type → difficulty → rounds → play.
//
// Steps are named ({ name }) rather than closures, so the whole position —
// config, history, current step — can be handed to the game and back
// again: the game's ☰ → Back returns to the last step with every earlier
// choice (and the Back chain behind it) intact, as in GeoQuiz.

import { BEAM_TYPES, LEVELS } from "../core/generator.js";
import { choiceScreen } from "./screenKit.js";

export const TASKS = [
  { id: "full", label: "Full solution", desc: "Reactions, then the shear and moment diagrams" },
  { id: "reactions", label: "Support reactions", desc: "Find the reaction forces and moments" },
  { id: "V", label: "Shear force diagram", desc: "Reactions given: draw V(x)" },
  { id: "M", label: "Bending moment diagram", desc: "Reactions given: draw M(x)" },
];

const ROUNDS = [3, 5, 10];

export function renderWizard(root, navigate, resume = null) {
  const config = { ...(resume?.config ?? {}) };
  const history = [...(resume?.history ?? [])];
  let current = resume?.current ?? { name: "task" };

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

  const steps = {
    task() {
      screen({
        title: "What do you want to practise?",
        options: TASKS.map((t) => ({
          label: t.label,
          desc: t.desc,
          onSelect: () => {
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
      screen({
        title: "How many beams?",
        options: ROUNDS.map((n) => ({
          label: String(n),
          onSelect: () => {
            config.rounds = n;
            navigate("game", { ...config }, { config: { ...config }, history: [...history], current });
          },
        })),
      });
    },
  };
  show();
}
