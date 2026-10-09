export const ISOTOPE = {
  name: "Uranium-235",
  symbol: "U",
  protons: 92,
  neutrons: 143,
  massNumber: 235,
} as const;

export type ParticleKind = "proton" | "neutron";
export type ParticleFilter = "all" | ParticleKind;

export interface Nucleon {
  position: readonly [number, number, number];
  radius: number;
  kind: ParticleKind;
  shade: number;
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createNucleus(): Nucleon[] {
  const random = seededRandom(235);
  const candidates: { position: [number, number, number]; distance: number }[] =
    [];

  // Close packing and an asymmetric envelope are sculptural choices, not physical particle positions.
  for (let x = -6; x <= 6; x += 1) {
    for (let y = -6; y <= 6; y += 1) {
      for (let z = -6; z <= 6; z += 1) {
        if ((x + y + z) % 2 !== 0) continue;
        const position: [number, number, number] = [
          x * 0.49 + (random() - 0.5) * 0.09,
          y * 0.49 + (random() - 0.5) * 0.09,
          z * 0.49 + (random() - 0.5) * 0.09,
        ];
        const radius = Math.hypot(...position);
        const envelope =
          1 +
          0.13 *
            Math.sin(position[1] * 1.6 + position[2]) *
            Math.cos(position[0] * 1.2);
        candidates.push({ position, distance: radius / envelope });
      }
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const positions = candidates.slice(0, ISOTOPE.massNumber);
  for (let i = positions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  return positions.map(({ position }, index) => ({
    position: [
      position[0] * 1.07 + Math.sin(position[1] * 1.5) * 0.13,
      position[1] * 1.12,
      position[2] * 0.94 + Math.sin(position[0] * 1.3) * 0.1,
    ],
    radius: 0.31 + random() * 0.055,
    kind: index < ISOTOPE.protons ? "proton" : "neutron",
    shade: 0.64 + random() * 0.36,
  }));
}

export const NUCLEONS = createNucleus();
