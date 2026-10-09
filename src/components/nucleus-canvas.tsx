"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import {
  ACESFilmicToneMapping,
  Color,
  DataTexture,
  DirectionalLight,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  PointLight,
  RepeatWrapping,
  RGBAFormat,
  SphereGeometry,
  Vector3,
} from "three";
import { ISOTOPE, NUCLEONS, type ParticleFilter } from "@/lib/nucleus";
import { DAUGHTERS, FISSION_PARTICLES, REACTION_TIMING } from "@/lib/fission";
import { NucleusAtmosphere } from "./nucleus-atmosphere";
import type { FissionController } from "./use-fission";
import type { ReactorController } from "./use-reactor";
import { ReactorScene } from "./reactor-scene";
import type { PowerController } from "./use-power";
import { PowerScene } from "./power-scene";
import { journeyTime, type JourneyController } from "./use-journey";
import { JourneyCamera } from "./journey-camera";

export interface ViewOrientation {
  x: number;
  y: number;
}

interface NucleusCanvasProps {
  filter: ParticleFilter;
  expanded: boolean;
  reducedMotion: boolean;
  playing: boolean;
  visible: boolean;
  orientation: ViewOrientation;
  resetKey: number;
  pointer: RefObject<ViewOrientation>;
  reaction: FissionController;
  reacting: boolean;
  reactor: ReactorController | null;
  power: PowerController | null;
  journey: JourneyController;
  onReady: () => void;
  onContextLost: () => void;
}

