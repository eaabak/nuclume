"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type OpeningBeat = "arrival" | "approach" | "inspect" | "neutron";

function smoothstep(value: number, start: number, end: number) {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
}

export function useAtomOpening(active: boolean, reducedMotion: boolean) {
  const progress = useRef(0);
  const settling = useRef(false);
  const container = useRef<HTMLElement | null>(null);
  const [beat, setBeat] = useState<OpeningBeat>("arrival");
  const currentBeat = useRef<OpeningBeat>("arrival");
  const controls = useRef<{
    seek: (amount: number, behavior: ScrollBehavior) => void;
  } | null>(null);

  const update = useCallback((value: number) => {
    const amount = Math.max(0, Math.min(1, value));
    progress.current = amount;
    const style = container.current?.style;
    if (style) {
      style.setProperty("--opening-progress", String(amount));
      style.setProperty(
        "--opening-approach",
        String(smoothstep(amount, 0.05, 0.45)),
      );
      style.setProperty(
        "--opening-handoff",
        String(smoothstep(amount, 0.72, 0.9)),
      );
      style.setProperty(
        "--opening-arrival-opacity",
        String(1 - smoothstep(amount, 0.05, 0.3)),
      );
      style.setProperty(
        "--opening-inspect-opacity",
        String(
          smoothstep(amount, 0.32, 0.45) * (1 - smoothstep(amount, 0.72, 0.86)),
        ),
      );
      style.setProperty(
        "--opening-neutron-opacity",
        String(smoothstep(amount, 0.8, 0.9)),
      );
    }
    const next: OpeningBeat =
      amount < 0.08
        ? "arrival"
        : amount < 0.38
          ? "approach"
          : amount < 0.9
            ? "inspect"
            : "neutron";
    if (next !== currentBeat.current) {
      currentBeat.current = next;
      setBeat(next);
    }
  }, []);

  useEffect(() => {
    if (!active || !container.current) return;
    const element = container.current;
    let frame = 0;
    let restorePending = false;
    let lastScrollAt = -Infinity;
    let previousFrame = 0;

    const measure = () =>
      Math.max(0, element.offsetHeight - window.innerHeight);
    let distance = measure();
    const schedule = (restore = false) => {
      restorePending ||= restore;
      if (frame) return;
      frame = requestAnimationFrame((now) => {
        frame = 0;
        if (restorePending) {
          restorePending = false;
          distance = measure();
          window.scrollTo({
            top: progress.current * distance,
            behavior: "instant",
          });
          update(progress.current);
          settling.current = false;
        } else {
          const target = Math.max(
            0,
            Math.min(1, distance > 0 ? window.scrollY / distance : 0),
          );
          const delta = previousFrame
            ? Math.min((now - previousFrame) / 1000, 0.05)
            : 1 / 60;
          const duration = target > 0.7 || progress.current > 0.7 ? 0.28 : 0.14;
          const next = reducedMotion
            ? target
            : progress.current +
              (target - progress.current) * (1 - Math.exp(-delta / duration));
          settling.current = Math.abs(next - target) > 0.0002;
          update(settling.current ? next : target);
        }
        previousFrame = settling.current ? now : 0;
        if (settling.current) schedule();
      });
    };
    const onScroll = () => {
      lastScrollAt = performance.now();
      settling.current = true;
      schedule();
    };
    const onResize = () => {
      const nextDistance = measure();
      if (Math.abs(nextDistance - distance) <= 2) return;
      distance = nextDistance;
      schedule(performance.now() - lastScrollAt > 180);
    };
    controls.current = {
      seek: (amount, behavior) => {
        distance = measure();
        restorePending = false;
        lastScrollAt = performance.now();
        window.scrollTo({ top: amount * distance, behavior });
        schedule();
      },
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    schedule(true);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      cancelAnimationFrame(frame);
      settling.current = false;
      controls.current = null;
    };
  }, [active, reducedMotion, update]);

  const advance = useCallback(() => {
    controls.current?.seek(
      currentBeat.current === "arrival" || currentBeat.current === "approach"
        ? 0.53
        : 1,
      reducedMotion ? "instant" : "smooth",
    );
  }, [reducedMotion]);

  const reset = useCallback(() => {
    update(0);
    controls.current?.seek(0, "instant");
  }, [update]);

  return { progress, settling, beat, container, advance, reset };
}

export type AtomOpeningController = ReturnType<typeof useAtomOpening>;
