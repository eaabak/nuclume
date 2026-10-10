"use client";

import { REACTOR_COLORS } from "@/lib/scene-colors";
import { useFrame } from "@react-three/fiber";
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
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PowerController } from "./use-power";
import { COOLANT_TRANSFER } from "@/lib/power";
import { journeyTime, type JourneyController } from "./use-journey";

type Placement = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
};
type MaterialName =
  | "concrete"
  | "steel"
  | "edge"
  | "brass"
  | "blue"
  | "flow"
  | "exchange"
  | "exchangeEdge"
  | "exchangeBlue"
  | "exchangeSteel"
  | "exchangePipeEdge"
  | "exchangeConcrete";
type BatchName =
  | "supports"
  | "panels"
  | "rails"
  | "services"
  | "fasteners"
  | "exchangeDetails"
  | "exchangeFasteners";

export function ReactorArchitecture({
  reveal,
  inspection,
  flowTime,
  power,
  journey,
}: {
  reveal: RefObject<number>;
  inspection: RefObject<number>;
  flowTime: RefObject<number>;
  power: PowerController | null;
  journey: JourneyController;
}) {
  const root = useRef<Group>(null);
  const instances = useRef<Partial<Record<BatchName, InstancedMesh>>>({});
  const arrows = useRef<InstancedMesh>(null);
  const resources = useMemo(() => {
    const size = 128;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        const value =
          204 +
          (grain - Math.floor(grain)) * 22 +
          Math.sin(x * 0.17 + Math.cos(y * 0.09)) * 5;
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
        pixels[index + 3] = 255;
      }
    }
    const texture = new DataTexture(pixels, size, size, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.repeat.set(3, 3);
    texture.needsUpdate = true;
    const baseMaterials = {
      concrete: new MeshStandardMaterial({
        color: "#838a8e",
        roughness: 0.94,
        metalness: 0.04,
        map: texture,
        bumpMap: texture,
        bumpScale: 0.008,
        transparent: true,
        side: DoubleSide,
      }),
      steel: new MeshStandardMaterial({
        color: "#3c4041",
        roughness: 0.63,
        metalness: 0.72,
        transparent: true,
        side: DoubleSide,
      }),
      edge: new MeshStandardMaterial({
        color: "#888c87",
        roughness: 0.44,
        metalness: 0.78,
        transparent: true,
        side: DoubleSide,
      }),
      brass: new MeshStandardMaterial({
        color: "#9c7842",
        roughness: 0.5,
        metalness: 0.72,
        transparent: true,
      }),
      blue: new MeshStandardMaterial({
        color: REACTOR_COLORS.primaryPipe,
        emissive: REACTOR_COLORS.primaryEmission,
        emissiveIntensity: 0.18,
        roughness: 0.36,
        metalness: 0.46,
        transparent: true,
        opacity: 0.53,
        side: DoubleSide,
        depthWrite: false,
      }),
      flow: new MeshBasicMaterial({
        color: REACTOR_COLORS.primaryFlow,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      }),
      exchange: new MeshStandardMaterial({
        color: "#4b5254",
        roughness: 0.57,
        metalness: 0.76,
        transparent: true,
        side: DoubleSide,
      }),
      exchangeEdge: new MeshStandardMaterial({
        color: "#929d9f",
        roughness: 0.36,
        metalness: 0.82,
        transparent: true,
        side: DoubleSide,
      }),
      exchangeBlue: new MeshStandardMaterial({
        color: REACTOR_COLORS.secondaryWater,
        emissive: REACTOR_COLORS.secondaryEmission,
        emissiveIntensity: 0.36,
        roughness: 0.32,
        metalness: 0.25,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: DoubleSide,
      }),
    };
    const materials = {
      ...baseMaterials,
      exchangeSteel: baseMaterials.steel.clone(),
      exchangePipeEdge: baseMaterials.edge.clone(),
      exchangeConcrete: baseMaterials.concrete.clone(),
    };
    const box = new BoxGeometry(1, 1, 1);
    const cylinder = new CylinderGeometry(1, 1, 1, 12);
    const batchGeometries = {
      supports: box,
      panels: box,
      rails: cylinder,
      services: cylinder,
      fasteners: cylinder,
      exchangeDetails: cylinder,
      exchangeFasteners: cylinder,
    };
    const batchMaterials: Record<BatchName, MaterialName> = {
      supports: "concrete",
      panels: "steel",
      rails: "brass",
      services: "steel",
      fasteners: "edge",
      exchangeDetails: "exchangeEdge",
      exchangeFasteners: "exchangePipeEdge",
    };
    const placements: Record<BatchName, Placement[]> = {
      supports: [],
      panels: [],
      rails: [],
      services: [],
      fasteners: [],
      exchangeDetails: [],
      exchangeFasteners: [],
    };
    const parts = {} as Record<MaterialName, BufferGeometry[]>;
    for (const name of Object.keys(materials) as MaterialName[])
      parts[name] = [];
    const transform = new Object3D();
    const push = (
      name: MaterialName,
      geometry: BufferGeometry,
      position: [number, number, number] = [0, 0, 0],
      rotation: [number, number, number] = [0, 0, 0],
      scale: [number, number, number] = [1, 1, 1],
    ) => {
      transform.position.fromArray(position);
      transform.rotation.set(...rotation);
      transform.scale.fromArray(scale);
      transform.updateMatrix();
      const result = geometry.index
        ? geometry.toNonIndexed()
        : geometry.clone();
      result.applyMatrix4(transform.matrix);
      parts[name].push(result);
      geometry.dispose();
    };
    const place = (
      name: BatchName,
      position: [number, number, number],
      scale: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
    ) => placements[name].push({ position, scale, rotation });
    const connect = (
      name: BatchName,
      from: [number, number, number],
      to: [number, number, number],
      radius: number,
    ) => {
      const a = new Vector3(...from);
      const b = new Vector3(...to);
      const direction = b.sub(a);
      transform.position.copy(a).addScaledVector(direction, 0.5);
      transform.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction.clone().normalize(),
      );
      place(
        name,
        transform.position.toArray(),
        [radius, direction.length(), radius],
        [transform.rotation.x, transform.rotation.y, transform.rotation.z],
      );
    };
    const curve = (points: [number, number, number][]) =>
      new CatmullRomCurve3(
        points.map((point) => new Vector3(...point)),
        false,
        "centripetal",
      );
    const ring = (
      name: MaterialName,
      x: number,
      y: number,
      z: number,
      radius: number,
      thickness: number,
      rotation: [number, number, number] = [Math.PI / 2, 0, 0],
    ) =>
      push(
        name,
        new TorusGeometry(radius, thickness, 8, 64),
        [x, y, z],
        rotation,
      );
    const rail = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      y: number,
    ) => {
      const distance = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(1, Math.ceil(distance / 0.7));
      for (let index = 0; index <= steps; index++) {
        const t = index / steps;
        connect(
          "rails",
          [MathUtils.lerp(x1, x2, t), y, MathUtils.lerp(z1, z2, t)],
          [MathUtils.lerp(x1, x2, t), y + 0.68, MathUtils.lerp(z1, z2, t)],
          0.019,
        );
      }
      for (const height of [0.28, 0.66])
        connect("rails", [x1, y + height, z1], [x2, y + height, z2], 0.017);
    };
    const arch = (
      x: number,
      radius: number,
      spring: number,
      rise: number,
      depth: number,
    ) => {
      const thickness = 0.48;
      const shape = new Shape();
      shape.moveTo(-radius, -4.3);
      shape.lineTo(-radius, spring);
      for (let index = 0; index <= 40; index++) {
        const angle = Math.PI - (index / 40) * Math.PI;
        shape.lineTo(Math.cos(angle) * radius, spring + Math.sin(angle) * rise);
      }
      shape.lineTo(radius, -4.3);
      shape.lineTo(radius - thickness, -4.3);
      shape.lineTo(radius - thickness, spring);
      for (let index = 0; index <= 40; index++) {
        const angle = (index / 40) * Math.PI;
        shape.lineTo(
          Math.cos(angle) * (radius - thickness),
          spring + Math.sin(angle) * (rise - thickness),
        );
      }
      shape.lineTo(-radius + thickness, -4.3);
      shape.closePath();
      push(
        "concrete",
        new ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: false,
          steps: 1,
          curveSegments: 32,
        }),
        [x, 0, -0.3],
      );
      push(
        "concrete",
        new CylinderGeometry(
          radius,
          radius,
          spring + 4.3,
          64,
          1,
          true,
          Math.PI / 2,
          Math.PI,
        ),
        [x, (spring - 4.3) / 2, -0.3],
      );
      push(
        "concrete",
        new CylinderGeometry(
          radius - thickness,
          radius - thickness,
          spring + 4.3,
          64,
          1,
          true,
          Math.PI / 2,
          Math.PI,
        ),
        [x, (spring - 4.3) / 2, -0.3],
      );
      push(
        "concrete",
        new SphereGeometry(radius, 48, 20, Math.PI, Math.PI, 0, Math.PI / 2),
        [x, spring, -0.3],
        [0, 0, 0],
        [1, rise / radius, 1],
      );
      push(
        "concrete",
        new SphereGeometry(
          radius - thickness,
          48,
          20,
          Math.PI,
          Math.PI,
          0,
          Math.PI / 2,
        ),
        [x, spring, -0.3],
        [0, 0, 0],
        [1, (rise - thickness) / (radius - thickness), 1],
      );
      for (let level = -3.1; level < spring; level += 1.38) {
        for (const side of [-1, 1]) {
          place(
            "panels",
            [x + side * (radius - thickness * 0.5), level, depth - 0.28],
            [thickness + 0.01, 0.018, 0.018],
          );
          place(
            "panels",
            [x + side * (radius + 0.015), level, -1.18],
            [0.022, 0.02, 1.75],
          );
        }
        for (let index = 0; index < 10; index++) {
          const angle = Math.PI / 2 + ((index + 0.5) / 10) * Math.PI;
          const wall = radius - thickness - 0.035;
          place(
            "supports",
            [
              x + Math.sin(angle) * wall,
              level + 0.6,
              -0.3 + Math.cos(angle) * wall,
            ],
            [0.64, 1.14, 0.035],
            [0, angle, 0],
          );
          place(
            "services",
            [
              x + Math.sin(angle) * (wall - 0.065),
              level + 0.56,
              -0.3 + Math.cos(angle) * (wall - 0.065),
            ],
            [0.022, 1.19, 0.022],
          );
        }
      }
      for (let index = 1; index < 14; index++) {
        const angle = (index / 14) * Math.PI;
        connect(
          "services",
          [
            x + Math.cos(angle) * radius,
            spring + Math.sin(angle) * rise,
            depth - 0.29,
          ],
          [
            x + Math.cos(angle) * (radius - thickness),
            spring + Math.sin(angle) * (rise - thickness),
            depth - 0.29,
          ],
          0.009,
        );
      }
      for (const side of [-1, 1]) {
        place(
          "supports",
          [x + side * (radius + 0.17), 0.18, -1.7],
          [0.34, 8.96, 0.46],
        );
        place(
          "supports",
          [x + side * (radius + 0.2), -3.85, 0.55],
          [0.65, 0.7, 1.55],
        );
        place(
          "panels",
          [x + side * (radius + 0.18), -3.46, 0.6],
          [0.77, 0.12, 1.7],
        );
      }
      for (let index = 0; index <= 32; index++) {
        const angle = Math.PI / 2 + (index / 32) * Math.PI;
        const px = x + Math.sin(angle) * (radius + 0.06);
        const pz = -0.3 + Math.cos(angle) * (radius + 0.06);
        if (index % 4 === 0)
          connect(
            "rails",
            [px, spring + 0.07, pz],
            [px, spring + 0.64, pz],
            0.019,
          );
        if (index < 32) {
          const next = Math.PI / 2 + ((index + 1) / 32) * Math.PI;
          connect(
            "rails",
            [px, spring + 0.61, pz],
            [
              x + Math.sin(next) * (radius + 0.06),
              spring + 0.61,
              -0.3 + Math.cos(next) * (radius + 0.06),
            ],
            0.018,
          );
        }
      }
    };
    arch(0, 3.7, 5.15, 2.45, 0.8);
    arch(8, 2.75, 4.82, 1.7, 0.7);
    push(
      "concrete",
      new CylinderGeometry(1, 1, 0.58, 96),
      [3.1, -4.52, 0.1],
      [0, 0, 0],
      [8.8, 1, 5.9],
    );
    push(
      "steel",
      new CylinderGeometry(1, 1, 0.11, 96),
      [3.1, -4.85, 0.1],
      [0, 0, 0],
      [9, 1, 6.07],
    );
    push(
      "concrete",
      new CylinderGeometry(1, 1, 1.18, 80, 1, true, -Math.PI / 2, Math.PI),
      [3.1, -4.2, 0.1],
      [0, 0, 0],
      [8.72, 1, 5.78],
    );
    push(
      "concrete",
      new CylinderGeometry(1, 1, 1.18, 80, 1, true, -Math.PI / 2, Math.PI),
      [3.1, -4.2, 0.1],
      [0, 0, 0],
      [8.35, 1, 5.41],
    );
    for (let index = 0; index <= 60; index++) {
      const angle = -Math.PI / 2 + (index / 60) * Math.PI;
      const x = 3.1 + Math.sin(angle) * 8.53;
      const z = 0.1 + Math.cos(angle) * 5.58;
      place("panels", [x, -3.59, z], [0.38, 0.035, 0.2], [0, angle, 0]);
      if (index % 7 === 0)
        place(
          "supports",
          [x, -4.25, z + 0.06],
          [0.26, 1.56, 0.5],
          [0, angle, 0],
        );
    }
    for (let x = -5; x < 12; x += 0.93) {
      for (let z = -4.9; z < 5.6; z += 0.93) {
        if (((x - 3.1) / 8.55) ** 2 + ((z - 0.1) / 5.62) ** 2 > 0.95) continue;
        place("panels", [x, -4.216, z], [0.014, 0.008, 0.92]);
        place("panels", [x + 0.455, -4.216, z - 0.455], [0.92, 0.008, 0.014]);
      }
    }
    for (const [x, y, z, width, depth] of [
      [-2.8, 2.8, -0.05, 1.25, 2.4],
      [3.6, -0.05, 0.8, 1.7, 2.5],
      [4.7, 3.65, -1.6, 2.2, 1.7],
      [5.35, -2.0, -1.1, 1.3, 1.8],
      [9.8, -0.8, 0.1, 1.65, 1.7],
      [-1.5, 4.85, -2.5, 3.4, 1.05],
    ]) {
      place("panels", [x, y, z], [width, 0.13, depth]);
      rail(
        x - width / 2,
        z + depth / 2,
        x + width / 2,
        z + depth / 2,
        y + 0.08,
      );
      rail(
        x + width / 2,
        z - depth / 2,
        x + width / 2,
        z + depth / 2,
        y + 0.08,
      );
      for (const side of [-1, 1])
        connect(
          "services",
          [x + side * width * 0.4, y - 0.06, z - depth * 0.3],
          [x + side * width * 0.4, y - 0.75, z - depth * 0.65],
          0.032,
        );
      for (let index = 0; index < width / 0.16; index++)
        place(
          "panels",
          [x - width / 2 + index * 0.16, y + 0.074, z],
          [0.022, 0.012, depth],
        );
    }
    for (const x of [4.15, 5.35, 10.55]) {
      for (const offset of [-0.23, 0.23])
        connect(
          "rails",
          [x + offset, -4, -0.7],
          [x + offset, 5.3, -0.7],
          0.028,
        );
      for (let y = -3.9; y < 5.3; y += 0.29)
        connect("rails", [x - 0.23, y, -0.7], [x + 0.23, y, -0.7], 0.023);
    }
    for (let index = 0; index < 9; index++) {
      const x = 3.2 + index * 0.25;
      connect(
        "services",
        [x, -4.1, -2.15],
        [x, 4.6 + index * 0.1, -2.15],
        0.045 + (index % 3) * 0.018,
      );
      for (const y of [-2.7, -0.2, 2.6])
        place("fasteners", [x, y, -2.15], [0.092, 0.09, 0.092]);
    }
    for (const [x, z] of [
      [-2.5, -1.55],
      [2.5, -1.55],
      [6.1, -1.4],
      [9.9, -1.4],
    ]) {
      place("supports", [x, -3.95, z], [0.8, 0.53, 0.9]);
      place("services", [x, -2.6, z], [0.35, 2.25, 0.35]);
      for (const y of [-3.5, -1.7]) ring("edge", x, y, z, 0.37, 0.06);
    }
    const sg = [8, 0.875, 0] as const;
    push(
      "exchange",
      new CylinderGeometry(1.8, 1.8, 9.125, 64, 1, true, Math.PI / 2, Math.PI),
      [...sg],
    );
    push(
      "exchangeEdge",
      new CylinderGeometry(1.82, 1.82, 0.15, 64),
      [8, 5.4375, 0],
    );
    push("exchange", new CylinderGeometry(1.35, 1.5, 0.85, 48), [8, -3.93, 0]);
    for (const y of [-3.6875, -2.95, 0.65, 3.0, 5.4375])
      ring("exchangeEdge", 8, y, 0, 1.82, y === 3 ? 0.04 : 0.065);
    for (const x of [6.2, 9.8])
      connect("exchangeDetails", [x, -3.69, 0], [x, 5.44, 0], 0.074);
    for (let index = 0; index < 24; index++) {
      const angle = (index / 24) * Math.PI * 2;
      for (const y of [-3.68, 5.53])
        place(
          "exchangeDetails",
          [8 + Math.sin(angle) * 1.8, y, Math.cos(angle) * 1.8],
          [0.055, 0.11, 0.055],
        );
    }
    push(
      "exchangeBlue",
      new CylinderGeometry(1.64, 1.64, 4.7, 56, 1, true, -Math.PI / 2, Math.PI),
      [8, -0.77, 0],
    );
    const coilPoints: Vector3[] = [];
    for (let index = 0; index <= 256; index++) {
      const t = index / 256;
      const angle = t * Math.PI * 14;
      coilPoints.push(
        new Vector3(
          8 + Math.cos(angle) * 1.1,
          2.2 - t * 2.6,
          Math.sin(angle) * 0.9,
        ),
      );
    }
    const coil = new CatmullRomCurve3(coilPoints);
    push("exchangeEdge", new TubeGeometry(coil, 224, 0.075, 10, false));
    push("exchangeBlue", new TubeGeometry(coil, 224, 0.087, 10, false));
    for (const z of [-0.58, 0.58]) {
      push(
        "exchangeEdge",
        new TubeGeometry(
          curve([
            [6.92, -0.4, z],
            [8, -0.4, z],
            [9.1, -0.4, z],
          ]),
          16,
          0.12,
          10,
          false,
        ),
      );
    }
    push(
      "exchangeEdge",
      new TubeGeometry(
        curve([
          [9.1, -0.4, 0],
          [9.1, -0.4, -0.58],
        ]),
        8,
        0.075,
        10,
        false,
      ),
    );
    for (let index = 0; index < 8; index++) {
      const x = 6.94 + index * 0.3;
      const tube = curve([
        [x, -0.4, -0.58],
        [x, -2.45, -0.58],
        [x, -2.91, -0.35],
        [x, -3, 0],
        [x, -2.91, 0.35],
        [x, -2.45, 0.58],
        [x, -0.4, 0.58],
      ]);
      push("exchangeEdge", new TubeGeometry(tube, 44, 0.055, 8, false));
      push("exchangeBlue", new TubeGeometry(tube, 44, 0.068, 8, false));
    }
    for (const y of [-2.3, -1.35]) {
      push("exchange", new BoxGeometry(2.43, 0.055, 1.3), [8, y, 0]);
    }
    const hot = curve([
      [4.2, 2.2, 0.4],
      [4.95, 2.2, 0.4],
      [5.5, 1.6, 0.4],
      [5.6, -0.45, 0.4],
      [6.1, -0.65, 0.4],
      [6.6, 0.1, 0.4],
      [6.7, 1.8, 0.4],
      [7.3, 2.2, 0.4],
      [9.1, 2.2, 0],
    ]);
    const returning = curve([
      [9.1, -0.4, 0.58],
      [9.35, -1.1, 0.58],
      [9.24, -2, 0],
      [7.2, -2.1, 0.25],
      [6.3, -2.8, 1.4],
      [5.3, -3.05, 3.35],
      [3, -3.05, 4],
      [-0.8, -3.05, 4],
      [-2.9, -2.85, 3.9],
      [-3.4, -1.7, 3.8],
      [-1.65, -0.6, 4.2],
      [0, -0.25, 4.2],
      [0, 1.1, 4.2],
    ]);
    const steamOut = curve([
      [9.55, 3.45, 0.15],
      [10.35, 3.45, 0.15],
      [11.6, 3.4, 0.15],
      [12.25, 3.4, 0.15],
    ]);
    const waterIn = curve([
      [12.15, -2.9, 0.7],
      [11.2, -2.9, 0.7],
      [10.65, -2.1, 0.7],
      [10.55, -1.9, 0.6],
      [9.55, -1.8, 0.5],
    ]);
    const curves = [hot, returning, steamOut, waterIn];
    for (let curveIndex = 0; curveIndex < curves.length; curveIndex++) {
      const path = curves[curveIndex];
      path.getLengths(200);
      push(
        "blue",
        new TubeGeometry(path, 144, curveIndex === 1 ? 0.3 : 0.255, 24, false),
      );
      push("flow", new TubeGeometry(path, 144, 0.024, 8, false));
      const count = curveIndex === 1 ? 7 : curveIndex === 0 ? 5 : 2;
      for (let index = 0; index < count; index++) {
        const t = (index + 0.16) / count;
        const point = path.getPointAt(t);
        const direction = path.getTangentAt(t);
        transform.quaternion.setFromUnitVectors(
          new Vector3(0, 1, 0),
          direction,
        );
        place(
          "exchangeFasteners",
          point.toArray(),
          [0.355, 0.15, 0.355],
          [transform.rotation.x, transform.rotation.y, transform.rotation.z],
        );
        for (const offset of [-0.095, 0.095]) {
          const collarPoint = point.clone().addScaledVector(direction, offset);
          transform.quaternion.setFromUnitVectors(
            new Vector3(0, 0, 1),
            direction,
          );
          push(
            "exchangePipeEdge",
            new TorusGeometry(0.34, 0.039, 6, 20),
            collarPoint.toArray(),
            [transform.rotation.x, transform.rotation.y, transform.rotation.z],
          );
        }
        const radial = direction
          .clone()
          .cross(
            new Vector3(
              Math.abs(direction.y) < 0.9 ? 0 : 1,
              Math.abs(direction.y) < 0.9 ? 1 : 0,
              0,
            ),
          )
          .normalize();
        const across = direction.clone().cross(radial).normalize();
        for (let bolt = 0; bolt < 6; bolt++) {
          const angle = (bolt / 6) * Math.PI * 2;
          const center = point
            .clone()
            .addScaledVector(radial, Math.cos(angle) * 0.39)
            .addScaledVector(across, Math.sin(angle) * 0.39);
          connect(
            "exchangeFasteners",
            center.clone().addScaledVector(direction, -0.105).toArray(),
            center.clone().addScaledVector(direction, 0.105).toArray(),
            0.034,
          );
        }
      }
    }
    push(
      "exchangeSteel",
      new CylinderGeometry(0.94, 0.94, 1.6, 48),
      [3, -3.05, 4],
      [0, 0, Math.PI / 2],
    );
    for (const x of [2.14, 3.86]) {
      push(
        "exchangePipeEdge",
        new CylinderGeometry(1, 1, 0.13, 48),
        [x, -3.05, 4],
        [0, 0, Math.PI / 2],
      );
      for (let index = 0; index < 14; index++) {
        const angle = (index / 14) * Math.PI * 2;
        place(
          "exchangeFasteners",
          [x, -3.05 + Math.cos(angle) * 0.85, 4 + Math.sin(angle) * 0.85],
          [0.07, 0.19, 0.07],
          [0, 0, Math.PI / 2],
        );
      }
    }
    for (const x of [2.05, 3.95]) {
      push(
        "exchangeSteel",
        new CylinderGeometry(0.51, 0.66, 0.42, 36),
        [x, -3.05, 4],
        [0, 0, Math.PI / 2],
      );
      push("exchangeConcrete", new BoxGeometry(0.4, 0.82, 1.48), [x, -3.8, 4]);
    }
    for (let index = 0; index < 10; index++) {
      const angle = (index / 10) * Math.PI * 2;
      push(
        "exchangeSteel",
        new BoxGeometry(1.15, 0.045, 0.18),
        [3, -3.05 + Math.cos(angle) * 0.945, 4 + Math.sin(angle) * 0.945],
        [angle, 0, 0],
      );
    }
    const merged = {} as Record<MaterialName, BufferGeometry>;
    for (const name of Object.keys(parts) as MaterialName[]) {
      if (parts[name].length === 0) continue;
      merged[name] =
        mergeGeometries(parts[name], false) ?? new BufferGeometry();
      for (const geometry of parts[name]) geometry.dispose();
    }
    const steamMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uOpacity;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y); }
        void main() {
          vec2 p = vUv * vec2(5.8, 6.9) - vec2(uTime * .027, uTime * .17);
          float n = noise(p) * .54 + noise(p * 2.1 + 7.3) * .29 + noise(p * 4.3 + 1.5) * .17;
          float width = .44 + .09 * sin(vUv.y * 6.0 + n * 2.0);
          float envelope = (1. - smoothstep(width - .18, width, abs(vUv.x-.5))) * smoothstep(0.,.2,vUv.y) * (1.-smoothstep(.77,1.,vUv.y));
          float alpha = smoothstep(.14,.72,n) * envelope * uOpacity;
          gl_FragColor = vec4(mix(vec3(.46,.5,.52),vec3(.88,.85,.78),n),alpha);
        }`,
    });
    return {
      materials,
      materialEntries: Object.entries(materials),
      merged,
      texture,
      box,
      cylinder,
      batchGeometries,
      batchMaterials,
      placements,
      curves,
      arrow: new ConeGeometry(0.12, 0.37, 8),
      plane: new PlaneGeometry(3.35, 3.15),
      steamMaterial,
      matrix: new Object3D(),
      tangent: new Vector3(),
      up: new Vector3(0, 1, 0),
      tint: new Color(),
    };
  }, []);

  useLayoutEffect(() => {
    for (const name of Object.keys(resources.placements) as BatchName[]) {
      const mesh = instances.current[name];
      if (!mesh) continue;
      resources.placements[name].forEach((placement, index) => {
        resources.matrix.position.fromArray(placement.position);
        resources.matrix.scale.fromArray(placement.scale);
        resources.matrix.rotation.set(...placement.rotation);
        resources.matrix.updateMatrix();
        mesh.setMatrixAt(index, resources.matrix.matrix);
        if (name === "supports") {
          resources.tint.setScalar(0.78 + (index % 5) * 0.048);
          mesh.setColorAt(index, resources.tint);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const meshes = Object.values(instances.current);
    const arrowMesh = arrows.current;
    return () => {
      for (const mesh of meshes) mesh?.dispose();
      arrowMesh?.dispose();
    };
  }, [resources]);

  useEffect(
    () => () => {
      for (const geometry of Object.values(resources.merged))
        geometry.dispose();
      for (const material of Object.values(resources.materials))
        material.dispose();
      resources.box.dispose();
      resources.cylinder.dispose();
      resources.arrow.dispose();
      resources.plane.dispose();
      resources.steamMaterial.dispose();
      resources.texture.dispose();
    },
    [resources],
  );

  useFrame(() => {
    const sceneTime = power
      ? journeyTime(journey, 3, power.sceneTime.current)
      : 0;
    const transferTime = power
      ? journeyTime(journey, 3, power.transferTime.current)
      : 0;
    const departure = power
      ? power.transfer
        ? power.transfer === "leaving"
          ? MathUtils.smootherstep(transferTime, 0, COOLANT_TRANSFER.leave)
          : 0
        : MathUtils.smoothstep(sceneTime, 0, 3.2)
      : 0;
    const alpha =
      reveal.current * (1 - departure) * (1 - inspection.current * 0.94);
    const exchange = power?.transfer
      ? power.transfer === "following"
        ? 1 - MathUtils.smootherstep(transferTime, 0.15, 1.5)
        : 1 -
          MathUtils.smootherstep(
            journeyTime(journey, 3, COOLANT_TRANSFER.travel),
            0.15,
            1.5,
          )
      : 1;
    if (root.current) root.current.visible = alpha > 0.003;
    for (const [name, material] of resources.materialEntries) {
      const local =
        name.startsWith("exchange") || name === "blue" || name === "flow"
          ? exchange
          : 1;
      const opacity =
        name === "blue"
          ? 0.48
          : name === "exchangeBlue"
            ? 0.23
            : name === "flow"
              ? 0.42
              : 1;
      material.opacity = alpha * local * opacity;
      material.depthWrite = material.opacity > 0.99;
    }
    resources.steamMaterial.uniforms.uTime.value = flowTime.current;
    resources.steamMaterial.uniforms.uOpacity.value = alpha * exchange * 0.66;
    if (arrows.current && alpha > 0.003) {
      for (let index = 0; index < 20; index++) {
        const pathIndex = Math.floor(index / 5);
        const curve = resources.curves[pathIndex];
        const along =
          ((index % 5) / 5 +
            flowTime.current * (pathIndex < 2 ? 0.04 : 0.075)) %
          1;
        curve.getPointAt(along, resources.matrix.position);
        curve.getTangentAt(along, resources.tangent);
        resources.matrix.quaternion.setFromUnitVectors(
          resources.up,
          resources.tangent,
        );
        resources.matrix.scale.setScalar(1);
        resources.matrix.updateMatrix();
        arrows.current.setMatrixAt(index, resources.matrix.matrix);
      }
      arrows.current.instanceMatrix.needsUpdate = true;
    }
  }, -1.9);

  return (
    <group ref={root} dispose={null}>
      {(Object.keys(resources.merged) as MaterialName[]).map((name) => (
        <mesh
          key={name}
          geometry={resources.merged[name]}
          material={resources.materials[name]}
          castShadow={!name.toLowerCase().includes("blue") && name !== "flow"}
          receiveShadow
        />
      ))}
      {(Object.keys(resources.placements) as BatchName[]).map((name) => (
        <instancedMesh
          key={name}
          ref={(mesh) => {
            if (mesh) instances.current[name] = mesh;
          }}
          args={[
            resources.batchGeometries[name],
            resources.materials[resources.batchMaterials[name]],
            resources.placements[name].length,
          ]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
      ))}
      <instancedMesh
        ref={arrows}
        args={[resources.arrow, resources.materials.flow, 20]}
        frustumCulled={false}
      />
      <mesh
        geometry={resources.plane}
        material={resources.steamMaterial}
        position={[8, 3.4, 0.65]}
      />
    </group>
  );
}