function Nucleus({
  filter,
  expanded,
  reducedMotion,
  playing,
  orientation,
  pointer,
  resetKey,
  visible,
  reveal,
  reaction,
  reacting,
  reactor,
  power,
  journey,
}: NucleusCanvasProps & { reveal: RefObject<number> }) {
  const group = useRef<Group>(null);
  const protons = useRef<InstancedMesh>(null);
  const neutrons = useRef<InstancedMesh>(null);
  const spread = useRef(expanded ? 1.16 : 1);
  const rotation = useRef(0);
  const entrance = useRef(reducedMotion ? 1 : 0);
  const inspection = useRef(expanded ? 1 : 0);
  const lastFrame = useRef(0);
  const baseZoom = useRef(80);
  const compact = useRef(false);
  const energyLight = useRef<PointLight>(null);
  const keyLight = useRef<DirectionalLight>(null);
  const rimLight = useRef<DirectionalLight>(null);
  const fillLight = useRef<DirectionalLight>(null);
  const ambientLight = useRef<HemisphereLight>(null);
  const appliedSpread = useRef(-1);
  const appliedReactionTime = useRef(-1);
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const resources = useMemo(() => {
    const geometry = new SphereGeometry(1, 32, 24);
    const vertices = geometry.getAttribute("position");
    for (let index = 0; index < vertices.count; index += 1) {
      const x = vertices.getX(index);
      const y = vertices.getY(index);
      const z = vertices.getZ(index);
      const contour =
        1 + 0.009 * Math.sin(x * 6 + z * 3) * Math.sin(y * 5 - z * 4);
      vertices.setXYZ(index, x * contour, y * contour * 0.97, z * contour);
    }
    geometry.computeVertexNormals();

    const pixels = new Uint8Array(128 * 128 * 4);
    let seed = 235;
    for (let index = 0; index < pixels.length; index += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = 180 + (seed >>> 26);
      pixels[index] = pixels[index + 1] = pixels[index + 2] = grain;
      pixels[index + 3] = 255;
    }
    const surface = new DataTexture(pixels, 128, 128, RGBAFormat);
    surface.wrapS = surface.wrapT = RepeatWrapping;
    surface.repeat.set(5, 3);
    surface.magFilter = LinearFilter;
    surface.minFilter = LinearMipmapLinearFilter;
    surface.generateMipmaps = true;
    surface.needsUpdate = true;

    return {
      geometry,
      surface,
      protonMaterial: new MeshStandardMaterial({
        color: "white",
        roughness: 0.95,
        metalness: 0.28,
        roughnessMap: surface,
        bumpMap: surface,
        bumpScale: 0.008,
        emissive: "#8b3d10",
        emissiveIntensity: 0,
      }),
      neutronMaterial: new MeshStandardMaterial({
        color: "white",
        roughness: 1,
        metalness: 0.2,
        roughnessMap: surface,
        bumpMap: surface,
        bumpScale: 0.01,
      }),
      matrix: new Object3D(),
      tint: new Color(),
      bright: new Color("white"),
      dim: new Color("#354250"),
      focus: new Vector3(),
      projected: new Vector3(),
      incoming: new Vector3(),
    };
  }, []);

  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      compact.current = window.matchMedia("(max-width: 760px)").matches;
      baseZoom.current = Math.min(size.width / 8.5, size.height / 8.6);
      camera.zoom = baseZoom.current;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, size, invalidate]);

  useLayoutEffect(() => {
    if (!protons.current || !neutrons.current) return;
    appliedSpread.current = -1;
    const indices = { proton: 0, neutron: 0 };
    for (const particle of NUCLEONS) {
      const mesh =
        particle.kind === "proton" ? protons.current : neutrons.current;
      resources.tint
        .set(particle.kind === "proton" ? "#bdac91" : "#647b8d")
        .multiplyScalar(particle.shade);
      mesh.setColorAt(indices[particle.kind]++, resources.tint);
    }
    neutrons.current.setColorAt(
      ISOTOPE.neutrons,
      resources.tint.set("#c6ddea"),
    );
    neutrons.current.count = ISOTOPE.neutrons;
    protons.current.instanceMatrix.setUsage(DynamicDrawUsage);
    neutrons.current.instanceMatrix.setUsage(DynamicDrawUsage);
    if (protons.current.instanceColor)
      protons.current.instanceColor.needsUpdate = true;
    if (neutrons.current.instanceColor)
      neutrons.current.instanceColor.needsUpdate = true;
    invalidate();
  }, [resources, invalidate]);

  useEffect(() => {
    const protonMesh = protons.current;
    const neutronMesh = neutrons.current;
    return () => {
      protonMesh?.dispose();
      neutronMesh?.dispose();
      resources.geometry.dispose();
      resources.surface.dispose();
      resources.protonMaterial.dispose();
      resources.neutronMaterial.dispose();
    };
  }, [resources]);

  useEffect(() => {
    rotation.current = 0;
    invalidate();
  }, [resetKey, invalidate]);

  useEffect(() => {
    invalidate();
  }, [
    filter,
    expanded,
    orientation,
    playing,
    reducedMotion,
    reacting,
    reactor?.run,
    reaction.stage,
    invalidate,
  ]);

  useEffect(() => {
    lastFrame.current = 0;
  }, [visible]);

  useFrame(() => {
    if (!group.current || !protons.current || !neutrons.current) return;
    const now = performance.now();
    const elapsed = lastFrame.current ? (now - lastFrame.current) / 1000 : 0;
    lastFrame.current = now;
    const delta = Math.min(elapsed, 0.05);
    const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 4);
    const returningToFission =
      journey.motion?.kind === "return" && journey.motion.from === 2;
    if (reactor && !returningToFission) {
      const changeOfScale = MathUtils.smoothstep(
        journeyTime(journey, 2, reactor.elapsed.current),
        0,
        1.8,
      );
      group.current.visible =
        !power && reactor.fromFission.current && changeOfScale < 1;
      group.current.scale.setScalar(1 - changeOfScale * 0.98);
      reveal.current = 0.1;
      if (keyLight.current) keyLight.current.intensity = 4.6;
      if (rimLight.current) rimLight.current.intensity = 5;
      if (fillLight.current) fillLight.current.intensity = 0.8;
      if (ambientLight.current) ambientLight.current.intensity = 0.6;
      return;
    }
    group.current.visible = true;
    camera.position.z = MathUtils.lerp(camera.position.z, 12, damping);
    if (reacting) {
      const time = journeyTime(journey, 1, reaction.elapsed.current);
      const capture = MathUtils.smoothstep(time, 0, REACTION_TIMING.capture);
      const excitation = MathUtils.smoothstep(
        time,
        REACTION_TIMING.capture,
        REACTION_TIMING.split,
      );
      const separation =
        1 -
        Math.pow(
          1 -
            MathUtils.clamp(
              (time - REACTION_TIMING.split) /
                (REACTION_TIMING.finish - REACTION_TIMING.split),
              0,
              1,
            ),
          3,
        );
      const pulse = reducedMotion
        ? 0
        : Math.exp(-Math.pow((time - REACTION_TIMING.split - 0.18) / 0.55, 2));
      const tension = excitation * (1 - separation);
      reveal.current = 0.18;
      if (keyLight.current) keyLight.current.intensity = 4.2 + pulse * 1.4;
      if (rimLight.current) rimLight.current.intensity = 5 + tension * 1.5;
      if (fillLight.current) fillLight.current.intensity = 0.6;
      if (ambientLight.current) ambientLight.current.intensity = 0.5;
      if (energyLight.current)
        energyLight.current.intensity = 1.2 + tension * 3 + pulse * 12;
      resources.protonMaterial.emissiveIntensity =
        0.015 + tension * 0.07 + pulse * 0.22;
      resources.protonMaterial.color.copy(resources.bright);
      resources.neutronMaterial.color.copy(resources.bright);
      group.current.rotation.x = MathUtils.lerp(
        group.current.rotation.x,
        0.2 - separation * 0.12,
        damping,
      );
      group.current.rotation.y = MathUtils.lerp(
        group.current.rotation.y,
        -0.2 + separation * 0.28,
        damping,
      );
      group.current.rotation.z = MathUtils.lerp(
        group.current.rotation.z,
        -0.12 + (reducedMotion ? 0 : Math.sin(time * 6) * tension * 0.022),
        damping,
      );
      group.current.position.y = 0;
      const reactorScale = reactor
        ? MathUtils.smoothstep(
            journeyTime(journey, 2, reactor.elapsed.current),
            0,
            1.8,
          )
        : 0;
      group.current.visible = reactorScale < 1;
      group.current.scale.setScalar(1 - reactorScale * 0.98);
      camera.position.x = MathUtils.lerp(
        camera.position.x,
        reducedMotion ? 0 : pointer.current.x * 0.06,
        damping,
      );
      camera.position.y = MathUtils.lerp(
        camera.position.y,
        separation * 0.3,
        damping,
      );
      camera.lookAt(resources.focus.set(0, 0, 0));
      if (camera instanceof OrthographicCamera) {
        const zoom =
          baseZoom.current * (1 - separation * 0.28 + tension * 0.045);
        camera.zoom = MathUtils.lerp(camera.zoom, zoom, damping);
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      group.current.updateMatrixWorld();
      if (reaction.stage === "ready" && reaction.dragPoint.current.active) {
        resources.incoming
          .set(0, 0, 0)
          .applyMatrix4(group.current.matrixWorld)
          .project(camera);
        resources.incoming
          .set(
            reaction.dragPoint.current.x,
            reaction.dragPoint.current.y,
            resources.incoming.z,
          )
          .unproject(camera);
        group.current.worldToLocal(resources.incoming);
        reaction.incoming.current[0] = resources.incoming.x;
        reaction.incoming.current[1] = resources.incoming.y;
        reaction.incoming.current[2] = resources.incoming.z;
      }
      if (
        appliedReactionTime.current !== time ||
        reaction.dragPoint.current.active ||
        appliedSpread.current !== -1
      ) {
        let protonIndex = 0;
        let neutronIndex = 0;
        for (let index = 0; index < FISSION_PARTICLES.length; index++) {
          const particle = FISSION_PARTICLES[index];
          let x = particle.position[0] * (1 + tension * 0.3);
          let y = particle.position[1] * (1 - tension * 0.1);
          let z = particle.position[2] * (1 - tension * 0.1);
          if (index === ISOTOPE.massNumber) {
            x = reaction.incoming.current[0] * (1 - capture);
            y = reaction.incoming.current[1] * (1 - capture);
            z = reaction.incoming.current[2] * (1 - capture);
          }
          if (separation > 0) {
            const center =
              particle.fragment === null
                ? null
                : DAUGHTERS[particle.fragment].center;
            x = MathUtils.lerp(
              x,
              particle.destination[0] + (center?.[0] ?? 0),
              separation,
            );
            y = MathUtils.lerp(
              y,
              particle.destination[1] + (center?.[1] ?? 0),
              separation,
            );
            z = MathUtils.lerp(
              z,
              particle.destination[2] + (center?.[2] ?? 0),
              separation,
            );
          }
          resources.matrix.position.set(x, y, z);
          resources.matrix.scale.setScalar(particle.radius);
          resources.matrix.rotation.set(
            particle.position[1] * 2,
            particle.position[2] * 2 +
              separation * (particle.fragment === 0 ? 0.25 : -0.25),
            particle.position[0],
          );
          resources.matrix.updateMatrix();
          if (particle.kind === "proton")
            protons.current.setMatrixAt(protonIndex++, resources.matrix.matrix);
          else
            neutrons.current.setMatrixAt(
              neutronIndex++,
              resources.matrix.matrix,
            );
        }
        neutrons.current.count = ISOTOPE.neutrons + 1;
        protons.current.instanceMatrix.needsUpdate = true;
        neutrons.current.instanceMatrix.needsUpdate = true;
        appliedReactionTime.current = reaction.dragPoint.current.active
          ? -1
          : time;
      }
      appliedSpread.current = -1;
      resources.projected
        .set(0, 0, 0)
        .applyMatrix4(group.current.matrixWorld)
        .project(camera);
      const target = reaction.target.current;
      target.x = ((resources.projected.x + 1) * size.width) / 2;
      target.y = ((1 - resources.projected.y) * size.height) / 2;
      target.radius =
        camera instanceof OrthographicCamera
          ? camera.zoom * 2.05
          : size.width * 0.2;
      if (reaction.captureTarget.current) {
        reaction.captureTarget.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
        reaction.captureTarget.current.style.width = `${target.radius * 2}px`;
        reaction.captureTarget.current.style.height = `${target.radius * 2}px`;
      }
      if (
        reaction.stage === "ready" &&
        reaction.handle.current &&
        !reaction.dragPoint.current.active
      ) {
        resources.projected
          .fromArray(reaction.incoming.current)
          .applyMatrix4(group.current.matrixWorld)
          .project(camera);
        reaction.handle.current.style.transform = `translate3d(${((resources.projected.x + 1) * size.width) / 2}px, ${((1 - resources.projected.y) * size.height) / 2}px, 0)`;
      }
      if (reaction.stage === "complete") {
        for (let index = 0; index < DAUGHTERS.length; index++) {
          const label = reaction.fragmentLabels.current[index];
          if (!label) continue;
          resources.projected
            .fromArray(DAUGHTERS[index].center)
            .add(resources.focus.set(0, -2.45, 0))
            .applyMatrix4(group.current.matrixWorld)
            .project(camera);
          label.style.transform = `translate3d(${((resources.projected.x + 1) * size.width) / 2}px, ${((1 - resources.projected.y) * size.height) / 2}px, 0)`;
        }
      }
      const reactionMoving =
        reaction.stage !== "ready" && reaction.stage !== "complete";
      const settling =
        Math.abs(group.current.rotation.x - (0.2 - separation * 0.12)) >
          0.0001 ||
        Math.abs(group.current.rotation.y - (-0.2 + separation * 0.28)) >
          0.0001 ||
        Math.abs(camera.position.x - pointer.current.x * 0.06) > 0.0001 ||
        (camera instanceof OrthographicCamera &&
          Math.abs(
            camera.zoom -
              baseZoom.current * (1 - separation * 0.28 + tension * 0.045),
          ) > 0.001);
      if (!reducedMotion && ((playing && reactionMoving) || settling))
        invalidate();
      return;
    }
    appliedReactionTime.current = -1;
    neutrons.current.count = ISOTOPE.neutrons;
    if (reducedMotion) entrance.current = 1;
    else if (playing)
      entrance.current = Math.min(1, entrance.current + elapsed / 3);
    const arrival = MathUtils.smoothstep(entrance.current, 0, 1);
    reveal.current = arrival;
    const keyReveal = MathUtils.smoothstep(entrance.current, 0.2, 1);
    const rimReveal = MathUtils.smoothstep(entrance.current, 0, 0.45);
    if (keyLight.current) keyLight.current.intensity = keyReveal * 4.2;
    if (rimLight.current) rimLight.current.intensity = rimReveal * 5;
    if (fillLight.current) fillLight.current.intensity = keyReveal * 0.5;
    if (ambientLight.current) ambientLight.current.intensity = keyReveal * 0.5;

    const gathering = journey.motion?.kind === "gather";
    const nextInspection = expanded && !gathering ? 1 : 0;
    inspection.current = MathUtils.lerp(
      inspection.current,
      nextInspection,
      damping,
    );
    const view = inspection.current;
    const nextSpread = expanded && !gathering ? 1.16 : 1;
    spread.current = MathUtils.lerp(spread.current, nextSpread, damping);
    if (playing && !reducedMotion) rotation.current += delta;
    const phase = rotation.current;
    const pointerX = reducedMotion ? 0 : pointer.current.x * 0.12;
    const pointerY = reducedMotion ? 0 : pointer.current.y * 0.08;
    const targetX = gathering
      ? 0.2
      : 0.3 + orientation.x + Math.sin(phase * 0.16) * 0.02;
    const targetY = gathering
      ? -0.2
      : -0.48 +
        orientation.y +
        Math.sin(phase * 0.12) * 0.085 -
        (1 - arrival) * 0.25;
    group.current.rotation.x = MathUtils.lerp(
      group.current.rotation.x,
      targetX,
      damping,
    );
    group.current.rotation.y = MathUtils.lerp(
      group.current.rotation.y,
      targetY,
      damping,
    );
    group.current.rotation.z = MathUtils.lerp(
      group.current.rotation.z,
      gathering ? -0.12 : -0.28 + Math.sin(phase * 0.12) * 0.018,
      damping,
    );
    const breathing = reducedMotion ? 0 : Math.sin(phase * 0.65) * 0.0015;
    group.current.scale.setScalar(1 + breathing);
    group.current.position.y = Math.sin(phase * 0.23) * 0.025;
    if (energyLight.current)
      energyLight.current.intensity =
        keyReveal * (1.2 + Math.sin(phase * 0.65) * 0.1);
    resources.protonMaterial.emissiveIntensity = keyReveal * 0.015;

    const cameraX = view * 3.2 + pointerX * 0.8 + (1 - arrival) * 0.65;
    const cameraY = view * 0.85 + pointerY * 0.65 + (1 - arrival) * 0.3;
    camera.position.x = MathUtils.lerp(camera.position.x, cameraX, damping);
    camera.position.y = MathUtils.lerp(camera.position.y, cameraY, damping);
    camera.lookAt(
      resources.focus.set(
        view * (compact.current ? 0.18 : 1.15),
        view * (compact.current ? -0.7 : 0.2),
        0,
      ),
    );
    if (camera instanceof OrthographicCamera) {
      const zoom =
        baseZoom.current *
        (0.9 + arrival * 0.1) *
        (1 + view * (compact.current ? 0.02 : 0.15));
      if (Math.abs(camera.zoom - zoom) > 0.001) {
        camera.zoom = MathUtils.lerp(camera.zoom, zoom, damping);
        camera.updateProjectionMatrix();
      }
    }

    if (Math.abs(appliedSpread.current - spread.current) > 0.00001) {
      let protonIndex = 0;
      let neutronIndex = 0;
      for (const particle of NUCLEONS) {
        resources.matrix.position.set(
          particle.position[0] * spread.current,
          particle.position[1] * spread.current,
          particle.position[2] * spread.current,
        );
        resources.matrix.scale.setScalar(particle.radius);
        resources.matrix.rotation.set(
          particle.position[1] * 2,
          particle.position[2] * 2,
          particle.position[0],
        );
        resources.matrix.updateMatrix();
        if (particle.kind === "proton")
          protons.current.setMatrixAt(protonIndex++, resources.matrix.matrix);
        else
          neutrons.current.setMatrixAt(neutronIndex++, resources.matrix.matrix);
      }
      protons.current.instanceMatrix.needsUpdate = true;
      neutrons.current.instanceMatrix.needsUpdate = true;
      appliedSpread.current = spread.current;
    }

    const protonTarget =
      filter === "neutron" ? resources.dim : resources.bright;
    const neutronTarget =
      filter === "proton" ? resources.dim : resources.bright;
    resources.protonMaterial.color.lerp(protonTarget, damping);
    resources.neutronMaterial.color.lerp(neutronTarget, damping);
    const unsettled =
      Math.abs(spread.current - nextSpread) > 0.001 ||
      Math.abs(inspection.current - nextInspection) > 0.0001 ||
      Math.abs(camera.position.x - cameraX) > 0.001 ||
      Math.abs(camera.position.y - cameraY) > 0.001 ||
      Math.abs(group.current.rotation.x - targetX) > 0.001 ||
      Math.abs(group.current.rotation.y - targetY) > 0.001 ||
      Math.abs(resources.protonMaterial.color.r - protonTarget.r) > 0.001 ||
      Math.abs(resources.neutronMaterial.color.r - neutronTarget.r) > 0.001;
    if (!reducedMotion && (playing || unsettled)) invalidate();
  }, -2);

  return (
    <>
      <hemisphereLight ref={ambientLight} args={["#b3c6d8", "#151518", 0]} />
      <directionalLight
        ref={keyLight}
        position={[-5, 7, 4]}
        color="#e8d6ba"
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={power ? -15 : reactor ? -6 : -4}
        shadow-camera-right={power ? 15 : reactor ? 6 : 4}
        shadow-camera-top={power ? 15 : reactor ? 6 : 4}
        shadow-camera-bottom={power ? -15 : reactor ? -6 : -4}
        shadow-camera-near={0.5}
        shadow-camera-far={power ? 40 : 22}
        shadow-normalBias={0.025}
        shadow-bias={-0.0001}
        shadow-radius={3}
      />
      <directionalLight
        ref={rimLight}
        position={[4, 2, -4]}
        color="#719bbf"
        intensity={0}
      />
      <directionalLight
        ref={fillLight}
        position={[-1, -3, 4]}
        color="#7b8aa2"
        intensity={0}
      />
      <group ref={group}>
        <pointLight
          ref={energyLight}
          position={[0.1, 0.2, 0.5]}
          color="#ec8533"
          intensity={0}
          distance={5}
          decay={2}
        />
        <instancedMesh
          ref={protons}
          args={[resources.geometry, resources.protonMaterial, ISOTOPE.protons]}
          frustumCulled={false}
          castShadow
          receiveShadow
          dispose={null}
        />
        <instancedMesh
          ref={neutrons}
          args={[
            resources.geometry,
            resources.neutronMaterial,
            ISOTOPE.neutrons + 1,
          ]}
          frustumCulled={false}
          castShadow
          receiveShadow
          dispose={null}
        />
      </group>
    </>
  );
}

