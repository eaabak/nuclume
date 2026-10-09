"use client";

import {
  JOURNEY_CHAPTERS,
  type JourneyController,
  type JourneyPhase,
} from "./use-journey";

export function JourneyNavigation({
  journey,
  available,
  onNavigate,
}: {
  journey: JourneyController;
  available: boolean[];
  onNavigate: (phase: JourneyPhase) => void;
}) {
  return (
    <nav
      className="journey-navigation"
      aria-label="Journey chapters"
      aria-busy={journey.busy}
    >
      <ol>
        {JOURNEY_CHAPTERS.map((label, index) => (
          <li key={label} data-visited={journey.visited[index]}>
            <button
              type="button"
              aria-label={`${index + 1}. ${label}`}
              aria-current={journey.phase === index ? "step" : undefined}
              disabled={!available[index] || journey.busy}
              onClick={() => onNavigate(index as JourneyPhase)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const buttons = Array.from(
                  event.currentTarget
                    .closest("nav")!
                    .querySelectorAll<HTMLButtonElement>(
                      "button:not(:disabled)",
                    ),
                );
                const current = buttons.indexOf(event.currentTarget);
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            buttons.length - 1,
                            current + (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        );
                buttons[next]?.focus();
              }}
            >
              <span aria-hidden="true">0{index + 1}</span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <span className="sr-only" role="status" aria-live="polite">
        {journey.motion
          ? `Moving to ${JOURNEY_CHAPTERS[journey.motion.to]}.`
          : `${JOURNEY_CHAPTERS[journey.phase]}, chapter ${journey.phase + 1} of 4.`}
      </span>
    </nav>
  );
}
