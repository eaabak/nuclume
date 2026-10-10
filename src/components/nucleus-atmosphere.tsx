"use client";

import { NUCLEUS_COLORS } from "@/lib/scene-colors";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
} from "three";
import type { ViewOrientation } from "@/lib/scene";

interface NucleusAtmosphereProps {
  opening: boolean;
  playing: boolean;
  reducedMotion: boolean;
  pointer: RefObject<ViewOrientation>;
  reveal: RefObject<number>;
}

function OpeningScattering({
  reveal,
  time,
  reducedMotion,
}: {
  reveal: RefObject<number>;
  time: RefObject<number>;
  reducedMotion: boolean;
}) {
  const plumes = useRef<InstancedMesh>(null);
  const resources = useMemo(() => {
    const hash = (x: number, y: number) => {
      let value = Math.imul(x, 374761393) + Math.imul(y, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    };
    const noise = (x: number, y: number) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const u = fx * fx * (3 - 2 * fx);
      const v = fy * fy * (3 - 2 * fy);
      return (
        (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
        (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
      );
    };
    const pixels = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const u = (x + 0.5) / 128;
        const v = (y + 0.5) / 128;
        const cloud =
          noise(u * 12, v * 12) * 0.5 +
          noise(u * 33 + 9, v * 33) * 0.32 +
          noise(u * 71, v * 71) * 0.18;
        const envelope = Math.pow(
          Math.max(0, 1 - Math.pow(u * 2 - 1, 2) - Math.pow(v * 2 - 1, 2)),
          2.5,
        );
        const offset = (y * 128 + x) * 4;
        pixels[offset] = Math.round(noise(u * 5, v * 5) * 255);
        pixels[offset + 1] = Math.round(noise(u * 5 + 13, v * 5 + 7) * 255);
        pixels[offset + 2] = 255;
        pixels[offset + 3] = Math.min(
          255,
          Math.round(255 * envelope * (0.025 + Math.pow(cloud, 3) * 2)),
        );
      }
    }
    const texture = new DataTexture(pixels, 128, 128, RGBAFormat);
    texture.magFilter = texture.minFilter = LinearFilter;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute(
      "aPhase",
      new InstancedBufferAttribute(
        Float32Array.from({ length: 8 }, (_, i) => i / 8),
        1,
      ),
    );
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uSmoke: { value: texture },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uWarm: { value: new Color(NUCLEUS_COLORS.atmosphereWarm) },
        uCool: { value: new Color(NUCLEUS_COLORS.atmosphereCool) },
      },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vPhase;
        varying float vLight;
        void main() {
          float age = fract(uTime * 0.1 + aPhase);
          float drift = sin(aPhase * 31.4);
          float angle = aPhase * 6.283 + age * drift * 0.4;
          mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
          vec2 p = turn * position.xy * (2.4 + age * 3.6);
          p.x += -1.25 + drift * age * 0.5 + sin(age * 4.0 + aPhase * 6.283) * age * 0.12;
          p.y += -2.0 + age * 4.3;
          vUv = uv;
          vPhase = aPhase;
          vLight = smoothstep(-0.5, 1.5, p.x);
          vAlpha = smoothstep(0.0, 0.16, age) * (1.0 - smoothstep(0.48, 1.0, age));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, -4.0 - aPhase, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uSmoke;
        uniform float uTime;
        uniform float uReveal;
        uniform vec3 uWarm;
        uniform vec3 uCool;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vPhase;
        varying float vLight;
        void main() {
          vec2 curl = texture2D(uSmoke, vUv * 0.8 + vec2(vPhase, -uTime * 0.035)).rg - 0.5;
          float density = texture2D(uSmoke, vUv + curl * 0.18).a;
          float edge = 1.0 - smoothstep(0.35, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
          vec3 color = mix(uWarm, uCool, vLight);
          gl_FragColor = vec4(color, density * edge * vAlpha * uReveal * 0.24);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return { texture, geometry, material };
  }, []);

  useEffect(() => {
    const mesh = plumes.current;
    return () => {
      mesh?.dispose();
      resources.texture.dispose();
      resources.geometry.dispose();
      resources.material.dispose();
    };
  }, [resources]);

  useFrame(() => {
    resources.material.uniforms.uTime.value = reducedMotion ? 0 : time.current;
    resources.material.uniforms.uReveal.value = reveal.current;
  });

  return (
    <instancedMesh
      ref={plumes}
      args={[resources.geometry, resources.material, 8]}
      frustumCulled={false}
      dispose={null}
    />
  );
}

export function NucleusAtmosphere({
  opening,
  playing,
  reducedMotion,
  pointer,
  reveal,
}: NucleusAtmosphereProps) {
  const motes = useRef<Points>(null);
  const elapsed = useRef(0);
  const dpr = useThree((state) => state.viewport.dpr);
  const resources = useMemo(() => {
    const positions = new Float32Array(96 * 3);
    const sizes = new Float32Array(96);
    const phases = new Float32Array(96);
    for (let i = 0; i < 96; i += 1) {
      const angle = i * 2.399963;
      const height = 1 - (i / 95) * 2;
      const radial = Math.sqrt(1 - height * height);
      const radius = 3.3 + (Math.sin(i * 7.13) * 0.5 + 0.5) * 2.5;
      positions[i * 3] = Math.cos(angle) * radial * radius;
      positions[i * 3 + 1] = height * radius * 0.85;
      positions[i * 3 + 2] = Math.sin(angle) * radial * radius;
      sizes[i] = 1.3 + (Math.sin(i * 13.1) * 0.5 + 0.5) * 3;
      phases[i] = i * 0.73;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDpr: { value: 1 },
        uReveal: { value: 0 },
        uOpening: { value: 0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uDpr;
        uniform float uOpening;
        varying float vWarm;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.08 + aPhase) * 0.12;
          p.y += cos(uTime * 0.1 + aPhase) * 0.14;
          p.z -= uOpening * 2.0;
          vWarm = mix(step(0.35, sin(aPhase)), 1.0 - smoothstep(-3.5, 1.0, p.x), uOpening);
          vAlpha = 0.16 + 0.18 * (sin(aPhase + uTime * 0.16) * 0.5 + 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * uDpr * mix(1.0, 0.7, uOpening);
        }
      `,
      fragmentShader: `
        uniform float uReveal;
        varying float vWarm;
        varying float vAlpha;
        void main() {
          float falloff = 1.0 - smoothstep(0.05, 0.5, length(gl_PointCoord - 0.5));
          vec3 color = mix(vec3(0.35, 0.57, 0.8), vec3(0.84, 0.6, 0.31), vWarm);
          gl_FragColor = vec4(color, falloff * vAlpha * uReveal);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return { geometry, material };
  }, []);

  useEffect(() => {
    resources.material.uniforms.uDpr.value = dpr;
  }, [resources, dpr]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  useFrame((_, delta) => {
    if (playing && !reducedMotion) elapsed.current += Math.min(delta, 0.05);
    resources.material.uniforms.uTime.value = reducedMotion
      ? 0
      : elapsed.current;
    resources.material.uniforms.uReveal.value = reveal.current;
    resources.material.uniforms.uOpening.value = opening ? 1 : 0;
    if (motes.current) {
      motes.current.rotation.y = elapsed.current * 0.004;
      motes.current.position.x = reducedMotion ? 0 : pointer.current.x * 0.025;
    }
  });

  return (
    <>
      {opening && (
        <OpeningScattering
          reveal={reveal}
          time={elapsed}
          reducedMotion={reducedMotion}
        />
      )}
      <points
        ref={motes}
        geometry={resources.geometry}
        material={resources.material}
        dispose={null}
      />
    </>
  );
}