function SceneLifecycle({
  onReady,
  onContextLost,
  visible,
  reducedMotion,
}: NucleusCanvasProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    const container = canvas.closest(".atom-composition");
    const requestFrame = (event: Event) => {
      if (
        reducedMotion &&
        event instanceof PointerEvent &&
        (event.type === "pointermove" || event.type === "pointerleave") &&
        event.buttons === 0
      )
        return;
      invalidate();
    };
    const handleKey = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape")
        invalidate();
    };
    container?.addEventListener("pointermove", requestFrame);
    container?.addEventListener("pointerleave", requestFrame);
    container?.addEventListener("pointerup", requestFrame);
    container?.addEventListener("pointercancel", requestFrame);
    container?.addEventListener("lostpointercapture", requestFrame);
    container?.addEventListener("keydown", handleKey);
    onReady();
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      container?.removeEventListener("pointermove", requestFrame);
      container?.removeEventListener("pointerleave", requestFrame);
      container?.removeEventListener("pointerup", requestFrame);
      container?.removeEventListener("pointercancel", requestFrame);
      container?.removeEventListener("lostpointercapture", requestFrame);
      container?.removeEventListener("keydown", handleKey);
    };
  }, [gl, onReady, onContextLost, invalidate, reducedMotion]);

  useEffect(() => {
    if (visible) invalidate();
  }, [visible, invalidate]);

  return null;
}

