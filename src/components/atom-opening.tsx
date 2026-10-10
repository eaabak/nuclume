"use client";

import { useEffect, useRef } from "react";
import { ISOTOPE, type ParticleFilter } from "@/lib/nucleus";
import { useLanguage } from "./language-provider";
import type { AtomOpeningController } from "./use-atom-opening";

const descriptions: Record<ParticleFilter, { copy: string }> = {
  all: {
    copy: "235 particles, bound together by the strong nuclear force. This is where our story begins.",
  },
  proton: {
    copy: "Each proton carries a positive electric charge. Their number defines the element: 92 means uranium.",
  },
  neutron: {
    copy: "Neutrons have no electric charge. Together with 92 protons, they give this isotope its mass number: 235.",
  },
};

const descriptionsTr: typeof descriptions = {
  all: {
    copy: "Güçlü nükleer kuvvetle bir arada tutulan 235 parçacık. Hikâyemiz burada başlıyor.",
  },
  proton: {
    copy: "Her proton pozitif elektrik yükü taşır. Proton sayısı elementi belirler: 92, uranyum demektir.",
  },
  neutron: {
    copy: "Nötronlar elektrik yükü taşımaz. 92 protonla birlikte bu izotopun kütle numarasını oluştururlar: 235.",
  },
};

export function AtomOpening({
  opening,
  filter,
  reactionReady,
  onFilter,
  onReset,
  onScience,
  onReaction,
}: {
  opening: AtomOpeningController;
  filter: ParticleFilter;
  reactionReady: boolean;
  onFilter: (filter: ParticleFilter) => void;
  onReset: () => void;
  onScience: () => void;
  onReaction: () => void;
}) {
  const { language, t } = useLanguage();
  const description = (language === "tr" ? descriptionsTr : descriptions)[
    filter
  ].copy;
  const focusNext = useRef<AtomOpeningController["beat"] | null>(null);
  const arriving = opening.beat === "arrival" || opening.beat === "approach";
  const inspecting = opening.beat === "inspect";
  const encountering = opening.beat === "neutron";

  useEffect(() => {
    if (focusNext.current !== opening.beat) return;
    document
      .getElementById(
        opening.beat === "arrival"
          ? "explore-button"
          : opening.beat === "inspect"
            ? "opening-inspect-title"
            : "opening-neutron-title",
      )
      ?.focus({ preventScroll: true });
    focusNext.current = null;
  }, [opening.beat]);

  const advance = () => {
    focusNext.current = arriving ? "inspect" : "neutron";
    opening.advance();
  };

  return (
    <>
      <div
        className="hero-copy opening-arrival"
        inert={!arriving}
        aria-hidden={!arriving}
      >
        <h1 id="chapter-title">
          <span>{t("A world", "İçinde bir")}</span>
          <em>{t("within.", "dünya.")}</em>
        </h1>
        <p className="hero-description">
          {t("Before a city comes to light,", "Bir şehir aydınlanmadan önce,")}
          <br />
          {t(
            "a story begins inside an atom.",
            "bir atomun içinde başlar hikâye.",
          )}
        </p>
        <button
          id="explore-button"
          className="explore-button"
          onClick={advance}
        >
          <span className="explore-arrow" aria-hidden="true">
            ↘
          </span>
          <span>{t("Come closer", "Yakından bak")}</span>
        </button>
      </div>
      <div
        className="opening-inspect opening-copy"
        inert={!inspecting}
        aria-hidden={!inspecting}
      >
        <p className="section-kicker">
          {t("URANIUM–235 / A CLOSER LOOK", "URANYUM–235 / YAKINDAN")}
        </p>
        <h2 id="opening-inspect-title" tabIndex={-1}>
          {t("235 particles.", "235 parçacık.")}
          <br />
          <em>{t("One nucleus.", "Tek çekirdek.")}</em>
        </h2>
        <div
          className="opening-particles"
          role="group"
          aria-label={t("Highlight particles", "Parçacıkları vurgula")}
        >
          <button
            aria-pressed={filter === "proton"}
            onClick={() => onFilter(filter === "proton" ? "all" : "proton")}
          >
            <i className="particle-dot proton-dot" aria-hidden="true" />
            <strong>{ISOTOPE.protons}</strong> {t("protons", "proton")}
          </button>
          <button
            aria-pressed={filter === "neutron"}
            onClick={() => onFilter(filter === "neutron" ? "all" : "neutron")}
          >
            <i className="particle-dot neutron-dot" aria-hidden="true" />
            <strong>{ISOTOPE.neutrons}</strong> {t("neutrons", "nötron")}
          </button>
        </div>
        <p className="opening-detail" aria-live="polite" aria-atomic="true">
          {description}
        </p>
        <div className="opening-actions">
          <button className="opening-next" onClick={advance}>
            {t("What changes everything?", "Her şeyi ne değiştirir?")}{" "}
            <span aria-hidden="true">→</span>
          </button>
          <button className="about-button" onClick={onScience}>
            {t("The science", "Bilimsel arka plan")}
          </button>
        </div>
      </div>
      <div
        className="opening-encounter opening-copy"
        inert={!encountering}
        aria-hidden={!encountering}
      >
        <p className="section-kicker">
          {t("AT THE THRESHOLD", "DEĞİŞİMİN EŞİĞİNDE")}
        </p>
        <h2 id="opening-neutron-title" tabIndex={-1}>
          {t("One neutron", "Bir nötron")}
          <br />
          <em>{t("is enough.", "yeter.")}</em>
        </h2>
        <p className="opening-detail" id="reaction-instruction">
          {reactionReady
            ? t(
                "Drag the neutron into the nucleus. Or select it. The next moment is yours.",
                "Nötronu çekirdeğe sürükle ya da seç. Bir sonraki an senin elinde.",
              )
            : t(
                "Your reaction is waiting where you left it.",
                "Tepkimen bıraktığın yerde seni bekliyor.",
              )}
        </p>
        <button
          id="opening-reaction-entry"
          className="opening-next"
          onClick={onReaction}
        >
          {reactionReady
            ? t("Send the neutron", "Nötronu gönder")
            : t("Return to the reaction", "Tepkimeye dön")}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="opening-wayfinding">
        <button
          onClick={() => {
            focusNext.current = "arrival";
            onReset();
          }}
          disabled={opening.beat === "arrival"}
          aria-label={t("Return to the opening", "Açılışa dön")}
        >
          <span aria-hidden="true">↑</span> {t("Beginning", "Başlangıç")}
        </button>
        <div className="opening-scroll-cue" aria-hidden="true">
          <span>
            {encountering
              ? t("Your move", "Sıra sende")
              : t("Scroll to discover", "Kaydırarak keşfet")}
          </span>
          <i>
            <b />
          </i>
        </div>
      </div>
    </>
  );
}
