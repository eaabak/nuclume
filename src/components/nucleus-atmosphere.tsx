"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from "three";
import type { ViewOrientation } from "./nucleus-canvas";

interface NucleusAtmosphereProps {
  playing: boolean;
  reducedMotion: boolean;
  pointer: RefObject<ViewOrientation>;
  reveal: RefObject<number>;
}

export function NucleusAtmosphere({
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
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uDpr;
        varying float vWarm;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.08 + aPhase) * 0.12;
          p.y += cos(uTime * 0.1 + aPhase) * 0.14;
          vWarm = step(0.35, sin(aPhase));
          vAlpha = 0.16 + 0.18 * (sin(aPhase + uTime * 0.16) * 0.5 + 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * uDpr;
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
    if (motes.current) {
      motes.current.rotation.y = elapsed.current * 0.004;
      motes.current.position.x = reducedMotion ? 0 : pointer.current.x * 0.025;
    }
  });

  return (
    <points
      ref={motes}
      geometry={resources.geometry}
      material={resources.material}
      dispose={null}
    />
  );
}
