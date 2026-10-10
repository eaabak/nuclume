"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from "three";
import {
  DAUGHTERS,
  FISSION_PARTICLES,
  FISSION_FRAGMENT_SCALE,
  REACTION_TIMING,
  type FissionParticle,
} from "@/lib/fission";
import type { FissionController } from "./use-fission";
import { journeyTime, type JourneyController } from "./use-journey";

export function FissionEnergy({
  reaction,
  journey,
  surface,
  afterglow,
}: {
  reaction: FissionController;
  journey: JourneyController;
  surface: Texture;
  afterglow: RefObject<number>;
}) {
  const halos = useRef<InstancedMesh>(null);
  const dpr = useThree((state) => state.viewport.dpr);
  const resources = useMemo(() => {
    const emitted = FISSION_PARTICLES.filter(
      (particle) => particle.fragment === null,
    );
    const uniforms = {
      uTime: { value: 0 },
      uTension: { value: 0 },
      uRelease: { value: 0 },
      uSeparation: { value: 0 },
      uEmission: { value: 0 },
      uDpr: { value: 1 },
      uSurface: { value: surface },
    };
    const positions: number[] = [];
    const kinds: number[] = [];
    const strengths: number[] = [];
    const along: number[] = [];
    const sides: number[] = [];
    const radii: number[] = [];
    const startOrigins: number[] = [];
    const startTargets: number[] = [];
    const endOrigins: number[] = [];
    const endTargets: number[] = [];
    const anchors = [0, 1].map((fragment) => {
      const direction = fragment === 0 ? 1 : -1;
      const score = (p: FissionParticle) =>
        p.destination[0] * direction + p.destination[2] * 0.85;
      return FISSION_PARTICLES.filter(
        (p) =>
          p.fragment === fragment &&
          p.destination[0] * direction > 0.4 &&
          p.destination[2] > 0,
      )
        .sort((a, b) => score(b) - score(a))
        .slice(0, 20)
        .sort((a, b) => a.destination[1] - b.destination[1]);
    });
    const anchor = (
      particle: FissionParticle | undefined,
      origin: number[],
      target: number[],
    ) => {
      if (!particle) {
        origin.push(0, 0, 0);
        target.push(0, 0, 0);
        return;
      }
      if (particle.fragment === null) {
        origin.push(...particle.position);
        target.push(...particle.destination);
        return;
      }
      const center = DAUGHTERS[particle.fragment].center;
      const side = particle.fragment === 0 ? 1 : -1;
      origin.push(
        particle.position[0] + side * particle.radius * 0.6,
        particle.position[1],
        particle.position[2] + particle.radius * 0.8,
      );
      target.push(
        particle.destination[0] +
          center[0] +
          side * particle.radius * FISSION_FRAGMENT_SCALE * 0.6,
        particle.destination[1] + center[1],
        particle.destination[2] +
          center[2] +
          particle.radius * FISSION_FRAGMENT_SCALE * 0.8,
      );
    };
    const vertex = (
      x: number,
      y: number,
      z: number,
      kind: number,
      strength: number,
      t: number,
      start?: FissionParticle,
      end?: FissionParticle,
      side = 0,
    ) => {
      positions.push(x, y, z);
      kinds.push(kind);
      strengths.push(strength);
      along.push(t);
      sides.push(side);
      radii.push(start?.radius ?? 0, end?.radius ?? 0);
      anchor(start, startOrigins, startTargets);
      anchor(end, endOrigins, endTargets);
    };
    const strandCount = 72;
    const corners = [
      [0, -1],
      [1, -1],
      [0, 1],
      [0, 1],
      [1, -1],
      [1, 1],
    ];
    for (let strand = 0; strand < strandCount; strand++) {
      const start =
        anchors[0][Math.floor((strand / strandCount) * anchors[0].length)];
      const end =
        anchors[1][Math.floor((strand / strandCount) * anchors[1].length)];
      for (let step = 0; step < 40; step++) {
        for (const [endpoint, side] of corners) {
          const t = (step + endpoint) / 40;
          vertex(
            0,
            strand / strandCount,
            0,
            0,
            0.55 + (strand % 5) * 0.13,
            t,
            start,
            end,
            side,
          );
        }
      }
    }
    const filamentVertexCount = positions.length / 3;
    emitted.forEach((particle) => {
      for (let strand = 0; strand < 14; strand++) {
        const width = Math.sin(strand * 2.4) * 0.18;
        for (let step = 0; step < 32; step++) {
          for (let endpoint = 0; endpoint < 2; endpoint++) {
            const t = (step + endpoint) / 32;
            const wave =
              Math.sin(t * 8 + strand) * Math.sin(t * Math.PI) * 0.07;
            vertex(
              particle.destination[0] * t + (width + wave) * (1 - t),
              particle.destination[1] * t + (width - wave) * (1 - t),
              particle.destination[2] * t,
              1,
              (0.035 + t * 0.28) * (0.5 + (strand % 3) * 0.25),
              t,
              particle,
            );
          }
        }
      }
    });
    for (let ring = 0; ring < 3; ring++) {
      const radius = 4.4 + ring * 0.4;
      for (let step = 0; step < 240; step++) {
        if (ring !== 1 && step % 13 > 9) continue;
        for (let endpoint = 0; endpoint < 2; endpoint++) {
          const angle = ((step + endpoint) / 240) * Math.PI * 2;
          vertex(
            -0.7 + Math.cos(angle) * radius,
            0.6 + Math.sin(angle) * radius,
            -3.8,
            2,
            0.055 + Math.max(0, Math.sin(angle + ring)) * 0.11,
            0,
          );
        }
      }
    }
    const lines = new BufferGeometry();
    lines.setAttribute("position", new Float32BufferAttribute(positions, 3));
    lines.setAttribute("aKind", new Float32BufferAttribute(kinds, 1));
    lines.setAttribute("aStrength", new Float32BufferAttribute(strengths, 1));
    lines.setAttribute("aAlong", new Float32BufferAttribute(along, 1));
    lines.setAttribute("aSide", new Float32BufferAttribute(sides, 1));
    lines.setAttribute("aRadii", new Float32BufferAttribute(radii, 2));
    lines.setAttribute(
      "aStartOrigin",
      new Float32BufferAttribute(startOrigins, 3),
    );
    lines.setAttribute(
      "aStartTarget",
      new Float32BufferAttribute(startTargets, 3),
    );
    lines.setAttribute("aEndOrigin", new Float32BufferAttribute(endOrigins, 3));
    lines.setAttribute("aEndTarget", new Float32BufferAttribute(endTargets, 3));
    const filaments = new BufferGeometry();
    for (const [name, attribute] of Object.entries(lines.attributes)) {
      filaments.setAttribute(name, attribute);
    }
    filaments.setDrawRange(0, filamentVertexCount);
    lines.setDrawRange(
      filamentVertexCount,
      positions.length / 3 - filamentVertexCount,
    );
    const lineMaterial = new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        uniform float uRelease;
        uniform float uSeparation;
        uniform float uEmission;
        uniform float uTime;
        uniform float uTension;
        attribute float aKind;
        attribute float aStrength;
        attribute float aAlong;
        attribute float aSide;
        attribute vec2 aRadii;
        attribute vec3 aStartOrigin;
        attribute vec3 aStartTarget;
        attribute vec3 aEndOrigin;
        attribute vec3 aEndTarget;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vSide;
        varying float vRibbon;
        void main() {
          vec3 p = position;
          vAlpha = aStrength;
          vSide = aSide;
          vRibbon = 0.0;
          vColor = vec3(0.64, 0.43, 0.2);
          if (aKind < 0.5) {
            vec3 strain = vec3(1.0 + uTension * 0.3, 1.0 - uTension * 0.1, 1.0 - uTension * 0.1);
            vec3 startOffset = vec3(0.6, 0.0, 0.8) * aRadii.x;
            vec3 endOffset = vec3(-0.6, 0.0, 0.8) * aRadii.y;
            vec3 start = mix((aStartOrigin - startOffset) * strain + startOffset, aStartTarget, uSeparation);
            vec3 end = mix((aEndOrigin - endOffset) * strain + endOffset, aEndTarget, uSeparation);
            vec3 c1 = mix(start, end, 0.38);
            vec3 c2 = mix(start, end, 0.62);
            float bundle = (position.y - 0.5) * 0.42;
            float center = mix((start.y + end.y) * 0.5, 0.08 + bundle, uSeparation);
            c1.y = center - 0.14;
            c2.y = center + 0.14;
            float t = aAlong;
            float s = 1.0 - t;
            float wave = sin(t * 8.0 + position.y * 19.0 + uTime * 0.4) * sin(t * 3.14159) * 0.055;
            p = s*s*s*start + 3.0*s*s*t*c1 + 3.0*s*t*t*c2 + t*t*t*end;
            p.y += wave;
            vec3 tangent = 3.0*s*s*(c1-start) + 6.0*s*t*(c2-c1) + 3.0*t*t*(end-c2);
            vec2 normal = vec2(-tangent.y, tangent.x) / max(length(tangent.xy), 0.001);
            p.xy += normal * aSide * (0.028 + sin(t * 3.14159) * 0.016);
            vRibbon = 1.0;
            vColor = vec3(1.0, 0.48, 0.09);
            vAlpha *= uRelease;
          } else if (aKind < 1.5) {
            p *= uEmission;
            p += aStartOrigin * vec3(1.0 + uTension * 0.3, 1.0 - uTension * 0.1, 1.0 - uTension * 0.1) * (1.0 - uEmission) * aAlong;
            vColor = vec3(0.025, 0.3, 1.0);
            vAlpha *= uRelease * uEmission;
          }
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vSide;
        varying float vRibbon;
        void main() {
          float core = exp(-vSide * vSide * 36.0);
          float profile = core + 0.22 * exp(-vSide * vSide * 4.0);
          vec3 color = mix(vColor, mix(vec3(1.0, 0.34, 0.025), vec3(1.0, 0.73, 0.27), core), vRibbon);
          gl_FragColor = vec4(color, vAlpha * mix(1.0, profile, vRibbon));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const haloGeometry = new PlaneGeometry(1, 1);
    haloGeometry.setAttribute(
      "aStart",
      new InstancedBufferAttribute(
        new Float32Array(emitted.flatMap((p) => [...p.position])),
        3,
      ),
    );
    haloGeometry.setAttribute(
      "aEnd",
      new InstancedBufferAttribute(
        new Float32Array(emitted.flatMap((p) => [...p.destination])),
        3,
      ),
    );
    haloGeometry.setAttribute(
      "aRadius",
      new InstancedBufferAttribute(
        new Float32Array(emitted.map((p) => p.radius)),
        1,
      ),
    );
    const haloMaterial = new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        uniform float uEmission;
        uniform float uTension;
        attribute vec3 aStart;
        attribute vec3 aEnd;
        attribute float aRadius;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 strain = vec3(1.0 + uTension * 0.3, 1.0 - uTension * 0.1, 1.0 - uTension * 0.1);
          vec3 p = mix(aStart * strain, aEnd, uEmission);
          p.xy += position.xy * aRadius * 3.6;
          p.z += aRadius + 0.08;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uRelease;
        varying vec2 vUv;
        void main() {
          float radius = length(vUv - 0.5) * 2.0;
          float rim = exp(-pow((radius - 0.56) * 28.0, 2.0));
          float halo = exp(-pow((radius - 0.56) * 5.0, 2.0)) * smoothstep(0.4, 0.56, radius);
          gl_FragColor = vec4(mix(vec3(0.025, 0.28, 1.0), vec3(0.22, 0.65, 1.0), rim), (rim * 0.65 + halo * 0.32) * uRelease);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const hazeGeometry = new PlaneGeometry(8, 9);
    const hazeMaterial = new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D uSurface;
        uniform float uRelease;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float grain = texture2D(uSurface, vUv * 0.8).r;
          float haze = exp(-dot(p * vec2(1.25, 0.85), p * vec2(1.25, 0.85)) * 4.0);
          float core = exp(-dot(p * vec2(3.5, 1.6), p * vec2(3.5, 1.6)) * 3.0);
          gl_FragColor = vec4(vec3(0.8, 0.43, 0.13), (haze * (0.12 + grain * 0.12) + core * 0.36) * uRelease);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const dustPositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      const angle = i * 2.399;
      const radius = 0.5 + (Math.sin(i * 13.13) * 0.5 + 0.5) * 3.6;
      dustPositions.set(
        [
          Math.cos(angle) * radius * 0.7,
          Math.sin(angle) * radius,
          Math.sin(i * 3.7) * 1.6 - 0.3,
        ],
        i * 3,
      );
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(dustPositions, 3),
    );
    const dustMaterial = new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: `
        uniform float uSeparation;
        uniform float uDpr;
        varying float vAlpha;
        void main() {
          vec3 p = position * (0.45 + uSeparation * 0.55);
          vAlpha = 0.15 + 0.5 * fract(sin(position.x * 17.0 + position.y * 9.0) * 431.2);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.8 + vAlpha * 3.0) * uDpr;
        }
      `,
      fragmentShader: `
        uniform float uRelease;
        varying float vAlpha;
        void main() {
          float shape = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(1.0, 0.7, 0.32, shape * vAlpha * uRelease);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return {
      uniforms,
      lines,
      filaments,
      lineMaterial,
      haloGeometry,
      haloMaterial,
      hazeGeometry,
      hazeMaterial,
      dustGeometry,
      dustMaterial,
    };
  }, [surface]);

  useEffect(() => {
    const mesh = halos.current;
    return () => {
      mesh?.dispose();
      resources.lines.dispose();
      resources.filaments.dispose();
      resources.lineMaterial.dispose();
      resources.haloGeometry.dispose();
      resources.haloMaterial.dispose();
      resources.hazeGeometry.dispose();
      resources.hazeMaterial.dispose();
      resources.dustGeometry.dispose();
      resources.dustMaterial.dispose();
    };
  }, [resources]);

  useFrame(() => {
    const time = journeyTime(journey, 1, reaction.elapsed.current);
    resources.uniforms.uTime.value = time + afterglow.current;
    resources.uniforms.uDpr.value = dpr;
    resources.uniforms.uSeparation.value = MathUtils.smootherstep(
      time,
      REACTION_TIMING.split,
      REACTION_TIMING.finish - 0.6,
    );
    resources.uniforms.uTension.value =
      MathUtils.smoothstep(
        time,
        REACTION_TIMING.capture,
        REACTION_TIMING.split,
      ) *
      (1 - resources.uniforms.uSeparation.value);
    resources.uniforms.uRelease.value = MathUtils.smoothstep(
      time,
      REACTION_TIMING.split,
      REACTION_TIMING.split + 0.45,
    );
    resources.uniforms.uEmission.value =
      1 -
      Math.pow(
        1 - MathUtils.clamp((time - REACTION_TIMING.split - 0.14) / 1.8, 0, 1),
        3,
      );
  });

  return (
    <group dispose={null}>
      <mesh
        geometry={resources.hazeGeometry}
        material={resources.hazeMaterial}
        position={[0, 0, -3.5]}
      />
      <lineSegments
        geometry={resources.lines}
        material={resources.lineMaterial}
        frustumCulled={false}
      />
      <mesh
        geometry={resources.filaments}
        material={resources.lineMaterial}
        frustumCulled={false}
      />
      <instancedMesh
        ref={halos}
        args={[resources.haloGeometry, resources.haloMaterial, 3]}
        frustumCulled={false}
      />
      <points
        geometry={resources.dustGeometry}
        material={resources.dustMaterial}
        frustumCulled={false}
      />
    </group>
  );
}
