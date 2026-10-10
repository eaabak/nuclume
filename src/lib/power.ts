export type PowerStage =
  "heat" | "turbine" | "generator" | "transmission" | "city" | "ready";
export type PowerPart = Exclude<PowerStage, "ready">;
export const POWER_TIMING = {
  turbine: 3.6,
  generator: 6.3,
  transmission: 8.8,
  city: 11.5,
  ready: 20,
} as const;

export type CityPlace = "home" | "hospital";
export const CITY_PLACES = {
  home: {
    label: "A light at home",
    description:
      "An ordinary evening: a meal, a conversation, a light left on. Electricity becomes part of everyday life.",
    position: [3.5, -0.55, 3.5],
  },
  hospital: {
    label: "Care, around the clock",
    description:
      "Electricity supports lighting, medical equipment and essential services. This hospital represents the public infrastructure a community relies on.",
    position: [6.7, -0.25, 5.2],
  },
} as const;

export const CITY_LIGHT_TIMING = [
  12.6, 13.55, 14.05, 13.15, 15.9, 17.3, 17.5, 18.25, 17.1, 18.1, 18.7, 17.6,
  18.2, 18.6, 18.8, 17.9, 18.4, 18.6, 18.9, 19.0, 18.5,
] as const;

export function cityBeatAt(time: number) {
  if (time < 12.6) return "street";
  if (time < 15.9) return "home";
  if (time < 17.4) return "hospital";
  return "neighborhood";
}

export const COOLANT_TRANSFER = {
  travel: 6,
  steamTravel: 5.8,
  leave: 2,
  scene: 3.2,
  turbineScene: 5.7,
} as const;

export const POWER_PARTS = {
  heat: {
    number: "01",
    label: "Steam / heat transfer",
    title: "Heat crosses.\nWater stays apart.",
    description:
      "In the steam generator, hot primary water transfers heat through metal tubes to a separate water circuit. That water becomes steam. The two circuits do not mix.",
    position: [-3.4, 2.6, -1],
    source: "https://www.nrc.gov/reactors/power/pwrs",
    sourceLabel: "U.S. NRC",
  },
  turbine: {
    number: "02",
    label: "Turbine",
    title: "Heat becomes\nmotion.",
    description:
      "Expanding steam turns the turbine blades and their shaft. Afterward, the steam is condensed into water and returned to the steam generator. The turbine converts energy into motion; it does not store electricity.",
    position: [-0.7, 1.25, -1],
    source:
      "https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php",
    sourceLabel: "U.S. EIA",
  },
  generator: {
    number: "03",
    label: "Generator",
    title: "Motion becomes\nelectricity.",
    description:
      "The same shaft turns the generator's rotor. Its changing magnetic field induces electricity in stationary coils, converting mechanical energy into electrical energy.",
    position: [2.2, 1.1, -1],
    source:
      "https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php",
    sourceLabel: "U.S. EIA",
  },
  transmission: {
    number: "04",
    label: "Transmission",
    title: "A connection,\nacross distance.",
    description:
      "Transformers raise the voltage for transmission. Power lines carry electrical energy toward communities, where substations lower the voltage for local distribution. Blue pulses trace the connection, not the motion of individual electrons.",
    position: [5.5, 3, 0.1],
    source:
      "https://www.eia.gov/energyexplained/electricity/delivery-to-consumers.php",
    sourceLabel: "U.S. EIA",
  },
  city: {
    number: "05",
    label: "City impact",
    title: "A world,\nilluminated.",
    description:
      "A light at home. A hospital at work. Streets that connect us. Electricity supports everyday life and essential public services. This city illustrates that connection; one atom cannot power a city.",
    position: [10.2, 1, 6],
    source:
      "https://www.eia.gov/energyexplained/electricity/delivery-to-consumers.php",
    sourceLabel: "U.S. EIA",
  },
} as const;

export const POWER_PART_IDS: readonly PowerPart[] = [
  "heat",
  "turbine",
  "generator",
  "transmission",
  "city",
];

export const CITY_BUILDINGS = [
  { x: 3.5, z: 3.5, width: 1.05, depth: 1, height: 0.8, kind: "home" },
  { x: 3.5, z: 5.4, width: 1.05, depth: 1, height: 1.05, kind: "home" },
  { x: 5, z: 5.7, width: 1.05, depth: 1, height: 0.85, kind: "home" },
  { x: 4.95, z: 3.5, width: 0.85, depth: 1, height: 1.25, kind: "home" },
  { x: 6.7, z: 5.2, width: 1.8, depth: 1.45, height: 1.65, kind: "hospital" },
  { x: 6.8, z: 2.35, width: 1.8, depth: 1.25, height: 1.05, kind: "civic" },
  { x: 8.5, z: 1.05, width: 1.1, depth: 1.05, height: 3.25, kind: "tower" },
  { x: 10.2, z: 1.15, width: 1.25, depth: 1.1, height: 4.05, kind: "tower" },
  { x: 8.65, z: 3.2, width: 1.2, depth: 1.3, height: 2.3, kind: "tower" },
  { x: 10.5, z: 3.2, width: 1.2, depth: 1.15, height: 2.8, kind: "tower" },
  { x: 9.5, z: 5.6, width: 1.7, depth: 1.2, height: 1.8, kind: "tower" },
  { x: 12.8, z: 1.3, width: 1.5, depth: 1.3, height: 4.6, kind: "tower" },
  { x: 13.3, z: 3.55, width: 1.6, depth: 1.55, height: 3.3, kind: "tower" },
  { x: 13.4, z: 5.7, width: 1.7, depth: 1.25, height: 2.5, kind: "tower" },
  { x: 13.4, z: 8.65, width: 1.5, depth: 1.4, height: 3.1, kind: "tower" },
  { x: 3.65, z: 8.65, width: 1.1, depth: 1.15, height: 1, kind: "home" },
  { x: 5.35, z: 8.65, width: 1.15, depth: 1.2, height: 1.3, kind: "home" },
  { x: 7.15, z: 8.55, width: 1.15, depth: 1.2, height: 1.15, kind: "home" },
  { x: 9.25, z: 8.65, width: 1.7, depth: 1.5, height: 2.1, kind: "civic" },
  { x: 3.7, z: 1.35, width: 1.15, depth: 1.15, height: 1.05, kind: "home" },
  { x: 10.5, z: 8.6, width: 0.65, depth: 1.3, height: 1.4, kind: "civic" },
] as const;

export function powerStageAt(time: number): PowerStage {
  if (time >= POWER_TIMING.ready) return "ready";
  if (time >= POWER_TIMING.city) return "city";
  if (time >= POWER_TIMING.transmission) return "transmission";
  if (time >= POWER_TIMING.generator) return "generator";
  if (time >= POWER_TIMING.turbine) return "turbine";
  return "heat";
}
