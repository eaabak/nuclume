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
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PointLight,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import {
  CONTROL_ROD_POSITIONS,
  FUEL_ROD_POSITIONS,
  REACTOR_PART_IDS,
  REACTOR_PARTS,
} from "@/lib/reactor";
import type { ViewOrientation } from "./nucleus-canvas";
import type { ReactorController } from "./use-reactor";
import type { PowerController } from "./use-power";
import { COOLANT_TRANSFER } from "@/lib/power";
import { journeyTime, type JourneyController } from "./use-journey";

const fuelPositions = FUEL_ROD_POSITIONS.filter(([x, z]) => x !== 0 || z !== 0);
const FLOW_COUNT = 32;
const INSPECTION_PARTS = ["fuel", "control"] as const;

export function ReactorScene({
  reactor,
  playing,
  reducedMotion,
  visible,
  pointer,
  power,
  journey,
}: {
  reactor: ReactorController;
  playing: boolean;
  reducedMotion: boolean;
  visible: boolean;
  pointer: RefObject<ViewOrientation>;
  power: PowerController | null;
  journey: JourneyController;
}) {
  const root = useRef<Group>(null);
  const pellet = useRef<Mesh>(null);
  const detail = useRef<Group>(null);
  const cladding = useRef<Mesh>(null);
  const absorbers = useRef<Group>(null);
  const yoke = useRef<Mesh>(null);
  const neutrons = useRef<InstancedMesh>(null);
  const core = useRef<Group>(null);
  const vessel = useRef<Group>(null);
  const head = useRef<Mesh>(null);
  const stack = useRef<InstancedMesh>(null);
  const fuel = useRef<InstancedMesh>(null);
  const control = useRef<InstancedMesh>(null);
  const grid = useRef<InstancedMesh>(null);
  const flanges = useRef<InstancedMesh>(null);
  const bolts = useRef<InstancedMesh>(null);
  const flow = useRef<InstancedMesh>(null);
  const arrows = useRef<InstancedMesh>(null);
  const heat = useRef<PointLight>(null);
  const flowTime = useRef(0);
  const coolantFocus = useRef(0);
  const previousSelection = useRef(reactor.selected);
  const initialZoom = useRef(80);
  const initialCamera = useRef(new Vector3());
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const resources = useMemo(() => {
    const profile = [
      new Vector2(0, -3.35),
      new Vector2(1.6, -3.2),
      new Vector2(2.6, -2.7),
      new Vector2(2.75, -2.15),
      new Vector2(2.75, 2.7),
      new Vector2(2.5, 2.7),
      new Vector2(2.5, -2.15),
      new Vector2(2.37, -2.5),
      new Vector2(1.5, -2.94),
      new Vector2(0, -3.08),
    ];
    const curve = new CatmullRomCurve3(
      [
        new Vector3(0, 1.1, 4.25),
        new Vector3(0, 1.1, 2.35),
        new Vector3(0.85, -1.7, 2.15),
        new Vector3(0.85, -2.65, 1.35),
        new Vector3(0.65, -2.15, 0.65),
        new Vector3(0.65, 1.85, 0.65),
        new Vector3(1.65, 2.2, 0.4),
        new Vector3(4.25, 2.2, 0.4),
      ],
      false,
      "centripetal",
    );
    curve.getLengths(200);
    const geometries = {
      pellet: new LatheGeometry(
        [
          new Vector2(0, -0.51),
          new Vector2(0.72, -0.51),
          new Vector2(0.84, -0.4),
          new Vector2(0.84, 0.4),
          new Vector2(0.74, 0.51),
          new Vector2(0.27, 0.51),
          new Vector2(0, 0.46),
        ],
        40,
      ),
      cylinder: new CylinderGeometry(1, 1, 1, 16),
      rod: new CylinderGeometry(
        1,
        1,
        1,
        32,
        1,
        true,
        Math.PI / 2,
        Math.PI * 1.5,
      ),
      vessel: new LatheGeometry(profile, 64, Math.PI / 2, Math.PI * 1.5),
      cut: new ShapeGeometry(new Shape(profile)),
      head: new LatheGeometry(
        [
          new Vector2(0, 0.75),
          new Vector2(1.45, 0.6),
          new Vector2(2.75, 0),
          new Vector2(2.75, -0.18),
          new Vector2(2.4, -0.18),
          new Vector2(1.4, 0.35),
          new Vector2(0, 0.48),
        ],
        48,
        Math.PI / 2,
        Math.PI * 1.5,
      ),
      ring: new TorusGeometry(2.65, 0.085, 8, 64),
      box: new BoxGeometry(1, 1, 1),
      inlet: new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, 1.1, 2.5),
          new Vector3(0, 1.1, 3.35),
          new Vector3(0, 1.1, 4.2),
        ]),
        12,
        0.25,
        16,
        false,
      ),
      outlet: new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(2.5, 2.2, 0.4),
          new Vector3(3.3, 2.2, 0.4),
          new Vector3(4.2, 2.2, 0.4),
        ]),
        12,
        0.25,
        16,
        false,
      ),
      path: new TubeGeometry(curve, 100, 0.026, 6, false),
      drop: new SphereGeometry(0.047, 8, 6),
      arrow: new ConeGeometry(0.09, 0.24, 8),
    };
    const materials = {
      pellet: new MeshStandardMaterial({
        color: "#3d4142",
        metalness: 0.35,
        roughness: 0.78,
        transparent: true,
      }),
      fuel: new MeshStandardMaterial({
        color: "#a89678",
        metalness: 0.6,
        roughness: 0.5,
        emissive: "#d67b24",
        emissiveIntensity: 0.2,
        transparent: true,
      }),
      control: new MeshStandardMaterial({
        color: "#98afbd",
        metalness: 0.7,
        roughness: 0.42,
        emissive: "#4a89ad",
        emissiveIntensity: 0.04,
        transparent: true,
      }),
      steel: new MeshStandardMaterial({
        color: "#3f5665",
        metalness: 0.65,
        roughness: 0.55,
        side: DoubleSide,
        transparent: true,
      }),
      edge: new MeshStandardMaterial({
        color: "#a2a7a4",
        metalness: 0.7,
        roughness: 0.4,
        side: DoubleSide,
        transparent: true,
      }),
      cladding: new MeshStandardMaterial({
        color: "#8b9da3",
        metalness: 0.72,
        roughness: 0.4,
        side: DoubleSide,
        transparent: true,
      }),
      water: new MeshBasicMaterial({ color: "#399fea", transparent: true }),
      path: new MeshBasicMaterial({
        color: "#329feb",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      neutron: new MeshBasicMaterial({
        color: "#b8cedb",
        transparent: true,
        depthWrite: false,
      }),
    };
    return {
      geometries,
      materials,
      curve,
      matrix: new Object3D(),
      point: new Vector3(),
      tangent: new Vector3(),
      up: new Vector3(0, 1, 0),
      target: new Vector3(),
      focus: new Vector3(),
      fuelColor: new Color("#a89678"),
      fuelSelected: new Color("#e4bb79"),
    };
  }, []);

  useLayoutEffect(() => {
    const { matrix } = resources;
    const place = (
      mesh: InstancedMesh | null,
      index: number,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      matrix.position.set(x, y, z);
      matrix.scale.set(sx, sy, sz);
      matrix.rotation.set(0, 0, 0);
      matrix.updateMatrix();
      mesh?.setMatrixAt(index, matrix.matrix);
    };
    for (let index = 0; index < 25; index++)
      place(stack.current, index, 0, (index - 12) * 0.169, 0, 0.15, 0.15, 0.15);
    fuelPositions.forEach(([x, z], index) =>
      place(fuel.current, index, x, 0, z, 0.125, 4.35, 0.125),
    );
    CONTROL_ROD_POSITIONS.forEach(([x, z], index) =>
      place(control.current, index, x, 1.15, z, 0.085, 4.7, 0.085),
    );
    let gridIndex = 0;
    for (const y of [-2.3, 2.3])
      for (let row = -3; row <= 3; row++) {
        place(grid.current, gridIndex++, row * 0.48, y, 0, 0.05, 0.09, 3.35);
        place(grid.current, gridIndex++, 0, y, row * 0.48, 3.35, 0.09, 0.05);
      }
    for (let index = 0; index < 3; index++) {
      matrix.position.set(0, [-2.65, 2.72, 3.25][index], 0);
      matrix.rotation.set(Math.PI / 2, 0, 0);
      matrix.scale.setScalar(1);
      matrix.updateMatrix();
      flanges.current?.setMatrixAt(index, matrix.matrix);
    }
    for (let index = 0; index < 24; index++) {
      const angle = (index / 24) * Math.PI * 2;
      place(
        bolts.current,
        index,
        Math.sin(angle) * 2.65,
        2.82,
        Math.cos(angle) * 2.65,
        0.065,
        0.18,
        0.065,
      );
    }
    for (let index = 0; index < 3; index++) {
      const progress = [0.23, 0.61, 0.9][index];
      resources.curve.getPointAt(progress, matrix.position);
      resources.curve.getTangentAt(progress, resources.tangent);
      matrix.quaternion.setFromUnitVectors(resources.up, resources.tangent);
      matrix.scale.setScalar(1);
      matrix.updateMatrix();
      arrows.current?.setMatrixAt(index, matrix.matrix);
    }
    const meshes = [
      stack.current,
      fuel.current,
      control.current,
      grid.current,
      flanges.current,
      bolts.current,
      arrows.current,
      neutrons.current,
    ];
    for (const mesh of meshes) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    flow.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    neutrons.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    invalidate();
    const flowMesh = flow.current;
    return () => {
      for (const mesh of meshes) mesh?.dispose();
      flowMesh?.dispose();
    };
  }, [resources, invalidate]);

  useLayoutEffect(() => {
    initialCamera.current.copy(camera.position);
    initialZoom.current =
      camera instanceof OrthographicCamera ? camera.zoom : 80;
    flowTime.current = 0;
    invalidate();
  }, [reactor.run, camera, invalidate]);

  useEffect(() => {
    invalidate();
  }, [
    reactor.stage,
    reactor.selected,
    power?.run,
    playing,
    reducedMotion,
    visible,
    size,
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

  useFrame((_, delta) => {
    if (root.current) {
      let transition = power
        ? MathUtils.smoothstep(
            journeyTime(journey, 3, power.sceneTime.current),
            0,
            3.2,
          )
        : 0;
      if (power?.transfer)
        transition *=
          power.transfer === "leaving"
            ? MathUtils.smootherstep(
                power.transferTime.current,
                0,
                COOLANT_TRANSFER.leave,
              )
            : 0;
      root.current.scale.setScalar(1 - transition * 0.6);
      root.current.position.set(-6.6 * transition, 0, -transition);
    }
    const time = power ? 9.5 : journeyTime(journey, 2, reactor.elapsed.current);
    const rodReveal = MathUtils.smoothstep(time, 2.65, 4.9);
    const coreReveal = MathUtils.smoothstep(time, 5.3, 7.2);
    const vesselReveal = MathUtils.smoothstep(time, 6.3, 9.2);
    const orbit = MathUtils.smoothstep(time, 3.3, 8.8);
    const arrival = MathUtils.smoothstep(time, 0, 2.5);
    const { materials, matrix } = resources;
    const inspection = reactor.inspection.current;
    const immediateFocus =
      reducedMotion ||
      (!playing && reactor.selected !== previousSelection.current);
    previousSelection.current = reactor.selected;
    if (!power && !journey.busy) {
      for (const part of INSPECTION_PARTS) {
        const goal =
          reactor.stage === "ready" && reactor.selected === part ? 1 : 0;
        if (immediateFocus) inspection[part] = goal;
        else if (playing && visible) {
          inspection[part] = MathUtils.damp(
            inspection[part],
            goal,
            3,
            Math.min(delta, 0.05),
          );
          if (Math.abs(inspection[part] - goal) < 0.0001)
            inspection[part] = goal;
        }
      }
    }
    const context = power
      ? 1 -
        MathUtils.smoothstep(
          journeyTime(journey, 3, power.sceneTime.current),
          0,
          1,
        )
      : MathUtils.smoothstep(time, 8.6, 9.5);
    const fuelFocus = inspection.fuel * context;
    const controlFocus = inspection.control * context;
    const focus = Math.min(1, fuelFocus + controlFocus);
    const separation = MathUtils.smootherstep(fuelFocus, 0.2, 0.95);
    const insertion = MathUtils.smootherstep(controlFocus, 0.35, 0.99) * 0.55;
    if (pellet.current) {
      pellet.current.visible = time < 5.15;
      pellet.current.scale.setScalar(
        MathUtils.lerp(2.5, 0.15, MathUtils.smoothstep(time, 2.8, 5.1)),
      );
    }
    materials.pellet.opacity =
      reactor.fromFission.current ||
      (journey.motion?.kind === "return" && journey.motion.from === 2)
        ? MathUtils.smoothstep(time, 0.55, 1.9)
        : 1;
    materials.cladding.opacity = rodReveal;
    materials.fuel.opacity = coreReveal * (1 - focus * 0.72);
    materials.control.opacity = coreReveal;
    materials.steel.opacity = vesselReveal * (1 - focus * 0.82);
    materials.edge.opacity = vesselReveal * (1 - focus * 0.68);
    materials.steel.depthWrite = focus < 0.01;
    materials.fuel.depthWrite = focus < 0.01;
    materials.edge.depthWrite = focus < 0.01;
    materials.water.opacity =
      vesselReveal *
      (reactor.selected === "coolant" ? 1 : 0.8) *
      (1 - focus * 0.85);
    materials.path.opacity =
      vesselReveal *
      (reactor.selected === "coolant" ? 0.8 : 0.35) *
      (1 - focus * 0.85);
    materials.path.depthTest = reactor.selected !== "coolant";
    materials.water.depthTest = reactor.selected !== "coolant";
    materials.fuel.color.copy(
      reactor.selected === "fuel"
        ? resources.fuelSelected
        : resources.fuelColor,
    );
    materials.fuel.emissiveIntensity =
      reactor.selected === "fuel" ? 0.45 : 0.18;
    materials.control.emissiveIntensity =
      reactor.selected === "control" ? 0.6 : 0.03;
    if (detail.current) {
      detail.current.visible = time > 2.65;
      detail.current.position.set(
        2.4 * separation,
        0.35 * separation,
        2.4 * separation,
      );
      detail.current.scale.set(
        1 + separation * 1.1,
        0.02 + rodReveal * 0.98,
        1 + separation * 1.1,
      );
    }
    if (cladding.current)
      cladding.current.position.set(0.38 * separation, 0, -0.38 * separation);
    if (absorbers.current) absorbers.current.position.y = -insertion;
    if (yoke.current) {
      yoke.current.visible = controlFocus > 0.01;
      yoke.current.scale.set(1.2, 0.09 * controlFocus, 1.2);
    }
    if (neutrons.current) {
      const mesh = neutrons.current;
      mesh.visible =
        controlFocus > 0.01 &&
        inspection.time < 4.8 &&
        !reducedMotion &&
        reactor.selected === "control" &&
        !power;
      if (mesh.visible) {
        for (let index = 0; index < 6; index++) {
          const travel = MathUtils.smoothstep(
            inspection.time,
            2 + index * 0.16,
            3.55 + index * 0.16,
          );
          const [x, z] =
            CONTROL_ROD_POSITIONS[index % CONTROL_ROD_POSITIONS.length];
          const angle = index * 2.4;
          const distance = 0.085 + (1 - travel) * 1.15;
          matrix.position.set(
            x + Math.cos(angle) * distance,
            0.55 + index * 0.24,
            z + Math.sin(angle) * distance,
          );
          matrix.rotation.set(0, 0, 0);
          matrix.scale.setScalar(
            MathUtils.smoothstep(inspection.time, 1.9, 2.2) *
              (1 - MathUtils.smoothstep(travel, 0.84, 1)) *
              1.4 *
              controlFocus,
          );
          matrix.updateMatrix();
          mesh.setMatrixAt(index, matrix.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (core.current) core.current.visible = time > 5.3;
    if (vessel.current) {
      vessel.current.visible = time > 6.3;
      vessel.current.position.y = -(1 - vesselReveal) * 0.4;
    }
    if (head.current) head.current.position.y = 3.25 + (1 - vesselReveal) * 0.8;
    if (heat.current) heat.current.intensity = coreReveal * 3.8;

    if (!power) {
      const focusGoal =
        reactor.selected === "coolant" && reactor.stage === "ready" ? 1 : 0;
      if (immediateFocus) coolantFocus.current = focusGoal;
      else if (playing && visible) {
        coolantFocus.current = MathUtils.damp(
          coolantFocus.current,
          focusGoal,
          3.5,
          Math.min(delta, 0.05),
        );
        if (Math.abs(coolantFocus.current - focusGoal) < 0.0001)
          coolantFocus.current = focusGoal;
      }
      resources.focus
        .fromArray(REACTOR_PARTS.coolant.position)
        .multiplyScalar(coolantFocus.current);
      resources.focus.x += 2.4 * fuelFocus + 0.48 * controlFocus;
      resources.focus.y += 0.35 * fuelFocus + 1.2 * controlFocus;
      resources.focus.z += 2.4 * fuelFocus + 0.48 * controlFocus;
      resources.target.set(
        2.4 * (1 - orbit) + 11 * orbit,
        1.7 * (1 - orbit) + 11 * orbit,
        12 - orbit,
      );
      camera.position.lerpVectors(
        initialCamera.current,
        resources.target,
        arrival,
      );
      camera.position.add(resources.focus);
      if (!reducedMotion) {
        camera.position.x += pointer.current.x * 0.12 * orbit;
        camera.position.z -= pointer.current.x * 0.12 * orbit;
      }
      camera.lookAt(resources.focus);
      if (camera instanceof OrthographicCamera) {
        const compact = size.width < 600;
        const zoom = Math.min(
          size.width / (compact ? 10.8 : 13.4),
          size.height / (compact ? 10.8 : 12.1),
        );
        camera.zoom = MathUtils.lerp(
          initialZoom.current,
          zoom *
            (1 +
              coolantFocus.current * 0.45 +
              fuelFocus * 0.9 +
              controlFocus * 0.65),
          MathUtils.smoothstep(time, 0, 8.6),
        );
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
    }
    if (playing && !reducedMotion && visible)
      flowTime.current += Math.min(delta, 0.05);
    if (flow.current && vesselReveal > 0) {
      for (let index = 0; index < FLOW_COUNT; index++) {
        resources.curve.getPointAt(
          (index / FLOW_COUNT +
            (reducedMotion ? 0 : flowTime.current * 0.055)) %
            1,
          matrix.position,
        );
        matrix.rotation.set(0, 0, 0);
        matrix.scale.setScalar(1);
        matrix.updateMatrix();
        flow.current.setMatrixAt(index, matrix.matrix);
      }
      flow.current.instanceMatrix.needsUpdate = true;
    }
    if (reactor.stage === "ready" && !power) {
      for (let index = 0; index < REACTOR_PART_IDS.length; index++) {
        const button = reactor.hotspots.current[index];
        if (!button) continue;
        resources.point.fromArray(
          REACTOR_PARTS[REACTOR_PART_IDS[index]].position,
        );
        if (index === 0)
          resources.point.lerp(
            resources.target.set(1.75, 0.35, 3.05),
            separation,
          );
        if (index === 1) resources.point.y -= insertion;
        resources.point.project(camera);
        let x = ((resources.point.x + 1) * size.width) / 2;
        let y = ((1 - resources.point.y) * size.height) / 2;
        if (focus > 0.01) {
          x = MathUtils.clamp(x, 26, size.width - 26);
          y = MathUtils.clamp(y, size.width < 600 ? 28 : 200, size.height - 28);
        }
        button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      if (reactor.selected && reactor.label.current) {
        resources.point.fromArray(REACTOR_PARTS[reactor.selected].position);
        if (reactor.selected === "fuel")
          resources.point.set(2.4 * separation, 1.7, 2.4 * separation);
        if (reactor.selected === "control")
          resources.point.set(0.48, 1.5 - insertion, 0.48);
        resources.point.project(camera);
        const x = MathUtils.clamp(
          ((resources.point.x + 1) * size.width) / 2 + 32,
          12,
          size.width - 158,
        );
        const y = MathUtils.clamp(
          ((1 - resources.point.y) * size.height) / 2 - 12,
          12,
          size.height - 40,
        );
        reactor.label.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    }
    if (playing && !reducedMotion) invalidate();
  }, -2);

  const { geometries: g, materials: m } = resources;
  return (
    <group ref={root} dispose={null}>
      <mesh
        ref={pellet}
        geometry={g.pellet}
        material={m.pellet}
        castShadow
        receiveShadow
      />
      <group ref={detail} visible={false}>
        <instancedMesh
          ref={stack}
          args={[g.pellet, m.pellet, 25]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
        <mesh
          ref={cladding}
          geometry={g.rod}
          material={m.cladding}
          scale={[0.16, 4.55, 0.16]}
          castShadow
          receiveShadow
        />
      </group>
      <group ref={core} visible={false}>
        <instancedMesh
          ref={fuel}
          args={[g.cylinder, m.fuel, fuelPositions.length]}
          frustumCulled={false}
          castShadow
          receiveShadow
        />
        <group ref={absorbers}>
          <instancedMesh
            ref={control}
            args={[g.cylinder, m.control, CONTROL_ROD_POSITIONS.length]}
            frustumCulled={false}
            castShadow
            receiveShadow
          />
          <mesh
            ref={yoke}
            geometry={g.box}
            material={m.control}
            position={[0, 3.55, 0]}
            visible={false}
          />
        </group>
        <instancedMesh
          ref={neutrons}
          args={[g.drop, m.neutron, 6]}
          frustumCulled={false}
          visible={false}
        />
        <instancedMesh
          ref={grid}
          args={[g.box, m.edge, 28]}
          frustumCulled={false}
        />
        <pointLight
          ref={heat}
          position={[0.7, -0.4, 1.2]}
          color="#ef9b47"
          intensity={0}
          distance={7}
          decay={2}
        />
        <group ref={vessel} visible={false}>
          <mesh
            geometry={g.vessel}
            material={m.steel}
            castShadow
            receiveShadow
          />
          <mesh geometry={g.cut} material={m.edge} />
          <mesh
            geometry={g.cut}
            material={m.edge}
            rotation={[0, -Math.PI / 2, 0]}
          />
          <mesh
            ref={head}
            geometry={g.head}
            material={m.steel}
            position={[0, 3.25, 0]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={flanges}
            args={[g.ring, m.edge, 3]}
            frustumCulled={false}
          />
          <instancedMesh
            ref={bolts}
            args={[g.cylinder, m.edge, 24]}
            frustumCulled={false}
          />
          <mesh geometry={g.inlet} material={m.steel} />
          <mesh geometry={g.outlet} material={m.steel} />
          <mesh geometry={g.path} material={m.path} renderOrder={1} />
          <instancedMesh
            ref={flow}
            args={[g.drop, m.water, FLOW_COUNT]}
            frustumCulled={false}
            renderOrder={2}
          />
          <instancedMesh
            ref={arrows}
            args={[g.arrow, m.water, 3]}
            frustumCulled={false}
            renderOrder={2}
          />
        </group>
      </group>
    </group>
  );
}
