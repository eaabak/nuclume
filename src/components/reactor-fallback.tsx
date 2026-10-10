"use client";

import { REACTOR_COLORS } from "@/lib/scene-colors";
import {
  CONTROL_ROD_POSITIONS,
  FUEL_ROD_POSITIONS,
  type ReactorPart,
} from "@/lib/reactor";
import { useLanguage } from "./language-provider";

export function ReactorFallback({
  selected,
}: {
  selected: ReactorPart | null;
}) {
  const { t } = useLanguage();
  return (
    <svg
      className="reactor-fallback"
      viewBox="0 0 640 620"
      role="img"
      aria-label={t(
        "Conceptual PWR cutaway: fuel rods and control rods inside a steel vessel, with primary water flowing down around the core and up through it.",
        "Kavramsal basınçlı su reaktörü kesiti: çelik kap içindeki yakıt ve kontrol çubukları; birincil devre suyu çekirdeğin çevresinden aşağı, içinden yukarı akar.",
      )}
    >
      <defs>
        <linearGradient id="vessel-steel">
          <stop stopColor="#506a7c" />
          <stop offset="0.6" stopColor="#15232e" />
          <stop offset="1" stopColor="#617785" />
        </linearGradient>
        <linearGradient id="fuel-heat">
          <stop stopColor="#625747" />
          <stop offset="0.5" stopColor="#d5a35e" />
          <stop offset="1" stopColor="#524836" />
        </linearGradient>
        <marker
          id="water-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10Z" fill="#71bfea" />
        </marker>
      </defs>
      <path
        d="M172 165C172 80 466 80 466 165V432C466 514 172 514 172 432Z"
        fill="url(#vessel-steel)"
        stroke="#9aaeb9"
        strokeWidth="2"
      />
      <path
        d="M172 165Q320 249 466 165V432Q320 521 172 432Z"
        fill="#0b131ce8"
      />
      {FUEL_ROD_POSITIONS.map(([x, z], index) => {
        const px = 320 + (x - z) * 39;
        const py = 295 + (x + z) * 17;
        return (
          <g
            key={index}
            transform={`translate(${px.toFixed(4)} ${py.toFixed(4)})`}
          >
            <rect
              x="-5"
              y="-110"
              width="10"
              height="205"
              rx="5"
              fill="url(#fuel-heat)"
              stroke={selected === "fuel" ? "#ffe1a6" : "#ad8d5d"}
              strokeWidth="0.5"
            />
            <ellipse cy="-107" rx="5" ry="2" fill="#d3c09c" />
          </g>
        );
      })}
      {CONTROL_ROD_POSITIONS.map(([x, z], index) => (
        <path
          key={index}
          d={`M${320 + (x - z) * 39} ${140 + (x + z) * 17}v182`}
          stroke={selected === "control" ? "#d0edff" : "#89a4b7"}
          strokeWidth="7"
          strokeLinecap="round"
          transform={selected === "control" ? "translate(0 20)" : undefined}
        />
      ))}
      <path
        d="M172 165V432Q217 475 275 477V219Z"
        fill="url(#vessel-steel)"
        stroke="#aeb7b2"
        strokeWidth="2"
      />
      <ellipse
        cx="319"
        cy="160"
        rx="148"
        ry="50"
        fill="none"
        stroke="#71848e"
        strokeWidth="6"
      />
      <path
        d="M172 111Q319 5 466 111Q320 188 172 111Z"
        fill="url(#vessel-steel)"
        stroke="#8f9da2"
        strokeWidth="2"
      />
      <path
        d="M131 269 222 283M420 214 527 191"
        stroke="#506879"
        strokeWidth="22"
      />
      <path
        d="M130 269 226 285 247 420Q278 475 312 412V263Q313 236 370 227L527 191"
        fill="none"
        stroke="#62b9ed"
        strokeWidth={selected === "coolant" ? "4" : "2.5"}
        strokeDasharray="5 7"
      />
      <path
        d="M242 343 247 382M312 360V318M466 207 494 199"
        fill="none"
        stroke="#71bfea"
        strokeWidth="2"
        markerEnd="url(#water-arrow)"
      />
      {selected === "fuel" && (
        <g transform="translate(435 280)">
          <rect
            x="-15"
            y="-82"
            width="30"
            height="175"
            rx="8"
            fill="#17252f"
            stroke="#bec6c8"
          />
          {Array.from({ length: 9 }, (_, index) => (
            <rect
              key={index}
              x="-10"
              y={-74 + index * 18}
              width="20"
              height="15"
              rx="4"
              fill="#67675d"
              stroke="#c9ae85"
            />
          ))}
          <path
            d="M28-82v175h13V-82Z"
            fill="url(#vessel-steel)"
            stroke="#bec6c8"
          />
        </g>
      )}
      {selected === "control" && (
        <g stroke={REACTOR_COLORS.neutron} fill={REACTOR_COLORS.neutron}>
          <path
            d="m357 224-28 13m-35 16 23-5"
            strokeDasharray="3 5"
            fill="none"
          />
          <circle cx="357" cy="224" r="3" />
          <circle cx="294" cy="253" r="3" />
        </g>
      )}
    </svg>
  );
}
