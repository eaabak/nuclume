"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JourneyPhase = 0 | 1 | 2 | 3;
export type JourneyTransition = "gather" | "return" | "crossfade" | "native";
export const JOURNEY_CHAPTERS = ["Atom", "Fission", "Reactor", "City"] as const;

export function useJourney(visible: boolean, reducedMotion: boolean) {
  const [phase, setPhase] = useState<JourneyPhase>(0);
  const [visited, setVisited] = useState([true, false, false, false]);
  const [motion, setMotion] = useState<{
    from: JourneyPhase;
    to: JourneyPhase;
    kind: Exclude<JourneyTransition, "native">;
  } | null>(null);
  const progress = useRef(0);
  const elapsed = useRef(0);
  const switched = useRef(false);
  const scene = useRef<HTMLDivElement>(null);
  const locked = useRef(false);

  const arrive = useCallback((next: JourneyPhase) => {
    setPhase(next);
    setVisited((previous) =>
      previous.map((value, index) => value || index === next),
    );
  }, []);

  const navigate = useCallback(
    (next: JourneyPhase, kind: JourneyTransition) => {
      if (locked.current || next === phase) return;
      if (reducedMotion || kind === "native") {
        arrive(next);
        return;
      }
      locked.current = true;
      switched.current = false;
      progress.current = 0;
      elapsed.current = 0;
      setMotion({ from: phase, to: next, kind });
    },
    [phase, reducedMotion, arrive],
  );

  useEffect(() => {
    if (!motion) return;
    const finish = () => {
      arrive(motion.to);
      progress.current = 1;
      locked.current = false;
      if (scene.current) scene.current.style.opacity = "1";
      setMotion(null);
    };
    if (reducedMotion) {
      finish();
      return;
    }
    if (!visible) return;
    let frame = 0;
    let previous = 0;
    const duration =
      motion.kind === "return" ? (motion.from > 1 ? 2.2 : 1.4) : 1.1;
    const tick = (now: number) => {
      if (previous) elapsed.current += (now - previous) / 1000;
      previous = now;
      progress.current = Math.min(elapsed.current / duration, 1);
      if (motion.kind === "crossfade") {
        if (scene.current)
          scene.current.style.opacity = String(
            Math.abs(progress.current * 2 - 1),
          );
        if (!switched.current && progress.current >= 0.5) {
          switched.current = true;
          arrive(motion.to);
        }
      }
      if (progress.current >= 1) finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motion, visible, reducedMotion, arrive]);

  return {
    phase,
    visited,
    motion,
    progress,
    scene,
    navigate,
    busy: motion !== null,
  };
}

export type JourneyController = ReturnType<typeof useJourney>;

export function journeyTime(
  journey: JourneyController,
  phase: JourneyPhase,
  time: number,
) {
  if (journey.motion?.kind !== "return" || journey.motion.from !== phase)
    return time;
  const progress = journey.progress.current;
  return time * (1 - progress * progress * (3 - 2 * progress));
}
