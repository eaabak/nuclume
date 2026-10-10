"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ParticleFilter } from "@/lib/nucleus";
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
import { useLanguage } from "./language-provider";
import { useJourneyAudio } from "./journey-audio";
import { useAtomOpening } from "./use-atom-opening";
import { AtomOpening } from "./atom-opening";
import {
  ExperienceHeader,
  MotionControl,
  AtomReticle,
} from "./experience-chrome";
import { ScienceDialog } from "./science-dialog";
import { SceneBoundary } from "./scene-boundary";
import { useSceneEnvironment } from "./use-scene-environment";
import { useSceneInput } from "./use-scene-input";

const NucleusCanvas = dynamic(() => import("./nucleus-canvas"), { ssr: false });

export function AtomExperience() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<ParticleFilter>("all");
  const [playing, setPlaying] = useState(true);
  const { reducedMotion, visible, webgl, ready, onReady, onContextLost } =
    useSceneEnvironment();
  const [resetKey, setResetKey] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const journey = useJourney(
    visible && !aboutOpen,
    reducedMotion || webgl === false,
  );
  const reacting = journey.phase > 0;
  const opening = useAtomOpening(!reacting, reducedMotion || webgl === false);
  const expanded = !reacting && opening.beat === "inspect";
  const neutronPreview = !reacting && opening.beat === "neutron";
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
  const audio = useJourneyAudio({
    phase: journey.phase,
    reactionStage: reaction.stage,
    reactorTime: reactor.elapsed,
    reactorSelected: reactor.selected,
    reactorInspection: reactor.inspection,
    powerTime: power.sceneTime,
    powerTransfer: power.transfer,
    powerSelected: power.selected,
    roomOpen: power.roomOpen,
    playing,
    visible: visible && !aboutOpen,
    reducedMotion,
  });
  const input = useSceneInput({
    phase: journey.phase,
    disabled: webgl === false || journey.busy,
    playing,
    reducedMotion,
    neutronPreview,
    scene: journey.scene,
    city: power,
    reactor,
    onResetOpening: () => resetView(),
    onToggleMotion: () => setPlaying((value) => !value),
  });
  const previousPhase = useRef(journey.phase);
  const destinationFocus = useRef<string | null>(null);
  const resetView = () => {
    input.reset();
    opening.reset();
    setFilter("all");
    setResetKey((value) => value + 1);
  };

  const available = [
    true,
    journey.visited[1] || (journey.phase === 0 && (expanded || neutronPreview)),
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
    input.clearPointer();
    if (journey.phase !== 0 && next !== 0)
      window.scrollTo({
        top: 0,
        behavior: reducedMotion ? "instant" : "smooth",
      });
    reaction.dragPoint.current.active = false;
    destinationFocus.current =
      focus ??
      [
        opening.beat === "neutron"
          ? "opening-neutron-title"
          : opening.beat === "inspect"
            ? "opening-inspect-title"
            : "explore-button",
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
      transition = next === 1 && !neutronPreview ? "gather" : "native";
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

  useLayoutEffect(() => {
    if (previousPhase.current === 0 && journey.phase !== 0)
      window.scrollTo({ top: 0, behavior: "instant" });
    previousPhase.current = journey.phase;
  }, [journey.phase]);

  const startOpeningReaction = () => {
    if (journey.busy) return;
    setFilter("all");
    setPlaying(true);
    destinationFocus.current = "reaction-status";
    journey.navigate(1, "native");
    if (reaction.stage === "ready") reaction.start();
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
      ref={opening.container}
      data-opening-beat={!reacting ? opening.beat : undefined}
      className={`experience${!reacting ? " is-opening" : ""}${ready ? " scene-ready" : ""}${reacting ? " is-reacting" : ""}${insideReactor ? " is-reactor" : ""}${poweringCity ? " is-power" : ""}${journey.busy ? " is-travelling" : ""}`}
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
                : neutronPreview
                  ? "#opening-reaction-entry"
                  : expanded
                    ? "#opening-inspect-title"
                    : "#explore-button"
        }
      >
        {poweringCity
          ? t("Skip to city exploration", "Şehir keşfine geç")
          : insideReactor
            ? t("Skip to reactor exploration", "Reaktör keşfine geç")
            : reacting
              ? t("Skip to reaction", "Tepkimeye geç")
              : t("Skip to exploration", "Keşfe geç")}
      </a>
      <ExperienceHeader
        journey={journey}
        available={available}
        onNavigate={navigate}
        onHome={() => (reacting ? navigate(0) : resetView())}
        audio={audio}
      />
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
                : neutronPreview
                  ? "opening-neutron-title"
                  : expanded
                    ? "opening-inspect-title"
                    : "chapter-title"
        }
      >
        <div className="scene-atmosphere" aria-hidden="true" />
        <div className="atom-composition" ref={journey.scene}>
          <div
            id="atom-stage"
            className={`atom-stage${ready ? " is-ready" : ""}${webgl === false ? " is-static" : ""}`}
            tabIndex={
              webgl === false ||
              journey.busy ||
              (reacting &&
                !poweringCity &&
                !(insideReactor && reactor.stage === "ready"))
                ? -1
                : 0
            }
            data-explorable={
              webgl !== false &&
              !journey.busy &&
              ((insideReactor && !poweringCity && reactor.stage === "ready") ||
                (poweringCity &&
                  power.stage === "ready" &&
                  !power.transfer &&
                  !power.roomOpen))
                ? ""
                : undefined
            }
            role="group"
            aria-label={
              poweringCity
                ? t(
                    "Conceptual journey from reactor heat to a powered city",
                    "Reaktör ısısından elektrikle aydınlanan bir şehre kavramsal yolculuk",
                  )
                : insideReactor
                  ? t(
                      "Conceptual pressurized water reactor",
                      "Kavramsal basınçlı su reaktörü",
                    )
                  : reacting
                    ? t(
                        "Conceptual uranium-235 fission",
                        "Kavramsal uranyum-235 fisyonu",
                      )
                    : t(
                        "Interactive uranium-235 nucleus",
                        "Etkileşimli uranyum-235 çekirdeği",
                      )
            }
            aria-describedby={
              poweringCity
                ? "power-detail city-navigation-help"
                : insideReactor
                  ? "reactor-detail reactor-navigation-help"
                  : reacting
                    ? "reaction-instruction"
                    : "interaction-help"
            }
            {...input.handlers}
          >
            {(!ready || webgl === false) &&
              (poweringCity ? (
                <PowerFallback
                  roomOpen={power.roomOpen}
                  selected={
                    power.transfer
                      ? power.transfer === "steaming" ||
                        power.transfer === "turbine"
                        ? "turbine"
                        : "heat"
                      : power.selected
                  }
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
                  filter={!reacting && !expanded ? "all" : filter}
                  expanded={expanded && !reacting}
                  reaction={reacting ? reaction.stage : undefined}
                />
              ))}
            {webgl && (
              <SceneBoundary onError={onContextLost}>
                <NucleusCanvas
                  filter={!reacting && !expanded ? "all" : filter}
                  expanded={expanded && !reacting}
                  opening={!reacting ? opening : null}
                  playing={playing}
                  reducedMotion={reducedMotion}
                  visible={visible && !aboutOpen}
                  orientation={input.orientation}
                  resetKey={resetKey}
                  pointer={input.pointer}
                  reacting={reacting}
                  reaction={reaction}
                  journey={journey}
                  reactor={insideReactor ? reactor : null}
                  power={poweringCity ? power : null}
                  onReady={onReady}
                  onContextLost={onContextLost}
                />
              </SceneBoundary>
            )}
          </div>
          {!reacting && (
            <AtomReticle
              visible={ready || webgl === false}
              animated={playing && !reducedMotion && visible && webgl !== false}
            />
          )}
          {poweringCity && (
            <PowerHotspots power={power} fallback={webgl === false} />
          )}
          {insideReactor && !poweringCity && (
            <ReactorHotspots reactor={reactor} fallback={webgl === false} />
          )}
          {((reacting && !insideReactor) ||
            (neutronPreview && reaction.stage === "ready")) && (
            <ReactionNeutron
              autoFocus={reacting}
              reaction={
                reacting
                  ? reaction
                  : { ...reaction, start: startOpeningReaction }
              }
              fallback={webgl === false}
            />
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
            onBack={() => navigate(0)}
            onReplay={() => {
              reaction.replay();
              setPlaying(true);
            }}
          />
        )}
        {!reacting && (
          <AtomOpening
            opening={opening}
            filter={filter}
            reactionReady={reaction.stage === "ready"}
            onFilter={setFilter}
            onReset={resetView}
            onScience={() => setAboutOpen(true)}
            onReaction={startOpeningReaction}
          />
        )}
        <p id="interaction-help" className="sr-only" hidden={reacting}>
          {t(
            "A conceptual uranium-235 nucleus, containing 92 protons and 143 neutrons. Scroll or use the exploration buttons to move closer. Drag with a mouse or use arrow keys to rotate. Space pauses motion. Home resets the view. Colors, positions, motion, and atmospheric motes are illustrative, not a physical simulation.",
            "92 proton ve 143 nötron içeren kavramsal uranyum-235 çekirdeği. Yaklaşmak için kaydırın veya keşif düğmelerini kullanın. Döndürmek için fareyle sürükleyin veya yön tuşlarını kullanın. Boşluk tuşu hareketi duraklatır. Home tuşu görünümü sıfırlar. Renkler, konumlar, hareket ve atmosfer parçacıkları temsilidir; fiziksel simülasyon değildir.",
          )}
        </p>
        {webgl === false && (
          <p className="fallback-note" role="status">
            {t(
              "STATIC VIEW · 3D is unavailable. The illustrated model remains interactive.",
              "STATİK GÖRÜNÜM · 3B kullanılamıyor. Çizim üzerinden etkileşime devam edebilirsiniz.",
            )}
          </p>
        )}
        <MotionControl
          phase={journey.phase}
          playing={playing}
          reducedMotion={reducedMotion}
          unavailable={webgl === false}
          guided={Boolean(poweringCity && power.transfer)}
          onToggle={() => setPlaying(!playing)}
        />
      </section>
      <ScienceDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}
