"use client";

import { useCallback, useEffect, useState } from "react";

export function useSceneEnvironment() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => {
    setWebgl(false);
    setReady(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () =>
      setVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", {
        failIfMajorPerformanceCaveat: true,
      });
      setWebgl(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebgl(false);
    }

    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  return { reducedMotion, visible, webgl, ready, onReady, onContextLost };
}
