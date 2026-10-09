"use client";

import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ISOTOPE, type ParticleFilter } from "@/lib/nucleus";
import type { ViewOrientation } from "./nucleus-canvas";
import { NucleusFallback } from "./nucleus-fallback";
import { ReactionControls, ReactionNeutron } from "./reaction-controls";
import { useFission } from "./use-fission";
import { useReactor } from "./use-reactor";
import { ReactorControls, ReactorHotspots } from "./reactor-controls";
import { ReactorFallback } from "./reactor-fallback";
import { usePower } from "./use-power";
import { PowerControls, PowerHotspots } from "./power-controls";
import { PowerFallback } from "./power-fallback";
import {
  useJourney,
  type JourneyPhase,
  type JourneyTransition,
} from "./use-journey";
import { JourneyNavigation } from "./journey-navigation";

const NucleusCanvas = dynamic(() => import("./nucleus-canvas"), { ssr: false });

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const descriptions: Record<ParticleFilter, { title: string; copy: string }> = {
  all: {
    title: "A small world. An extraordinary possibility.",
    copy: "235 particles, bound together by the strong nuclear force. This is where our story begins.",
  },
  proton: {
    title: "92 protons. Unmistakably uranium.",
    copy: "Each proton carries a positive electric charge. Their number defines the element: 92 means uranium.",
  },
  neutron: {
    title: "143 neutrons. A particular kind of uranium.",
    copy: "Neutrons have no electric charge. Together with 92 protons, they give this isotope its mass number: 235.",
  },
};

