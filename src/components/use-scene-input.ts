"use client";

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import type { ViewOrientation } from "@/lib/scene";
import type { JourneyPhase } from "./use-journey";
import type { PowerController } from "./use-power";
import type { ReactorController } from "./use-reactor";

const REACTOR_PAN: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-0.6, 0],
  ArrowRight: [0.6, 0],
  ArrowUp: [0, 0.6],
  ArrowDown: [0, -0.6],
};

const CITY_PAN: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-0.6, 0.45],
  ArrowRight: [0.6, -0.45],
  ArrowUp: [-0.45, -0.6],
  ArrowDown: [0.45, 0.6],
};
const ROTATION_STEP: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [0, -0.2],
  ArrowRight: [0, 0.2],
  ArrowUp: [-0.15, 0],
  ArrowDown: [0.15, 0],
};
const clampTilt = (value: number) => Math.max(-0.85, Math.min(0.85, value));

export function useSceneInput({
  phase,
  disabled,
  playing,
  reducedMotion,
  neutronPreview,
  scene,
  city,
  reactor,
  onResetOpening,
  onToggleMotion,
}: {
  phase: JourneyPhase;
  disabled: boolean;
  playing: boolean;
  reducedMotion: boolean;
  neutronPreview: boolean;
  scene: RefObject<HTMLDivElement | null>;
  city: Pick<
    PowerController,
    "stage" | "transfer" | "roomOpen" | "zoomCity" | "panCity" | "resetCityView"
  >;
  reactor: Pick<
    ReactorController,
    "stage" | "zoomView" | "panView" | "resetView"
  >;
  onResetOpening: () => void;
  onToggleMotion: () => void;
}) {
  const [orientation, setOrientation] = useState<ViewOrientation>({
    x: 0,
    y: 0,
  });
  const pointer = useRef<ViewOrientation>({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    initial: ViewOrientation;
  } | null>(null);

  const resetParallax = useCallback(() => {
    pointer.current.x = 0;
    pointer.current.y = 0;
    scene.current?.style.setProperty("--reticle-x", "0px");
    scene.current?.style.setProperty("--reticle-y", "0px");
  }, [scene]);

  const clearPointer = useCallback(() => {
    drag.current = null;
    resetParallax();
  }, [resetParallax]);

  const reset = useCallback(() => {
    setOrientation({ x: 0, y: 0 });
    clearPointer();
  }, [clearPointer]);

  const endDrag = () => {
    drag.current = null;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.current.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    if (phase === 0 && !reducedMotion && playing) {
      scene.current?.style.setProperty(
        "--reticle-x",
        `${pointer.current.x * 4}px`,
      );
      scene.current?.style.setProperty(
        "--reticle-y",
        `${pointer.current.y * 3}px`,
      );
    }
    if (drag.current && phase === 0) {
      setOrientation({
        x: clampTilt(
          drag.current.initial.x + (event.clientY - drag.current.y) * 0.005,
        ),
        y: drag.current.initial.y + (event.clientX - drag.current.x) * 0.005,
      });
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      phase !== 0 ||
      neutronPreview ||
      event.pointerType === "touch" ||
      event.button !== 0
    )
      return;
    drag.current = { x: event.clientX, y: event.clientY, initial: orientation };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (phase === 2 && reactor.stage === "ready") {
      const pan = REACTOR_PAN[event.key];
      if (pan) {
        event.preventDefault();
        reactor.panView(...pan);
      } else if (["+", "=", "-", "Home"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "Home") reactor.resetView();
        else reactor.zoomView(event.key === "-" ? 1 / 1.35 : 1.35);
      }
      return;
    }
    if (
      phase === 3 &&
      city.stage === "ready" &&
      !city.roomOpen &&
      !city.transfer
    ) {
      const pan = CITY_PAN[event.key];
      if (pan) {
        event.preventDefault();
        city.panCity(...pan);
      } else if (["+", "=", "-", "Home"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "Home") city.resetCityView();
        else city.zoomCity(event.key === "-" ? 1 / 1.35 : 1.35);
      }
      return;
    }
    if (phase !== 0) return;
    if (event.code === "Space") {
      event.preventDefault();
      onToggleMotion();
    } else if (event.key === "Home") {
      event.preventDefault();
      onResetOpening();
    } else {
      const step = ROTATION_STEP[event.key];
      if (!step) return;
      event.preventDefault();
      setOrientation((value) => ({
        x: clampTilt(value.x + step[0]),
        y: value.y + step[1],
      }));
    }
  };

  return {
    orientation,
    pointer,
    reset,
    clearPointer,
    handlers: {
      onPointerMove,
      onPointerDown,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onPointerLeave: resetParallax,
      onKeyDown,
    },
  };
}
