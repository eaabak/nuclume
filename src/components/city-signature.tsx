"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Group,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function CitySignature({ time }: { time: RefObject<number> }) {
  const group = useRef<Group>(null);
  const resources = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 448;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#091b29";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#c9ac7c";
    context.font = "28px monospace";
    context.fillText("N U C L U M E", 62, 74);
    context.strokeStyle = "#b393604f";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(62, 118);
    context.lineTo(962, 118);
    context.stroke();
    context.fillStyle = "#e6e8e4";
    context.font = "49px Arial, sans-serif";
    context.fillText("GitHub", 62, 218);
    context.fillText("X", 62, 338);
    context.fillStyle = "#8eaaa9";
    context.fillText("/", 264, 218);
    context.fillText("/", 264, 338);
    context.fillStyle = "#e7d4ae";
    context.fillText("eaabak", 316, 218);
    context.fillText("@eaa_ce", 316, 338);
    context.strokeStyle = "#d1b889";
    context.lineWidth = 4;
    for (const y of [200, 320]) {
      context.beginPath();
      context.moveTo(908, y + 16);
      context.lineTo(941, y - 17);
      context.moveTo(913, y - 17);
      context.lineTo(941, y - 17);
      context.lineTo(941, y + 11);
      context.stroke();
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const materials = {
      case: new MeshStandardMaterial({
        color: "#203341",
        metalness: 0.52,
        roughness: 0.65,
        transparent: true,
      }),
      trim: new MeshStandardMaterial({
        color: "#b79967",
        metalness: 0.65,
        roughness: 0.48,
        transparent: true,
      }),
      display: new MeshBasicMaterial({
        map: texture,
        toneMapped: false,
        transparent: true,
      }),
    };
    const box = new BoxGeometry(1, 1, 1);
    const matrix = new Object3D();
    const pieces: Record<"case" | "trim", BufferGeometry[]> = {
      case: [],
      trim: [],
    };
    const add = (
      surface: "case" | "trim",
      position: [number, number, number],
      scale: [number, number, number],
    ) => {
      matrix.position.fromArray(position);
      matrix.scale.fromArray(scale);
      matrix.updateMatrix();
      const geometry = box.clone();
      geometry.applyMatrix4(matrix.matrix);
      pieces[surface].push(geometry);
    };
    add("case", [0, 1.15, 0], [2.8, 1.2, 0.13]);
    for (const x of [-1.04, 1.04]) {
      add("case", [x, 0.28, 0], [0.085, 0.56, 0.085]);
      add("case", [x, 0.018, 0], [0.22, 0.035, 0.26]);
      add("trim", [x, 0.43, 0.045], [0.088, 0.045, 0.012]);
    }
    for (const x of [-1.4, 1.4])
      add("trim", [x, 1.15, 0.075], [0.015, 1.21, 0.018]);
    for (const y of [0.55, 1.75])
      add("trim", [0, y, 0.075], [2.815, 0.015, 0.018]);
    const geometries = {
      case: mergeGeometries(pieces.case, false)!,
      trim: mergeGeometries(pieces.trim, false)!,
      display: new PlaneGeometry(2.71, 1.13),
    };
    for (const list of Object.values(pieces))
      for (const geometry of list) geometry.dispose();
    box.dispose();
    return { geometries, materials, texture };
  }, []);

  useEffect(
    () => () => {
      for (const geometry of Object.values(resources.geometries))
        geometry.dispose();
      for (const material of Object.values(resources.materials))
        material.dispose();
      resources.texture.dispose();
    },
    [resources],
  );

  useFrame(() => {
    const opacity = MathUtils.smoothstep(time.current, 17, 20);
    if (group.current) group.current.visible = opacity > 0.003;
    resources.materials.case.opacity = opacity;
    resources.materials.trim.opacity = opacity;
    resources.materials.display.opacity = opacity;
    resources.materials.case.depthWrite = opacity > 0.99;
    resources.materials.trim.depthWrite = opacity > 0.99;
    resources.materials.display.depthWrite = opacity > 0.99;
  }, -1.9);

  return (
    <group
      ref={group}
      position={[6.8, -1.5, 9.7]}
      visible={false}
      dispose={null}
    >
      <mesh
        geometry={resources.geometries.case}
        material={resources.materials.case}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={resources.geometries.trim}
        material={resources.materials.trim}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={resources.geometries.display}
        material={resources.materials.display}
        position={[0, 1.15, 0.078]}
        onClick={(event) => {
          if (event.delta > 3) return;
          const y = event.uv?.y;
          if (y === undefined || y > 0.67 || y < 0.11 || time.current < 17)
            return;
          event.stopPropagation();
          window.open(
            y > 0.36 ? "https://github.com/eaabak" : "https://x.com/eaa_ce",
            "_blank",
            "noopener,noreferrer",
          );
        }}
      />
    </group>
  );
}
