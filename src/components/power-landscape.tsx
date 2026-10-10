"use client";

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
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedBufferAttribute,
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
import { CITY_BUILDINGS } from "@/lib/power";
import { useLanguage } from "./language-provider";

type Placement = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  start?: number;
};
type BatchName =
  | "rocks"
  | "pines"
  | "trunks"
  | "shrubs"
  | "paving"
  | "curbs"
  | "steel"
  | "columns"
  | "rails"
  | "rims"
  | "cityTrim"
  | "cityMetal"
  | "cityGlass"
  | "lights"
  | "lightPools";

const PLANT_OUTLINE = [
  [-8.85, -3.5],
  [-6.9, -3.85],
  [-3.5, -3.55],
  [0.5, -3.65],
  [2.85, -2.9],
  [3.0, 0.55],
  [2.35, 1.5],
  [2.6, 2.6],
  [0.4, 3.7],
  [-0.75, 3.45],
  [-3.65, 3.2],
  [-6.5, 2.68],
  [-8.95, 2.9],
] as const;
const CITY_OUTLINE = [
  [2.5, -0.9],
  [7.8, -1.15],
  [14.4, -0.85],
  [15.05, -0.15],
  [15.0, 9.6],
  [14.2, 10.35],
  [6.6, 10.35],
  [2.45, 10.25],
  [2.2, 8.65],
  [2.35, 6.7],
  [2.4, 4.95],
  [2.35, 3.15],
  [2.95, 2.15],
] as const;
const BANK_OUTLINE = [
  [-9.1, 4.35],
  [-6.8, 4.45],
  [-4.45, 4.7],
  [-2.6, 5.3],
  [-0.7, 5.6],
  [0.95, 6.2],
  [1.4, 7.45],
  [1.25, 8.9],
  [1.2, 10.3],
  [-1.3, 9.8],
  [-3.8, 8.0],
  [-6.5, 6.5],
  [-8.8, 6.0],
] as const;

