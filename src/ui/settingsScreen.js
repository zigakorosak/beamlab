// Settings, reachable from home (GeoQuiz's settingsScreen.js): one section
// per preference, each a column of options with the current one selected.
// Saved on click (core/settings.js).

import { loadSettings, saveSettings } from "../core/settings.js";
import { h } from "./dom.js";

const sections = [
  {
    title: "Bending moment diagram",
    key: "momentSide",
    options: [
      { label: "Positive up", desc: "Sagging moments above the axis", value: "up" },
      { label: "On the tension side", desc: "Sagging moments below the axis", value: "tension" },
    ],
  },
  {
    title: "Build: snap positions to",
    key: "snap",
    options: [
      { label: "1 m", value: 1 },
      { label: "0.5 m", value: 0.5 },
      { label: "0.25 m", value: 0.25 },
      { label: "0.1 m", value: 0.1 },
    ],
  },
];

export function renderSettings(root, navigate, back = "home") {
  const settings = loadSettings();
  const section = ({ title, key, options }) => {
    const buttons = options.map((option) => {
      const btn = h(
        "button.menu-option.wizard-option",
        { type: "button" },
        h("span", {}, option.label),
        option.desc ? h("span.wizard-option-desc", {}, option.desc) : null,
      );
      if (option.value === settings[key]) btn.classList.add("menu-option--selected");
      btn.addEventListener("click", () => {
        for (const b of buttons) b.classList.remove("menu-option--selected");
        btn.classList.add("menu-option--selected");
        settings[key] = option.value;
        saveSettings(settings);
      });
      return btn;
    });
    return h("section.menu-step", {}, h("h2", {}, title), h("div.menu-options", {}, buttons));
  };
  root.append(
    h(
      "div.menu-screen.wizard-screen",
      {},
      h("button.wizard-back", { type: "button", onclick: () => navigate(back) }, "← Back"),
      h("h1", {}, "Settings"),
      sections.map(section),
    ),
  );
}
