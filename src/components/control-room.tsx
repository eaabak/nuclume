"use client";

import { SCENE_LIGHTS } from "@/lib/scene-colors";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useLanguage } from "./language-provider";

type Surface =
  | "stone"
  | "metal"
  | "desk"
  | "seat"
  | "skin"
  | "leaf"
  | "light"
  | "facadeLight"
  | "roof"
  | "facade"
  | "glass"
  | "display";
type Triple = [number, number, number];

export function ControlRoom({
  amount,
  onEnter,
  enabled,
}: {
  amount: RefObject<number>;
  onEnter: () => void;
  enabled: boolean;
}) {
  const { language } = useLanguage();
  const invalidate = useThree((state) => state.invalidate);
  const roof = useRef<Group>(null);
  const facade = useRef<Group>(null);
  const display = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 768;
    const context = canvas.getContext("2d")!;
    const panelWidth = 512;
    const panelHeight = 384;
    const line = (points: [number, number][], color = "#57bfe7", width = 3) => {
      context.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = color;
      context.lineWidth = width;
      context.stroke();
    };
    for (let tile = 0; tile < 6; tile++) {
      context.save();
      context.translate(
        (tile % 3) * panelWidth,
        Math.floor(tile / 3) * panelHeight,
      );
      context.fillStyle = "#0a2539";
      context.fillRect(0, 0, panelWidth, panelHeight);
      context.strokeStyle = "#153a4e";
      context.lineWidth = 1;
      for (let x = 16; x < panelWidth; x += 32) {
        context.beginPath();
        context.moveTo(x, 68);
        context.lineTo(x, 332);
        context.stroke();
      }
      for (let y = 76; y < 340; y += 32) {
        context.beginPath();
        context.moveTo(16, y);
        context.lineTo(496, y);
        context.stroke();
      }
      context.fillStyle = "#a6dcf3";
      context.font = "17px monospace";
      context.fillText(
        (language === "tr"
          ? [
              "NUCLUME / ISI AKTARIMI",
              "ENERJİ / YOLCULUK",
              "SİSTEMLER / GENEL BAKIŞ",
              "BİRİNCİL / İKİNCİL",
              "NUCLUME / KONTROL ODASI",
              "İNSAN / DENETİM",
            ]
          : [
              "NUCLUME / HEAT TRANSFER",
              "ENERGY / THE JOURNEY",
              "SYSTEMS / OVERVIEW",
              "PRIMARY / SECONDARY",
              "NUCLUME / CONTROL ROOM",
              "PEOPLE / OVERSIGHT",
            ])[tile],
        20,
        34,
      );
      line(
        [
          [20, 49],
          [492, 49],
        ],
        "#2c6b8a",
        1,
      );
      context.fillStyle = "#6d9ab2";
      context.font = "12px monospace";
      context.fillText(
        language === "tr"
          ? "AÇIKLAYICI ŞEMA / CANLI VERİ YOK"
          : "ILLUSTRATIVE SCHEMATIC / NO LIVE DATA",
        20,
        366,
      );
      if (tile === 0 || tile === 3) {
        context.strokeStyle = "#74bad9";
        context.lineWidth = 3;
        context.beginPath();
        context.roundRect(74, 100, 125, 198, 34);
        context.stroke();
        context.beginPath();
        context.roundRect(326, 112, 82, 178, 27);
        context.stroke();
        for (let x = 96; x < 178; x += 14)
          line(
            [
              [x, 146],
              [x, 273],
            ],
            "#e6ab5d",
            5,
          );
        line(
          [
            [200, 157],
            [259, 157],
            [259, 202],
            [338, 202],
            [390, 217],
            [338, 232],
            [390, 247],
            [338, 262],
            [259, 262],
            [259, 282],
            [198, 282],
          ],
          "#48ace0",
          4,
        );
        line(
          [
            [407, 150],
            [464, 150],
            [464, 107],
          ],
          "#edb168",
          4,
        );
        line(
          [
            [464, 301],
            [444, 301],
            [444, 272],
            [408, 272],
          ],
          "#8ad6e5",
          3,
        );
      } else if (tile === 1 || tile === 5) {
        for (let index = 0; index < 4; index++) {
          const x = 32 + index * 124;
          context.strokeStyle = index < 2 ? "#d4a665" : "#64bddc";
          context.lineWidth = 2;
          context.strokeRect(x, 128, 80, 105);
          context.fillStyle = "#b3d4df";
          context.font = "12px monospace";
          context.fillText(
            (language === "tr"
              ? ["ISI", "HAREKET", "ELEKTRİK", "ŞEHİR"]
              : ["HEAT", "MOTION", "POWER", "CITY"])[index],
            x + 12,
            265,
          );
          for (let column = 0; column < 4; column++)
            line(
              [
                [x + 15 + column * 15, 212],
                [x + 15 + column * 15, 149 + column * 9],
              ],
              index < 2 ? "#dfa855" : "#56b4d8",
              5,
            );
          if (index < 3)
            line(
              [
                [x + 84, 180],
                [x + 120, 180],
              ],
              "#d5af72",
              3,
            );
        }
      } else {
        for (let graph = 0; graph < 3; graph++) {
          const points: [number, number][] = [];
          for (let index = 0; index < 44; index++)
            points.push([
              24 + index * 10.7,
              113 +
                graph * 76 +
                Math.sin(index * 0.36 + graph) * 10 +
                Math.cos(index * 0.17) * 6,
            ]);
          line(points, graph === 1 ? "#d2a15f" : "#58b5d9", 2);
          line(
            [
              [24, 134 + graph * 76],
              [490, 134 + graph * 76],
            ],
            "#214c61",
            1,
          );
        }
      }
      context.restore();
    }
    const display = new CanvasTexture(canvas);
    display.colorSpace = SRGBColorSpace;
    display.anisotropy = 4;
    return display;
  }, [language]);
  const resources = useMemo(() => {
    const materials = {
      stone: new MeshStandardMaterial({
        color: "#202b36",
        roughness: 0.67,
        metalness: 0.16,
      }),
      metal: new MeshStandardMaterial({
        color: "#14232d",
        roughness: 0.48,
        metalness: 0.65,
      }),
      desk: new MeshStandardMaterial({
        color: "#3a4853",
        roughness: 0.56,
        metalness: 0.3,
      }),
      seat: new MeshStandardMaterial({
        color: "#162630",
        roughness: 0.89,
        metalness: 0.05,
      }),
      skin: new MeshStandardMaterial({
        color: "#b3927a",
        roughness: 0.92,
        metalness: 0,
      }),
      leaf: new MeshStandardMaterial({
        color: "#315544",
        roughness: 0.83,
        metalness: 0,
      }),
      light: new MeshBasicMaterial({ color: SCENE_LIGHTS.controlRoom.strips }),
      facadeLight: new MeshBasicMaterial({
        color: SCENE_LIGHTS.controlRoom.strips,
        transparent: true,
        depthWrite: false,
      }),
      roof: new MeshStandardMaterial({
        color: "#263f57",
        roughness: 0.61,
        metalness: 0.38,
        transparent: true,
      }),
      facade: new MeshStandardMaterial({
        color: "#53626a",
        roughness: 0.72,
        metalness: 0.25,
        transparent: true,
      }),
      glass: new MeshStandardMaterial({
        color: "#f5c98b",
        emissive: "#c1813a",
        emissiveIntensity: 0.28,
        roughness: 0.24,
        metalness: 0.17,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
        side: DoubleSide,
      }),
      display: new MeshBasicMaterial({
        color: "#ffffff",
        toneMapped: false,
      }),
    };
    const parts = {} as Record<Surface, BufferGeometry[]>;
    for (const key of Object.keys(materials) as Surface[]) parts[key] = [];
    const box = new BoxGeometry(1, 1, 1);
    const cylinder = new CylinderGeometry(1, 1, 1, 12);
    const sphere = new SphereGeometry(1, 8, 6);
    const head = new SphereGeometry(1, 16, 10);
    const plane = new PlaneGeometry(1, 1);
    const transform = new Object3D();
    const add = (
      surface: Surface,
      geometry: BufferGeometry,
      position: Triple,
      scale: Triple,
      rotation: Triple = [0, 0, 0],
    ) => {
      transform.position.fromArray(position);
      transform.rotation.set(...rotation);
      transform.scale.fromArray(scale);
      transform.updateMatrix();
      const part = geometry.clone();
      part.applyMatrix4(transform.matrix);
      parts[surface].push(part);
    };
    const block = (
      surface: Surface,
      position: Triple,
      scale: Triple,
      rotation?: Triple,
    ) => add(surface, box, position, scale, rotation);
    const direction = new Vector3();
    const up = new Vector3(0, 1, 0);
    const limb = (
      surface: Surface,
      from: Triple,
      to: Triple,
      radius: number,
    ) => {
      direction.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
      const length = direction.length();
      transform.quaternion.setFromUnitVectors(up, direction.normalize());
      add(
        surface,
        cylinder,
        [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
        [radius, length, radius],
        [transform.rotation.x, transform.rotation.y, transform.rotation.z],
      );
    };
    const screen = (
      position: Triple,
      width: number,
      height: number,
      tile: number,
      tilt = 0,
    ) => {
      block(
        "metal",
        [position[0], position[1], position[2] - 0.026],
        [width + 0.025, height + 0.025, 0.028],
        [tilt, 0, 0],
      );
      const geometry = plane.clone();
      const uv = geometry.getAttribute("uv");
      for (let index = 0; index < uv.count; index++)
        uv.setXY(
          index,
          (uv.getX(index) + (tile % 3)) / 3,
          (uv.getY(index) + (1 - Math.floor(tile / 3))) / 2,
        );
      add("display", geometry, position, [width, height, 1], [tilt, 0, 0]);
      geometry.dispose();
    };
    block("stone", [0, -0.075, 0], [3.3, 0.15, 2.1]);
    block("stone", [0, 0.67, -1.01], [3.3, 1.34, 0.08]);
    block("stone", [-1.61, 0.65, 0], [0.08, 1.3, 2.1]);
    for (let x = -1.5; x <= 1.5; x += 0.3)
      block("metal", [x, 0.001, 0], [0.006, 0.004, 2.05]);
    for (let z = -0.9; z <= 0.9; z += 0.3)
      block("metal", [0, 0.001, z], [3.25, 0.004, 0.006]);
    block("metal", [0, 0.13, -0.92], [3.15, 0.25, 0.08]);
    block("light", [0, 0.265, -0.875], [2.98, 0.012, 0.012]);
    block("light", [0, 1.27, -0.91], [3.07, 0.009, 0.014]);
    block("light", [-1.55, 0.16, 0], [0.012, 0.011, 1.88]);
    block("light", [1.55, 0.16, 0], [0.012, 0.011, 1.88]);
    for (let index = 0; index < 3; index++)
      screen([-0.92 + index * 0.92, 0.81, -0.951], 0.86, 0.68, index);
    for (const [deskX, deskZ] of [
      [-0.72, -0.16],
      [0.66, 0.2],
    ]) {
      block("desk", [deskX, 0.385, deskZ], [1.2, 0.055, 0.43]);
      for (const side of [-1, 1]) {
        block("metal", [deskX + side * 0.48, 0.19, deskZ], [0.12, 0.38, 0.34]);
        block(
          "light",
          [deskX + side * 0.48, 0.025, deskZ + 0.17],
          [0.12, 0.015, 0.008],
        );
      }
      for (let index = 0; index < 3; index++) {
        const x = deskX + (index - 1) * 0.36;
        block("metal", [x, 0.455, deskZ - 0.095], [0.035, 0.11, 0.035]);
        screen([x, 0.575, deskZ - 0.07], 0.325, 0.225, 2 + (index % 3), -0.12);
        block("seat", [x, 0.42, deskZ + 0.115], [0.24, 0.014, 0.07]);
        for (let row = 0; row < 3; row++)
          block(
            "desk",
            [x, 0.428, deskZ + 0.09 + row * 0.021],
            [0.21, 0.002, 0.003],
          );
      }
      const chairZ = deskZ + 0.47;
      add("metal", cylinder, [deskX, 0.12, chairZ], [0.025, 0.22, 0.025]);
      block("seat", [deskX, 0.255, chairZ], [0.27, 0.055, 0.28]);
      block(
        "seat",
        [deskX, 0.445, chairZ + 0.13],
        [0.29, 0.35, 0.045],
        [-0.12, 0, 0],
      );
      for (const side of [-1, 1]) {
        block(
          "metal",
          [deskX + side * 0.155, 0.31, chairZ],
          [0.019, 0.13, 0.02],
        );
        block(
          "seat",
          [deskX + side * 0.155, 0.365, chairZ],
          [0.035, 0.025, 0.21],
        );
      }
      for (let leg = 0; leg < 5; leg++) {
        const angle = (leg * Math.PI * 2) / 5;
        block(
          "metal",
          [
            deskX + Math.sin(angle) * 0.065,
            0.025,
            chairZ + Math.cos(angle) * 0.065,
          ],
          [0.015, 0.02, 0.15],
          [0, angle, 0],
        );
        add(
          "seat",
          sphere,
          [
            deskX + Math.sin(angle) * 0.135,
            0.023,
            chairZ + Math.cos(angle) * 0.135,
          ],
          [0.028, 0.022, 0.023],
        );
      }
      add(
        "desk",
        head,
        [deskX, 0.46, chairZ - 0.016],
        [0.11, 0.165, 0.073],
        [-0.1, 0, 0],
      );
      add("skin", cylinder, [deskX, 0.63, chairZ - 0.04], [0.03, 0.055, 0.03]);
      add(
        "skin",
        head,
        [deskX, 0.709, chairZ - 0.055],
        [0.066, 0.081, 0.068],
        [-0.12, 0, 0],
      );
      add("seat", head, [deskX, 0.743, chairZ - 0.041], [0.067, 0.052, 0.062]);
      for (const side of [-1, 1]) {
        const shoulder: Triple = [deskX + side * 0.098, 0.557, chairZ - 0.027];
        const elbow: Triple = [deskX + side * 0.15, 0.423, deskZ + 0.3];
        const wrist: Triple = [deskX + side * 0.087, 0.444, deskZ + 0.154];
        limb("desk", shoulder, elbow, 0.032);
        limb("desk", elbow, wrist, 0.026);
        add(
          "skin",
          head,
          [wrist[0], 0.442, deskZ + 0.129],
          [0.029, 0.016, 0.035],
        );
        limb(
          "seat",
          [deskX + side * 0.066, 0.285, chairZ],
          [deskX + side * 0.075, 0.27, deskZ + 0.18],
          0.046,
        );
        limb(
          "seat",
          [deskX + side * 0.075, 0.27, deskZ + 0.18],
          [deskX + side * 0.075, 0.06, deskZ + 0.11],
          0.033,
        );
        add(
          "seat",
          head,
          [deskX + side * 0.075, 0.039, deskZ + 0.071],
          [0.043, 0.027, 0.07],
        );
      }
    }
    for (const [x, z] of [
      [-1.38, -0.68],
      [1.37, -0.72],
      [-1.37, 0.76],
      [1.4, 0.78],
    ]) {
      add("desk", cylinder, [x, 0.115, z], [0.075, 0.23, 0.075]);
      add("metal", cylinder, [x, 0.29, z], [0.009, 0.3, 0.009]);
      for (let leaf = 0; leaf < 7; leaf++) {
        const angle = (leaf * Math.PI * 2) / 7;
        add(
          "leaf",
          sphere,
          [
            x + Math.sin(angle) * 0.062,
            0.34 + (leaf % 3) * 0.047,
            z + Math.cos(angle) * 0.062,
          ],
          [0.044, 0.16, 0.025],
          [Math.sin(angle) * 0.6, angle, Math.cos(angle) * 0.6],
        );
      }
    }
    block("roof", [0, 1.39, 0], [3.46, 0.13, 2.24]);
    for (const x of [-1.65, 1.65])
      block("roof", [x, 1.5, 0], [0.06, 0.17, 2.18]);
    for (const z of [-1.065, 1.065])
      block("roof", [0, 1.5, z], [3.33, 0.17, 0.06]);
    for (const x of [-0.78, 0.68]) {
      block("roof", [x, 1.49, -0.16], [0.9, 0.08, 0.71]);
      for (let slat = 0; slat < 6; slat++)
        block("roof", [x, 1.55, -0.43 + slat * 0.1], [0.8, 0.035, 0.025]);
    }
    block("facade", [0, 0.155, 1.02], [3.3, 0.31, 0.08]);
    block("facade", [1.61, 0.63, 0], [0.08, 1.26, 2.1]);
    block("facade", [0, 1.215, 1.015], [3.25, 0.18, 0.07]);
    for (let index = 0; index < 7; index++) {
      const x = -1.44 + index * 0.48;
      block("glass", [x, 0.745, 1.026], [0.43, 0.87, 0.012]);
      block("facade", [x - 0.237, 0.72, 1.05], [0.027, 1, 0.04]);
    }
    block("glass", [1.657, 0.77, 0], [0.015, 0.56, 1.78]);
    block("facadeLight", [0, 1.12, 1.058], [3.16, 0.018, 0.018]);
    block("facadeLight", [1.665, 1.12, 0], [0.018, 0.018, 1.97]);
    const geometries = {} as Record<Surface, BufferGeometry>;
    for (const key of Object.keys(parts) as Surface[]) {
      geometries[key] = mergeGeometries(parts[key], false)!;
      for (const geometry of parts[key]) geometry.dispose();
    }
    box.dispose();
    cylinder.dispose();
    sphere.dispose();
    head.dispose();
    plane.dispose();
    return { materials, geometries };
  }, []);

  useLayoutEffect(() => {
    resources.materials.display.map = display;
    resources.materials.display.needsUpdate = true;
    invalidate();
  }, [display, resources, invalidate]);
  useEffect(() => () => display.dispose(), [display]);

  useEffect(
    () => () => {
      for (const geometry of Object.values(resources.geometries))
        geometry.dispose();
      for (const material of Object.values(resources.materials))
        material.dispose();
    },
    [resources],
  );

  useFrame(() => {
    const open = MathUtils.clamp(amount.current, 0, 1);
    const roofOpacity = 1 - MathUtils.smoothstep(open, 0.08, 0.65);
    resources.materials.roof.opacity = roofOpacity;
    resources.materials.roof.depthWrite = roofOpacity > 0.98;
    resources.materials.facade.opacity =
      1 - MathUtils.smoothstep(open, 0, 0.62);
    resources.materials.facade.depthWrite =
      resources.materials.facade.opacity > 0.98;
    resources.materials.facadeLight.opacity =
      resources.materials.facade.opacity;
    resources.materials.glass.opacity =
      0.56 * (1 - MathUtils.smoothstep(open, 0, 0.5));
    if (roof.current) {
      roof.current.position.y = open * 0.72;
      roof.current.visible = roofOpacity > 0.003;
    }
    if (facade.current)
      facade.current.visible = resources.materials.facade.opacity > 0.003;
  }, -1.9);

  return (
    <group
      position={[-1.6, -1.5, 2.1]}
      dispose={null}
      onClick={(event) => {
        if (!enabled || amount.current > 0.5 || event.delta > 3) return;
        event.stopPropagation();
        onEnter();
      }}
    >
      <group ref={roof}>
        <mesh
          geometry={resources.geometries.roof}
          material={resources.materials.roof}
          castShadow
          receiveShadow
        />
      </group>
      <group ref={facade}>
        <mesh
          geometry={resources.geometries.facade}
          material={resources.materials.facade}
          receiveShadow
        />
        <mesh
          geometry={resources.geometries.glass}
          material={resources.materials.glass}
        />
        <mesh
          geometry={resources.geometries.facadeLight}
          material={resources.materials.facadeLight}
        />
      </group>
      {(Object.keys(resources.geometries) as Surface[])
        .filter(
          (surface) =>
            !["roof", "facade", "facadeLight", "glass"].includes(surface),
        )
        .map((surface) => (
          <mesh
            key={surface}
            geometry={resources.geometries[surface]}
            material={resources.materials[surface]}
            castShadow={!["light", "display", "glass"].includes(surface)}
            receiveShadow
          />
        ))}
      <pointLight
        position={[0, 1.1, 0.35]}
        color={SCENE_LIGHTS.controlRoom.ambient}
        intensity={1.6}
        distance={3.3}
        decay={2}
      />
    </group>
  );
}
