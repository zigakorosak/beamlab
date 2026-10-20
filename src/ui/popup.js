// A popup in the middle of the screen (Anatomy Quiz's Subjects popup):
// title, content, Done. Closes on Done, Escape, or a click outside it.

import { h } from "./dom.js";

export function openPopup({ title, content, hint }) {
  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  const panel = h(
    "div.popup",
    { role: "dialog", "aria-label": title },
    h("div.popup-title", {}, title),
    content,
    hint ? h("p.popup-hint", {}, hint) : null,
    h("button.action-button", { type: "button", onclick: close }, "Done"),
  );
  const backdrop = h("div.popup-backdrop", {}, panel);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(backdrop);
  return close;
}
