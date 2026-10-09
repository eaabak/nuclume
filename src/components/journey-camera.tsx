"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MathUtils, OrthographicCamera, Quaternion, Vector3 } from "three";
import type { JourneyController } from "./use-journey";

export function JourneyCamera({ journey }: { journey: JourneyController }) {
  const invalidate = useThree((state) => state.invalidate);
  const views = useMemo(
    () =>
      Array.from({ length: 4 }, () => ({
        position: new Vector3(),
        rotation: new Quaternion(),
        zoom: 80,
        width: 1,
        height: 1,
        ready: false,
      })),
    [],
  );
  const previous = useRef(journey.motion);
  useFrame(({ camera }) => {
    const motion = journey.motion;
    if (motion?.kind === "return") {
      const target = views[motion.to];
      if (target.ready) {
        const progress = MathUtils.smoothstep(
          journey.progress.current,
          0.25,
          1,
        );
        camera.position.lerp(target.position, progress);
        camera.quaternion.slerp(target.rotation, progress);
        if (camera instanceof OrthographicCamera) {
          const resize = Math.min(
            window.innerWidth / target.width,
            window.innerHeight / target.height,
          );
          camera.zoom = MathUtils.lerp(
            camera.zoom,
            target.zoom * resize,
            progress,
          );
          camera.updateProjectionMatrix();
        }
        camera.updateMatrixWorld();
      }
    }
    if (!motion) {
      const view = views[journey.phase];
      view.position.copy(camera.position);
      view.rotation.copy(camera.quaternion);
      view.zoom = camera instanceof OrthographicCamera ? camera.zoom : 80;
      view.width = window.innerWidth;
      view.height = window.innerHeight;
      view.ready = true;
    }
    if (motion || previous.current !== motion) invalidate();
    previous.current = motion;
  }, -1);
  return null;
}
