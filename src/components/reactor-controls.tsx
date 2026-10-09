"use client";

import { useEffect, useRef } from "react";
import {
  REACTOR_PART_IDS,
  REACTOR_PARTS,
  type ReactorStage,
} from "@/lib/reactor";
import type { ReactorController } from "./use-reactor";

const chapters: Record<
  ReactorStage,
  { number: string; title: string; text: string }
> = {
  pellet: {
    number: "01 / THE PELLET",
    title: "One event.\nA larger world.",
    text: "We are changing scale. Fission happens within a ceramic uranium dioxide pellet.",
  },
  rod: {
    number: "02 / THE FUEL ROD",
    title: "A story,\nrepeated.",
    text: "Pellets are stacked inside sealed metal tubes. Together, fuel rods form an assembly.",
  },
  core: {
    number: "03 / THE CORE",
    title: "A new\nperspective.",
    text: "Fuel, neutron absorbers and circulating water, held within a steel pressure vessel.",
  },
  ready: {
    number: "PWR / CONCEPTUAL CUTAWAY",
    title: "Inside the\nreactor.",
    text: "A place where heat is generated, the reaction is regulated, and energy is carried away. Select a point to look closer.",
  },
};

export function ReactorHotspots({
  reactor,
  fallback,
}: {
  reactor: ReactorController;
  fallback: boolean;
}) {
  return (
    <div
      className={`reactor-hotspots${fallback ? " is-illustrated" : ""}`}
      hidden={reactor.stage !== "ready"}
      aria-label="Explore the reactor"
    >
      {REACTOR_PART_IDS.map((id, index) => (
        <button
          key={id}
          ref={(node) => {
            reactor.hotspots.current[index] = node;
          }}
          className={`reactor-hotspot hotspot-${id}`}
          aria-label={REACTOR_PARTS[id].label}
          aria-pressed={reactor.selected === id}
          aria-controls="reactor-detail"
          onClick={() =>
            reactor.setSelected(reactor.selected === id ? null : id)
          }
        >
          <span>{REACTOR_PARTS[id].number}</span>
          <span className="hotspot-label">{REACTOR_PARTS[id].label}</span>
        </button>
      ))}
      {reactor.selected && (
        <div
          ref={reactor.label}
          className={`reactor-object-label label-${reactor.selected}`}
          aria-hidden="true"
        >
          {REACTOR_PARTS[reactor.selected].detail}
        </div>
      )}
    </div>
  );
}

export function ReactorControls({
  reactor,
  onReturn,
  onReplay,
  onContinue,
}: {
  reactor: ReactorController;
  onReturn: () => void;
  onReplay: () => void;
  onContinue: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const chapter = chapters[reactor.stage];
  const part = reactor.selected ? REACTOR_PARTS[reactor.selected] : null;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [reactor.run]);

  return (
    <>
      <button className="reaction-back" onClick={onReturn}>
        <span aria-hidden="true">←</span> Return to fission
      </button>
      <div
        className="reactor-copy"
        data-stage={reactor.stage}
        data-selected={reactor.selected ?? "none"}
      >
        <div id="reactor-detail" aria-live="polite" aria-atomic="true">
          <p className="section-kicker">
            {part
              ? `${part.number} / ${part.label.toUpperCase()}`
              : chapter.number}
          </p>
          <h1 id="reactor-title" ref={heading} tabIndex={-1}>
            {part?.title ?? chapter.title}
          </h1>
          <p className="reactor-description">
            {part?.description ?? chapter.text}
          </p>
          {part && <p className="reactor-detail-note">{part.note}</p>}
        </div>
        <div className="reactor-actions">
          {reactor.stage === "ready" && (
            <button
              id="power-entry"
              className="reaction-action reactor-entry"
              onClick={onContinue}
            >
              {reactor.selected === "coolant"
                ? "Follow the coolant"
                : "Power the city"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
          {reactor.stage === "ready" && (
            <button className="reaction-action" onClick={onReplay}>
              Replay this view <span aria-hidden="true">↺</span>
            </button>
          )}
          {part && (
            <button
              className="reactor-overview"
              onClick={() => {
                reactor.hotspots.current[
                  REACTOR_PART_IDS.indexOf(reactor.selected!)
                ]?.focus({ preventScroll: true });
                reactor.setSelected(null);
              }}
            >
              Overview <span aria-hidden="true">×</span>
            </button>
          )}
          {reactor.stage !== "ready" && (
            <span className="reactor-scale">
              ATOM <span>→</span> PELLET <span>→</span> CORE
            </span>
          )}
        </div>
        <p className="reactor-note">
          Conceptual · not to scale. Cut surfaces reveal the interior.
          <br />
          {reactor.stage === "ready"
            ? "Flow, heat and component counts are illustrative."
            : "This is a change of scale, not a transformation of fission products."}
        </p>
        {reactor.stage === "ready" && (
          <a
            className="reactor-source"
            href="https://www.nrc.gov/reactors/power/pwrs"
            target="_blank"
            rel="noreferrer"
          >
            The science, via the U.S. NRC ↗
          </a>
        )}
      </div>
    </>
  );
}
