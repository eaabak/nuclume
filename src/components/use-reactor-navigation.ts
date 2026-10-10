"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { MathUtils, OrthographicCamera } from "three";
import type { ReactorController } from "./use-reactor";

export function useReactorNavigation(
  active: boolean,
  view: ReactorController["view"],
) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (!active || !(camera instanceof OrthographicCamera)) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; zoom: number } | null = null;
    const pan = (x: number, y: number) => {
      view.current.x = MathUtils.clamp(view.current.x + x, -8, 8);
      view.current.y = MathUtils.clamp(view.current.y + y, -6, 6);
      invalidate();
    };
    const zoom = (factor: number, x: number, y: number) => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const previous = view.current.zoom;
      const next = MathUtils.clamp(previous * factor, 1, 4);
      const scale = (1 - previous / next) / camera.zoom;
      view.current.zoom = next;
      pan(
        ((x - bounds.left) / bounds.width - 0.5) *
          (camera.right - camera.left) *
          scale,
        (0.5 - (y - bounds.top) / bounds.height) *
          (camera.top - camera.bottom) *
          scale,
      );
      camera.zoom *= next / previous;
      camera.updateProjectionMatrix();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? canvas.clientHeight
            : 1;
      zoom(
        Math.exp(-MathUtils.clamp(event.deltaY * unit, -240, 240) * 0.002),
        event.clientX,
        event.clientY,
      );
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || pointers.size >= 2) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinch = {
          distance: Math.hypot(first.x - second.x, first.y - second.y),
          zoom: view.current.zoom,
        };
      }
      canvas.setPointerCapture(event.pointerId);
      canvas.parentElement
        ?.closest<HTMLElement>("[tabindex]")
        ?.focus({ preventScroll: true });
    };
    const move = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      let other: { x: number; y: number } | undefined;
      for (const [id, point] of pointers)
        if (id !== event.pointerId) other = point;
      const weight = other ? 0.5 : 1;
      pan(
        ((((previous.x - event.clientX) / bounds.width) *
          (camera.right - camera.left)) /
          camera.zoom) *
          weight,
        ((((event.clientY - previous.y) / bounds.height) *
          (camera.top - camera.bottom)) /
          camera.zoom) *
          weight,
      );
      if (other && pinch) {
        const after = Math.hypot(
          event.clientX - other.x,
          event.clientY - other.y,
        );
        if (pinch.distance > 8 && after > 8)
          zoom(
            (pinch.zoom * after) / (pinch.distance * view.current.zoom),
            (event.clientX + other.x) / 2,
            (event.clientY + other.y) / 2,
          );
      }
      previous.x = event.clientX;
      previous.y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinch = null;
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    return () => {
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      for (const id of pointers.keys())
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
  }, [active, view, camera, canvas, invalidate]);
}
