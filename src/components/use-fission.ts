"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NEUTRON_HOME,
  REACTION_TIMING,
  reactionStageAt,
  type ReactionStage,
} from "@/lib/fission";

export function useFission(
  active: boolean,
  playing: boolean,
  visible: boolean,
  reducedMotion: boolean,
) {
  const [stage, setStage] = useState<ReactionStage>("ready");
  const elapsed = useRef(0);
  const running = useRef(false);
  const incoming = useRef<[number, number, number]>([...NEUTRON_HOME]);
  const dragPoint = useRef({ x: 0, y: 0, active: false });
  const target = useRef({ x: 0, y: 0, radius: 0 });
  const handle = useRef<HTMLButtonElement>(null);
  const captureTarget = useRef<HTMLDivElement>(null);
  const fragmentLabels = useRef<(HTMLSpanElement | null)[]>([]);

  const reset = useCallback(() => {
    running.current = false;
    elapsed.current = 0;
    incoming.current = [...NEUTRON_HOME];
    dragPoint.current.active = false;
    setStage("ready");
  }, []);

  const start = useCallback(() => {
    if (running.current || elapsed.current > 0) return;
    dragPoint.current.active = false;
    running.current = !reducedMotion;
    elapsed.current = reducedMotion ? REACTION_TIMING.finish : 0;
    setStage(reducedMotion ? "complete" : "absorbing");
  }, [reducedMotion]);

  useEffect(() => {
    if (!active || !running.current) return;
    if (reducedMotion) {
      elapsed.current = REACTION_TIMING.finish;
      running.current = false;
      setStage("complete");
      return;
    }
    if (!playing || !visible) return;
    let frame = 0;
    let previous = 0;
    const tick = (now: number) => {
      if (!running.current) return;
      if (previous)
        elapsed.current = Math.min(
          REACTION_TIMING.finish,
          elapsed.current + Math.min((now - previous) / 1000, 0.1),
        );
      previous = now;
      const next = reactionStageAt(elapsed.current);
      if (next !== stage) setStage(next);
      if (next === "complete") running.current = false;
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, visible, reducedMotion, stage]);

  return {
    stage,
    elapsed,
    incoming,
    dragPoint,
    target,
    handle,
    captureTarget,
    fragmentLabels,
    start,
    reset,
  };
}

export type FissionController = ReturnType<typeof useFission>;
