// Persistent, app-wide preferences (as opposed to per-game choices made in
// the wizard). Backed by localStorage; falls back to defaults when storage
// is unavailable (private browsing) or holds unexpected data. Same shape
// as GeoQuiz's and Anatomy Quiz's core/settings.js.

const STORAGE_KEY = "beamlab-settings";

const defaults = {
  // Where positive bending moment is drawn: "up" (most English textbooks)
  // or "tension" (on the tension side, i.e. sagging below the axis — the
  // European convention).
  momentSide: "up",
  // Build grid: positions snap to this many metres.
  snap: 0.5,
};

export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaults, ...stored };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable — the setting just won't survive a reload.
  }
}
