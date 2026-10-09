import { NUCLEONS, type ParticleFilter } from "@/lib/nucleus";
import {
  DAUGHTERS,
  FISSION_PARTICLES,
  type ReactionStage,
} from "@/lib/fission";

interface NucleusFallbackProps {
  filter: ParticleFilter;
  expanded: boolean;
  reaction?: ReactionStage;
}

export function NucleusFallback({
  filter,
  expanded,
  reaction,
}: NucleusFallbackProps) {
  const split = reaction === "splitting" || reaction === "complete";
  const particles = split
    ? FISSION_PARTICLES.map((particle) => {
        const center =
          particle.fragment === null
            ? null
            : DAUGHTERS[particle.fragment].center;
        return {
          ...particle,
          position: [
            particle.destination[0] + (center?.[0] ?? 0),
            particle.destination[1] + (center?.[1] ?? 0),
            particle.destination[2],
          ],
        };
      })
    : NUCLEONS;
  // Rounded SVG coordinates avoid hydration differences between engines' trig implementations.
  return (
    <svg
      className="nucleus-fallback"
      viewBox={split ? "-6 -6 12 12" : "-4 -4 8 8"}
      role="img"
      aria-label={
        split
          ? "Static conceptual fission model: barium-141, krypton-92 and three free neutrons."
          : "Static conceptual model of a uranium-235 nucleus: 92 protons and 143 neutrons."
      }
    >
      <defs>
        <radialGradient id="proton-surface" cx="24%" cy="18%" r="100%">
          <stop offset="0" stopColor="#c2ad90" />
          <stop offset="0.5" stopColor="#81705a" />
          <stop offset="1" stopColor="#212025" />
        </radialGradient>
        <radialGradient id="neutron-surface" cx="24%" cy="18%" r="100%">
          <stop offset="0" stopColor="#8d9cac" />
          <stop offset="0.5" stopColor="#48586a" />
          <stop offset="1" stopColor="#141b26" />
        </radialGradient>
      </defs>
      <g
        transform={`rotate(${reaction ? 0 : -18}) scale(${expanded ? 1.2 : 1})`}
      >
        {[...particles]
          .sort((a, b) => a.position[2] - b.position[2])
          .map((particle, index) => (
            <circle
              key={index}
              cx={particle.position[0].toFixed(5)}
              cy={particle.position[1].toFixed(5)}
              r={particle.radius.toFixed(5)}
              fill={`url(#${particle.kind}-surface)`}
              opacity={filter === "all" || filter === particle.kind ? 1 : 0.2}
            />
          ))}
      </g>
    </svg>
  );
}
