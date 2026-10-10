"use client";

import { useEffect, useState } from "react";
import { ISOTOPE } from "@/lib/nucleus";
import { JourneyNavigation } from "./journey-navigation";
import { LanguageSwitcher, useLanguage } from "./language-provider";
import type { JourneyController, JourneyPhase } from "./use-journey";

export function ExperienceHeader({
  journey,
  available,
  onNavigate,
  onHome,
  audio,
}: {
  journey: JourneyController;
  available: boolean[];
  onNavigate: (phase: JourneyPhase) => void;
  onHome: () => void;
  audio: { enabled: boolean; available: boolean; toggle: () => void };
}) {
  const { t } = useLanguage();
  const [brandOpen, setBrandOpen] = useState(false);
  useEffect(() => {
    if (!brandOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBrandOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [brandOpen]);
  return (
    <header className="site-header">
      <div
        className="brand"
        onMouseEnter={() => setBrandOpen(true)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement))
            setBrandOpen(false);
        }}
        onFocus={() => setBrandOpen(true)}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget) &&
            !event.currentTarget.matches(":hover")
          )
            setBrandOpen(false);
        }}
      >
        <a
          className="wordmark"
          href="/"
          aria-label={t("Nuclume home", "Nuclume ana sayfa")}
          aria-describedby="brand-origin"
          onClick={(event) => {
            event.preventDefault();
            onHome();
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
        <div
          id="brand-origin"
          role="tooltip"
          className="brand-tooltip"
          hidden={!brandOpen}
        >
          <span className="brand-tooltip-kicker">
            {t("Behind the name", "İsmin hikâyesi")}
          </span>
          <span className="brand-tooltip-words">
            <span>
              <strong>Nucleus</strong>
              <small>{t("Atomic nucleus", "Atom çekirdeği")}</small>
            </span>
            <span aria-hidden="true">+</span>
            <span>
              <strong>Lumen</strong>
              <small>{t("Latin for light", "Latince ışık")}</small>
            </span>
          </span>
          <span className="brand-tooltip-caption">
            {t(
              "From an atom’s nucleus to the light of a city.",
              "Atomun çekirdeğinden bir şehrin ışığına.",
            )}
          </span>
        </div>
      </div>
      <JourneyNavigation
        journey={journey}
        available={available}
        onNavigate={onNavigate}
      />
      <LanguageSwitcher />
      <button
        type="button"
        className="sound-control"
        aria-label={
          audio.enabled
            ? t("Turn sound design off", "Ses tasarımını kapat")
            : t("Turn sound design on", "Ses tasarımını aç")
        }
        title={t("Optional sound design", "İsteğe bağlı ses tasarımı")}
        aria-pressed={audio.enabled}
        disabled={!audio.available}
        onClick={audio.toggle}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m11 5-5 4H3v6h3l5 4V5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d={
              audio.enabled
                ? "M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"
                : "m16 9 6 6m0-6-6 6"
            }
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  );
}

export function MotionControl({
  phase,
  playing,
  reducedMotion,
  unavailable,
  guided,
  onToggle,
}: {
  phase: JourneyPhase;
  playing: boolean;
  reducedMotion: boolean;
  unavailable: boolean;
  guided: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  return (
    <button
      className="motion-control"
      data-guided={guided ? "" : undefined}
      aria-label={
        phase === 3
          ? playing
            ? t("Pause city motion", "Şehir hareketini duraklat")
            : t("Resume city motion", "Şehir hareketini sürdür")
          : phase === 2
            ? playing
              ? t("Pause reactor motion", "Reaktör hareketini duraklat")
              : t("Resume reactor motion", "Reaktör hareketini sürdür")
            : phase === 1
              ? playing
                ? t("Pause reaction", "Tepkimeyi duraklat")
                : t("Resume reaction", "Tepkimeyi sürdür")
              : playing
                ? t("Pause rotation", "Dönüşü duraklat")
                : t("Resume rotation", "Dönüşü sürdür")
      }
      aria-pressed={!playing}
      disabled={reducedMotion || unavailable}
      onClick={onToggle}
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
            playing && !reducedMotion ? "M9 5v14m6-14v14" : "m9 5 10 7-10 7V5Z"
          }
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
      <span>
        {playing && !reducedMotion
          ? t("Pause motion", "Hareketi duraklat")
          : t("Motion paused", "Hareket duraklatıldı")}
      </span>
    </button>
  );
}

export function AtomReticle({
  visible,
  animated,
}: {
  visible: boolean;
  animated: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="atom-reticle"
      hidden={!visible}
      data-motion={animated ? "playing" : "paused"}
    >
      <svg
        className="atom-reticle-ring"
        viewBox="0 0 1000 1000"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="reticle-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--amber)" stopOpacity="0.05" />
            <stop offset="0.4" stopColor="var(--amber)" stopOpacity="0.4" />
            <stop offset="0.7" stopColor="var(--blue)" stopOpacity="0.13" />
            <stop offset="1" stopColor="var(--amber)" stopOpacity="0.42" />
          </linearGradient>
        </defs>
        <circle
          cx="500"
          cy="500"
          r="465"
          fill="none"
          stroke="url(#reticle-stroke)"
          strokeWidth="0.8"
        />
        <circle
          className="reticle-motion"
          cx="500"
          cy="500"
          r="465"
          fill="none"
          stroke="var(--amber)"
          strokeWidth="1"
          opacity="0.35"
          pathLength="1000"
          strokeDasharray="34 210 2 92 14 315 2 331"
        />
      </svg>
      <div className="atom-annotation atom-annotation--isotope">
        <i className="annotation-leader" aria-hidden="true" />
        <span>
          {ISOTOPE.protons} {t("PROTONS", "PROTON")}
          <br />
          {ISOTOPE.neutrons} {t("NEUTRONS", "NÖTRON")}
          <br />
          {t("URANIUM", "URANYUM")}–{ISOTOPE.massNumber}
        </span>
      </div>
      <div className="atom-annotation atom-annotation--potential">
        <span>
          {t("NUCLEAR", "NÜKLEER")}
          <br />
          {t("POTENTIAL", "POTANSİYEL")}
        </span>
        <i className="annotation-leader" aria-hidden="true" />
      </div>
    </div>
  );
}
