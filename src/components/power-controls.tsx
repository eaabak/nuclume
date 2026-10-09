"use client";

import { useEffect, useRef } from "react";
import { CITY_PLACES, POWER_PART_IDS, POWER_PARTS } from "@/lib/power";
import type { PowerController } from "./use-power";

export function PowerHotspots({
  power,
  fallback,
}: {
  power: PowerController;
  fallback: boolean;
}) {
  return (
    <>
      <div
        className={`power-hotspots${fallback ? " is-illustrated" : ""}`}
        hidden={power.stage !== "ready" || power.transfer !== null}
        aria-label="Explore the energy journey"
        data-city={
          power.stage === "ready" &&
          (!power.selected || power.selected === "city")
            ? ""
            : undefined
        }
      >
        {POWER_PART_IDS.map((id, index) => (
          <button
            key={id}
            ref={(node) => {
              power.hotspots.current[index] = node;
            }}
            className={`reactor-hotspot power-hotspot power-hotspot-${id}`}
            aria-label={POWER_PARTS[id].label}
            aria-pressed={power.selected === id}
            aria-controls="power-detail"
            onClick={() => {
              if (power.selected === id) power.setCityPlace(null);
              power.setSelected(power.selected === id ? null : id);
            }}
          >
            <span>{POWER_PARTS[id].number}</span>
            <span className="hotspot-label">{POWER_PARTS[id].label}</span>
          </button>
        ))}
        {power.stage === "ready" &&
          !power.transfer &&
          (!power.selected || power.selected === "city") && (
            <div
              className="city-exploration"
              role="group"
              aria-label="Explore the illuminated city"
            >
              <button
                aria-pressed={power.cityPlace === "home"}
                onClick={() => power.exploreCity("home")}
              >
                Home
              </button>
              <button
                aria-pressed={power.cityPlace === "hospital"}
                onClick={() => power.exploreCity("hospital")}
              >
                Hospital
              </button>
              <button
                aria-pressed={power.cityPlace === null}
                onClick={() => power.exploreCity(null)}
              >
                Neighborhood
              </button>
            </div>
          )}
      </div>
      {power.labelPlace && (
        <div
          ref={power.cityLabel}
          className={`city-object-label${fallback ? " is-illustrated" : ""}`}
          aria-hidden="true"
        >
          {CITY_PLACES[power.labelPlace].label}
        </div>
      )}
    </>
  );
}

export function PowerControls({
  power,
  onReturn,
  onReplay,
}: {
  power: PowerController;
  onReturn: () => void;
  onReplay: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const part = power.transfer
    ? "heat"
    : (power.selected ?? (power.stage === "ready" ? "city" : power.stage));
  const content = POWER_PARTS[part];
  const place =
    !power.transfer &&
    power.stage === "ready" &&
    power.selected === "city" &&
    power.cityPlace
      ? CITY_PLACES[power.cityPlace]
      : null;
  const cityOverview =
    power.stage === "ready" &&
    !power.transfer &&
    (!power.selected || power.selected === "city") &&
    !place;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [power.run, power.transferRun]);
  return (
    <>
      <button className="reaction-back" onClick={onReturn}>
        <span aria-hidden="true">←</span> Return to reactor
      </button>
      <div
        className="reactor-copy power-copy"
        data-stage={power.stage}
        data-transfer={power.transfer ?? "none"}
        data-city-beat={power.cityBeat}
        data-city-place={place ? power.cityPlace : "overview"}
      >
        <div id="power-detail" aria-live="polite" aria-atomic="true">
          <p className="section-kicker">
            {power.stage === "ready" && !power.selected && !power.transfer
              ? "FROM A SINGLE ATOM TO AN ENTIRE CITY"
              : `${content.number} / ${content.label.toUpperCase()}`}
          </p>
          <h1 id="power-title" ref={heading} tabIndex={-1}>
            {power.transfer === "following"
              ? "Follow the heat."
              : (place?.label ?? content.title)}
          </h1>
          <p className="reactor-description">
            {power.transfer === "following"
              ? "Pressurized primary water carries heat out of the reactor. Follow its sealed pipe to the steam generator."
              : (place?.description ?? content.description)}
          </p>
          {power.transfer && (
            <p className="reactor-note">
              Primary: liquid inside the tubes.
              <br />
              Secondary: separate water around the tubes, becoming steam.
            </p>
          )}
        </div>
        {cityOverview && (
          <p className="city-closing">
            From the smallest of things, a world of possibilities.
          </p>
        )}
        <div className="reactor-actions">
          {power.transfer === "reading" ? (
            <button className="reaction-action" onClick={power.continuePower}>
              Continue to turbine <span aria-hidden="true">↗</span>
            </button>
          ) : power.transfer ? (
            <span className="reactor-scale">
              PRIMARY WATER <span>→</span> HEAT TRANSFER
            </span>
          ) : power.stage === "ready" ? (
            <button className="reaction-action" onClick={onReplay}>
              Replay this phase <span aria-hidden="true">↺</span>
            </button>
          ) : (
            <span className="reactor-scale">
              HEAT <span>→</span> MOTION <span>→</span> LIGHT
            </span>
          )}
          {power.selected && !power.transfer && (
            <button
              className="reactor-overview"
              onClick={() => {
                power.hotspots.current[
                  POWER_PART_IDS.indexOf(power.selected!)
                ]?.focus({ preventScroll: true });
                power.setSelected(null);
                power.setCityPlace(null);
              }}
            >
              Overview <span aria-hidden="true">×</span>
            </button>
          )}
          {!power.transfer && power.stage !== "ready" && (
            <button
              className="reactor-overview"
              onClick={() => {
                power.finish();
                heading.current?.focus({ preventScroll: true });
              }}
            >
              Skip to illuminated city <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
        <p className="reactor-note">
          Conceptual · not to scale. Flow, speed and output are illustrative.
          <br />
          Ancillary systems omitted. Primary water stays in its own circuit.
        </p>
        {power.stage === "ready" && (
          <a
            className="reactor-source"
            href={content.source}
            target="_blank"
            rel="noreferrer"
          >
            The science, via the {content.sourceLabel} ↗
          </a>
        )}
      </div>
    </>
  );
}
