import { NUCLEONS, type Nucleon } from "./nucleus";

export type ReactionStage =
  | "ready"
  | "absorbing"
  | "excited"
  | "splitting"
  | "complete";
export const REACTION_TIMING = {
  capture: 1.2,
  split: 2.5,
  finish: 6.2,
} as const;
export const NEUTRON_HOME: readonly [number, number, number] = [-3.65, -0.3, 1];
export const DAUGHTERS = [
  {
    symbol: "Ba",
    name: "Barium-141",
    mass: 141,
    protons: 56,
    neutrons: 85,
    center: [-2.65, 0.4, 0.2],
  },
  {
    symbol: "Kr",
    name: "Krypton-92",
    mass: 92,
    protons: 36,
    neutrons: 56,
    center: [3.05, -0.35, -0.3],
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
    .forEach((particle, index) =>
      destinations.set(particle, fragmentPositions[fragment][index].position),
    );
}
const outgoing: readonly (readonly [number, number, number])[] = [
  [-1.1, 4.25, 1.2],
  [1.9, 3.85, 1.7],
  [0.2, -4.35, 1.5],
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
