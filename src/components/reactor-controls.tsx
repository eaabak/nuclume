"use client";

import { useEffect, useRef } from "react";
import {
  REACTOR_PART_IDS,
  REACTOR_PARTS,
  REACTOR_ANNOTATIONS,
  type ReactorStage,
} from "@/lib/reactor";
import type { ReactorController } from "./use-reactor";
import { useLanguage } from "./language-provider";

const chapters: Record<
  ReactorStage,
  { number: string; title: string; text: string }
> = {
  pellet: {
    number: "01 / THE PELLET",
    title: "One event.\nA larger world.",
    text: "We are changing scale. Fission happens within a ceramic uranium dioxide pellet.",
  },
  rod: {
    number: "02 / THE FUEL ROD",
    title: "A story,\nrepeated.",
    text: "Pellets are stacked inside sealed metal tubes. Together, fuel rods form an assembly.",
  },
  core: {
    number: "03 / THE CORE",
    title: "A new\nperspective.",
    text: "Fuel, neutron absorbers and circulating water, held within a steel pressure vessel.",
  },
  ready: {
    number: "03 — Reactor",
    title: "Inside\nthe reactor.",
    text: "Extreme conditions.\nExtraordinary purpose.\nA closer look at how fission heat\nbegins a much larger journey.",
  },
};

const hotspotNotes = {
  fuel: "Uranium fuel generates heat through fission",
  control: "Absorb neutrons to regulate the reaction",
  coolant: "Pressurized water carries heat to a separate circuit",
};

const chaptersTr: typeof chapters = {
  pellet: {
    number: "01 / YAKIT PELETİ",
    title: "Tek bir olay.\nDaha büyük bir dünya.",
    text: "Ölçeği değiştiriyoruz. Fisyon, seramik uranyum dioksit peletinin içinde gerçekleşir.",
  },
  rod: {
    number: "02 / YAKIT ÇUBUĞU",
    title: "Tekrarlanan\nbir hikâye.",
    text: "Peletler, sızdırmaz metal tüplerin içine üst üste yerleştirilir. Yakıt çubukları bir araya gelerek bir demet oluşturur.",
  },
  core: {
    number: "03 / REAKTÖR KALBİ",
    title: "Yeni bir\nbakış açısı.",
    text: "Yakıt, nötron soğurucular ve dolaşan su, çelik bir basınç kabının içinde bulunur.",
  },
  ready: {
    number: "03 — Reaktör",
    title: "Reaktörün\niçinde.",
    text: "Zorlu koşullar.\nBüyük bir amaç.\nFisyon ısısının başlattığı\nyolculuğa yakından bir bakış.",
  },
};

const reactorPartsTr = {
  fuel: {
    ...REACTOR_PARTS.fuel,
    label: "Yakıt çubukları",
    title: "Isının başladığı yer.",
    description:
      "İncelemek için ayrılmış, temsili bir yakıt çubuğu. Seramik uranyum dioksit peletleri sızdırmaz metal zarfın içinde bulunur. Peletlerdeki fisyon ısı açığa çıkarır.",
    detail: "Yakıt peletleri · metal zarf",
    note: "Açıklama amacıyla büyütülmüş kesit. Yakıt çubukları çalışma sırasında kapalı kalır.",
  },
  control: {
    ...REACTOR_PARTS.control,
    label: "Kontrol çubukları",
    title: "Daha sakin bir tepkime.",
    description:
      "Kontrol çubukları nötronları soğurur. Yukarıdan yapılan kısa bir hareket, soğurucunun reaktör kalbine daha fazla girmesini gösterir. Soğurulan nötronlar yeni fisyonlara yol açamaz.",
    detail: "Nötron soğurulması",
    note: "Hareket ve nötron yolları temsilidir. Reaktör gücü veya tepkisi simüle edilmez.",
  },
  coolant: {
    ...REACTOR_PARTS.coolant,
    label: "Soğutucu",
    title: "Isı taşınıyor.",
    description:
      "Basınçlı su, reaktör kalbinde yukarı doğru akarken sıvı hâlde kalır ve ısıyı uzaklaştırır. Birincil devre, buhar üretecinde ısıyı ayrı bir su devresine aktarır; birincil soğutucu türbine girmez.",
    detail: "Birincil soğutucu çıkışı",
    note: "Basınçlı sıvı · ayrı bir birincil devre.",
  },
};

