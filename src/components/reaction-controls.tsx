"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { DAUGHTERS, NEUTRON_HOME, type ReactionStage } from "@/lib/fission";
import type { FissionController } from "./use-fission";

const copy: Record<
  ReactionStage,
  { label: string; title: string; detail: string }
> = {
  ready: {
    label: "01 / THE ENCOUNTER",
    title: "One small arrival.",
    detail: "Drag the neutron into the nucleus. Or select it to begin.",
  },
  absorbing: {
    label: "02 / CAPTURE",
    title: "A moment of contact.",
    detail: "Uranium-235 absorbs a neutron.",
  },
  excited: {
    label: "03 / EXCITATION",
    title: "Too much to hold.",
    detail: "For a brief moment, an excited uranium-236 nucleus forms.",
  },
  splitting: {
    label: "04 / FISSION",
    title: "Energy, set free.",
    detail: "Two fragments move apart. Three neutrons are released.",
  },
  complete: {
    label: "04 / FISSION",
    title: "A small beginning.\nAn immense release.",
    detail: "Most of the released energy becomes motion of the fragments.",
  },
};

export function ReactionNeutron({
  reaction,
  fallback,
}: {
  reaction: FissionController;
  fallback: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const gesture = useRef({
    x: 0,
    y: 0,
    moved: false,
    canceled: false,
    pointerId: -1,
  });
  const home = useRef({ x: 0, y: 0 });

  useEffect(() => {
    reaction.handle.current?.focus({ preventScroll: true });
  }, [reaction.handle]);

  useEffect(() => {
    const button = reaction.handle.current;
    const parent = button?.parentElement;
    if (!fallback || !parent || !button) return;
    const update = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (!reaction.dragPoint.current.active)
        button.style.transform = `translate3d(${width * 0.13}px, ${height / 2}px, 0)`;
      if (reaction.captureTarget.current) {
        reaction.captureTarget.current.style.transform = `translate3d(${width / 2}px, ${height / 2}px, 0)`;
        reaction.captureTarget.current.style.width = `${Math.min(width, height) * 0.48}px`;
        reaction.captureTarget.current.style.height = `${Math.min(width, height) * 0.48}px`;
      }
      DAUGHTERS.forEach((daughter, index) => {
        const label = reaction.fragmentLabels.current[index];
        if (label)
          label.style.transform = `translate3d(${width / 2 + (daughter.center[0] / 12) * Math.min(width, height)}px, ${height / 2 + ((daughter.center[1] + 2.6) / 12) * Math.min(width, height)}px, 0)`;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [
    fallback,
    reaction.stage,
    reaction.handle,
    reaction.captureTarget,
    reaction.dragPoint,
    reaction.fragmentLabels,
  ]);

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    gesture.current.moved ||=
      Math.hypot(
        event.clientX - gesture.current.x,
        event.clientY - gesture.current.y,
      ) > 5;
    const x = Math.max(
      28,
      Math.min(bounds.width - 28, event.clientX - bounds.left),
    );
    const y = Math.max(
      28,
      Math.min(bounds.height - 28, event.clientY - bounds.top),
    );
    reaction.dragPoint.current = {
      x: (x / bounds.width) * 2 - 1,
      y: 1 - (y / bounds.height) * 2,
      active: true,
    };
    event.currentTarget.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const restore = () => {
    reaction.dragPoint.current.active = false;
    reaction.incoming.current = [...NEUTRON_HOME];
    if (reaction.handle.current)
      reaction.handle.current.style.transform = `translate3d(${home.current.x}px, ${home.current.y}px, 0)`;
    setDragging(false);
  };

  return (
    <>
      <div
        ref={reaction.captureTarget}
        className={`capture-target${dragging ? " is-dragging" : ""}`}
        aria-hidden="true"
      >
        <span>RELEASE TO CAPTURE</span>
      </div>
      <button
        ref={reaction.handle}
        className={`incoming-neutron${fallback ? " is-illustrated" : ""}${dragging ? " is-dragging" : ""}`}
        hidden={reaction.stage !== "ready"}
        id="incoming-neutron"
        aria-label="Send neutron into nucleus"
        aria-describedby="reaction-instruction"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const parent =
            event.currentTarget.parentElement?.getBoundingClientRect();
          if (!parent) return;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            moved: false,
            canceled: false,
            pointerId: event.pointerId,
          };
          home.current = {
            x: bounds.left + bounds.width / 2 - parent.left,
            y: bounds.top + bounds.height / 2 - parent.top,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          const bounds =
            event.currentTarget.parentElement?.getBoundingClientRect();
          if (
            !bounds ||
            !event.currentTarget.hasPointerCapture(event.pointerId)
          )
            return;
          const target = fallback
            ? {
                x: bounds.width / 2,
                y: bounds.height / 2,
                radius: Math.min(bounds.width, bounds.height) * 0.24,
              }
            : reaction.target.current;
          const hit =
            Math.hypot(
              event.clientX - bounds.left - target.x,
              event.clientY - bounds.top - target.y,
            ) < target.radius;
          if (gesture.current.moved && !gesture.current.canceled && hit) {
            reaction.start();
            setDragging(false);
          } else restore();
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          gesture.current.canceled = true;
          restore();
        }}
        onLostPointerCapture={() => {
          if (reaction.dragPoint.current.active) restore();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            gesture.current.canceled = true;
            restore();
            if (
              event.currentTarget.hasPointerCapture(gesture.current.pointerId)
            )
              event.currentTarget.releasePointerCapture(
                gesture.current.pointerId,
              );
          }
        }}
        onClick={(event) => {
          if (
            event.detail === 0 ||
            (!gesture.current.moved && !gesture.current.canceled)
          )
            reaction.start();
        }}
      >
        <span className="neutron-orb" aria-hidden="true" />
        <span className="neutron-caption">
          1 NEUTRON<span>DRAG / TAP</span>
        </span>
      </button>
      <div
        className="fragment-labels"
        aria-hidden="true"
        hidden={reaction.stage !== "complete"}
      >
        {DAUGHTERS.map((daughter, index) => (
          <span
            key={daughter.symbol}
            ref={(node) => {
              reaction.fragmentLabels.current[index] = node;
            }}
          >
            <sup>{daughter.mass}</sup>
            {daughter.symbol}
            <small>{daughter.name}</small>
          </span>
        ))}
      </div>
    </>
  );
}

export function ReactionControls({
  reaction,
  onBack,
  onReplay,
  onContinue,
}: {
  reaction: FissionController;
  onBack: () => void;
  onReplay: () => void;
  onContinue: () => void;
}) {
  const status = useRef<HTMLDivElement>(null);
  const details = copy[reaction.stage];
  useEffect(() => {
    if (reaction.stage === "absorbing" || reaction.stage === "complete")
      status.current?.focus({ preventScroll: true });
  }, [reaction.stage]);

  return (
    <>
      <button className="reaction-back" onClick={onBack}>
        <span aria-hidden="true">←</span> The first atom
      </button>
      <div className="reaction-copy" data-stage={reaction.stage}>
        <div
          id="reaction-status"
          ref={status}
          tabIndex={-1}
          className="reaction-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="section-kicker">{details.label}</p>
          <h1 id="reaction-title">{details.title}</h1>
          <p id="reaction-instruction">{details.detail}</p>
          {reaction.stage === "complete" && (
            <p
              className="reaction-equation"
              aria-label="Uranium 235 plus one neutron forms excited uranium 236, then barium 141, krypton 92, three neutrons and energy"
            >
              <sup>235</sup>U + n <span>→</span> <sup>236</sup>U* <span>→</span>{" "}
              <sup>141</sup>Ba + <sup>92</sup>Kr + 3n + energy
            </p>
          )}
        </div>
        <div className="reaction-actions">
          {reaction.stage === "ready" && (
            <button className="reaction-action" onClick={reaction.start}>
              Send the neutron <span aria-hidden="true">↗</span>
            </button>
          )}
          {reaction.stage === "complete" && (
            <button
              id="reactor-entry"
              className="reaction-action reactor-entry"
              onClick={onContinue}
            >
              Inside the reactor <span aria-hidden="true">↗</span>
            </button>
          )}
          {reaction.stage === "complete" && (
            <button className="reaction-action" onClick={onReplay}>
              Replay reaction <span aria-hidden="true">↺</span>
            </button>
          )}
          <p className="reaction-note">
            Conceptual · not to scale
            {reaction.stage === "complete" && (
              <>
                <br />
                One possible fission channel. Timing and light are illustrative.
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}