export function PowerLandscape({
  time,
  playing,
  reducedMotion,
  visible,
}: {
  time: RefObject<number>;
  playing: boolean;
  reducedMotion: boolean;
  visible: boolean;
}) {
  const { language } = useLanguage();
  const root = useRef<Group>(null);
  const city = useRef<Group>(null);
  const batches = useRef<Partial<Record<BatchName, InstancedMesh>>>({});
  const clock = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const signTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#203746";
    context.fillRect(0, 0, 256, 64);
    context.fillStyle = "#cde9f2";
    context.font = "500 38px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(language === "tr" ? "HASTANE" : "HOSPITAL", 128, 33);
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearMipmapLinearFilter;
    return texture;
  }, [language]);
  const resources = useMemo(() => {
    const hash = (value: number) => {
      const n = Math.sin(value * 127.1 + 83.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const inside = (
      x: number,
      z: number,
      polygon: readonly (readonly [number, number])[],
    ) => {
      let hit = false;
      for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
        const [ax, az] = polygon[a];
        const [bx, bz] = polygon[b];
        if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
          hit = !hit;
      }
      return hit;
    };
    const room = (x: number, z: number) =>
      x > -3.48 && x < 0.3 && z > 0.8 && z < 3.35;
    const textureData = new Uint8Array(128 * 128 * 4);
    for (let index = 0; index < 128 * 128; index++) {
      const value = 211 + hash(index) * 29;
      textureData.set([value, value, value, 255], index * 4);
    }
    const texture = new DataTexture(textureData, 128, 128, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    const materials = {
      earth: new MeshStandardMaterial({
        color: "#263844",
        roughness: 0.95,
        metalness: 0.06,
        map: texture,
        bumpMap: texture,
        bumpScale: 0.015,
        transparent: true,
      }),
      rock: new MeshStandardMaterial({
        color: "white",
        roughness: 0.93,
        metalness: 0.06,
        flatShading: true,
        transparent: true,
      }),
      foliage: new MeshStandardMaterial({
        color: "white",
        roughness: 1,
        metalness: 0,
        flatShading: true,
        transparent: true,
      }),
      trunk: new MeshStandardMaterial({
        color: "#2d322c",
        roughness: 1,
        transparent: true,
      }),
      paving: new MeshStandardMaterial({
        color: "white",
        roughness: 0.88,
        metalness: 0.12,
        map: texture,
        transparent: true,
      }),
      concrete: new MeshStandardMaterial({
        color: "#61717a",
        roughness: 0.85,
        metalness: 0.1,
        transparent: true,
      }),
      steel: new MeshStandardMaterial({
        color: "#586c7a",
        roughness: 0.47,
        metalness: 0.67,
        side: DoubleSide,
        transparent: true,
      }),
      dark: new MeshStandardMaterial({
        color: "#263842",
        roughness: 0.6,
        metalness: 0.65,
        transparent: true,
      }),
      rail: new MeshStandardMaterial({
        color: "#627a82",
        roughness: 0.44,
        metalness: 0.66,
        transparent: true,
      }),
      facade: new MeshStandardMaterial({
        color: "white",
        roughness: 0.76,
        metalness: 0.17,
        transparent: true,
      }),
      glass: new MeshStandardMaterial({
        color: "#1b3947",
        roughness: 0.33,
        metalness: 0.48,
        transparent: true,
      }),
    };
    const box = new BoxGeometry(1, 1, 1);
    const cylinder = new CylinderGeometry(1, 1, 1, 10);
    const rock = new DodecahedronGeometry(1, 0);
    const rockPosition = rock.getAttribute("position");
    for (let index = 0; index < rockPosition.count; index++) {
      const x = rockPosition.getX(index),
        y = rockPosition.getY(index),
        z = rockPosition.getZ(index);
      const variation = 0.86 + hash(x * 14.7 + y * 51.3 + z * 83.2) * 0.25;
      rockPosition.setXYZ(index, x * variation, y * variation, z * variation);
    }
    rock.computeVertexNormals();
    const canopyParts: BufferGeometry[] = [];
    for (let tier = 0; tier < 7; tier++) {
      const radius = 0.36 * (1 - tier * 0.115);
      const layer = new ConeGeometry(radius, 0.44 - tier * 0.031, 9, 1);
      const attribute = layer.getAttribute("position");
      for (let index = 0; index < attribute.count; index++) {
        const x = attribute.getX(index),
          z = attribute.getZ(index);
        const irregularity = 0.83 + hash(x * 73 + z * 19 + tier * 2.1) * 0.3;
        attribute.setXYZ(
          index,
          x * irregularity,
          attribute.getY(index),
          z * irregularity,
        );
      }
      layer.rotateY(tier * 1.7);
      layer.translate(0, 0.35 + tier * 0.15, 0);
      layer.computeVertexNormals();
      canopyParts.push(layer);
    }
    const canopy = mergeGeometries(canopyParts, false)!;
    canopyParts.forEach((part) => part.dispose());
    const geometry = {
      rocks: rock,
      pines: canopy,
      trunks: cylinder,
      shrubs: new DodecahedronGeometry(1, 1),
      paving: box,
      curbs: box,
      steel: box,
      columns: cylinder,
      rails: cylinder,
      rims: new TorusGeometry(0.735, 0.033, 8, 40),
      cityTrim: box,
      cityMetal: box,
      cityGlass: box,
      lights: new SphereGeometry(1, 8, 6),
      lightPools: new PlaneGeometry(1, 1),
    };
    const placement: Record<BatchName, Placement[]> = {
      rocks: [],
      pines: [],
      trunks: [],
      shrubs: [],
      paving: [],
      curbs: [],
      steel: [],
      columns: [],
      rails: [],
      rims: [],
      cityTrim: [],
      cityMetal: [],
      cityGlass: [],
      lights: [],
      lightPools: [],
    };
    const matrix = new Object3D();
    const up = new Vector3(0, 1, 0);
    const add = (
      name: BatchName,
      position: [number, number, number],
      scale: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
      color?: string,
      start?: number,
    ) => placement[name].push({ position, scale, rotation, color, start });
    const connect = (
      name: "rails" | "columns",
      from: [number, number, number],
      to: [number, number, number],
      radius: number,
    ) => {
      const a = new Vector3(...from);
      const direction = new Vector3(...to).sub(a);
      matrix.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      add(
        name,
        a.addScaledVector(direction, 0.5).toArray(),
        [radius, direction.length(), radius],
        [matrix.rotation.x, matrix.rotation.y, matrix.rotation.z],
      );
    };
    const lands = [PLANT_OUTLINE, CITY_OUTLINE, BANK_OUTLINE].map((outline) => {
      const shape = new Shape();
      outline.forEach(([x, z], index) =>
        index === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z),
      );
      shape.closePath();
      const slab = new ExtrudeGeometry(shape, {
        depth: 1.48,
        bevelEnabled: true,
        bevelSize: 0.08,
        bevelThickness: 0.08,
        bevelSegments: 1,
        steps: 1,
        curveSegments: 1,
      });
      slab.rotateX(Math.PI / 2);
      slab.translate(0, -1.59, 0);
      return slab;
    });
    const housingParts: BufferGeometry[] = [];
    const housingPart = (geometry: BufferGeometry) => {
      housingParts.push(
        geometry.index ? geometry.toNonIndexed() : geometry.clone(),
      );
      geometry.dispose();
    };
    const housingRadius = 1.72;
    const housingShape = new Shape();
    housingShape.moveTo(-housingRadius, -1.5);
    housingShape.lineTo(-housingRadius, 1.66);
    for (let index = 0; index <= 32; index++) {
      const angle = Math.PI - (index / 32) * Math.PI;
      housingShape.lineTo(
        Math.cos(angle) * housingRadius,
        1.66 + Math.sin(angle) * housingRadius,
      );
    }
    housingShape.lineTo(housingRadius, -1.5);
    housingShape.lineTo(housingRadius - 0.15, -1.5);
    housingShape.lineTo(housingRadius - 0.15, 1.66);
    for (let index = 0; index <= 32; index++) {
      const angle = (index / 32) * Math.PI;
      housingShape.lineTo(
        Math.cos(angle) * (housingRadius - 0.15),
        1.66 + Math.sin(angle) * (housingRadius - 0.15),
      );
    }
    housingShape.lineTo(-housingRadius + 0.15, -1.5);
    housingShape.closePath();
    const housingArch = new ExtrudeGeometry(housingShape, {
      depth: 0.16,
      bevelEnabled: false,
      steps: 1,
    });
    housingArch.translate(-6.6, 0, -1.04);
    housingPart(housingArch);
    for (const radius of [housingRadius, housingRadius - 0.15]) {
      const wall = new CylinderGeometry(
        radius,
        radius,
        3.16,
        40,
        1,
        true,
        Math.PI / 2,
        Math.PI,
      );
      wall.translate(-6.6, 0.08, -1);
      housingPart(wall);
      const dome = new SphereGeometry(
        radius,
        40,
        20,
        Math.PI,
        Math.PI,
        0,
        Math.PI / 2,
      );
      dome.translate(-6.6, 1.66, -1);
      housingPart(dome);
    }
    for (let section = 0; section <= 6; section++) {
      const angle = Math.PI + (section / 6) * Math.PI;
      const points: Vector3[] = [];
      for (let index = 0; index <= 20; index++) {
        const theta = ((index / 20) * Math.PI) / 2;
        points.push(
          new Vector3(
            -6.6 - Math.cos(angle) * Math.sin(theta) * 1.736,
            1.66 + Math.cos(theta) * 1.736,
            -1 + Math.sin(angle) * Math.sin(theta) * 1.736,
          ),
        );
      }
      housingPart(
        new TubeGeometry(new CatmullRomCurve3(points), 20, 0.012, 5, false),
      );
      const end = points[points.length - 1];
      connect("rails", [end.x, -1.4, end.z], end.toArray(), 0.02);
    }
    const housing = mergeGeometries(housingParts, false)!;
    housingParts.forEach((geometry) => geometry.dispose());
    const rocks = ["#2c4251", "#3d5360", "#334754", "#243947", "#4a5b63"];
    for (const [island, outline] of [
      PLANT_OUTLINE,
      CITY_OUTLINE,
      BANK_OUTLINE,
    ].entries()) {
      for (let side = 0; side < outline.length; side++) {
        const a = outline[side],
          b = outline[(side + 1) % outline.length];
        const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const count = Math.ceil(distance / 0.46);
        for (let index = 0; index <= count; index++) {
          const seed = island * 491 + side * 37 + index * 7;
          const t = index / count;
          const x = MathUtils.lerp(a[0], b[0], t),
            z = MathUtils.lerp(a[1], b[1], t);
          const size = 0.27 + hash(seed) * 0.24;
          add(
            "rocks",
            [x, -2.38 - hash(seed + 1) * 0.14, z],
            [size * 1.3, 0.68 + hash(seed + 2) * 0.28, size],
            [hash(seed + 3) * 0.5, hash(seed + 4) * 6.28, hash(seed + 5) * 0.4],
            rocks[seed % rocks.length],
          );
          if (index % 3 === 0)
            add(
              "rocks",
              [x + 0.12, -2.92, z + 0.15],
              [size * 0.72, size * 0.64, size * 0.9],
              [0.3, hash(seed) * 6.28, 0.2],
              rocks[(seed + 1) % rocks.length],
            );
        }
      }
    }
    const pines = ["#17332c", "#203d30", "#1b382f", "#2b4233", "#213d34"];
    const buildingNear = (x: number, z: number, margin = 0.12) =>
      CITY_BUILDINGS.some(
        (building) =>
          Math.abs(x - building.x) < building.width / 2 + margin &&
          Math.abs(z - building.z) < building.depth / 2 + margin,
      );
    const tree = (x: number, z: number, height: number, seed: number) => {
      if (room(x, z)) return;
      if (
        inside(x, z, CITY_OUTLINE) &&
        (buildingNear(x, z, height * 0.23 + 0.1) ||
          Math.abs(z - 4.3) < 0.38 ||
          Math.abs(z - 7.25) < 0.4 ||
          Math.abs(x - 5.85) < 0.35 ||
          Math.abs(x - 8) < 0.35 ||
          Math.abs(x - 11.65) < 0.37)
      )
        return;
      add(
        "pines",
        [x, -1.51, z],
        [height * 0.82, height, height * 0.82],
        [0, hash(seed) * 6.28, 0],
        pines[seed % pines.length],
      );
      add(
        "trunks",
        [x, -1.51 + height * 0.28, z],
        [height * 0.032, height * 0.56, height * 0.032],
      );
      add(
        "paving",
        [x, -1.498, z],
        [0.48 * height, 0.016, 0.49 * height],
        [0, hash(seed + 3) * 0.4, 0],
        "#223f34",
      );
      if (seed % 3 === 0)
        add(
          "shrubs",
          [x + height * 0.24, -1.42, z + height * 0.1],
          [0.14, 0.12, 0.17],
          [0, seed, 0],
          pines[(seed + 2) % pines.length],
        );
    };
    for (let index = 0; index < 240; index++) {
      const x = -8.65 + hash(index * 13 + 1) * 23.4;
      const z = -3.55 + hash(index * 13 + 2) * 13.7;
      const bank = inside(x, z, BANK_OUTLINE);
      const plant = inside(x, z, PLANT_OUTLINE);
      const city = inside(x, z, CITY_OUTLINE);
      const perimeter =
        plant && (z < -2.75 || x < -8.0 || (z > 1.85 && x < -3.6));
      const cityEdge = city && (z > 9.65 || x > 14.35 || (z < 0.1 && x > 7.25));
      if (bank || perimeter || cityEdge)
        tree(x, z, 0.53 + hash(index * 7 + 4) * 0.76, index);
    }
    for (let index = 0; index < 34; index++) {
      const x = -8.4 + index * 0.55;
      const z = -3.04 + Math.sin(index * 2.4) * 0.25;
      if (inside(x, z, PLANT_OUTLINE))
        tree(x, z, 0.62 + hash(index + 74) * 0.48, index + 200);
    }
    for (let index = 0; index < 34; index++) {
      const x = 2.65 + index * 0.36;
      const z = 9.92 + Math.sin(index * 2.4) * 0.17;
      if (inside(x, z, CITY_OUTLINE))
        tree(x, z, 0.42 + hash(index + 304) * 0.6, index + 300);
    }
    for (let index = 0; index < 21; index++) {
      const x = 14.62 + Math.sin(index * 1.8) * 0.12;
      const z = -0.2 + index * 0.47;
      if (inside(x, z, CITY_OUTLINE))
        tree(x, z, 0.56 + hash(index + 420) * 0.54, index + 420);
    }
    for (const [index, point] of [
      [4.25, 9.35],
      [6.8, 9.55],
      [9.55, 9.45],
      [12.8, 9.5],
      [13.6, 6.25],
      [4.2, 1.9],
      [7.25, 0.55],
    ].entries()) {
      for (let plant = 0; plant < 3; plant++) {
        const x = point[0] + (plant - 1) * 0.28;
        const z = point[1] + Math.sin(plant * 2.4) * 0.18;
        if (!buildingNear(x, z, 0.22))
          tree(
            x,
            z,
            0.4 + hash(index * 3 + plant + 540) * 0.24,
            index * 3 + plant + 540,
          );
      }
    }
    for (let x = -8.5; x < 3.2; x += 0.55) {
      for (let z = -3.2; z < 3.5; z += 0.55) {
        if (!inside(x, z, PLANT_OUTLINE) || room(x, z)) continue;
        if (z > -2.15 && z < 0.22 && x < 3.3 && x > -7.6) continue;
        if (z > 1.1 && x < -4.1) continue;
        const shade = hash(x * 15 + z * 43) > 0.5 ? "#43535d" : "#394a55";
        add("paving", [x, -1.487, z], [0.53, 0.026, 0.53], [0, 0, 0], shade);
      }
    }
    for (const [x, z, width, depth] of [
      [-6.6, -1, 3.6, 3.5],
      [-3.4, -1, 2.2, 2.3],
      [-0.7, -1, 2.85, 1.9],
      [2.2, -1, 2.4, 1.65],
    ]) {
      add("curbs", [x, -1.425, z], [width, 0.15, depth]);
      for (const side of [-1, 1])
        add(
          "steel",
          [x + side * (width * 0.5 - 0.06), -1.335, z],
          [0.065, 0.035, depth],
        );
    }
    for (const [x, z, width, height, depth] of [
      [-7.55, 0.6, 0.65, 0.9, 0.58],
      [-4.9, -2.5, 0.75, 0.65, 0.62],
      [2.5, 0.2, 0.74, 0.6, 0.52],
      [3.45, -1.8, 0.62, 0.86, 0.65],
    ]) {
      add("steel", [x, -1.5 + height / 2, z], [width, height, depth]);
      add("curbs", [x, -1.425, z], [width + 0.13, 0.15, depth + 0.13]);
      add("steel", [x, -1.48 + height, z], [width + 0.09, 0.07, depth + 0.09]);
      for (let fin = 0; fin < 6; fin++)
        add(
          "rails",
          [
            x - width * 0.37 + fin * width * 0.145,
            -1.5 + height * 0.55,
            z + depth / 2 + 0.018,
          ],
          [0.015, height * 0.55, 0.015],
        );
      add("columns", [x, -1.48 + height + 0.12, z], [0.12, 0.18, 0.12]);
      add("steel", [x, -1.48 + height + 0.23, z], [0.32, 0.04, 0.32]);
    }
    for (const x of [-1.93, 0.53]) {
      add("steel", [x, -0.02, -1.95], [0.12, 2.94, 0.16]);
      add("curbs", [x, -1.41, -1.95], [0.38, 0.18, 0.39]);
    }
    add("steel", [-0.7, 1.48, -1.95], [2.76, 0.19, 0.5]);
    add("steel", [-0.7, 1.61, -1.95], [2.92, 0.075, 0.68]);
    for (const x of [1.23, 3.16])
      add("rims", [x, 0, -1], [1, 1, 1], [0, Math.PI / 2, 0]);
    for (let index = 0; index < 15; index++) {
      const angle = (Math.PI * index) / 14;
      add(
        "steel",
        [2.2, -Math.sin(angle) * 0.716, -1 + Math.cos(angle) * 0.716],
        [1.63, 0.028, 0.05],
        [Math.PI / 2 - angle, 0, 0],
      );
    }
    for (const x of [1.45, 2.95]) {
      add("curbs", [x, -0.96, -1], [0.25, 0.74, 1.6]);
      for (const z of [-1.7, -0.3])
        add("columns", [x, -1.285, z], [0.046, 0.13, 0.046]);
    }
    const bridgeA = new Vector3(0.25, -1.43, 3.45);
    const bridgeB = new Vector3(3.0, -1.43, 4.3);
    const bridgeDirection = bridgeB.clone().sub(bridgeA);
    const bridgeLength = bridgeDirection.length();
    const bridgeAngle = -Math.atan2(bridgeDirection.z, bridgeDirection.x);
    const bridgeNormal = new Vector3(
      -bridgeDirection.z,
      0,
      bridgeDirection.x,
    ).normalize();
    add(
      "curbs",
      bridgeA.clone().lerp(bridgeB, 0.5).toArray(),
      [bridgeLength + 0.25, 0.2, 0.83],
      [0, bridgeAngle, 0],
    );
    add(
      "paving",
      bridgeA
        .clone()
        .lerp(bridgeB, 0.5)
        .add(new Vector3(0, 0.105, 0))
        .toArray(),
      [bridgeLength + 0.22, 0.025, 0.67],
      [0, bridgeAngle, 0],
      "#485e69",
    );
    for (const side of [-1, 1]) {
      const a = bridgeA.clone().addScaledVector(bridgeNormal, side * 0.37);
      const b = bridgeB.clone().addScaledVector(bridgeNormal, side * 0.37);
      connect(
        "rails",
        a
          .clone()
          .add(new Vector3(0, 0.47, 0))
          .toArray(),
        b
          .clone()
          .add(new Vector3(0, 0.47, 0))
          .toArray(),
        0.017,
      );
      connect(
        "rails",
        a
          .clone()
          .add(new Vector3(0, 0.27, 0))
          .toArray(),
        b
          .clone()
          .add(new Vector3(0, 0.27, 0))
          .toArray(),
        0.012,
      );
      for (let index = 0; index <= 9; index++) {
        const point = a.clone().lerp(b, index / 9);
        connect(
          "rails",
          point.toArray(),
          point
            .clone()
            .add(new Vector3(0, 0.49, 0))
            .toArray(),
          0.016,
        );
      }
    }
    for (const fraction of [0.12, 0.5, 0.88]) {
      const point = bridgeA.clone().lerp(bridgeB, fraction);
      add(
        "curbs",
        [point.x, -2.04, point.z],
        [0.2, 1.14, 0.65],
        [0, bridgeAngle, 0],
      );
    }
    const lamp = (
      x: number,
      z: number,
      start: number,
      height = 0.72,
      pool = 1.1,
    ) => {
      if (room(x, z)) return;
      const inCity = inside(x, z, CITY_OUTLINE);
      if (inCity && buildingNear(x, z, 0.06)) return;
      const ignition = Math.min(start, 19.1);
      add("columns", [x, -1.5 + height / 2, z], [0.014, height, 0.014]);
      add("curbs", [x, -1.475, z], [0.095, 0.06, 0.095]);
      add("steel", [x, -1.5 + height, z], [0.12, 0.035, 0.12]);
      add(
        "lights",
        [x, -1.48 + height, z],
        [0.059, 0.033, 0.059],
        [0, 0, 0],
        undefined,
        ignition,
      );
      add(
        "lightPools",
        [x, inCity ? -1.421 : -1.462, z],
        [pool, pool, pool],
        [-Math.PI / 2, 0, 0],
        undefined,
        ignition,
      );
    };
    for (const [index, point] of [
      [-7.9, 1.6],
      [-6.1, 1.45],
      [-4.05, 1.45],
      [-3.65, 3.0],
      [0.4, 2.5],
      [1.9, 1.0],
      [3.35, 0.15],
      [-7.7, -2.45],
      [-4.8, -2.72],
      [-1.1, -2.9],
      [1.6, -2.6],
      [-8.2, 4.92],
      [-5.75, 5.35],
      [-3.1, 5.86],
      [-0.5, 6.7],
    ].entries())
      lamp(point[0], point[1], 1.0 + index * 0.055);
    for (let index = 0; index < 5; index++) {
      const point = bridgeA
        .clone()
        .lerp(bridgeB, index / 4)
        .addScaledVector(bridgeNormal, -0.4);
      lamp(point.x, point.z, 8.8 + index * 0.18, 0.6);
    }
    for (const [index, point] of [
      [2.8, 6.8],
      [4.5, 6.9],
      [7.3, 6.85],
      [9.3, 6.9],
      [11.2, 5.9],
      [11.2, 3.15],
      [10.65, 0.3],
      [7.9, -0.25],
    ].entries())
      lamp(point[0], point[1], 15.3 + index * 0.28);
    for (let index = 0; index < 11; index++) {
      const x = 3.05 + index * 1.06;
      for (const side of [-1, 1])
        lamp(
          x,
          7.25 + side * 0.42,
          16.2 + index * 0.21 + (side + 1) * 0.07,
          0.83,
          1.5,
        );
    }
    for (let index = 0; index < 10; index++) {
      const z = 0.25 + index * 0.98;
      for (const side of [-1, 1])
        lamp(
          11.65 + side * 0.42,
          z,
          17.05 + index * 0.2 + (side + 1) * 0.08,
          0.88,
          1.55,
        );
    }
    for (let index = 0; index < 12; index++)
      lamp(3.0 + index * 1.0, 9.55, 17.4 + index * 0.15, 0.66, 1.25);
    for (let x = 2.8; x < 14.25; x += 0.48) {
      for (const side of [-1, 1]) {
        const z = 7.25 + side * 0.39;
        if (!buildingNear(x, z, 0.1))
          add(
            "cityTrim",
            [x, -1.455, z],
            [0.46, 0.055, 0.18],
            [0, 0, 0],
            "#586770",
          );
      }
    }
    for (let z = -0.15; z < 9.65; z += 0.48) {
      for (const side of [-1, 1]) {
        const x = 11.65 + side * 0.39;
        if (!buildingNear(x, z, 0.1))
          add(
            "cityTrim",
            [x, -1.455, z],
            [0.18, 0.055, 0.46],
            [0, 0, 0],
            "#586770",
          );
      }
    }
    for (const junction of [5.85, 8.0, 11.65]) {
      for (let stripe = 0; stripe < 5; stripe++)
        add(
          "cityTrim",
          [junction - 0.74 + stripe * 0.105, -1.439, 7.25],
          [0.055, 0.007, 0.52],
          [0, 0, 0],
          "#9fa799",
        );
    }
    for (const junction of [4.3, 7.25]) {
      for (let stripe = 0; stripe < 5; stripe++)
        add(
          "cityTrim",
          [11.65, -1.439, junction - 0.74 + stripe * 0.105],
          [0.5, 0.007, 0.055],
          [0, 0, 0],
          "#9fa799",
        );
    }
    CITY_BUILDINGS.forEach(({ x, z, width, depth, height, kind }, index) => {
      const top = -1.45 + height;
      const color = ["#8f9b9d", "#7a8e99", "#a0a6a1"][index % 3];
      add(
        "cityTrim",
        [x, -1.44, z + depth / 2 + 0.15],
        [width * 0.84, 0.075, 0.34],
        [0, 0, 0],
        color,
      );
      add(
        "cityGlass",
        [x, -1.27, z + depth / 2 + 0.018],
        [Math.min(0.3, width * 0.27), 0.35, 0.028],
      );
      add(
        "cityMetal",
        [x, -1.06, z + depth / 2 + 0.15],
        [Math.min(0.56, width * 0.5), 0.04, 0.32],
      );
      if (kind === "home") {
        add(
          "cityTrim",
          [x - width * 0.21, top + 0.26, z - depth * 0.2],
          [0.11, 0.27, 0.13],
          [0, 0, 0],
          "#596c76",
        );
        add(
          "cityMetal",
          [x - width * 0.21, top + 0.41, z - depth * 0.2],
          [0.15, 0.035, 0.17],
        );
        for (const side of [-1, 1])
          add(
            "cityTrim",
            [x + side * width * 0.18, -1.26, z + depth / 2 + 0.21],
            [0.027, 0.38, 0.027],
            [0, 0, 0],
            color,
          );
        return;
      }
      for (const side of [-1, 1]) {
        add(
          "cityTrim",
          [x, top + 0.135, z + side * (depth / 2 - 0.032)],
          [width, 0.18, 0.06],
          [0, 0, 0],
          color,
        );
        add(
          "cityTrim",
          [x + side * (width / 2 - 0.032), top + 0.135, z],
          [0.06, 0.18, depth],
          [0, 0, 0],
          color,
        );
        add(
          "cityTrim",
          [
            x + side * (width / 2 + 0.008),
            -1.45 + height / 2,
            z + depth / 2 + 0.013,
          ],
          [0.035, height, 0.04],
          [0, 0, 0],
          color,
        );
      }
      for (let floor = 1; floor < Math.floor(height / 0.34); floor++) {
        const y = -1.35 + floor * 0.34;
        add(
          "cityTrim",
          [x, y, z + depth / 2 + 0.014],
          [width + 0.025, 0.014, 0.032],
          [0, 0, 0],
          "#354853",
        );
        add(
          "cityTrim",
          [x + width / 2 + 0.014, y, z],
          [0.032, 0.014, depth],
          [0, 0, 0],
          "#354853",
        );
      }
      const units = width > 1.4 ? 2 : 1;
      for (let unit = 0; unit < units; unit++) {
        const unitX = x - width * 0.19 + unit * 0.42;
        const unitZ = z - depth * 0.16;
        add("cityMetal", [unitX, top + 0.17, unitZ], [0.28, 0.2, 0.32]);
        for (let vent = 0; vent < 5; vent++)
          add(
            "cityTrim",
            [unitX - 0.11 + vent * 0.055, top + 0.278, unitZ],
            [0.017, 0.012, 0.27],
            [0, 0, 0],
            "#9da8aa",
          );
      }
      if (kind === "tower")
        add(
          "cityMetal",
          [x + width * 0.27, top + 0.3, z - depth * 0.22],
          [0.014, 0.49, 0.014],
        );
    });
    const signGeometry = new PlaneGeometry(0.95, 0.22);
    const signMaterial = new MeshBasicMaterial({
      color: "#a3c9da",
      transparent: true,
      toneMapped: false,
    });
    const riverCenters = [
      [-9.15, 3.55],
      [-7.0, 3.55],
      [-4.5, 3.93],
      [-2.2, 4.36],
      [0.2, 4.65],
      [1.4, 5.4],
      [1.72, 6.6],
      [1.68, 7.7],
      [1.7, 9.0],
      [1.7, 10.5],
    ];
    const riverPosition: number[] = [],
      riverUv: number[] = [],
      riverIndex: number[] = [];
    for (let index = 0; index < riverCenters.length; index++) {
      const [x, z] = riverCenters[index];
      const previous = riverCenters[Math.max(0, index - 1)],
        next = riverCenters[Math.min(riverCenters.length - 1, index + 1)];
      const dx = next[0] - previous[0],
        dz = next[1] - previous[1],
        distance = Math.hypot(dx, dz);
      const halfWidth = index > 4 ? 0.56 : 0.61;
      for (const side of [-1, 1]) {
        riverPosition.push(
          x - (dz / distance) * halfWidth * side,
          -2.22,
          z + (dx / distance) * halfWidth * side,
        );
        riverUv.push(index / (riverCenters.length - 1), (side + 1) / 2);
      }
      if (index < riverCenters.length - 1) {
        const a = index * 2;
        riverIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const waterGeometry = new BufferGeometry();
    waterGeometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(riverPosition), 3),
    );
    waterGeometry.setAttribute(
      "uv",
      new BufferAttribute(new Float32Array(riverUv), 2),
    );
    waterGeometry.setIndex(riverIndex);
    waterGeometry.computeVertexNormals();
    const water = new ShaderMaterial({
      transparent: true,
      uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uReveal;
        void main(){
          float wave=sin(vUv.x*285.+sin(vUv.y*26.+uTime*.13)*2.5-uTime*.3);
          float ripple=pow(max(0.,wave),24.);
          float cross=sin(vUv.y*71.+sin(vUv.x*90.-uTime*.2)*1.7);
          float edge=smoothstep(.02,.2,vUv.y)*(1.-smoothstep(.8,.98,vUv.y));
          vec3 color=mix(vec3(.024,.067,.1),vec3(.035,.14,.205),edge);
          color+=vec3(.095,.175,.22)*ripple*(.28+.72*pow(max(0.,cross),5.));
          float reflection=exp(-pow((vUv.x-.15)*45.,2.))+exp(-pow((vUv.x-.43)*48.,2.))+exp(-pow((vUv.x-.69)*38.,2.));
          color+=vec3(.74,.43,.16)*reflection*ripple*.55;
          gl_FragColor=vec4(color,uReveal*.98);
        }`,
    });
    const lampMaterial = new ShaderMaterial({
      transparent: true,
      toneMapped: false,
      uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
      vertexShader: `attribute float aStart; varying float vLight; uniform float uTime; void main(){vLight=smoothstep(aStart,aStart+.65,uTime); gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float vLight; uniform float uReveal; void main(){gl_FragColor=vec4(vec3(1.,.74,.4)*(.12+vLight*.88),uReveal);}`,
    });
    const poolMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: lampMaterial.uniforms,
      vertexShader: `attribute float aStart; varying float vLight; varying vec2 vUv; uniform float uTime; void main(){vUv=uv;vLight=smoothstep(aStart,aStart+.65,uTime);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float vLight;varying vec2 vUv;uniform float uReveal;void main(){float falloff=pow(max(0.,1.-length(vUv-.5)*2.),2.);gl_FragColor=vec4(.98,.62,.27,falloff*vLight*uReveal*.47);}`,
    });
    for (const name of ["lights", "lightPools"] as const)
      geometry[name].setAttribute(
        "aStart",
        new InstancedBufferAttribute(
          new Float32Array(placement[name].map((item) => item.start ?? 0)),
          1,
        ),
      );
    const batchMaterials = {
      rocks: materials.rock,
      pines: materials.foliage,
      trunks: materials.trunk,
      shrubs: materials.foliage,
      paving: materials.paving,
      curbs: materials.concrete,
      steel: materials.steel,
      columns: materials.dark,
      rails: materials.rail,
      rims: materials.steel,
      cityTrim: materials.facade,
      cityMetal: materials.steel,
      cityGlass: materials.glass,
      lights: lampMaterial,
      lightPools: poolMaterial,
    };
    return {
      geometry,
      placement,
      materials,
      materialList: Object.values(materials),
      batchMaterials,
      lands,
      housing,
      waterGeometry,
      water,
      signGeometry,
      signMaterial,
      lampMaterial,
      poolMaterial,
      texture,
      matrix,
      color: new Color(),
    };
  }, []);

  useLayoutEffect(() => {
    resources.signMaterial.map = signTexture;
    resources.signMaterial.needsUpdate = true;
    invalidate();
  }, [signTexture, resources, invalidate]);
  useEffect(() => () => signTexture.dispose(), [signTexture]);

  useLayoutEffect(() => {
    for (const name of Object.keys(resources.placement) as BatchName[]) {
      const mesh = batches.current[name];
      if (!mesh) continue;
      resources.placement[name].forEach((item, index) => {
        resources.matrix.position.fromArray(item.position);
        resources.matrix.rotation.set(...item.rotation);
        resources.matrix.scale.fromArray(item.scale);
        resources.matrix.updateMatrix();
        mesh.setMatrixAt(index, resources.matrix.matrix);
        if (item.color) mesh.setColorAt(index, resources.color.set(item.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const meshes = Object.values(batches.current);
    invalidate();
    return () => meshes.forEach((mesh) => mesh?.dispose());
  }, [resources, invalidate]);

  useEffect(() => {
    invalidate();
  }, [visible, playing, reducedMotion, invalidate]);
  useEffect(
    () => () => {
      const unique = new Set(Object.values(resources.geometry));
      unique.forEach((geometry) => geometry.dispose());
      resources.lands.forEach((geometry) => geometry.dispose());
      resources.housing.dispose();
      resources.waterGeometry.dispose();
      resources.signGeometry.dispose();
      resources.signMaterial.dispose();
      resources.materialList.forEach((material) => material.dispose());
      resources.water.dispose();
      resources.lampMaterial.dispose();
      resources.poolMaterial.dispose();
      resources.texture.dispose();
    },
    [resources],
  );

  useFrame((_, delta) => {
    const reveal = MathUtils.smootherstep(time.current, 0.7, 2.5);
    if (root.current) root.current.visible = visible && reveal > 0.001;
    if (!visible || reveal <= 0.001) return;
    if (playing && !reducedMotion) clock.current += Math.min(delta, 0.05);
    for (const material of resources.materialList) {
      material.opacity = reveal;
      material.depthWrite = reveal > 0.99;
    }
    resources.water.uniforms.uReveal.value = reveal;
    resources.water.uniforms.uTime.value = reducedMotion ? 0 : clock.current;
    resources.lampMaterial.uniforms.uReveal.value = reveal;
    resources.lampMaterial.uniforms.uTime.value = time.current;
    const cityReveal = MathUtils.smoothstep(time.current, 8.5, 11.2);
    if (city.current) {
      city.current.visible = cityReveal > 0;
      city.current.scale.y = 0.04 + cityReveal * 0.96;
      city.current.position.y =
        -1.65 * (1 - city.current.scale.y) - (1 - cityReveal) * 0.7;
    }
    resources.signMaterial.opacity =
      reveal * (0.12 + MathUtils.smoothstep(time.current, 15.9, 16.5) * 0.88);
    if (playing && !reducedMotion) invalidate();
  }, -1.9);

  const renderBatch = (name: BatchName) => (
    <instancedMesh
      key={name}
      ref={(mesh) => {
        if (mesh) batches.current[name] = mesh;
      }}
      args={[
        resources.geometry[name],
        resources.batchMaterials[name],
        resources.placement[name].length,
      ]}
      frustumCulled={false}
      castShadow={name !== "lights" && name !== "lightPools"}
      receiveShadow={name !== "lights" && name !== "lightPools"}
    />
  );

  return (
    <group ref={root} visible={false} dispose={null}>
      {resources.lands.map((geometry, index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={resources.materials.earth}
          castShadow
          receiveShadow
        />
      ))}
      <mesh
        geometry={resources.housing}
        material={resources.materials.steel}
        castShadow
        receiveShadow
      />
      {(Object.keys(resources.placement) as BatchName[])
        .filter((name) => !name.startsWith("city"))
        .map(renderBatch)}
      <group ref={city} visible={false}>
        {(["cityTrim", "cityMetal", "cityGlass"] as const).map(renderBatch)}
        <mesh
          geometry={resources.signGeometry}
          material={resources.signMaterial}
          position={[6.7, -0.43, 5.942]}
        />
      </group>
      <mesh geometry={resources.waterGeometry} material={resources.water} />
    </group>
  );
}