const hotspotNotesTr = {
  fuel: "Uranyum yakıtı fisyon yoluyla ısı üretir",
  control: "Tepkimeyi düzenlemek için nötronları soğurur",
  coolant: "Basınçlı su ısıyı ayrı bir devreye taşır",
};

const annotationsTr = {
  "Reactor vessel": {
    label: "Reaktör kabı",
    detail: "Reaktör kalbini yüksek basınç altında tutar",
  },
  "Steam generator": {
    label: "Buhar üreteci",
    detail: "Isı, birbirinden ayrı devreler arasında aktarılır",
  },
  "Secondary circuit": {
    label: "İkincil devre",
    detail: "Buhar çıkışı · besleme suyu girişi",
  },
};

export function ReactorHotspots({
  reactor,
  fallback,
}: {
  reactor: ReactorController;
  fallback: boolean;
}) {
  const { t, language } = useLanguage();
  const parts = language === "tr" ? reactorPartsTr : REACTOR_PARTS;
  return (
    <div
      className={`reactor-hotspots${fallback ? " is-illustrated" : ""}`}
      hidden={reactor.stage !== "ready"}
      aria-label={t("Explore the reactor", "Reaktörü keşfet")}
      data-selected={reactor.selected ?? "none"}
    >
      {!fallback && (
        <div
          className="reactor-camera-controls"
          role="group"
          aria-label={t("Reactor camera", "Reaktör kamerası")}
        >
          <button
            aria-label={t("Zoom out of the reactor", "Reaktörden uzaklaş")}
            onClick={() => reactor.zoomView(1 / 1.35)}
          >
            −
          </button>
          <output
            ref={reactor.zoomLabel}
            aria-label={t("Zoom level", "Yakınlaştırma düzeyi")}
            aria-live="off"
          >
            100%
          </output>
          <button
            aria-label={t("Zoom in on the reactor", "Reaktöre yaklaş")}
            onClick={() => reactor.zoomView(1.35)}
          >
            +
          </button>
          <button className="reactor-camera-reset" onClick={reactor.resetView}>
            {t("Reset view", "Görünümü sıfırla")}
          </button>
          <span>
            {t(
              "Scroll / pinch to zoom · Drag to explore",
              "Tekerlek / iki parmakla yakınlaş · Sürükle",
            )}
          </span>
        </div>
      )}
      <p className="sr-only" id="reactor-navigation-help">
        {t(
          "Use the mouse wheel or pinch to zoom. Drag to explore the reactor. With the scene focused, use arrow keys to pan, plus and minus to zoom, and Home to reset.",
          "Fare tekerleği veya iki parmakla yakınlaştırın. Reaktörde gezinmek için sürükleyin. Sahne odaktayken ok tuşlarıyla gezinin, artı ve eksiyle yakınlaştırın, Home ile görünümü sıfırlayın.",
        )}
      </p>
      {REACTOR_PART_IDS.map((id, index) => (
        <button
          key={id}
          ref={(node) => {
            reactor.hotspots.current[index] = node;
          }}
          className={`reactor-hotspot hotspot-${id}`}
          aria-label={parts[id].label}
          aria-pressed={reactor.selected === id}
          aria-controls="reactor-detail"
          onClick={() =>
            reactor.setSelected(reactor.selected === id ? null : id)
          }
        >
          <span className="reactor-hotspot-marker" aria-hidden="true">
            {REACTOR_PARTS[id].number}
          </span>
          <span className="hotspot-label">
            {parts[id].label}
            <small className="reactor-hotspot-note" aria-hidden="true">
              {t(hotspotNotes[id], hotspotNotesTr[id])}
            </small>
          </span>
        </button>
      ))}
      {reactor.selected && (
        <div
          ref={reactor.label}
          className={`reactor-object-label label-${reactor.selected}`}
          aria-hidden="true"
        >
          {parts[reactor.selected].detail}
        </div>
      )}
      {!fallback &&
        !reactor.selected &&
        REACTOR_ANNOTATIONS.map((annotation, index) => (
          <div
            key={annotation.label}
            ref={(node) => {
              reactor.annotations.current[index] = node;
            }}
            className={`reactor-annotation annotation-${annotation.side}`}
            aria-hidden="true"
          >
            {t(annotation.label, annotationsTr[annotation.label].label)}
            <small>
              {t(annotation.detail, annotationsTr[annotation.label].detail)}
            </small>
          </div>
        ))}
    </div>
  );
}

