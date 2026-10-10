export const NUCLEUS_COLORS = {
  proton: "#bda889",
  neutron: "#647e93",
  incomingNeutron: "#c6ddea",
  inactive: "#354250",
  protonEmission: "#8b3d10",
  atmosphereWarm: "#dfba82",
  atmosphereCool: "#638ba1",
} as const;

export const SCENE_LIGHTS = {
  sky: "#b3c6d8",
  ground: "#151518",
  atom: {
    key: "#f6e8d4",
    rim: "#98c6e2",
    fill: "#ffc881",
    energy: "#ffc16e",
  },
  fission: {
    key: "#f0e4d4",
    rim: "#719bbf",
    fill: "#7b8aa2",
  },
  reactor: {
    key: "#e8d6ba",
    fill: "#c2c5c6",
    energy: "#ec8533",
    core: "#ff9b35",
  },
  power: "#ffbc72",
  controlRoom: {
    ambient: "#ffb85c",
    strips: "#ffbb69",
  },
} as const;

export const REACTOR_COLORS = {
  fuelHeat: "#ff821c",
  fuelPellet: "#b6a283",
  selectedFuel: "#e4bb79",
  controlEmission: "#4a89ad",
  neutron: "#b8cedb",
  coolant: "#399fea",
  coolantPath: "#329feb",
  primaryPipe: "#175787",
  primaryEmission: "#11507c",
  primaryFlow: "#3c9bc6",
  secondaryWater: "#287cc0",
  secondaryEmission: "#1f64a7",
} as const;

export const POWER_COLORS = {
  heat: "#df9e54",
  coilEmission: "#d99440",
  steam: "#f4bf7e",
  steamEmission: "#b9712d",
  primaryFlow: "#86cfe8",
  heatTransfer: "#f3bb70",
  primaryWater: "#4e9fca",
  primaryEmission: "#1b76a3",
  secondaryWater: "#3c9cce",
  transmissionWire: "#ffc678",
  electricity: "#58beff",
} as const;

export const CITY_COLORS = {
  buildings: ["#3e505d", "#58616a", "#425461", "#67716f"],
  windowOff: "#1d303b",
  windowWarm: "#ffce88",
  windowCool: "#84c6df",
  streetlight: "#ffe0a0",
  road: "#101b24",
  roadMarking: "#75818a",
  roomFog: "#07111b",
} as const;
