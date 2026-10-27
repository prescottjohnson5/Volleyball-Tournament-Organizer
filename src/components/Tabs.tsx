"use client";

import { useEffect, useState } from "react";

export type TabItem = { id: string; label: string; content: React.ReactNode };

/**
 * A small tab bar that shows one section at a time. The open tab is kept in the URL hash (#bracket), so it
 * can be linked to and survives a refresh. Every panel stays mounted, so half-typed forms are not lost
 * when switching tabs.
 */
export function Tabs({ tabs, defaultTab, label }: { tabs: readonly TabItem[]; defaultTab?: string; label: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const ids = tabs.map((tab) => tab.id);
  const active = chosen && ids.includes(chosen) ? chosen : defaultTab && ids.includes(defaultTab) ? defaultTab : ids[0];
  const idsKey = ids.join(",");

  useEffect(() => {
    const known = idsKey.split(",");
    const fromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (known.includes(hash)) setChosen(hash);
    };
    window.addEventListener("hashchange", fromHash);
    // Read the hash once after hydration; the server cannot see it.
    const timer = window.setTimeout(fromHash, 0);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.clearTimeout(timer);
    };
  }, [idsKey]);

  function select(id: string, focus = false) {
    setChosen(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) document.getElementById(`tab-${id}`)?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = ids.indexOf(active);
    const next =
      event.key === "ArrowRight" ? ids[(index + 1) % ids.length]
      : event.key === "ArrowLeft" ? ids[(index - 1 + ids.length) % ids.length]
      : event.key === "Home" ? ids[0]
      : event.key === "End" ? ids[ids.length - 1]
      : null;
    if (!next) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="sticky top-0 z-10 -mx-4 flex gap-6 overflow-x-auto border-b border-line bg-black/90 px-4 backdrop-blur"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={`relative shrink-0 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-sun ${
                selected ? "text-ink" : "text-ink-subtle hover:text-ink"
              }`}
            >
              {tab.label}
              {selected && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-sun" />}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== active} className="pt-6">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
