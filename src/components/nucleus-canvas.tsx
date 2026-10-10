"use client";

import { NUCLEUS_COLORS, SCENE_LIGHTS } from "@/lib/scene-colors";
import type { ViewOrientation } from "@/lib/scene";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
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
import {
  DAUGHTERS,
  FISSION_PARTICLES,
  FISSION_FRAGMENT_SCALE,
  REACTION_TIMING,
} from "@/lib/fission";
import { NucleusAtmosphere } from "./nucleus-atmosphere";
import type { FissionController } from "./use-fission";
import type { ReactorController } from "./use-reactor";
import { ReactorScene } from "./reactor-scene";
import type { PowerController } from "./use-power";
import { PowerScene } from "./power-scene";
import { journeyTime, type JourneyController } from "./use-journey";
import { JourneyCamera } from "./journey-camera";
import { FissionEnergy } from "./fission-energy";

const EMITTED_NEUTRONS = FISSION_PARTICLES.filter(
  (particle) => particle.fragment === null,
);

interface NucleusCanvasProps {
  opening?: {
    progress: RefObject<number>;
    settling: RefObject<boolean>;
    beat: "arrival" | "approach" | "inspect" | "neutron";
  } | null;
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
  opening,
}: NucleusCanvasProps & { reveal: RefObject<number> }) {
  const group = useRef<Group>(null);
  const protons = useRef<InstancedMesh>(null);
  const neutrons = useRef<InstancedMesh>(null);
  const frameSpecks = useRef<InstancedMesh>(null);
  const spread = useRef(expanded ? 1.16 : 1);
  const rotation = useRef(0);
  const afterglow = useRef(0);
  const insideReactor = reactor !== null;
  const openingActive = Boolean(opening);
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
  const appliedForm = useRef(-1);
  const appliedReactionTime = useRef(-1);
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const resources = useMemo(() => {
    const geometry = new SphereGeometry(1, 32, 24);
    const openingGeometry = geometry.clone();
    const vertices = geometry.getAttribute("position");
    for (let index = 0; index < vertices.count; index += 1) {
      const x = vertices.getX(index);
      const y = vertices.getY(index);
      const z = vertices.getZ(index);
      const contour =
        1 +
        0.014 * Math.sin(x * 6 + z * 3) * Math.sin(y * 5 - z * 4) +
        0.009 * Math.cos(x * 11 - y * 7 + z * 4);
      vertices.setXYZ(index, x * contour, y * contour * 0.97, z * contour);
    }
    geometry.computeVertexNormals();

    const pixels = new Uint8Array(128 * 128 * 4);
    let seed = 235;
    for (let index = 0; index < pixels.length; index += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const u = (index / 4) % 128;
      const v = Math.floor(index / 512);
      const grain = Math.min(
        255,
        Math.round(
          162 +
            15 *
              Math.sin(u * 0.31 + Math.sin(v * 0.17) * 3) *
              Math.cos(v * 0.27) +
            (seed >>> 26),
        ),
      );
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

    let packingSeed = 235031;
    const random = () => {
      packingSeed = (Math.imul(packingSeed, 1664525) + 1013904223) >>> 0;
      return packingSeed / 4294967296;
    };
    const openingNucleons = NUCLEONS.map((particle, index) => {
      const [x, y, z] = particle.position;
      const twist = y * 0.27 + Math.sin(z * 1.35) * 0.16;
      return {
        x:
          (x * Math.cos(twist) -
            z * Math.sin(twist) +
            Math.sin(y * 2.4 + z * 0.8) * 0.16 +
            (random() - 0.5) * 0.72) *
          0.95,
        y:
          (y + Math.sin(x * 1.8 - z * 0.9) * 0.14 + (random() - 0.5) * 0.72) *
          1.1,
        z:
          (x * Math.sin(twist) + z * Math.cos(twist)) * 1.08 +
          Math.sin(x * 2 + y * 1.5) * 0.12 +
          (random() - 0.5) * 0.72,
        radius:
          particle.radius *
          (0.94 + (Math.sin(index * 8.13) * 0.5 + 0.5) * 0.16),
      };
    });
    for (let pass = 0; pass < 24; pass++) {
      for (let i = 0; i < openingNucleons.length; i++) {
        const a = openingNucleons[i];
        for (let j = i + 1; j < openingNucleons.length; j++) {
          const b = openingNucleons[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const distanceSquared = dx * dx + dy * dy + dz * dz;
          const contact = (a.radius + b.radius) * 0.985;
          if (distanceSquared >= contact * contact) continue;
          const distance = Math.sqrt(Math.max(distanceSquared, 0.000001));
          const push = ((contact - distance) / distance) * 0.46;
          a.x -= dx * push;
          a.y -= dy * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.y += dy * push;
          b.z += dz * push;
        }
        a.x *= 0.999;
        a.y *= 0.999;
        a.z *= 0.999;
      }
    }

    return {
      specks: [
        [-1.28, 3.03, 0.4, 0.075],
        [-3.12, 1.2, 1.1, 0.052],
        [-3.02, -1.82, 0.5, 0.068],
        [-1.1, -3.42, 0.5, 0.046],
        [2.65, -2.86, -0.7, 0.056],
        [3.28, 1.98, 0.9, 0.06],
        [3.48, -0.85, -0.8, 0.045],
        [0.75, -3.75, 0.4, 0.056],
      ],
      openingNucleons,
      geometry,
      openingGeometry,
      surface,
      protonMaterial: new MeshStandardMaterial({
        color: "white",
        roughness: 0.86,
        metalness: 0.24,
        map: surface,
        bumpMap: surface,
        bumpScale: 0.008,
        emissive: NUCLEUS_COLORS.protonEmission,
        emissiveIntensity: 0,
      }),
      neutronMaterial: new MeshStandardMaterial({
        color: "white",
        roughness: 0.9,
        metalness: 0.3,
        map: surface,
        bumpMap: surface,
        bumpScale: 0.009,
      }),
      matrix: new Object3D(),
      tint: new Color(),
      bright: new Color("white"),
      dim: new Color(NUCLEUS_COLORS.inactive),
      protonFocus: new Color(),
      neutronFocus: new Color(),
      openingKey: new Color(SCENE_LIGHTS.atom.key),
      reactionKey: new Color(SCENE_LIGHTS.fission.key),
      openingRim: new Color(SCENE_LIGHTS.atom.rim),
      reactionRim: new Color(SCENE_LIGHTS.fission.rim),
      openingFill: new Color(SCENE_LIGHTS.atom.fill),
      reactionFill: new Color(SCENE_LIGHTS.fission.fill),
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
    const geometry = insideReactor
      ? resources.geometry
      : resources.openingGeometry;
    if (protons.current) protons.current.geometry = geometry;
    if (neutrons.current) neutrons.current.geometry = geometry;
    for (const material of [
      resources.protonMaterial,
      resources.neutronMaterial,
    ]) {
      material.map = insideReactor ? resources.surface : null;
      material.bumpMap =
        insideReactor || openingActive ? resources.surface : null;
      material.needsUpdate = true;
    }
    invalidate();
  }, [insideReactor, openingActive, resources, invalidate]);

  useLayoutEffect(() => {
    if (!protons.current || !neutrons.current) return;
    appliedSpread.current = -1;
    const indices = { proton: 0, neutron: 0 };
    for (const particle of NUCLEONS) {
      const mesh =
        particle.kind === "proton" ? protons.current : neutrons.current;
      resources.tint
        .set(
          particle.kind === "proton"
            ? NUCLEUS_COLORS.proton
            : NUCLEUS_COLORS.neutron,
        )
        .multiplyScalar(particle.shade);
      mesh.setColorAt(indices[particle.kind]++, resources.tint);
    }
    neutrons.current.setColorAt(
      ISOTOPE.neutrons,
      resources.tint.set(NUCLEUS_COLORS.incomingNeutron),
    );
    neutrons.current.count = ISOTOPE.neutrons;
    protons.current.instanceMatrix.setUsage(DynamicDrawUsage);
    neutrons.current.instanceMatrix.setUsage(DynamicDrawUsage);
    if (protons.current.instanceColor)
      protons.current.instanceColor.needsUpdate = true;
    if (neutrons.current.instanceColor)
      neutrons.current.instanceColor.needsUpdate = true;
    const speckMesh = frameSpecks.current;
    if (speckMesh) {
      resources.specks.forEach((_, index) => {
        speckMesh.setColorAt(
          index,
          resources.tint.set(
            index % 3 === 1 ? NUCLEUS_COLORS.neutron : NUCLEUS_COLORS.proton,
          ),
        );
      });
      speckMesh.instanceMatrix.setUsage(DynamicDrawUsage);
      if (speckMesh.instanceColor) speckMesh.instanceColor.needsUpdate = true;
    }
    invalidate();
  }, [resources, invalidate]);

  useEffect(() => {
    const protonMesh = protons.current;
    const neutronMesh = neutrons.current;
    const speckMesh = frameSpecks.current;
    return () => {
      protonMesh?.dispose();
      neutronMesh?.dispose();
      speckMesh?.dispose();
      resources.geometry.dispose();
      resources.openingGeometry.dispose();
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
    opening?.beat,
    reactor?.run,
    reaction.stage,
    invalidate,
  ]);

  useEffect(() => {
    lastFrame.current = 0;
  }, [visible]);

  const updateIncoming = useCallback(() => {
    if (
      !group.current ||
      reaction.stage !== "ready" ||
      !reaction.dragPoint.current.active
    )
      return;
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
  }, [camera, reaction, resources]);

  const projectReactionControls = useCallback(() => {
    if (!group.current) return;
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
  }, [camera, reaction, resources, size]);

  useFrame(() => {
    if (!group.current || !protons.current || !neutrons.current) return;
    const now = performance.now();
    const elapsed = lastFrame.current ? (now - lastFrame.current) / 1000 : 0;
    lastFrame.current = now;
    const delta = Math.min(elapsed, 0.05);
    const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 4);
    const openingProgress = opening
      ? MathUtils.clamp(opening.progress.current, 0, 1)
      : 0;
    const scrollSettling = opening?.settling.current ?? false;
    const handoff = opening
      ? MathUtils.smootherstep(openingProgress, 0.72, 0.9)
      : 0;
    const returningToFission =
      journey.motion?.kind === "return" && journey.motion.from === 2;
    resources.protonMaterial.roughness = reacting
      ? 0.86
      : opening
        ? 0.82 + handoff * 0.04
        : 0.72;
    resources.neutronMaterial.roughness = reacting
      ? 0.9
      : opening
        ? 0.87 + handoff * 0.03
        : 0.76;
    resources.protonMaterial.bumpScale = insideReactor
      ? 0.008
      : opening
        ? 0.0015 * (1 - handoff)
        : 0;
    resources.neutronMaterial.bumpScale = insideReactor
      ? 0.009
      : opening
        ? 0.0018 * (1 - handoff)
        : 0;
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
      if (keyLight.current) keyLight.current.intensity = power ? 1.5 : 3.1;
      if (rimLight.current) rimLight.current.intensity = power ? 1.7 : 1.5;
      if (fillLight.current) fillLight.current.intensity = power ? 0.8 : 1.1;
      if (ambientLight.current)
        ambientLight.current.intensity = power ? 0.2 : 0.32;
      return;
    }
    group.current.visible = true;
    camera.position.z = MathUtils.lerp(camera.position.z, 12, damping);
    if (reacting) {
      if (reaction.stage !== "complete" || reducedMotion) afterglow.current = 0;
      else if (playing) afterglow.current += delta;
      const drift = afterglow.current;
      const time = journeyTime(journey, 1, reaction.elapsed.current);
      const capture = MathUtils.smoothstep(time, 0, REACTION_TIMING.capture);
      const excitation = MathUtils.smoothstep(
        time,
        REACTION_TIMING.capture,
        REACTION_TIMING.split,
      );
      const separation = MathUtils.smootherstep(
        time,
        REACTION_TIMING.split,
        REACTION_TIMING.finish - 0.6,
      );
      const emission =
        1 -
        Math.pow(
          1 -
            MathUtils.clamp((time - REACTION_TIMING.split - 0.14) / 1.8, 0, 1),
          3,
        );
      const pulse = reducedMotion
        ? 0
        : Math.exp(-Math.pow((time - REACTION_TIMING.split - 0.26) / 0.38, 2));
      const tension = excitation * (1 - separation);
      reveal.current = 0.35;
      if (keyLight.current) keyLight.current.intensity = 4.2 - tension;
      if (rimLight.current) rimLight.current.intensity = 3.2 + tension;
      if (fillLight.current) fillLight.current.intensity = 0.5;
      if (ambientLight.current) ambientLight.current.intensity = 0.48;
      if (energyLight.current)
        energyLight.current.intensity =
          tension * 8 +
          pulse * 38 +
          separation * 65 * (1 + Math.sin(drift * 0.8) * 0.025);
      resources.protonMaterial.emissiveIntensity =
        tension * 0.025 + pulse * 0.1 + separation * 0.025;
      resources.protonMaterial.color.copy(resources.bright);
      resources.neutronMaterial.color.copy(resources.bright);
      const targetRotationX =
        0.2 - separation * 0.12 + Math.sin(drift * 0.16) * 0.018;
      const targetRotationY =
        -0.2 + separation * 0.28 + Math.sin(drift * 0.2) * 0.025;
      group.current.rotation.x = MathUtils.lerp(
        group.current.rotation.x,
        targetRotationX,
        damping,
      );
      group.current.rotation.y = MathUtils.lerp(
        group.current.rotation.y,
        targetRotationY,
        damping,
      );
      group.current.rotation.z = MathUtils.lerp(
        group.current.rotation.z,
        -0.12 + separation * 0.08 - tension * 0.055,
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
      const cameraX =
        (reducedMotion ? 0 : pointer.current.x * 0.08) -
        tension * 0.6 +
        separation * 0.35 +
        Math.sin(drift * 0.22) * 0.12;
      camera.position.x = MathUtils.lerp(camera.position.x, cameraX, damping);
      camera.position.y = MathUtils.lerp(
        camera.position.y,
        tension * 0.2 - separation * 0.15 + Math.sin(drift * 0.18) * 0.04,
        damping,
      );
      camera.lookAt(
        resources.focus.set(separation * 0.12, -separation * 0.08, 0),
      );
      camera.updateMatrixWorld();
      group.current.updateMatrixWorld();
      let reactionZoom =
        baseZoom.current *
        (1 - separation * (compact.current ? 0.38 : 0.22) + tension * 0.065);
      if (camera instanceof OrthographicCamera) {
        let frameZoom = Infinity;
        if (emission > 0) {
          const halfWidth = Math.max(1, size.width / 2 - 16);
          const halfHeight = Math.max(1, size.height / 2 - 16);
          for (const particle of EMITTED_NEUTRONS) {
            resources.projected
              .set(
                MathUtils.lerp(
                  particle.position[0] * (1 + tension * 0.3),
                  particle.destination[0],
                  emission,
                ),
                MathUtils.lerp(
                  particle.position[1] * (1 - tension * 0.1),
                  particle.destination[1],
                  emission,
                ),
                MathUtils.lerp(
                  particle.position[2] * (1 - tension * 0.1),
                  particle.destination[2],
                  emission,
                ),
              )
              .applyMatrix4(group.current.matrixWorld)
              .applyMatrix4(camera.matrixWorldInverse);
            const haloRadius =
              Math.hypot(
                particle.radius * 1.8,
                particle.radius * 1.8,
                particle.radius + 0.08,
              ) * group.current.scale.x;
            frameZoom = Math.min(
              frameZoom,
              halfWidth / (Math.abs(resources.projected.x) + haloRadius),
              halfHeight / (Math.abs(resources.projected.y) + haloRadius),
            );
          }
        }
        reactionZoom = Math.min(reactionZoom, frameZoom);
        camera.zoom = Math.min(
          MathUtils.lerp(camera.zoom, reactionZoom, damping),
          frameZoom,
        );
        camera.updateProjectionMatrix();
      }
      updateIncoming();
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
            const travel = particle.fragment === null ? emission : separation;
            x = MathUtils.lerp(
              x,
              particle.destination[0] + (center?.[0] ?? 0),
              travel,
            );
            y = MathUtils.lerp(
              y,
              particle.destination[1] + (center?.[1] ?? 0),
              travel,
            );
            z = MathUtils.lerp(
              z,
              particle.destination[2] + (center?.[2] ?? 0),
              travel,
            );
          }
          resources.matrix.position.set(x, y, z);
          resources.matrix.scale.setScalar(
            particle.radius *
              (particle.fragment === null
                ? 1
                : 1 + separation * (FISSION_FRAGMENT_SCALE - 1)),
          );
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
      projectReactionControls();
      if (reaction.stage === "complete") {
        if (reaction.emissionLabel.current) {
          resources.projected
            .set(4.55, 4.25, 1.2)
            .applyMatrix4(group.current.matrixWorld)
            .project(camera);
          reaction.emissionLabel.current.style.transform = `translate3d(${((resources.projected.x + 1) * size.width) / 2}px, ${((1 - resources.projected.y) * size.height) / 2}px, 0)`;
        }
        for (let index = 0; index < DAUGHTERS.length; index++) {
          const label = reaction.fragmentLabels.current[index];
          if (!label) continue;
          resources.projected
            .fromArray(DAUGHTERS[index].center)
            .add(
              resources.focus.set(
                compact.current ? 0 : index === 0 ? -1.8 : 2.55,
                compact.current
                  ? index === 0
                    ? -3
                    : -2.5
                  : index === 0
                    ? 2.3
                    : 1.3,
                0.5,
              ),
            )
            .applyMatrix4(group.current.matrixWorld)
            .project(camera);
          label.style.transform = `translate3d(${((resources.projected.x + 1) * size.width) / 2}px, ${((1 - resources.projected.y) * size.height) / 2}px, 0)`;
        }
      }
      const reactionMoving =
        reaction.stage !== "ready" && reaction.stage !== "complete";
      const settling =
        Math.abs(group.current.rotation.x - targetRotationX) > 0.0001 ||
        Math.abs(group.current.rotation.y - targetRotationY) > 0.0001 ||
        Math.abs(camera.position.x - cameraX) > 0.0001 ||
        (camera instanceof OrthographicCamera &&
          Math.abs(camera.zoom - reactionZoom) > 0.001);
      if (
        !reducedMotion &&
        ((playing && (reactionMoving || reaction.stage === "complete")) ||
          settling)
      )
        invalidate();
      return;
    }
    appliedReactionTime.current = -1;
    const openingNeutron =
      opening?.beat === "neutron" && reaction.stage === "ready";
    neutrons.current.count = ISOTOPE.neutrons + (openingNeutron ? 1 : 0);
    if (reducedMotion) entrance.current = 1;
    else if (playing)
      entrance.current = Math.min(
        1,
        entrance.current + elapsed / (opening ? 2 : 3),
      );
    const arrival = MathUtils.smoothstep(entrance.current, 0, 1);
    reveal.current = MathUtils.lerp(
      opening ? 0.2 + arrival * 0.8 : arrival,
      0.35,
      handoff,
    );
    const keyReveal = opening
      ? 0.3 + arrival * 0.7
      : MathUtils.smootherstep(entrance.current, 0.12, 0.92);
    const rimReveal = opening
      ? 0.35 + arrival * 0.65
      : MathUtils.smoothstep(entrance.current, 0, 0.45);
    if (keyLight.current) {
      keyLight.current.intensity = MathUtils.lerp(
        keyReveal * 4.5,
        4.2,
        handoff,
      );
      if (opening) {
        keyLight.current.position.set(
          -6 + handoff,
          5 + handoff,
          5 - handoff * 0.5,
        );
        keyLight.current.color
          .copy(resources.openingKey)
          .lerp(resources.reactionKey, handoff);
        keyLight.current.shadow.intensity = 0.84 + handoff * 0.16;
      }
    }
    if (rimLight.current) {
      rimLight.current.intensity = MathUtils.lerp(
        rimReveal * 1.8,
        3.2,
        handoff,
      );
      if (opening) {
        rimLight.current.position.set(4, 2 - handoff * 0.5, -4 + handoff);
        rimLight.current.color
          .copy(resources.openingRim)
          .lerp(resources.reactionRim, handoff);
      }
    }
    if (fillLight.current) {
      fillLight.current.intensity = MathUtils.lerp(rimReveal * 7, 0.5, handoff);
      if (opening) {
        fillLight.current.position.set(
          -5 + handoff * 4,
          2 - handoff * 5,
          handoff * 4,
        );
        fillLight.current.color
          .copy(resources.openingFill)
          .lerp(resources.reactionFill, handoff);
      }
    }
    if (ambientLight.current)
      ambientLight.current.intensity = MathUtils.lerp(
        keyReveal * 0.35,
        0.48,
        handoff,
      );

    const gathering = journey.motion?.kind === "gather";
    const form = opening
      ? 1 - handoff
      : gathering
        ? 1 - MathUtils.smootherstep(journey.progress.current, 0, 1)
        : 1;
    const nextInspection = expanded && !gathering && !opening ? 1 : 0;
    inspection.current = MathUtils.lerp(
      inspection.current,
      nextInspection,
      damping,
    );
    const view = inspection.current;
    const nextSpread = expanded && !gathering && !opening ? 1.16 : 1;
    spread.current = opening
      ? 1
      : MathUtils.lerp(spread.current, nextSpread, damping);
    if (playing && !reducedMotion) rotation.current += delta;
    const phase = rotation.current;
    if (frameSpecks.current)
      frameSpecks.current.visible = !expanded && handoff < 0.95;
    if (frameSpecks.current && !expanded) {
      const frameScale = compact.current ? 0.88 : 1;
      for (let index = 0; index < resources.specks.length; index++) {
        const [x, y, z, radius] = resources.specks[index];
        resources.matrix.position.set(
          x * frameScale + Math.sin(phase * 0.18 + index) * 0.025,
          y * frameScale + Math.sin(phase * 0.3 + index * 0.75) * 0.04,
          z,
        );
        resources.matrix.rotation.set(0, 0, 0);
        resources.matrix.scale.setScalar(radius * (1 - handoff));
        resources.matrix.updateMatrix();
        frameSpecks.current.setMatrixAt(index, resources.matrix.matrix);
      }
      frameSpecks.current.instanceMatrix.needsUpdate = true;
    }
    const pointerX = reducedMotion || !playing ? 0 : pointer.current.x * 0.12;
    const pointerY = reducedMotion || !playing ? 0 : pointer.current.y * 0.08;
    const approach = MathUtils.smootherstep(openingProgress, 0.05, 0.45);
    const targetX = opening
      ? MathUtils.lerp(
          0.3 +
            orientation.x -
            approach * 0.065 +
            Math.sin(phase * 0.16) * 0.02,
          0.2,
          handoff,
        )
      : gathering
        ? 0.2
        : 0.3 + orientation.x + Math.sin(phase * 0.16) * 0.02;
    const targetY = opening
      ? MathUtils.lerp(
          -0.48 +
            orientation.y +
            (reducedMotion ? 0 : approach * 0.31) +
            Math.sin(phase * 0.12) * 0.04 -
            (1 - arrival) * 0.15,
          -0.2,
          handoff,
        )
      : gathering
        ? -0.2
        : -0.48 +
          orientation.y +
          Math.sin(phase * 0.12) * 0.085 -
          (1 - arrival) * 0.25;
    group.current.rotation.x = MathUtils.lerp(
      group.current.rotation.x,
      targetX,
      opening ? 1 : damping,
    );
    group.current.rotation.y = MathUtils.lerp(
      group.current.rotation.y,
      targetY,
      opening ? 1 : damping,
    );
    group.current.rotation.z = MathUtils.lerp(
      group.current.rotation.z,
      opening
        ? MathUtils.lerp(-0.28 + Math.sin(phase * 0.12) * 0.018, -0.12, handoff)
        : gathering
          ? -0.12
          : -0.28 + Math.sin(phase * 0.12) * 0.018,
      opening ? 1 : damping,
    );
    const breathing = reducedMotion ? 0 : Math.sin(phase * 0.65) * 0.0015;
    group.current.scale.setScalar(
      opening
        ? MathUtils.lerp(0.98 * (1 + breathing), 1, handoff)
        : (0.92 + view * 0.08) * (1 + breathing),
    );
    group.current.position.y = Math.sin(phase * 0.23) * 0.025 * (1 - handoff);
    if (energyLight.current) energyLight.current.intensity = 0;
    resources.protonMaterial.emissiveIntensity = 0;

    const scrollFocus =
      (compact.current ? -0.08 : -1.15 + approach * 0.18) * (1 - handoff);
    const cameraX = opening
      ? scrollFocus + pointerX * MathUtils.lerp(0.8, 2 / 3, handoff)
      : view * 3.2 + pointerX * 0.8 + (1 - arrival) * 0.65;
    const cameraY = opening
      ? (approach * 0.12 + pointerY * 0.65) * (1 - handoff)
      : view * 0.85 + pointerY * 0.65 + (1 - arrival) * 0.3;
    camera.position.x = MathUtils.lerp(
      camera.position.x,
      cameraX,
      opening ? 1 : damping,
    );
    camera.position.y = MathUtils.lerp(
      camera.position.y,
      cameraY,
      opening ? 1 : damping,
    );
    if (opening) camera.position.z = 12;
    camera.lookAt(
      resources.focus.set(
        opening ? scrollFocus : view * (compact.current ? 0.18 : 1.6),
        opening
          ? approach * 0.1 * (1 - handoff)
          : view * (compact.current ? -0.7 : 0.2),
        0,
      ),
    );
    if (camera instanceof OrthographicCamera) {
      const zoom =
        baseZoom.current *
        (opening
          ? MathUtils.lerp(
              (compact.current ? 1 : 1.08) +
                approach * (compact.current ? 0.17 : 0.28),
              1,
              handoff,
            )
          : (0.94 + arrival * 0.06) *
            (1 + view * (compact.current ? 0.02 : -0.05)));
      if (Math.abs(camera.zoom - zoom) > 0.001) {
        camera.zoom = MathUtils.lerp(camera.zoom, zoom, opening ? 1 : damping);
        camera.updateProjectionMatrix();
      }
    }

    if (
      Math.abs(appliedSpread.current - spread.current) > 0.00001 ||
      appliedForm.current !== form
    ) {
      let protonIndex = 0;
      let neutronIndex = 0;
      for (let index = 0; index < NUCLEONS.length; index++) {
        const particle = NUCLEONS[index];
        const opening = resources.openingNucleons[index];
        resources.matrix.position.set(
          MathUtils.lerp(particle.position[0], opening.x, form) *
            spread.current,
          MathUtils.lerp(particle.position[1], opening.y, form) *
            spread.current,
          MathUtils.lerp(particle.position[2], opening.z, form) *
            spread.current,
        );
        resources.matrix.scale.setScalar(
          MathUtils.lerp(particle.radius, opening.radius, form),
        );
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
      appliedForm.current = form;
    }

    if (openingNeutron) {
      camera.updateMatrixWorld();
      group.current.updateMatrixWorld();
      updateIncoming();
      resources.matrix.position.fromArray(reaction.incoming.current);
      resources.matrix.scale.setScalar(
        FISSION_PARTICLES[ISOTOPE.massNumber].radius,
      );
      resources.matrix.rotation.set(0, 0, 0);
      resources.matrix.updateMatrix();
      neutrons.current.setMatrixAt(ISOTOPE.neutrons, resources.matrix.matrix);
      neutrons.current.instanceMatrix.needsUpdate = true;
      projectReactionControls();
    }

    const protonTarget = resources.protonFocus
      .copy(filter === "neutron" ? resources.dim : resources.bright)
      .lerp(resources.bright, handoff);
    const neutronTarget = resources.neutronFocus
      .copy(filter === "proton" ? resources.dim : resources.bright)
      .lerp(resources.bright, handoff);
    resources.protonMaterial.color.lerp(
      protonTarget,
      handoff === 1 ? 1 : damping,
    );
    resources.neutronMaterial.color.lerp(
      neutronTarget,
      handoff === 1 ? 1 : damping,
    );
    const unsettled =
      Math.abs(spread.current - nextSpread) > 0.001 ||
      Math.abs(inspection.current - nextInspection) > 0.0001 ||
      Math.abs(camera.position.x - cameraX) > 0.001 ||
      Math.abs(camera.position.y - cameraY) > 0.001 ||
      Math.abs(group.current.rotation.x - targetX) > 0.001 ||
      Math.abs(group.current.rotation.y - targetY) > 0.001 ||
      Math.abs(resources.protonMaterial.color.r - protonTarget.r) > 0.001 ||
      Math.abs(resources.neutronMaterial.color.r - neutronTarget.r) > 0.001;
    if (!reducedMotion && (playing || unsettled || scrollSettling))
      invalidate();
  }, -2);

  return (
    <>
      <hemisphereLight
        ref={ambientLight}
        args={[SCENE_LIGHTS.sky, SCENE_LIGHTS.ground, 0]}
      />
      <directionalLight
        ref={keyLight}
        position={reactor ? [-5, 7, 4] : reacting ? [-5, 6, 4.5] : [-6, 5, 5]}
        color={
          reactor
            ? SCENE_LIGHTS.reactor.key
            : reacting
              ? SCENE_LIGHTS.fission.key
              : SCENE_LIGHTS.atom.key
        }
        intensity={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={power ? -15 : reactor ? -10 : -4}
        shadow-camera-right={power ? 15 : reactor ? 12 : 4}
        shadow-camera-top={power ? 15 : reactor ? 11 : 4}
        shadow-camera-bottom={power ? -15 : reactor ? -9 : -4}
        shadow-camera-near={0.5}
        shadow-camera-far={reactor ? 40 : 22}
        shadow-normalBias={reactor ? 0.025 : 0.045}
        shadow-intensity={reacting ? 1 : 0.84}
        shadow-bias={-0.0001}
        shadow-radius={3}
      />
      <directionalLight
        ref={rimLight}
        position={reactor ? [4, 2, -4] : reacting ? [4, 1.5, -3] : [4, 2, -4]}
        color={reacting ? SCENE_LIGHTS.fission.rim : SCENE_LIGHTS.atom.rim}
        intensity={0}
      />
      <directionalLight
        ref={fillLight}
        position={
          reactor && !power ? [2, 6, 12] : reacting ? [-1, -3, 4] : [-5, 2, 0]
        }
        color={
          reactor && !power
            ? SCENE_LIGHTS.reactor.fill
            : reacting
              ? SCENE_LIGHTS.fission.fill
              : SCENE_LIGHTS.atom.fill
        }
        intensity={0}
      />
      <instancedMesh
        ref={frameSpecks}
        args={[
          resources.openingGeometry,
          resources.protonMaterial,
          resources.specks.length,
        ]}
        visible={!reacting && !expanded}
        frustumCulled={false}
        dispose={null}
      />
      <group ref={group}>
        <pointLight
          ref={energyLight}
          position={reactor ? [0.1, 0.2, 0.5] : [0.1, 0.1, -0.45]}
          color={
            reactor ? SCENE_LIGHTS.reactor.energy : SCENE_LIGHTS.atom.energy
          }
          intensity={0}
          distance={reactor ? 5 : 8}
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
        {reacting && !reactor && (
          <FissionEnergy
            reaction={reaction}
            journey={journey}
            surface={resources.surface}
            afterglow={afterglow}
          />
        )}
      </group>
    </>
  );
}

function SceneLifecycle({
  onReady,
  onContextLost,
  visible,
  reducedMotion,
  opening,
}: NucleusCanvasProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const openingActive = Boolean(opening);
  useEffect(() => {
    if (!openingActive) return;
    let frame = 0;
    const requestFrame = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        invalidate();
      });
    };
    window.addEventListener("scroll", requestFrame, { passive: true });
    return () => {
      window.removeEventListener("scroll", requestFrame);
      window.cancelAnimationFrame(frame);
    };
  }, [openingActive, invalidate]);
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
        opening={!props.reacting && props.opening?.beat !== "neutron"}
        playing={
          props.playing && !props.reacting && props.opening?.beat !== "neutron"
        }
        reducedMotion={props.reducedMotion}
        pointer={props.pointer}
        reveal={reveal}
      />
      <SceneLifecycle {...props} />
    </Canvas>
  );
}
