import { NUCLEONS, type Nucleon } from "./nucleus";

export type ReactionStage =
  "ready" | "absorbing" | "excited" | "splitting" | "complete" | "rewinding";
export const REACTION_TIMING = {
  capture: 1.2,
  split: 2.5,
  finish: 6.2,
} as const;
export const NEUTRON_HOME: readonly [number, number, number] = [-3.65, -0.3, 1];
export const FISSION_FRAGMENT_SCALE = 1.12;
export const DAUGHTERS = [
  {
    symbol: "Ba",
    name: "Barium-141",
    mass: 141,
    protons: 56,
    neutrons: 85,
    center: [-2.45, 0.95, 0.35],
  },
  {
    symbol: "Kr",
    name: "Krypton-92",
    mass: 92,
    protons: 36,
    neutrons: 56,
    center: [2.75, -0.9, -0.5],
  },
] as const;

export interface FissionParticle extends Nucleon {
  fragment: 0 | 1 | null;
  destination: readonly [number, number, number];
}

const captured: Nucleon = {
  position: [0, 0, 0],
  radius: 0.33,
  kind: "neutron",
  shade: 1,
};
const particles = [...NUCLEONS, captured];
const assignments = new Map<Nucleon, 0 | 1>();
for (const kind of ["proton", "neutron"] as const) {
  const sorted = particles
    .filter((particle) => particle.kind === kind)
    .sort((a, b) => a.position[0] - b.position[0]);
  if (kind === "neutron") {
    const emitted = [...sorted]
      .filter((particle) => particle !== captured)
      .sort((a, b) => Math.hypot(...a.position) - Math.hypot(...b.position))
      .slice(0, 3);
    for (const particle of emitted) sorted.splice(sorted.indexOf(particle), 1);
  }
  sorted.forEach((particle, index) =>
    assignments.set(particle, index < DAUGHTERS[0][`${kind}s`] ? 0 : 1),
  );
}

const fragmentPositions = DAUGHTERS.map(({ mass }) =>
  [...NUCLEONS]
    .sort((a, b) => Math.hypot(...a.position) - Math.hypot(...b.position))
    .slice(0, mass)
    .sort((a, b) => a.position[0] - b.position[0]),
);
const destinations = new Map<Nucleon, readonly [number, number, number]>();
for (const fragment of [0, 1] as const) {
  particles
    .filter((particle) => assignments.get(particle) === fragment)
    .sort((a, b) => a.position[0] - b.position[0])
    .forEach((particle, index) => {
      const [x, y, z] = fragmentPositions[fragment][index].position;
      const twist = y * (fragment === 0 ? 0.16 : -0.19);
      destinations.set(particle, [
        (x * Math.cos(twist) - z * Math.sin(twist)) *
          (fragment === 0 ? 0.98 : 1.2),
        y * 1.23,
        (x * Math.sin(twist) + z * Math.cos(twist)) * 0.94,
      ]);
    });
}
const outgoing: readonly (readonly [number, number, number])[] = [
  [3.5, 4.25, 1.2],
  [6.1, 2.1, 1.7],
  [-3.3, -3.65, 1.5],
];
let emittedIndex = 0;

// One illustrative channel: 235 + 1 = 141 + 92 + 3; charge remains 92.
export const FISSION_PARTICLES: FissionParticle[] = particles.map(
  (particle) => {
    const fragment = assignments.get(particle) ?? null;
    return {
      ...particle,
      fragment,
      destination: destinations.get(particle) ?? outgoing[emittedIndex++],
    };
  },
);

export function reactionStageAt(seconds: number): ReactionStage {
  if (seconds >= REACTION_TIMING.finish) return "complete";
  if (seconds >= REACTION_TIMING.split) return "splitting";
  if (seconds >= REACTION_TIMING.capture) return "excited";
  return "absorbing";
}
