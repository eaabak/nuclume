"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REACTOR_TIMING,
  reactorStageAt,
  type ReactorPart,
  type ReactorStage,
} from "@/lib/reactor";

export function useReactor(
  active: boolean,
  playing: boolean,
  visible: boolean,
  reducedMotion: boolean,
) {
  const [stage, setStage] = useState<ReactorStage>("pellet");
  const [selected, setSelectedState] = useState<ReactorPart | null>(null);
  const [run, setRun] = useState(0);
  const elapsed = useRef(0);
  const fromFission = useRef(true);
  const hotspots = useRef<(HTMLButtonElement | null)[]>([]);
  const label = useRef<HTMLDivElement>(null);
  const inspection = useRef({ fuel: 0, control: 0, time: 0 });
  const setSelected = useCallback(
    (part: ReactorPart | null) => {
      if (part !== selected) inspection.current.time = 0;
      setSelectedState(part);
    },
    [selected],
  );

  const begin = useCallback(
    (transition: boolean) => {
      fromFission.current = transition;
      elapsed.current = reducedMotion ? REACTOR_TIMING.ready : 0;
      setStage(reducedMotion ? "ready" : "pellet");
      setSelectedState(null);
      inspection.current.fuel = 0;
      inspection.current.control = 0;
      inspection.current.time = 0;
      setRun((value) => value + 1);
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (!active || stage !== "ready" || !selected || selected === "coolant")
      return;
    if (reducedMotion) {
      inspection.current.time = 4.8;
      return;
    }
    if (!playing || !visible || inspection.current.time >= 4.8) return;
    let previous = 0;
    let frame = 0;
    const tick = (now: number) => {
      if (previous)
        inspection.current.time = Math.min(
          4.8,
          inspection.current.time + Math.min((now - previous) / 1000, 0.1),
        );
      previous = now;
      if (inspection.current.time < 4.8) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, stage, selected, playing, visible, reducedMotion, run]);

  useEffect(() => {
    if (!active || stage === "ready") return;
    if (reducedMotion) {
      elapsed.current = REACTOR_TIMING.ready;
      setStage("ready");
      return;
    }
    if (!playing || !visible) return;
    let previous = 0;
    let frame = 0;
    const tick = (now: number) => {
      if (previous)
        elapsed.current = Math.min(
          REACTOR_TIMING.ready,
          elapsed.current + Math.min((now - previous) / 1000, 0.1),
        );
      previous = now;
      const next = reactorStageAt(elapsed.current);
      if (next !== stage) setStage(next);
      if (next !== "ready") frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, visible, reducedMotion, stage, run]);

  return {
    stage,
    selected,
    setSelected,
    elapsed,
    fromFission,
    hotspots,
    label,
    inspection,
    run,
    begin,
  };
}

export type ReactorController = ReturnType<typeof useReactor>;