export default function NucleusCanvas(props: NucleusCanvasProps) {
  const reveal = useRef(props.reducedMotion ? 1 : 0);
  return (
    <Canvas
      orthographic
      resize={{ debounce: 0 }}
      shadows="percentage"
      camera={{ position: [0, 0, 12], zoom: 80, near: 0.1, far: 80 }}
      dpr={[1, 1.5]}
      frameloop={props.visible ? "demand" : "never"}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
    >
      <Nucleus {...props} reveal={reveal} />
      {props.reactor && (
        <ReactorScene
          reactor={props.reactor}
          power={props.power}
          playing={props.playing}
          reducedMotion={props.reducedMotion}
          visible={props.visible}
          pointer={props.pointer}
          journey={props.journey}
        />
      )}
      {props.power && (
        <PowerScene
          power={props.power}
          playing={props.playing}
          reducedMotion={props.reducedMotion}
          visible={props.visible}
          pointer={props.pointer}
          journey={props.journey}
        />
      )}
      <JourneyCamera journey={props.journey} />
      <NucleusAtmosphere
        playing={props.playing && !props.reacting}
        reducedMotion={props.reducedMotion}
        pointer={props.pointer}
        reveal={reveal}
      />
      <SceneLifecycle {...props} />
    </Canvas>
  );
}
