"use client";

import { CITY_COLORS, POWER_COLORS, SCENE_LIGHTS } from "@/lib/scene-colors";
import { useFrame, useThree } from "@react-three/fiber";
import { journeyTime, type JourneyController } from "./use-journey";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Fog,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import {
  CITY_BUILDINGS,
  CITY_LIGHT_TIMING,
  CITY_PLACES,
  COOLANT_TRANSFER,
  POWER_PART_IDS,
  POWER_PARTS,
} from "@/lib/power";
import { REACTOR_PARTS } from "@/lib/reactor";
import type { PowerController } from "./use-power";
import type { ViewOrientation } from "@/lib/scene";
import { ControlRoom } from "./control-room";
import { PowerLandscape } from "./power-landscape";
import { CitySignature } from "./city-signature";

type Placement = [number, number, number, number, number, number, number?];
type Batch =
  | "buildings"
  | "windows"
  | "roofs"
  | "roads"
  | "marks"
  | "lamps"
  | "bulbs"
  | "beams"
  | "blades"
  | "coils"
  | "steam"
  | "primary"
  | "exchange"
  | "secondary"
  | "electric";

function revealGroup(
  group: Group | null,
  time: number,
  start: number,
  end: number,
  x: number,
  z: number,
) {
  if (!group) return;
  const amount = MathUtils.smoothstep(time, start, end);
  const scale = 0.02 + amount * 0.98;
  group.visible = amount > 0;
  group.scale.setScalar(scale);
  group.position.set(x * (1 - scale), 0, z * (1 - scale));
}