export function AtomExperience() {
  const [filter, setFilter] = useState<ParticleFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [orientation, setOrientation] = useState<ViewOrientation>({
    x: 0,
    y: 0,
  });
  const [resetKey, setResetKey] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const journey = useJourney(
    visible && !aboutOpen,
    reducedMotion || webgl === false,
  );
  const reacting = journey.phase > 0;
  const insideReactor = journey.phase >= 2;
  const poweringCity = journey.phase === 3;
  const power = usePower(
    poweringCity && !journey.busy,
    playing,
    visible && !aboutOpen,
    reducedMotion || webgl === false,
  );
  const reactor = useReactor(
    journey.phase === 2 && !journey.busy,
    playing,
    visible && !aboutOpen,
    reducedMotion || webgl === false,
  );
  const reaction = useFission(
    journey.phase === 1 && !journey.busy,
    playing,
    visible && !aboutOpen,
    reducedMotion || webgl === false,
  );
  const pointer = useRef<ViewOrientation>({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    initial: ViewOrientation;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const exploreButton = useRef<HTMLButtonElement>(null);
  const destinationFocus = useRef<string | null>(null);
  const handleReady = useCallback(() => setReady(true), []);
  const handleContextLost = useCallback(() => {
    setWebgl(false);
    setReady(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () =>
      setVisible(document.visibilityState === "visible");
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", {
        failIfMajorPerformanceCaveat: true,
      });
      setWebgl(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebgl(false);
    }
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (aboutOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [aboutOpen]);

  const resetView = () => {
    setOrientation({ x: 0, y: 0 });
    setExpanded(false);
    setFilter("all");
    setResetKey((value) => value + 1);
    pointer.current = { x: 0, y: 0 };
  };

  const available = [
    true,
    journey.visited[1] || (journey.phase === 0 && expanded),
    journey.visited[2] ||
      (journey.phase === 1 && reaction.stage === "complete"),
    journey.visited[3] || (journey.phase === 2 && reactor.stage === "ready"),
  ];
  const navigate = (
    next: JourneyPhase,
    focus?: string,
    followCoolant = false,
  ) => {
    if (journey.busy || next === journey.phase || !available[next]) return;
    pointer.current.x = 0;
    pointer.current.y = 0;
    drag.current = null;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
    reaction.dragPoint.current.active = false;
    destinationFocus.current =
      focus ??
      [
        "explore-button",
        reaction.stage === "ready" ? "incoming-neutron" : "reaction-status",
        "reactor-title",
        "power-title",
      ][next];
    let transition: JourneyTransition = "crossfade";
    if (next === 3 && followCoolant) {
      power.followCoolant();
      transition = "native";
    } else if (!journey.visited[next]) {
      setPlaying(true);
      transition = next === 1 ? "gather" : "native";
      if (next === 2) reactor.begin(true);
      if (next === 3) power.begin();
    } else if (
      next === journey.phase - 1 &&
      (next === 0 ||
        (next === 1 && reaction.stage === "complete") ||
        (next === 2 && reactor.stage === "ready"))
    )
      transition = "return";
    journey.navigate(next, transition);
  };

  useEffect(() => {
    if (journey.busy || !destinationFocus.current) return;
    document
      .getElementById(destinationFocus.current)
      ?.focus({ preventScroll: true });
    destinationFocus.current = null;
  }, [journey.phase, journey.busy]);

  return (
    <main
      className={`experience${expanded && !reacting ? " is-exploring" : ""}${ready ? " scene-ready" : ""}${reacting ? " is-reacting" : ""}${insideReactor ? " is-reactor" : ""}${poweringCity ? " is-power" : ""}${journey.busy ? " is-travelling" : ""}`}
      data-phase={journey.phase + 1}
    >
      <a
        className="skip-link"
        href={
          poweringCity
            ? "#power-title"
            : insideReactor
              ? "#reactor-title"
              : reacting
                ? "#reaction-title"
                : "#explore-button"
        }
      >
        {poweringCity
          ? "Skip to city exploration"
          : insideReactor
            ? "Skip to reactor exploration"
            : reacting
              ? "Skip to reaction"
              : "Skip to exploration"}
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="/"
          aria-label="Nuclume home"
          onClick={(event) => {
            event.preventDefault();
            navigate(0);
          }}
        >
          <svg className="brand-symbol" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="11" cy="10" r="6.5" />
            <circle cx="22" cy="14" r="6.5" />
            <circle cx="12" cy="23" r="6.5" />
            <circle cx="23" cy="25" r="4" />
          </svg>
          NUCLUME<span>.</span>
        </a>
        <JourneyNavigation
          journey={journey}
          available={available}
          onNavigate={navigate}
        />
      </header>
      <section
        className="chapter"
        inert={journey.busy}
        aria-labelledby={
          poweringCity
            ? "power-title"
            : insideReactor
              ? "reactor-title"
              : reacting
                ? "reaction-title"
                : "chapter-title"
        }
      >
        <div className="scene-atmosphere" aria-hidden="true" />
        <div className="atom-composition" ref={journey.scene}>
          <div
            id="atom-stage"
            className={`atom-stage${ready ? " is-ready" : ""}${webgl === false ? " is-static" : ""}`}
            tabIndex={webgl === false || reacting ? -1 : 0}
            role="group"
            aria-label={
              poweringCity
                ? "Conceptual journey from reactor heat to a powered city"
                : insideReactor
                  ? "Conceptual pressurized water reactor"
                  : reacting
                    ? "Conceptual uranium-235 fission"
                    : "Interactive uranium-235 nucleus"
            }
            aria-describedby={
              poweringCity
                ? "power-detail"
                : insideReactor
                  ? "reactor-detail"
                  : reacting
                    ? "reaction-instruction"
                    : "interaction-help"
            }
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              pointer.current.x =
                ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
              pointer.current.y =
                ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
              if (drag.current && !reacting) {
                setOrientation({
                  x: Math.max(
                    -0.85,
                    Math.min(
                      0.85,
                      drag.current.initial.x +
                        (event.clientY - drag.current.y) * 0.005,
                    ),
                  ),
                  y:
                    drag.current.initial.y +
                    (event.clientX - drag.current.x) * 0.005,
                });
              }
            }}
            onPointerDown={(event) => {
              if (webgl === false || reacting || event.button !== 0) return;
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                initial: orientation,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onPointerLeave={() => {
              pointer.current.x = 0;
              pointer.current.y = 0;
            }}
            onKeyDown={(event) => {
              if (reacting) return;
              if (event.code === "Space") {
                event.preventDefault();
                setPlaying((value) => !value);
                return;
              }
              if (
                ![
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                ].includes(event.key)
              )
                return;
              event.preventDefault();
              if (event.key === "Home") resetView();
              else
                setOrientation((value) => ({
                  x: Math.max(
                    -0.85,
                    Math.min(
                      0.85,
                      value.x +
                        (event.key === "ArrowUp"
                          ? -0.15
                          : event.key === "ArrowDown"
                            ? 0.15
                            : 0),
                    ),
                  ),
                  y:
                    value.y +
                    (event.key === "ArrowLeft"
                      ? -0.2
                      : event.key === "ArrowRight"
                        ? 0.2
                        : 0),
                }));
            }}
          >
            {(!ready || webgl === false) &&
              (poweringCity ? (
                <PowerFallback
                  selected={power.transfer ? "heat" : power.selected}
                  cityPlace={
                    !power.transfer && power.selected === "city"
                      ? power.cityPlace
                      : null
                  }
                  cityOverview={
                    !power.transfer &&
                    power.stage === "ready" &&
                    (!power.selected || power.selected === "city")
                  }
                />
              ) : insideReactor ? (
                <ReactorFallback selected={reactor.selected} />
              ) : (
                <NucleusFallback
                  filter={filter}
                  expanded={expanded && !reacting}
                  reaction={reacting ? reaction.stage : undefined}
                />
              ))}
            {webgl && (
              <SceneBoundary onError={handleContextLost}>
                <NucleusCanvas
                  filter={filter}
                  expanded={expanded && !reacting}
                  playing={playing}
                  reducedMotion={reducedMotion}
                  visible={visible && !aboutOpen}
                  orientation={orientation}
                  resetKey={resetKey}
                  pointer={pointer}
                  reacting={reacting}
                  reaction={reaction}
                  journey={journey}
                  reactor={insideReactor ? reactor : null}
                  power={poweringCity ? power : null}
                  onReady={handleReady}
                  onContextLost={handleContextLost}
                />
              </SceneBoundary>
            )}
          </div>
          {poweringCity && (
            <PowerHotspots power={power} fallback={webgl === false} />
          )}
          {insideReactor && !poweringCity && (
            <ReactorHotspots reactor={reactor} fallback={webgl === false} />
          )}
          {reacting && !insideReactor && (
            <ReactionNeutron reaction={reaction} fallback={webgl === false} />
          )}
        </div>
        {poweringCity && (
          <PowerControls
            power={power}
            onReturn={() =>
              navigate(
                2,
                reactor.stage === "ready" ? "power-entry" : "reactor-title",
              )
            }
            onReplay={() => {
              setPlaying(true);
              power.begin();
            }}
          />
        )}
        {insideReactor && !poweringCity && (
          <ReactorControls
            reactor={reactor}
            onContinue={() =>
              navigate(3, undefined, reactor.selected === "coolant")
            }
            onReturn={() =>
              navigate(
                1,
                reaction.stage === "complete" ? "reactor-entry" : undefined,
              )
            }
            onReplay={() => {
              setPlaying(true);
              reactor.begin(false);
            }}
          />
        )}
        {reacting && !insideReactor && (
          <ReactionControls
            reaction={reaction}
            onContinue={() => navigate(2)}
            onBack={() =>
              navigate(0, expanded ? "reaction-entry" : "explore-button")
            }
            onReplay={() => {
              reaction.reset();
              setPlaying(true);
              requestAnimationFrame(() =>
                reaction.handle.current?.focus({ preventScroll: true }),
              );
            }}
          />
        )}
        <div className="hero-copy" hidden={reacting}>
          <h1 id="chapter-title">
            <span>A world</span>
            <em>within.</em>
          </h1>
          <p className="hero-description">
            Before a city comes to light,
            <br />a story begins inside an atom.
          </p>
          <button
            id="explore-button"
            ref={exploreButton}
            className="explore-button"
            aria-expanded={expanded}
            aria-controls="nucleus-controls"
            onClick={() => {
              setExpanded(!expanded);
              if (expanded) setFilter("all");
            }}
          >
            <span className="explore-arrow">
              <Arrow />
            </span>
            <span>
              {expanded ? "Return to the scene" : "Explore the nucleus"}
            </span>
          </button>
        </div>
        <aside
          className="exploration-panel"
          id="nucleus-controls"
          aria-label="Inside uranium-235"
          hidden={!expanded || reacting}
        >
          <div className="panel-heading">
            <span>URANIUM–235</span>
            <button
              aria-label="Reset view"
              onClick={() => {
                resetView();
                exploreButton.current?.focus({ preventScroll: true });
              }}
            >
              Reset view <span aria-hidden="true">↺</span>
            </button>
          </div>
          <div className="particle-controls" aria-label="Highlight particles">
            <button
              className={`particle-control${filter === "proton" ? " selected" : ""}`}
              aria-pressed={filter === "proton"}
              onClick={() => setFilter(filter === "proton" ? "all" : "proton")}
            >
              <span className="particle-dot proton-dot" />
              <span className="particle-count">{ISOTOPE.protons}</span>
              <span className="particle-name">
                Protons<span>POSITIVE CHARGE</span>
              </span>
              <span className="particle-sign">+</span>
            </button>
            <button
              className={`particle-control${filter === "neutron" ? " selected" : ""}`}
              aria-pressed={filter === "neutron"}
              onClick={() =>
                setFilter(filter === "neutron" ? "all" : "neutron")
              }
            >
              <span className="particle-dot neutron-dot" />
              <span className="particle-count">{ISOTOPE.neutrons}</span>
              <span className="particle-name">
                Neutrons<span>NO CHARGE</span>
              </span>
              <span className="particle-sign">0</span>
            </button>
          </div>
          <div
            className="particle-explanation"
            aria-live="polite"
            aria-atomic="true"
          >
            <h2>{descriptions[filter].title}</h2>
            <p>{descriptions[filter].copy}</p>
            {expanded && (
              <p className="expanded-note">
                Spacing increased to reveal the structure.
              </p>
            )}
          </div>
          <div className="panel-footer">
            <span>Drag to rotate · Arrow keys to explore</span>
            <button className="about-button" onClick={() => setAboutOpen(true)}>
              The science <Arrow diagonal />
            </button>
          </div>
          <button
            id="reaction-entry"
            className="reaction-entry"
            onClick={() => navigate(1)}
          >
            The first reaction{" "}
            <span>
              02 <Arrow />
            </span>
          </button>
        </aside>
        <p id="interaction-help" className="sr-only" hidden={reacting}>
          A conceptual uranium-235 nucleus, containing 92 protons and 143
          neutrons. Drag or use arrow keys to rotate. Space pauses motion. Home
          resets the view. Colors, positions, motion, and atmospheric motes are
          illustrative, not a physical simulation.
        </p>
        {webgl === false && (
          <p className="fallback-note" role="status">
            STATIC VIEW · 3D is unavailable. The illustrated model remains
            interactive.
          </p>
        )}
        <button
          className="motion-control"
          data-guided={poweringCity && power.transfer ? "" : undefined}
          aria-label={
            poweringCity
              ? playing
                ? "Pause city motion"
                : "Resume city motion"
              : insideReactor
                ? playing
                  ? "Pause reactor motion"
                  : "Resume reactor motion"
                : reacting
                  ? playing
                    ? "Pause reaction"
                    : "Resume reaction"
                  : playing
                    ? "Pause rotation"
                    : "Resume rotation"
          }
          aria-pressed={!playing}
          disabled={reducedMotion || webgl === false}
          onClick={() => setPlaying(!playing)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d={
                playing && !reducedMotion
                  ? "M9 5v14m6-14v14"
                  : "m9 5 10 7-10 7V5Z"
              }
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          <span>
            {playing && !reducedMotion ? "Pause motion" : "Motion paused"}
          </span>
        </button>
      </section>
      <dialog
        ref={dialog}
        className="about-dialog"
        aria-labelledby="about-title"
        onClose={() => setAboutOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setAboutOpen(false);
        }}
      >
        <button
          className="dialog-close"
          aria-label="Close about the experience"
          onClick={() => setAboutOpen(false)}
        >
          ×
        </button>
        <p className="section-kicker">NUCLUME / CHAPTER 01</p>
        <h2 id="about-title">
          A world within.
          <br />
          <em>A world ahead.</em>
        </h2>
        <p>
          From a single atom to an entire city. NUCLUME is an exploration of the
          science behind nuclear energy. This first chapter begins with the
          nucleus of uranium-235.
        </p>
        <p>
          Its 92 protons define it as uranium. Add 143 neutrons and you have 235
          nucleons, giving this isotope its name.
        </p>
        <p className="science-note">
          This is a conceptual model, not a physical simulation. Colors identify
          particle types; positions, sizes, spacing, and motion are
          illustrative. The ambient motes are atmosphere, not emitted particles.
          Electrons are outside this view.
        </p>
        <a
          href="https://www.nrc.gov/education-regulatory-research/the-student-corner/science-101/what-is-a-chain-reaction"
          target="_blank"
          rel="noreferrer"
        >
          The science, via the U.S. NRC <Arrow diagonal />
        </a>
      </dialog>
    </main>
  );
}