export function ReactorControls({
  reactor,
  onReturn,
  onReplay,
  onContinue,
}: {
  reactor: ReactorController;
  onReturn: () => void;
  onReplay: () => void;
  onContinue: () => void;
}) {
  const { t, language } = useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const chapter = (language === "tr" ? chaptersTr : chapters)[reactor.stage];
  const parts = language === "tr" ? reactorPartsTr : REACTOR_PARTS;
  const part = reactor.selected ? parts[reactor.selected] : null;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [reactor.run]);

  return (
    <>
      <button className="reaction-back" onClick={onReturn}>
        <span aria-hidden="true">←</span>{" "}
        {t("Return to fission", "Fisyona dön")}
      </button>
      <div
        className="reactor-copy"
        data-stage={reactor.stage}
        data-selected={reactor.selected ?? "none"}
      >
        <div id="reactor-detail" aria-live="polite" aria-atomic="true">
          <p className="section-kicker">
            {part
              ? `${part.number} / ${part.label.toLocaleUpperCase(language)}`
              : chapter.number}
          </p>
          <h1 id="reactor-title" ref={heading} tabIndex={-1}>
            {part?.title ?? chapter.title}
          </h1>
          <p className="reactor-description">
            {part?.description ?? chapter.text}
          </p>
          {part && <p className="reactor-detail-note">{part.note}</p>}
        </div>
        <div className="reactor-actions">
          {reactor.stage === "ready" && (
            <button
              id="power-entry"
              className="reaction-action reactor-entry"
              onClick={onContinue}
            >
              {reactor.selected === "coolant"
                ? t("Follow the coolant", "Soğutucuyu takip et")
                : t("Power the city", "Şehre enerji ver")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
          {reactor.stage === "ready" && (
            <button className="reaction-action" onClick={onReplay}>
              {t("Replay this view", "Bu görünümü yeniden oynat")}{" "}
              <span aria-hidden="true">↺</span>
            </button>
          )}
          {part && (
            <button
              className="reactor-overview"
              onClick={() => {
                reactor.hotspots.current[
                  REACTOR_PART_IDS.indexOf(reactor.selected!)
                ]?.focus({ preventScroll: true });
                reactor.setSelected(null);
              }}
            >
              {t("Overview", "Genel görünüm")} <span aria-hidden="true">×</span>
            </button>
          )}
          {reactor.stage !== "ready" && (
            <span className="reactor-scale">
              ATOM <span>→</span> {t("PELLET", "PELET")} <span>→</span>{" "}
              {t("CORE", "REAKTÖR KALBİ")}
            </span>
          )}
        </div>
        <p className="reactor-note">
          {t(
            "Conceptual · not to scale. Cut surfaces reveal the interior.",
            "Kavramsal · ölçekli değildir. Kesitler iç yapıyı gösterir.",
          )}
          <br />
          {reactor.stage === "ready"
            ? t(
                "Flow, heat and component counts are illustrative.",
                "Akış, ısı ve bileşen sayıları temsilidir.",
              )
            : t(
                "This is a change of scale, not a transformation of fission products.",
                "Burada ölçek değişir; fisyon ürünleri başka bir yapıya dönüşmez.",
              )}
        </p>
        {reactor.stage === "ready" && (
          <a
            className="reactor-source"
            href="https://www.nrc.gov/reactors/power/pwrs"
            target="_blank"
            rel="noreferrer"
          >
            {t("The science, via the U.S. NRC ↗", "Bilimsel kaynak: ABD NRC ↗")}
          </a>
        )}
      </div>
    </>
  );
}