export function PowerScene({
  power,
  playing,
  reducedMotion,
  visible,
  pointer,
  journey,
}: {
  power: PowerController;
  journey: JourneyController;
  playing: boolean;
  reducedMotion: boolean;
  visible: boolean;
  pointer: RefObject<ViewOrientation>;
}) {
  const meshes = useRef<Partial<Record<Batch, InstancedMesh | null>>>({});
  const root = useRef<Group>(null);
  const exchanger = useRef<Group>(null);
  const turbine = useRef<Group>(null);
  const generator = useRef<Group>(null);
  const grid = useRef<Group>(null);
  const city = useRef<Group>(null);
  const rotor = useRef<Group>(null);
  const armature = useRef<Group>(null);
  const cityLight = useRef<PointLight>(null);
  const clock = useRef(0);
  const rotorAngle = useRef(0.3);
  const lastIllumination = useRef(-1);
  const previousSelection = useRef(power.selected);
  const previousPlace = useRef(power.cityPlace);
  const previousRoom = useRef(power.roomOpen);
  const surroundings = useRef<Group>(null);
  const landscapeTime = useRef(0);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const renderer = useThree((state) => state.gl);
  const secondaryWater = useRef<Mesh>(null);
  const shaftMark = useRef<Mesh>(null);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const resources = useMemo(() => {
    const curve = (points: number[][]) =>
      new CatmullRomCurve3(
        points.map(([x, y, z]) => new Vector3(x, y, z)),
        false,
        "centripetal",
      );
    const steam = curve([
      [-3.4, 2.15, -1],
      [-3.4, 2.6, -1],
      [-2.45, 2.6, -1],
      [-2.18, 2.32, -1],
      [-2.18, 0.38, -1],
      [-2.06, 0, -1],
      [-1.75, 0, -1],
    ]);
    const electric = curve([
      [3.05, 0, -1],
      [3.8, -0.65, -1],
      [4.4, 2.65, -1.2],
      [5.1, 2.25, -0.7],
      [5.9, 2.65, -0.2],
      [6.6, 2.25, 0.15],
      [7.3, 2.65, 0.5],
      [7.6, -0.65, 1.1],
      [4.3, -0.65, 2.1],
    ]);
    const distribution = curve([
      [4.3, -0.65, 2.1],
      [5.8, -1.42, 2.1],
      [5.8, -1.42, 4.25],
      [8, -1.42, 4.25],
      [10.8, -1.42, 4.25],
    ]);
    steam.getLengths(200);
    electric.getLengths(200);
    distribution.getLengths(200);
    const coil: Vector3[] = [];
    for (let index = 0; index <= 144; index++) {
      const angle = -Math.PI / 2 + (index / 144) * Math.PI * 9;
      coil.push(
        new Vector3(
          -3.4 + Math.cos(angle) * 0.53,
          1.3 - (index / 144) * 2.1,
          -1 + Math.sin(angle) * 0.53,
        ),
      );
    }
    const primaryHot = curve([
      [-4.92, 0.88, -0.84],
      [-4.6, 0.88, -0.84],
      [-4.35, 1.3, -1.2],
      [-3.9, 1.33, -1.53],
      [-3.4, 1.3, -1.53],
    ]);
    const primaryCoil = new CatmullRomCurve3(coil);
    primaryHot.getLengths(200);
    primaryCoil.getLengths(200);
    const primaryReturn = curve([
      [-3.4, -0.8, -0.47],
      [-3.85, -0.95, -0.47],
      [-4.2, -1.1, 0.7],
      [-6.6, -1.1, 0.7],
      [-6.6, 0.44, 0.68],
    ]);
    const primaryPath = new CatmullRomCurve3([
      ...primaryHot.points.slice(0, -1),
      ...coil,
      ...primaryReturn.points.slice(1),
    ]);
    primaryPath.arcLengthDivisions = 800;
    const primaryCircuit = new TubeGeometry(primaryPath, 320, 0.07, 12, false);
    const length =
      primaryHot.getLength() +
      primaryCoil.getLength() +
      primaryReturn.getLength();
    const firstCoil = Math.round((primaryHot.getLength() / length) * 320) * 72;
    const lastCoil =
      Math.round(
        ((primaryHot.getLength() + primaryCoil.getLength()) / length) * 320,
      ) * 72;
    primaryCircuit.clearGroups();
    primaryCircuit.addGroup(0, firstCoil, 0);
    primaryCircuit.addGroup(firstCoil, lastCoil - firstCoil, 1);
    primaryCircuit.addGroup(lastCoil, 320 * 72 - lastCoil, 0);
    const secondaryRise = curve([
      [-3.3, -0.9, -0.32],
      [-3.65, 0, -0.37],
      [-3.45, 1.4, -0.36],
      [-3.4, 2.15, -1],
    ]);
    secondaryRise.getLengths(200);
    const blade = new BoxGeometry(1, 1, 1, 1, 6, 1);
    const vertices = blade.getAttribute("position");
    for (let index = 0; index < vertices.count; index++) {
      const y = vertices.getY(index);
      vertices.setX(index, vertices.getX(index) + y * y * 1.3);
      vertices.setZ(index, vertices.getZ(index) + y * 0.65);
    }
    blade.computeVertexNormals();
    const geometries = {
      blade,
      box: new BoxGeometry(1, 1, 1),
      cylinder: new CylinderGeometry(1, 1, 1, 20),
      roof: new ConeGeometry(1, 1, 4),
      shell: new CylinderGeometry(
        1,
        1,
        1,
        40,
        1,
        true,
        Math.PI / 2,
        Math.PI * 1.5,
      ),
      casing: new CylinderGeometry(1, 1, 1, 40, 1, true, 0, Math.PI),
      ring: new TorusGeometry(1, 0.045, 8, 40),
      winding: new TorusGeometry(0.5, 0.045, 6, 32),
      drop: new SphereGeometry(0.055, 8, 6),
      primaryCircuit,
      steam: new TubeGeometry(steam, 60, 0.065, 8, false),
      condensate: new TubeGeometry(
        curve([
          [-0.4, -0.5, -1],
          [-0.4, -0.95, 0.6],
          [-1.5, -1.1, 0.6],
          [-3.4, -1.1, 0.1],
          [-3.4, -0.5, -0.3],
        ]),
        48,
        0.05,
        8,
        false,
      ),
      electric: new TubeGeometry(electric, 90, 0.022, 6, false),
      distribution: new TubeGeometry(distribution, 40, 0.025, 6, false),
    };
    const materials = {
      steel: new MeshStandardMaterial({
        color: "#66808c",
        metalness: 0.62,
        roughness: 0.48,
        side: DoubleSide,
        forceSinglePass: true,
      }),
      dark: new MeshStandardMaterial({
        color: "#24333e",
        metalness: 0.45,
        roughness: 0.65,
      }),
      copper: new MeshStandardMaterial({
        color: "#ba8856",
        metalness: 0.6,
        roughness: 0.48,
        emissive: "#8d430f",
        emissiveIntensity: 0.18,
      }),
      heat: new MeshBasicMaterial({
        color: POWER_COLORS.heat,
        transparent: true,
      }),
      coil: new MeshStandardMaterial({
        color: "#92784e",
        metalness: 0.65,
        roughness: 0.42,
        emissive: POWER_COLORS.coilEmission,
        emissiveIntensity: 0.4,
        transparent: true,
      }),
      steam: new MeshBasicMaterial({
        color: POWER_COLORS.steam,
        transparent: true,
      }),
      steamPipe: new MeshStandardMaterial({
        color: "#8e8068",
        metalness: 0.55,
        roughness: 0.4,
        emissive: POWER_COLORS.steamEmission,
        emissiveIntensity: 0.32,
        transparent: true,
        depthWrite: false,
      }),
      primaryFlow: new MeshBasicMaterial({
        color: POWER_COLORS.primaryFlow,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
      exchange: new MeshBasicMaterial({
        color: POWER_COLORS.heatTransfer,
        transparent: true,
        depthWrite: false,
      }),
      water: new MeshStandardMaterial({
        color: POWER_COLORS.primaryWater,
        emissive: POWER_COLORS.primaryEmission,
        emissiveIntensity: 0.65,
        metalness: 0.55,
        roughness: 0.35,
      }),
      secondary: new MeshStandardMaterial({
        color: POWER_COLORS.secondaryWater,
        roughness: 0.7,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
      wire: new MeshBasicMaterial({
        color: POWER_COLORS.transmissionWire,
        toneMapped: false,
        transparent: true,
        opacity: 0.3,
      }),
      electric: new MeshBasicMaterial({
        color: POWER_COLORS.electricity,
        toneMapped: false,
        transparent: true,
      }),
      building: new MeshStandardMaterial({
        color: "white",
        metalness: 0.28,
        roughness: 0.75,
      }),
      windows: new MeshBasicMaterial({ color: "white", toneMapped: false }),
      road: new MeshStandardMaterial({
        color: CITY_COLORS.road,
        roughness: 0.94,
      }),
      marks: new MeshBasicMaterial({ color: CITY_COLORS.roadMarking }),
      roof: new MeshStandardMaterial({
        color: "#354957",
        metalness: 0.4,
        roughness: 0.7,
      }),
      lamps: new MeshBasicMaterial({
        color: CITY_COLORS.streetlight,
        toneMapped: false,
        transparent: true,
      }),
    };
    const placements: Record<
      "buildings" | "windows" | "roofs" | "roads" | "marks" | "lamps" | "bulbs",
      Placement[]
    > = {
      buildings: [],
      windows: [],
      roofs: [],
      roads: [],
      marks: [],
      lamps: [],
      bulbs: [],
    };
    const windowDelays: number[] = [];
    const windowLevels: number[] = [];
    const addWindowLight = (
      building: number,
      row: number,
      column: number,
      side: number,
    ) => {
      const seed = (building * 73 + row * 31 + column * 17 + side * 43) % 101;
      windowDelays.push(CITY_LIGHT_TIMING[building] + seed / 160 + row * 0.022);
      windowLevels.push(seed > 79 ? 0 : 0.48 + (seed / 100) * 0.52);
    };
    const buildingColors = CITY_COLORS.buildings;
    const colors: Color[] = [];
    CITY_BUILDINGS.forEach((building, index) => {
      const { x, z, width, depth, height, kind } = building;
      placements.buildings.push([
        x,
        -1.45 + height / 2,
        z,
        width,
        height,
        depth,
      ]);
      colors.push(new Color(buildingColors[index % buildingColors.length]));
      placements.roofs.push([
        x,
        -1.43 + height + (kind === "home" ? 0.22 : 0.04),
        z,
        width * (kind === "home" ? 0.78 : 0.72),
        kind === "home" ? 0.48 : 0.09,
        depth * (kind === "home" ? 0.78 : 0.72),
        Math.PI / 4,
      ]);
      for (let row = 0; row < Math.floor(height / 0.34); row++) {
        for (let col = 0; col < Math.floor(width / 0.3); col++) {
          placements.windows.push([
            x - width / 2 + 0.19 + col * 0.3,
            -1.18 + row * 0.34,
            z + depth / 2 + 0.008,
            0.13,
            0.17,
            0.014,
          ]);
          addWindowLight(index, row, col, 0);
        }
        for (let col = 0; col < Math.floor(depth / 0.3); col++) {
          placements.windows.push([
            x + width / 2 + 0.008,
            -1.18 + row * 0.34,
            z - depth / 2 + 0.19 + col * 0.3,
            0.014,
            0.17,
            0.13,
          ]);
          addWindowLight(index, row, col, 1);
        }
      }
    });
    placements.roads.push(
      [8.45, -1.475, 4.3, 12, 0.025, 0.55],
      [5.85, -1.472, 3.5, 0.5, 0.025, 7.1],
      [8, -1.472, 3.5, 0.48, 0.025, 7.1],
      [8.55, -1.474, 7.25, 12, 0.025, 0.75],
      [11.65, -1.472, 4.6, 0.75, 0.025, 10.2],
    );
    for (let index = 0; index < 18; index++)
      placements.marks.push([
        2.8 + index * 0.48,
        -1.455,
        4.3,
        0.2,
        0.01,
        0.025,
      ]);
    for (let index = 0; index < 25; index++)
      placements.marks.push([
        2.8 + index * 0.47,
        -1.45,
        7.25,
        0.21,
        0.01,
        0.026,
      ]);
    for (let index = 0; index < 21; index++)
      placements.marks.push([
        11.65,
        -1.45,
        -0.3 + index * 0.47,
        0.026,
        0.01,
        0.21,
      ]);
    for (let index = 0; index < 12; index++) {
      const x = 3 + (index % 6) * 1.5;
      const z = index < 6 ? 4.66 : 3.94;
      placements.lamps.push([x, -1, z, 0.025, 0.9, 0.025]);
      placements.bulbs.push([x, -0.53, z, 0.16, 0.055, 0.12]);
    }
    return {
      geometries,
      materials,
      placements,
      colors,
      windowDelays,
      windowLevels,
      distribution,
      primaryHot,
      primaryCoil,
      primaryPath,
      secondaryRise,
      steam,
      flows: [
        { name: "steam" as const, curve: steam, count: 14, start: 3 },
        { name: "electric" as const, curve: electric, count: 20, start: 8.8 },
      ],
      matrix: new Object3D(),
      point: new Vector3(),
      direction: new Vector3(),
      up: new Vector3(0, 1, 0),
      initialCamera: new Vector3(),
      initialTarget: new Vector3(),
      target: new Vector3(),
      focus: new Vector3(),
      cityFocus: new Vector3(),
      guideFocus: new Vector3(),
      guidePosition: new Vector3(),
      guideOffset: new Vector3(),
      partFocus: new Vector3(),
      roomFocus: new Vector3(-1.6, -0.82, 2.1),
      roomCamera: new Vector3(2.4, 2.48, 7.1),
      roomFog: new Fog(CITY_COLORS.roomFog, 80, 150),
      gestureStart: new Vector3(),
      gestureEnd: new Vector3(),
      gestureDirection: new Vector3(),
      initialZoom: 80,
      tint: new Color(),
      windowOff: new Color(CITY_COLORS.windowOff),
      windowOn: new Color(CITY_COLORS.windowWarm),
      windowBlue: new Color(CITY_COLORS.windowCool),
    };
  }, []);

  useLayoutEffect(() => {
    const { matrix } = resources;
    for (const [name, placements] of Object.entries(resources.placements)) {
      const mesh = meshes.current[name as Batch];
      placements.forEach(([x, y, z, sx, sy, sz, ry = 0], index) => {
        matrix.position.set(x, y, z);
        matrix.scale.set(sx, sy, sz);
        matrix.rotation.set(0, ry, 0);
        matrix.updateMatrix();
        mesh?.setMatrixAt(index, matrix.matrix);
        if (name === "buildings")
          mesh?.setColorAt(index, resources.colors[index]);
        if (name === "windows" || name === "bulbs")
          mesh?.setColorAt(index, resources.windowOff);
      });
    }
    for (let stage = 0; stage < 4; stage++) {
      for (let blade = 0; blade < 24; blade++) {
        const angle = (blade / 24) * Math.PI * 2;
        const radius = 0.4 + stage * 0.065;
        matrix.position.set(
          -0.65 + stage * 0.43,
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        );
        matrix.rotation.set(angle + 0.22, 0.12, 0);
        matrix.scale.set(0.12, 0.4 + stage * 0.06, 0.045);
        matrix.updateMatrix();
        meshes.current.blades?.setMatrixAt(stage * 24 + blade, matrix.matrix);
      }
    }
    for (let index = 0; index < 6; index++) {
      matrix.position.set(1.55 + index * 0.25, 0, -1);
      matrix.rotation.set(0, Math.PI / 2, 0);
      matrix.scale.setScalar(1);
      matrix.updateMatrix();
      meshes.current.coils?.setMatrixAt(index, matrix.matrix);
    }
    let beam = 0;
    const connect = (
      a: [number, number, number],
      b: [number, number, number],
      radius: number,
    ) => {
      resources.point.fromArray(a);
      resources.direction.fromArray(b).sub(resources.point);
      matrix.position
        .copy(resources.point)
        .addScaledVector(resources.direction, 0.5);
      matrix.scale.set(radius, resources.direction.length(), radius);
      matrix.quaternion.setFromUnitVectors(
        resources.up,
        resources.direction.normalize(),
      );
      matrix.updateMatrix();
      meshes.current.beams?.setMatrixAt(beam++, matrix.matrix);
    };
    for (const [x, z] of [
      [4.4, -1.2],
      [5.9, -0.2],
      [7.3, 0.5],
    ]) {
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      corners.forEach(([sx, sz], face) => {
        connect(
          [x + sx * 0.38, -1.4, z + sz * 0.38],
          [x + sx * 0.07, 2.95, z + sz * 0.07],
          0.022,
        );
        const [nx, nz] = corners[(face + 1) % 4];
        for (let level = 0; level < 3; level++) {
          const bottom = -1.4 + level * 1.35;
          const width = 0.38 - level * 0.095;
          connect(
            [x + sx * width, bottom, z + sz * width],
            [x + nx * (width - 0.095), bottom + 1.35, z + nz * (width - 0.095)],
            0.012,
          );
          connect(
            [x + nx * width, bottom, z + nz * width],
            [x + sx * (width - 0.095), bottom + 1.35, z + sz * (width - 0.095)],
            0.012,
          );
        }
      });
      connect([x - 0.55, 2.65, z], [x + 0.55, 2.65, z], 0.032);
      connect([x - 0.4, 2.12, z], [x + 0.4, 2.12, z], 0.026);
    }
    if (meshes.current.beams) meshes.current.beams.count = beam;
    const instances = Object.values(meshes.current);
    for (const mesh of instances) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    meshes.current.steam?.instanceMatrix.setUsage(DynamicDrawUsage);
    meshes.current.primary?.instanceMatrix.setUsage(DynamicDrawUsage);
    meshes.current.exchange?.instanceMatrix.setUsage(DynamicDrawUsage);
    meshes.current.secondary?.instanceMatrix.setUsage(DynamicDrawUsage);
    meshes.current.electric?.instanceMatrix.setUsage(DynamicDrawUsage);
    meshes.current.windows?.instanceColor?.setUsage(DynamicDrawUsage);
    meshes.current.bulbs?.instanceColor?.setUsage(DynamicDrawUsage);
    invalidate();
    return () => {
      for (const mesh of instances) mesh?.dispose();
    };
  }, [resources, invalidate]);

  useLayoutEffect(() => {
    resources.initialCamera.copy(camera.position);
    camera.getWorldDirection(resources.direction);
    resources.initialTarget
      .copy(camera.position)
      .addScaledVector(resources.direction, camera.position.length());
    if (power.transfer === "following") {
      resources.point
        .fromArray(REACTOR_PARTS.coolant.position)
        .sub(camera.position);
      resources.initialTarget
        .copy(camera.position)
        .addScaledVector(
          resources.direction,
          resources.point.dot(resources.direction),
        );
    }
    resources.initialZoom =
      camera instanceof OrthographicCamera ? camera.zoom : 80;
    clock.current = 0;
    lastIllumination.current = -1;
    invalidate();
  }, [power.run, power.transferRun, camera, resources, invalidate]);

  useEffect(() => {
    const transparent = power.transfer !== null;
    for (const material of [
      resources.materials.steel,
      resources.materials.water,
    ]) {
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
    }
    invalidate();
  }, [
    power.stage,
    power.selected,
    power.cityPlace,
    power.roomOpen,
    power.viewRevision,
    power.transfer,
    playing,
    visible,
    reducedMotion,
    size,
    resources,
    invalidate,
  ]);
  useEffect(
    () => () => {
      for (const geometry of Object.values(resources.geometries))
        geometry.dispose();
      for (const material of Object.values(resources.materials))
        material.dispose();
    },
    [resources],
  );
  useEffect(() => {
    const previous = scene.fog;
    scene.fog = resources.roomFog;
    return () => {
      scene.fog = previous;
    };
  }, [scene, resources]);

  useEffect(() => {
    if (
      power.stage !== "ready" ||
      power.transfer ||
      power.roomOpen ||
      journey.busy
    )
      return;
    const canvas = renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    const ground = (x: number, y: number, target: Vector3) => {
      const bounds = canvas.getBoundingClientRect();
      target
        .set(
          ((x - bounds.left) / bounds.width) * 2 - 1,
          1 - ((y - bounds.top) / bounds.height) * 2,
          0,
        )
        .unproject(camera);
      camera.getWorldDirection(resources.gestureDirection);
      target.addScaledVector(
        resources.gestureDirection,
        (-1.5 - target.y) / resources.gestureDirection.y,
      );
    };
    const pan = (x: number, z: number) => {
      const navigation = power.cityNavigation.current;
      navigation.x +=
        MathUtils.clamp(resources.focus.x + x, -9, 16) - resources.focus.x;
      navigation.z +=
        MathUtils.clamp(resources.focus.z + z, -4, 11) - resources.focus.z;
      invalidate();
    };
    const zoom = (factor: number, x: number, y: number) => {
      const navigation = power.cityNavigation.current;
      const next = MathUtils.clamp(navigation.zoom * factor, 1, 4.5);
      const bounds = canvas.getBoundingClientRect();
      ground(x, y, resources.gestureStart);
      ground(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
        resources.gestureEnd,
      );
      resources.gestureStart
        .sub(resources.gestureEnd)
        .multiplyScalar(1 - navigation.zoom / next);
      navigation.zoom = next;
      pan(resources.gestureStart.x, resources.gestureStart.z);
    };
    const wheel = (event: WheelEvent) => {
      if (power.roomAmount.current > 0.01) return;
      event.preventDefault();
      const units =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? canvas.clientHeight
            : 1;
      zoom(
        Math.exp(-MathUtils.clamp(event.deltaY * units, -240, 240) * 0.002),
        event.clientX,
        event.clientY,
      );
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || power.roomAmount.current > 0.01) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      let other: { x: number; y: number } | undefined;
      for (const [id, point] of pointers)
        if (id !== event.pointerId) {
          other = point;
          break;
        }
      if (other) {
        const distance = Math.hypot(previous.x - other.x, previous.y - other.y);
        const next = Math.hypot(
          event.clientX - other.x,
          event.clientY - other.y,
        );
        if (distance > 8 && next > 8)
          zoom(
            next / distance,
            (event.clientX + other.x) / 2,
            (event.clientY + other.y) / 2,
          );
      } else {
        ground(previous.x, previous.y, resources.gestureStart);
        ground(event.clientX, event.clientY, resources.gestureEnd);
        resources.gestureStart.sub(resources.gestureEnd);
        pan(resources.gestureStart.x, resources.gestureStart.z);
      }
      previous.x = event.clientX;
      previous.y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
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
  }, [
    power.stage,
    power.transfer,
    power.roomOpen,
    power.cityNavigation,
    power.roomAmount,
    journey.busy,
    renderer,
    camera,
    resources,
    invalidate,
  ]);

  useFrame((_, delta) => {
    const time = journeyTime(journey, 3, power.sceneTime.current);
    landscapeTime.current = time;
    const guideTime = journeyTime(
      journey,
      3,
      power.transfer !== "following"
        ? COOLANT_TRANSFER.travel
        : power.transferTime.current,
    );
    const departure =
      power.transfer === "leaving"
        ? MathUtils.smootherstep(
            power.transferTime.current,
            0,
            COOLANT_TRANSFER.leave,
          )
        : 0;
    const guided = power.transfer !== null;
    const steamProgress = journeyTime(
      journey,
      3,
      power.transferProgress.current,
    );
    const steamLead = MathUtils.clamp(
      MathUtils.smootherstep(steamProgress, 0.1, 0.8),
      0,
      1,
    );
    const shaftFocus = MathUtils.smootherstep(steamProgress, 0.78, 1);
    const guideWeight = guided
      ? 1 - departure * MathUtils.smoothstep(time, 0, COOLANT_TRANSFER.scene)
      : 0;
    const sceneScale = 1 + guideWeight * 1.5;
    if (surroundings.current)
      surroundings.current.visible = guideWeight < 0.001 && time > 0.7;
    if (root.current) {
      root.current.scale.setScalar(sceneScale);
      root.current.position.set(16.5 * guideWeight, 0, 2.5 * guideWeight);
    }
    const { matrix, materials } = resources;
    if (playing && visible && !reducedMotion)
      clock.current += Math.min(delta, 0.05);
    const opening = MathUtils.smoothstep(time, 0, 3.2);
    const outward = MathUtils.smoothstep(time, 7.5, 11.5);
    const cityReveal = MathUtils.smoothstep(time, 8.5, 11.2);
    const illumination = MathUtils.clamp(time, 12.6, 20);
    revealGroup(exchanger.current, time, 0.7, 2.7, -3.4, -1);
    if (guided && exchanger.current) {
      exchanger.current.visible = true;
      exchanger.current.scale.setScalar(1);
      exchanger.current.position.set(0, 0, 0);
    }
    revealGroup(turbine.current, time, 3.1, 4.4, -0.7, -1);
    if (guided && turbine.current) {
      turbine.current.visible = true;
      turbine.current.scale.setScalar(1);
      turbine.current.position.set(0, 0, 0);
    }
    revealGroup(generator.current, time, 5.8, 7.1, 2.2, -1);
    revealGroup(grid.current, time, 8.2, 10.4, 5.3, 0.2);
    if (city.current) {
      city.current.visible = cityReveal > 0;
      city.current.scale.y = 0.04 + cityReveal * 0.96;
      city.current.position.y =
        -1.65 * (1 - city.current.scale.y) - (1 - cityReveal) * 0.7;
    }
    if (playing && visible && !reducedMotion)
      rotorAngle.current +=
        Math.min(delta, 0.05) * MathUtils.smoothstep(time, 3.6, 5.2) * 1.7;
    const rotation = reducedMotion ? 0.3 : rotorAngle.current;
    if (shaftMark.current) {
      shaftMark.current.position.y = Math.cos(rotation) * 0.122;
      shaftMark.current.position.z = -1 + Math.sin(rotation) * 0.122;
      shaftMark.current.rotation.x = rotation;
      shaftMark.current.visible = guided && steamProgress > 0.7;
    }
    if (rotor.current) rotor.current.rotation.x = rotation;
    if (armature.current) armature.current.rotation.x = rotation;
    const entry = MathUtils.lerp(
      1,
      MathUtils.smootherstep(guideTime, 0.15, 1.5),
      guideWeight,
    );
    materials.steel.opacity = entry;
    materials.water.opacity = entry;
    materials.coil.opacity = entry;
    materials.coil.depthWrite = entry === 1;
    materials.steel.depthWrite = entry === 1;
    materials.water.depthWrite = entry === 1;
    materials.heat.opacity =
      entry * (0.8 + (power.selected === "heat" ? 0.2 : 0));
    materials.steam.opacity = MathUtils.lerp(
      MathUtils.smoothstep(time, 2.8, 4.2),
      MathUtils.smoothstep(guideTime, 3.6, 5.4),
      guideWeight,
    );
    materials.steamPipe.opacity = materials.steam.opacity * 0.42;
    materials.primaryFlow.opacity = guideWeight * 0.65;
    materials.steamPipe.emissiveIntensity =
      0.32 + steamLead * guideWeight * 0.55;
    materials.coil.emissiveIntensity =
      0.4 + guideWeight * (1 - steamLead * 0.7) * 0.45;
    materials.secondary.opacity =
      MathUtils.smoothstep(guideTime, 3.1, 5) * 0.16 * guideWeight;
    if (secondaryWater.current)
      secondaryWater.current.visible = guideWeight > 0;
    materials.wire.opacity = MathUtils.lerp(
      0.16,
      1,
      MathUtils.smoothstep(time, 8.8, 11.5),
    );
    materials.electric.opacity = MathUtils.smoothstep(time, 8.8, 10.7);
    materials.lamps.opacity = MathUtils.smoothstep(time, 16, 16.65);
    materials.copper.emissiveIntensity =
      power.selected === "generator" ? 0.55 : 0.18;
    if (cityLight.current)
      cityLight.current.intensity = MathUtils.smoothstep(time, 12.6, 20) * 5;

    if (meshes.current.windows && illumination !== lastIllumination.current) {
      resources.windowDelays.forEach((delay, index) => {
        resources.tint
          .copy(resources.windowOff)
          .lerp(
            index % 7 === 0 ? resources.windowBlue : resources.windowOn,
            MathUtils.smoothstep(illumination, delay, delay + 0.6) *
              resources.windowLevels[index],
          );
        meshes.current.windows!.setColorAt(index, resources.tint);
      });
      if (meshes.current.windows.instanceColor)
        meshes.current.windows.instanceColor.needsUpdate = true;
      const bulbs = meshes.current.bulbs;
      if (bulbs) {
        for (
          let index = 0;
          index < resources.placements.bulbs.length;
          index++
        ) {
          const start = 13.65 + (index % 6) * 0.78 + (index < 6 ? 0 : 0.3);
          resources.tint
            .copy(resources.windowOff)
            .lerp(
              resources.windowOn,
              MathUtils.smoothstep(illumination, start, start + 0.55) * 0.82,
            );
          bulbs.setColorAt(index, resources.tint);
        }
        if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
      }
      lastIllumination.current = illumination;
    }
    const secondary = meshes.current.secondary;
    if (secondary) secondary.visible = guideWeight > 0 && guideTime > 3.6;
    for (const { name, curve, count, start } of resources.flows) {
      const mesh = meshes.current[name];
      if (!mesh) continue;
      let reach =
        name === "steam" && guided
          ? MathUtils.lerp(
              MathUtils.smoothstep(time, start, start + 2.5),
              MathUtils.smoothstep(guideTime, 3.6, 5.4),
              guideWeight,
            )
          : MathUtils.smoothstep(time, start, start + 2.5);
      if (name === "electric")
        reach = reach * 0.72 + MathUtils.smoothstep(time, 11.2, 13.5) * 0.28;
      for (let index = 0; index < count; index++) {
        const progress =
          (index / count + (reducedMotion ? 0 : clock.current * 0.12)) % 1;
        if (name === "electric") {
          if (progress > 0.72)
            resources.distribution.getPointAt(
              (progress - 0.72) / 0.28,
              matrix.position,
            );
          else curve.getPointAt(progress / 0.72, matrix.position);
        } else if (guided && progress < 0.4) {
          resources.secondaryRise.getPointAt(progress / 0.4, matrix.position);
        } else
          curve.getPointAt(
            guided ? (progress - 0.4) / 0.6 : progress,
            matrix.position,
          );
        resources.point.copy(matrix.position);
        matrix.rotation.set(0, 0, 0);
        const vapor =
          name === "steam" && guided
            ? MathUtils.smoothstep(progress, 0.24, 0.39)
            : 1;
        matrix.scale.setScalar(
          progress <= reach ? MathUtils.lerp(1, vapor, guideWeight) : 0,
        );
        matrix.updateMatrix();
        mesh.setMatrixAt(index, matrix.matrix);
        if (name === "steam" && secondary?.visible) {
          matrix.position.copy(resources.point);
          matrix.scale.setScalar(
            progress <= reach ? (1 - vapor) * guideWeight : 0,
          );
          matrix.updateMatrix();
          secondary.setMatrixAt(index, matrix.matrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (secondary?.visible) secondary.instanceMatrix.needsUpdate = true;

    if (meshes.current.primary) {
      const mesh = meshes.current.primary;
      mesh.visible = guideWeight > 0 && guideTime > 2.5;
      if (mesh.visible) {
        for (let index = 0; index < 12; index++) {
          const progress =
            (index / 12 + (reducedMotion ? 0 : clock.current * 0.12)) % 1;
          resources.primaryPath.getPointAt(progress, matrix.position);
          matrix.rotation.set(0, 0, 0);
          matrix.scale.setScalar(
            guideWeight * MathUtils.smoothstep(guideTime, 2.5, 3.3) * 0.85,
          );
          matrix.updateMatrix();
          mesh.setMatrixAt(index, matrix.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }

    const exchange = meshes.current.exchange;
    if (exchange) {
      exchange.visible = guideWeight > 0 && guideTime > 4;
      if (exchange.visible) {
        materials.exchange.opacity = guideWeight * (1 - steamLead * 0.7) * 0.65;
        for (let index = 0; index < 18; index++) {
          const along = (index + 0.5) / 18;
          resources.primaryCoil.getPointAt(along, matrix.position);
          resources.direction
            .set(matrix.position.x + 3.4, 0, matrix.position.z + 1)
            .normalize();
          const pulse = reducedMotion
            ? 0.5
            : (clock.current * 0.45 + index * 0.13) % 1;
          matrix.position.addScaledVector(
            resources.direction,
            0.075 + pulse * 0.12,
          );
          matrix.quaternion.setFromUnitVectors(
            resources.up,
            resources.direction,
          );
          matrix.scale.set(0.005, 0.07 * Math.sin(pulse * Math.PI), 0.005);
          matrix.updateMatrix();
          exchange.setMatrixAt(index, matrix.matrix);
        }
        exchange.instanceMatrix.needsUpdate = true;
      }
    }

    resources.focus.set(
      MathUtils.lerp(-2.7, 2, outward),
      MathUtils.lerp(0.3, 0.6, outward),
      MathUtils.lerp(-0.6, 1.5, outward),
    );
    resources.focus.lerpVectors(
      resources.initialTarget,
      resources.focus,
      opening,
    );
    const cityView = power.cityView.current;
    const immediateFocus =
      reducedMotion ||
      (!playing &&
        (previousSelection.current !== power.selected ||
          previousPlace.current !== power.cityPlace));
    previousSelection.current = power.selected;
    previousPlace.current = power.cityPlace;
    if (!guided && !journey.busy) {
      const weight =
        power.stage === "ready" && power.selected && power.selected !== "city"
          ? 0
          : 1;
      const home =
        power.stage === "ready" &&
        power.selected === "city" &&
        power.cityPlace === "home"
          ? 1
          : 0;
      const hospital =
        power.stage === "ready" &&
        power.selected === "city" &&
        power.cityPlace === "hospital"
          ? 1
          : 0;
      if (immediateFocus) {
        cityView.weight = weight;
        cityView.home = home;
        cityView.hospital = hospital;
      } else if (playing && visible) {
        const rate = Math.min(delta, 0.05);
        cityView.weight = MathUtils.damp(cityView.weight, weight, 3.8, rate);
        cityView.home = MathUtils.damp(cityView.home, home, 3.8, rate);
        cityView.hospital = MathUtils.damp(
          cityView.hospital,
          hospital,
          3.8,
          rate,
        );
      }
    }
    const street = MathUtils.smootherstep(time, 10.2, 12.4);
    const hospital = MathUtils.smootherstep(time, 14.4, 15.9);
    const neighborhood = MathUtils.smootherstep(time, 17.1, 20);
    const exploration = MathUtils.smootherstep(time, 19.5, 20);
    const cityWeight = street * MathUtils.lerp(1, cityView.weight, exploration);
    resources.cityFocus.set(3.9, -0.6, 4.05);
    resources.cityFocus.lerp(resources.point.set(6.7, -0.25, 5.2), hospital);
    if (power.selected === "city") resources.point.set(8.5, 0, 4.8);
    else resources.point.set(2, -1.2, 2.2);
    resources.cityFocus.lerp(resources.point, neighborhood);
    resources.cityFocus.lerp(
      resources.point.fromArray(CITY_PLACES.home.position),
      cityView.home * exploration,
    );
    resources.cityFocus.lerp(
      resources.point.fromArray(CITY_PLACES.hospital.position),
      cityView.hospital * exploration,
    );
    resources.focus.lerp(resources.cityFocus, cityWeight);
    if (power.selected && power.selected !== "city")
      resources.partFocus.fromArray(POWER_PARTS[power.selected].position);
    resources.focus.lerp(
      resources.partFocus,
      (1 - cityView.weight) * exploration,
    );
    resources.target
      .copy(resources.focus)
      .add(resources.direction.set(16, 14.5, 22));
    camera.position.lerpVectors(
      resources.initialCamera,
      resources.target,
      opening,
    );
    if (!reducedMotion && power.stage !== "ready") {
      camera.position.x += pointer.current.x * 0.18 * opening;
      camera.position.z -= pointer.current.x * 0.18 * opening;
    }
    if (camera instanceof OrthographicCamera) {
      const compact = size.width < 600;
      const close = Math.min(size.width / 13.8, size.height / 11);
      const wide = Math.min(
        size.width / (compact ? 18.5 : 21),
        size.height / 16,
      );
      camera.zoom = MathUtils.lerp(
        resources.initialZoom,
        MathUtils.lerp(close, wide, outward),
        opening,
      );
      const streetZoom = Math.min(size.width / 6.8, size.height / 5.7);
      const neighborhoodZoom =
        power.selected === "city"
          ? Math.min(size.width / 16.5, size.height / 12)
          : Math.min(size.width / 27, size.height / 18);
      let cityZoom = MathUtils.lerp(streetZoom, neighborhoodZoom, neighborhood);
      cityZoom = MathUtils.lerp(
        cityZoom,
        streetZoom,
        Math.min(1, cityView.home + cityView.hospital) * exploration,
      );
      camera.zoom = MathUtils.lerp(camera.zoom, cityZoom, cityWeight);
      camera.zoom = MathUtils.lerp(
        camera.zoom,
        Math.min(size.width / 8.5, size.height / 7.5),
        (1 - cityView.weight) * exploration,
      );
    }
    if (power.stage === "ready") {
      const navigation = power.cityNavigation.current;
      resources.focus.x += navigation.x;
      resources.focus.z += navigation.z;
      camera.position.x += navigation.x;
      camera.position.z += navigation.z;
      if (camera instanceof OrthographicCamera) camera.zoom *= navigation.zoom;
      const label = `${Math.round(navigation.zoom * 100)}%`;
      if (
        power.zoomLabel.current &&
        power.zoomLabel.current.textContent !== label
      )
        power.zoomLabel.current.textContent = label;
    }
    if (guided) {
      const alongPipe = MathUtils.clamp(
        MathUtils.smootherstep(guideTime, 0.6, 4.7),
        0,
        1,
      );
      const exchange = MathUtils.smootherstep(
        guideTime,
        4.5,
        COOLANT_TRANSFER.travel,
      );
      resources.primaryHot.getPointAt(alongPipe, resources.guideFocus);
      resources.point.set(-3.4, 0.75, -1);
      resources.guideFocus.lerp(resources.point, exchange);
      if (steamProgress > 0) {
        resources.steam.getPointAt(steamLead, resources.point);
        resources.guideFocus.lerp(
          resources.point,
          MathUtils.smootherstep(steamProgress, 0, 0.23),
        );
        resources.guideFocus.lerp(
          resources.point.set(-0.45, 0.12, -1),
          shaftFocus,
        );
      }
      resources.guideFocus.multiplyScalar(sceneScale);
      resources.guideFocus.x += 16.5 * guideWeight;
      resources.guideFocus.z += 2.5 * guideWeight;
      resources.guideFocus.lerpVectors(
        resources.initialTarget,
        resources.guideFocus,
        MathUtils.smootherstep(guideTime, 0, 1.2),
      );
      resources.guideOffset
        .copy(resources.initialCamera)
        .sub(resources.initialTarget);
      resources.point.setScalar(11 * sceneScale);
      resources.guideOffset.lerp(
        resources.point,
        MathUtils.smootherstep(guideTime, 0, 3),
      );
      resources.guideOffset.lerp(
        resources.point.set(9 * sceneScale, 7 * sceneScale, 13 * sceneScale),
        MathUtils.smootherstep(steamProgress, 0.18, 0.95),
      );
      resources.guidePosition
        .copy(resources.guideFocus)
        .add(resources.guideOffset);
      camera.position.lerpVectors(
        resources.guidePosition,
        camera.position,
        departure,
      );
      resources.focus.lerpVectors(
        resources.guideFocus,
        resources.focus,
        departure,
      );
      if (camera instanceof OrthographicCamera) {
        const close =
          MathUtils.lerp(
            Math.min(size.width / 6.5, size.height / 5.7),
            Math.min(size.width / 5.4, size.height / 4.8),
            shaftFocus,
          ) / sceneScale;
        const zoom = MathUtils.lerp(
          resources.initialZoom,
          close,
          MathUtils.smootherstep(guideTime, 1, COOLANT_TRANSFER.travel),
        );
        camera.zoom = MathUtils.lerp(zoom, camera.zoom, departure);
      }
    }
    const roomTarget = power.roomOpen ? 1 : 0;
    if (
      reducedMotion ||
      (!playing && previousRoom.current !== power.roomOpen)
    ) {
      power.roomProgress.current = roomTarget;
    } else if (playing && visible && !journey.busy) {
      power.roomProgress.current = MathUtils.clamp(
        power.roomProgress.current +
          ((power.roomOpen ? 1 : -1) * Math.min(delta, 0.05)) / 2.8,
        0,
        1,
      );
    }
    previousRoom.current = power.roomOpen;
    const room = MathUtils.smootherstep(power.roomProgress.current, 0, 1);
    power.roomAmount.current = room;
    resources.roomFog.near = MathUtils.lerp(80, 6.8, room);
    resources.roomFog.far = MathUtils.lerp(150, 14, room);
    if (!guided && room > 0) {
      camera.position.lerp(resources.roomCamera, room);
      resources.focus.lerp(resources.roomFocus, room);
      if (camera instanceof OrthographicCamera)
        camera.zoom = MathUtils.lerp(
          camera.zoom,
          Math.min(size.width / 4.8, size.height / 3.8),
          room,
        );
    }
    if (guided && size.width > 760 && camera instanceof OrthographicCamera) {
      resources.direction
        .copy(camera.position)
        .sub(resources.focus)
        .cross(resources.up)
        .normalize();
      const offset =
        (size.width / camera.zoom) *
        0.12 *
        (1 - departure) *
        MathUtils.smootherstep(guideTime, 0, 1.2);
      camera.position.addScaledVector(resources.direction, offset);
      resources.focus.addScaledVector(resources.direction, offset);
    }
    camera.lookAt(resources.focus);
    if (camera instanceof OrthographicCamera) camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (power.stage === "ready" && !guided) {
      for (let index = 0; index < POWER_PART_IDS.length; index++) {
        const button = power.hotspots.current[index];
        if (!button) continue;
        resources.point
          .fromArray(POWER_PARTS[POWER_PART_IDS[index]].position)
          .project(camera);
        button.style.transform = `translate3d(${((resources.point.x + 1) * size.width) / 2}px, ${((1 - resources.point.y) * size.height) / 2}px, 0)`;
      }
      if (power.roomHotspot.current) {
        resources.point.set(-1.6, 0.15, 2.1).project(camera);
        const x = MathUtils.clamp(
          ((resources.point.x + 1) * size.width) / 2,
          95,
          size.width - 95,
        );
        const y = MathUtils.clamp(
          ((1 - resources.point.y) * size.height) / 2,
          95,
          size.height - 65,
        );
        power.roomHotspot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    }
    if (power.labelPlace && power.cityLabel.current) {
      resources.point.fromArray(CITY_PLACES[power.labelPlace].position);
      resources.point.y += 0.65;
      resources.point.project(camera);
      const x = MathUtils.clamp(
        ((resources.point.x + 1) * size.width) / 2 + 20,
        12,
        size.width - 180,
      );
      const y = MathUtils.clamp(
        ((1 - resources.point.y) * size.height) / 2,
        24,
        size.height - 60,
      );
      power.cityLabel.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    if (playing && visible && !reducedMotion) invalidate();
  }, -2);

  const { geometries: g, materials: m, placements: p } = resources;
  return (
    <group ref={root} dispose={null}>
      <group ref={surroundings} visible={false}>
        <PowerLandscape
          time={landscapeTime}
          playing={playing}
          reducedMotion={reducedMotion}
          visible={visible && !power.transfer}
        />
        <ControlRoom
          amount={power.roomAmount}
          onEnter={power.enterRoom}
          enabled={power.stage === "ready" && !power.transfer && !journey.busy}
        />
      </group>
      <group ref={exchanger} visible={false}>
        <mesh
          geometry={g.shell}
          material={m.steel}
          position={[-3.4, 0.35, -1]}
          scale={[0.87, 3.65, 0.87]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={g.cylinder}
          material={m.steel}
          position={[-3.4, 2.18, -1]}
          scale={[0.9, 0.12, 0.9]}
        />
        <mesh
          geometry={g.ring}
          material={m.steel}
          position={[-3.4, -1.36, -1]}
          scale={0.87}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <mesh geometry={g.primaryCircuit} material={[m.water, m.coil]} />
        <mesh
          geometry={g.shell}
          material={m.secondary}
          ref={secondaryWater}
          visible={false}
          position={[-3.4, 0.2, -1]}
          scale={[0.72, 3.1, 0.72]}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.primary = node;
          }}
          args={[g.drop, m.primaryFlow, 12]}
          frustumCulled={false}
          visible={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.exchange = node;
          }}
          args={[g.cylinder, m.exchange, 18]}
          frustumCulled={false}
          visible={false}
        />
        <mesh geometry={g.steam} material={m.steamPipe} />
        <instancedMesh
          ref={(node) => {
            meshes.current.secondary = node;
          }}
          args={[g.drop, m.water, 14]}
          frustumCulled={false}
          visible={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.steam = node;
          }}
          args={[g.drop, m.steam, 14]}
          frustumCulled={false}
        />
      </group>
      <group ref={turbine} visible={false}>
        <mesh
          geometry={g.cylinder}
          material={m.steel}
          position={[-1.74, 0, -1]}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[0.9, 0.14, 0.9]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={g.cylinder}
          material={m.steel}
          position={[-1.94, 0, -1]}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[0.16, 0.4, 0.16]}
          castShadow
        />
        <mesh
          geometry={g.ring}
          material={m.copper}
          position={[-2.1, 0, -1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={0.22}
        />
        <mesh
          geometry={g.ring}
          material={m.steel}
          position={[-1.74, 0, -1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={0.9}
        />
        <mesh
          geometry={g.casing}
          material={m.steel}
          position={[-0.7, 0, -1]}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[0.96, 2.2, 0.96]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={g.box}
          material={m.dark}
          position={[-0.7, -1.05, -1]}
          scale={[2.55, 0.55, 1.6]}
        />
        <mesh
          geometry={g.cylinder}
          material={m.steel}
          position={[0.65, 0, -1]}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[0.12, 4.7, 0.12]}
        />
        <mesh
          ref={shaftMark}
          geometry={g.box}
          material={m.heat}
          position={[0.4, 0.122, -1]}
          scale={[0.85, 0.012, 0.035]}
          visible={false}
        />
        <group ref={rotor} position={[-0.7, 0, -1]}>
          <instancedMesh
            ref={(node) => {
              meshes.current.blades = node;
            }}
            args={[g.blade, m.steel, 96]}
            frustumCulled={false}
            castShadow
          />
        </group>
        <mesh
          geometry={g.box}
          material={m.water}
          position={[-0.7, -1.05, 0.55]}
          scale={[1.45, 0.6, 0.75]}
        />
        <mesh geometry={g.condensate} material={m.water} />
      </group>
      <group ref={generator} visible={false}>
        <mesh
          geometry={g.casing}
          material={m.steel}
          position={[2.2, 0, -1]}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[0.7, 1.9, 0.7]}
        />
        <mesh
          geometry={g.box}
          material={m.dark}
          position={[2.2, -1.02, -1]}
          scale={[2.15, 0.62, 1.3]}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.coils = node;
          }}
          args={[g.winding, m.copper, 6]}
          frustumCulled={false}
        />
        <group ref={armature} position={[2.2, 0, -1]}>
          <mesh
            geometry={g.cylinder}
            material={m.dark}
            rotation={[0, 0, -Math.PI / 2]}
            scale={[0.29, 1.8, 0.29]}
          />
          <mesh
            geometry={g.box}
            material={m.copper}
            position={[0, 0.28, 0]}
            scale={[1.65, 0.05, 0.13]}
          />
          <mesh
            geometry={g.box}
            material={m.steel}
            position={[0, -0.28, 0]}
            scale={[1.65, 0.05, 0.13]}
          />
        </group>
      </group>
      <group ref={grid} visible={false}>
        <mesh
          geometry={g.box}
          material={m.steel}
          position={[3.8, -0.95, -1]}
          scale={[0.65, 0.9, 0.75]}
        />
        <mesh
          geometry={g.box}
          material={m.steel}
          position={[4.3, -1.03, 2.1]}
          scale={[0.85, 0.75, 0.65]}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.beams = node;
          }}
          args={[g.cylinder, m.steel, 90]}
          frustumCulled={false}
        />
        {[-0.12, 0, 0.12].map((offset) => (
          <mesh
            key={offset}
            geometry={g.electric}
            material={m.wire}
            position={[0, 0, offset]}
          />
        ))}
        <instancedMesh
          ref={(node) => {
            meshes.current.electric = node;
          }}
          args={[g.drop, m.electric, 20]}
          frustumCulled={false}
        />
      </group>
      <group ref={city} visible={false}>
        <CitySignature time={landscapeTime} />
        <instancedMesh
          ref={(node) => {
            meshes.current.roads = node;
          }}
          args={[g.box, m.road, p.roads.length]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.marks = node;
          }}
          args={[g.box, m.marks, p.marks.length]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.buildings = node;
          }}
          args={[g.box, m.building, p.buildings.length]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.windows = node;
          }}
          args={[g.box, m.windows, p.windows.length]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.roofs = node;
          }}
          args={[g.roof, m.roof, p.roofs.length]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.lamps = node;
          }}
          args={[g.cylinder, m.steel, p.lamps.length]}
          frustumCulled={false}
        />
        <instancedMesh
          ref={(node) => {
            meshes.current.bulbs = node;
          }}
          args={[g.box, m.windows, p.bulbs.length]}
          frustumCulled={false}
        />
        <mesh
          geometry={g.box}
          material={m.lamps}
          position={[6.7, -0.13, 5.935]}
          scale={[0.45, 0.1, 0.02]}
        />
        <mesh
          geometry={g.box}
          material={m.lamps}
          position={[6.7, -0.13, 5.936]}
          scale={[0.1, 0.45, 0.02]}
        />
        <mesh
          geometry={g.box}
          material={m.roof}
          position={[6.8, -1.35, 3.1]}
          scale={[2, 0.15, 0.45]}
        />
        <mesh geometry={g.distribution} material={m.electric} />
        <pointLight
          ref={cityLight}
          position={[7.5, 1, 4]}
          color={SCENE_LIGHTS.power}
          intensity={0}
          distance={9}
          decay={2}
        />
      </group>
    </group>
  );
}
