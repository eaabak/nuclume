export type ReactorStage = "pellet" | "rod" | "core" | "ready";
export type ReactorPart = "fuel" | "control" | "coolant";
export const REACTOR_TIMING = { rod: 2.8, core: 5.4, ready: 9.5 } as const;

export const REACTOR_PARTS = {
  fuel: {
    number: "01",
    label: "Fuel rods",
    title: "Where heat begins.",
    description:
      "One representative rod, separated for inspection. Ceramic uranium dioxide pellets sit inside sealed metal cladding. Fission in the pellets releases heat.",
    detail: "Fuel pellets · cladding",
    note: "Magnified explanatory cutaway. Fuel rods remain sealed during operation.",
    position: [1.5, -0.45, 1.25],
  },
  control: {
    number: "02",
    label: "Control rods",
    title: "A quieter reaction.",
    description:
      "Control rods absorb neutrons. A short insertion from above shows the absorber entering farther into the core. Captured neutrons cannot go on to cause fission.",
    detail: "Neutron absorption",
    note: "Illustrative movement and neutron paths. No reactor power or response is simulated.",
    position: [0.65, 3.1, 0.65],
  },
  coolant: {
    number: "03",
    label: "Coolant",
    title: "Heat, carried away.",
    description:
      "Pressurized water stays liquid as it flows upward through the core and removes heat. The primary loop transfers heat to a separate water circuit in a steam generator; primary coolant does not enter the turbine.",
    detail: "Primary coolant outlet",
    note: "Pressurized liquid · a separate primary circuit.",
    position: [4.2, 2.2, 0.4],
  },
} as const;

export const REACTOR_PART_IDS: readonly ReactorPart[] = [
  "fuel",
  "control",
  "coolant",
];
export const FUEL_ROD_POSITIONS: [number, number][] = [];
export const CONTROL_ROD_POSITIONS: [number, number][] = [];
for (let x = -3; x <= 3; x++) {
  for (let z = -3; z <= 3; z++) {
    if (Math.hypot(x, z) > 3.45) continue;
    const positions =
      Math.abs(x) === 1 && Math.abs(z) === 1
        ? CONTROL_ROD_POSITIONS
        : FUEL_ROD_POSITIONS;
    positions.push([x * 0.48, z * 0.48]);
  }
}

export function reactorStageAt(time: number): ReactorStage {
  if (time >= REACTOR_TIMING.ready) return "ready";
  if (time >= REACTOR_TIMING.core) return "core";
  if (time >= REACTOR_TIMING.rod) return "rod";
  return "pellet";
}
