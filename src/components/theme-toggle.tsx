"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icon";

type Theme = "light" | "dark";
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "bluff:theme") return;
    applyTheme(event.newValue === "dark" ? "dark" : "light");
    notify();
  };
  window.addEventListener("bluff-theme", notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("bluff-theme", notify);
    window.removeEventListener("storage", onStorage);
  };
}
const getSnapshot = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerSnapshot = (): Theme => "light";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next = theme === "dark" ? "light" : "dark";
  function toggle() {
    applyTheme(next);
    try {
      localStorage.setItem("bluff:theme", next);
    } catch {
      /* The current page still changes when storage is unavailable. */
    }
    window.dispatchEvent(new Event("bluff-theme"));
  }
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={toggle}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
