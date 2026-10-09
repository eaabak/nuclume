import { CITY_BUILDINGS, type CityPlace, type PowerPart } from "@/lib/power";

export function PowerFallback({
  selected,
  cityPlace,
  cityOverview,
}: {
  selected: PowerPart | null;
  cityPlace: CityPlace | null;
  cityOverview: boolean;
}) {
  return (
    <svg
      className="power-fallback"
      viewBox={
        cityPlace === "home"
          ? "405 265 245 185"
          : cityPlace === "hospital"
            ? "425 295 235 175"
            : cityOverview
              ? "335 210 525 350"
              : "0 0 900 670"
      }
      role="img"
      aria-label="Conceptual energy journey: separate primary and steam circuits, a turbine shaft driving a generator, transmission lines and a lit city."
    >
      <defs>
        <linearGradient id="power-steel">
          <stop stopColor="#6c8390" />
          <stop offset="1" stopColor="#253b4a" />
        </linearGradient>
        <linearGradient id="city-glass" x2="0.2" y2="1">
          <stop stopColor="#648193" />
          <stop offset="1" stopColor="#233847" />
        </linearGradient>
      </defs>
      <path
        d="M68 190 308 89 570 200 327 307Z"
        fill="#182632"
        stroke="#53616a"
      />
      <path
        d="M340 377 605 254 848 369 588 507Z"
        fill="#182632"
        stroke="#53616a"
      />
      <g fill="url(#power-steel)" stroke="#9caeb2" strokeWidth="1.5">
        <path d="M99 116V201Q125 225 153 201V116" />
        <ellipse cx="126" cy="116" rx="27" ry="12" />
        <path d="M214 126V217Q242 239 271 217V126" />
        <ellipse cx="243" cy="126" rx="29" ry="13" />
        <path d="M330 188 376 167 417 184 367 211Z M330 188V215L367 238V211 M367 238 417 211V184" />
        <path d="M438 223 472 207 505 224 471 242Z M438 223V247L471 266V242 M471 266 505 249V224" />
      </g>
      <path
        d="M153 161 202 180 224 171M231 186 251 196 232 206 251 215M224 220 168 238 126 211"
        fill="none"
        stroke="#de9e57"
        strokeWidth={selected === "heat" ? 5 : 3}
      />
      <path
        d="M252 124V94L345 133V179"
        fill="none"
        stroke="#e9b974"
        strokeWidth="4"
      />
      <path d="M367 202 472 236" stroke="#a8b7bd" strokeWidth="5" />
      <g stroke="#c1cbd0" strokeWidth="2">
        <path d="m342 190 45 20m-23-35 3 43m-16-38 31 37m-43-20 50-13" />
      </g>
      <path
        d="M369 226 353 249 235 243 234 224"
        fill="none"
        stroke="#5286a4"
        strokeWidth="3"
      />
      <g stroke="#7291a5" fill="none" strokeWidth="2">
        <path d="M532 324 547 213 564 338M536 294 559 268 541 248 560 316M528 241 565 255M570 343 586 242 603 355M575 315 599 286 580 270 599 330M569 264 606 276" />
        <path
          d="M501 240 543 236Q565 276 583 262L613 363"
          stroke="#65c5ff"
          strokeWidth={selected === "transmission" ? 4 : 2.5}
        />
      </g>
      <path
        d="M407 393 622 294M489 447 705 332M424 340 741 422"
        stroke="#263e4d"
        strokeWidth="13"
      />
      {CITY_BUILDINGS.map((building, index) => {
        const x = 583 + (building.x - 7 - (building.z - 3.5)) * 24;
        const y = 383 + (building.x - 7 + building.z - 3.5) * 11;
        const width = building.width * 19;
        const depth = building.depth * 14;
        const height = building.height * 27;
        return (
          <g
            key={index}
            transform={`translate(${x.toFixed(3)} ${y.toFixed(3)})`}
          >
            <path
              d={`M${-width} ${-height} 0 ${-height + depth}V${depth}L${-width} 0Z`}
              fill="#314b5e"
              stroke="#597184"
            />
            <path
              d={`M0 ${-height + depth} ${width} ${-height}V0L0 ${depth}Z`}
              fill="url(#city-glass)"
              stroke="#597184"
            />
            <path
              d={`M${-width} ${-height} 0 ${-height - depth} ${width} ${-height} 0 ${-height + depth}Z`}
              fill="#738792"
            />
            {Array.from(
              { length: Math.max(1, Math.floor(building.height * 3)) },
              (_, row) => (
                <path
                  key={row}
                  d={`M${-width + 4} ${-height + 9 + row * 8}l${width - 8} ${depth * 0.65}m8 0 ${width - 8} ${-depth * 0.65}`}
                  stroke={selected === "city" ? "#ffe0a3" : "#d9af75"}
                  strokeWidth="3"
                  opacity={
                    (index * 7 + row * 3) % 5 === 0
                      ? 0.16
                      : 0.65 + ((index + row) % 4) * 0.1
                  }
                />
              ),
            )}
            {building.kind === "hospital" && (
              <path d="M3-22h12m-6-6v12" stroke="#ffe3aa" strokeWidth="3" />
            )}
          </g>
        );
      })}
      <path
        d="M432 395 619 305M500 442 699 349"
        stroke="#e3c38b"
        strokeWidth="3"
        strokeDasharray="2 16"
      />
    </svg>
  );
}
