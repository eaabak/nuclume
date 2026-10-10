"use client";

import { useEffect, useRef } from "react";
import { CITY_PLACES, POWER_PART_IDS, POWER_PARTS } from "@/lib/power";
import type { PowerController } from "./use-power";
import { useLanguage } from "./language-provider";

const powerPartsTr = {
  heat: {
    ...POWER_PARTS.heat,
    label: "Buhar / ısı aktarımı",
    title: "Isı aktarılır.\nSular ayrı kalır.",
    description:
      "Buhar üretecinde sıcak birincil su, metal boruların içinden ısıyı ayrı bir su devresine aktarır. Bu devredeki su buhara dönüşür. İki devrenin suları birbirine karışmaz.",
    sourceLabel: "ABD NRC",
  },
  turbine: {
    ...POWER_PARTS.turbine,
    label: "Türbin",
    title: "Isı harekete\ndönüşür.",
    description:
      "Genleşen buhar, türbin kanatlarını ve mili döndürür. Ardından buhar yoğuşturularak suya dönüştürülür ve buhar üretecine geri gönderilir. Türbin enerjiyi harekete dönüştürür; elektrik depolamaz.",
    sourceLabel: "ABD EIA",
  },
  generator: {
    ...POWER_PARTS.generator,
    label: "Jeneratör",
    title: "Hareket elektriğe\ndönüşür.",
    description:
      "Aynı mil, jeneratörün rotorunu döndürür. Rotorun değişen manyetik alanı, sabit bobinlerde elektrik indükleyerek mekanik enerjiyi elektrik enerjisine dönüştürür.",
    sourceLabel: "ABD EIA",
  },
  transmission: {
    ...POWER_PARTS.transmission,
    label: "İletim",
    title: "Mesafeleri aşan\nbir bağlantı.",
    description:
      "Transformatörler, iletim için gerilimi yükseltir. Enerji nakil hatları elektriği yerleşimlere taşır; trafo merkezleri ise yerel dağıtım için gerilimi düşürür. Mavi ışıklar bu bağlantıyı gösterir, tek tek elektronların hareketini değil.",
    sourceLabel: "ABD EIA",
  },
  city: {
    ...POWER_PARTS.city,
    label: "Şehirdeki etkisi",
    title: "Aydınlanan\nbir dünya.",
    description:
      "Evde yanan bir ışık. Hizmet veren bir hastane. Bizi birbirimize bağlayan sokaklar. Elektrik, gündelik yaşamı ve temel kamu hizmetlerini destekler. Bu şehir o bağlantıyı temsil eder; tek bir atom bir şehre enerji sağlayamaz.",
    sourceLabel: "ABD EIA",
  },
};

const cityPlacesTr = {
  home: {
    ...CITY_PLACES.home,
    label: "Evde yanan bir ışık",
    description:
      "Sıradan bir akşam: bir yemek, bir sohbet, açık bırakılan bir ışık. Elektrik, gündelik yaşamın bir parçasına dönüşür.",
  },
  hospital: {
    ...CITY_PLACES.hospital,
    label: "Günün her saati bakım",
    description:
      "Elektrik; aydınlatmayı, tıbbi cihazları ve temel hizmetleri destekler. Bu hastane, bir toplumun güvendiği kamu altyapısını temsil eder.",
  },
};

export function PowerHotspots({
  power,
  fallback,
}: {
  power: PowerController;
  fallback: boolean;
}) {
  const { t, language } = useLanguage();
  const parts = language === "tr" ? powerPartsTr : POWER_PARTS;
  const places = language === "tr" ? cityPlacesTr : CITY_PLACES;
  return (
    <>
      <div
        className={`power-hotspots${fallback ? " is-illustrated" : ""}`}
        hidden={
          power.stage !== "ready" || power.transfer !== null || power.roomOpen
        }
        aria-label={t(
          "Explore the energy journey",
          "Enerjinin yolculuğunu keşfet",
        )}
        data-city={
          !power.roomOpen &&
          power.stage === "ready" &&
          (!power.selected || power.selected === "city")
            ? ""
            : undefined
        }
      >
        {POWER_PART_IDS.map((id, index) => (
          <button
            key={id}
            ref={(node) => {
              power.hotspots.current[index] = node;
            }}
            className={`reactor-hotspot power-hotspot power-hotspot-${id}`}
            aria-label={parts[id].label}
            aria-pressed={power.selected === id}
            aria-controls="power-detail"
            onClick={() => {
              if (power.selected === id) power.setCityPlace(null);
              power.setSelected(power.selected === id ? null : id);
            }}
          >
            <span>{POWER_PARTS[id].number}</span>
            <span className="hotspot-label">{parts[id].label}</span>
          </button>
        ))}
        <button
          ref={power.roomHotspot}
          className="control-room-entry"
          aria-label={t("Enter the control room", "Kontrol odasına gir")}
          aria-controls="power-detail"
          aria-expanded={power.roomOpen}
          onClick={power.enterRoom}
        >
          <span aria-hidden="true">⌖</span>
          <span>
            {t("Control room", "Kontrol odası")}
            <small>{t("Enter & explore ↗", "İçeri gir ve keşfet ↗")}</small>
          </span>
        </button>
        {power.stage === "ready" &&
          !power.transfer &&
          (!power.selected || power.selected === "city") && (
            <div
              className="city-exploration"
              role="group"
              aria-label={t(
                "Explore the illuminated city",
                "Aydınlanan şehri keşfet",
              )}
            >
              <button
                aria-pressed={power.cityPlace === "home"}
                onClick={() => power.exploreCity("home")}
              >
                {t("Home", "Ev")}
              </button>
              <button
                aria-pressed={power.cityPlace === "hospital"}
                onClick={() => power.exploreCity("hospital")}
              >
                {t("Hospital", "Hastane")}
              </button>
              <button
                aria-pressed={power.cityPlace === null}
                onClick={() => power.exploreCity(null)}
              >
                {t("Neighborhood", "Mahalle")}
              </button>
            </div>
          )}
        {!fallback && (
          <div
            className="city-camera-controls"
            role="group"
            aria-label={t("City camera", "Şehir kamerası")}
          >
            <button
              aria-label={t("Zoom out of the city", "Şehirden uzaklaş")}
              onClick={() => power.zoomCity(1 / 1.35)}
            >
              −
            </button>
            <output
              ref={power.zoomLabel}
              aria-label={t("Zoom level", "Yakınlaştırma düzeyi")}
            >
              100%
            </output>
            <button
              aria-label={t("Zoom in on the city", "Şehre yaklaş")}
              onClick={() => power.zoomCity(1.35)}
            >
              +
            </button>
            <button className="city-camera-reset" onClick={power.resetCityView}>
              {t("Reset view", "Görünümü sıfırla")}
            </button>
            <span>
              {t(
                "Scroll to zoom · Drag to explore",
                "Tekerlekle yakınlaş · Sürükleyerek keşfet",
              )}
            </span>
          </div>
        )}
      </div>
      <p className="sr-only" id="city-navigation-help">
        {t(
          "Use the mouse wheel or pinch to zoom. Drag to move around the city. With the scene focused, use arrow keys to pan, plus and minus to zoom, and Home to reset.",
          "Yakınlaştırmak için fare tekerleğini kullanın veya iki parmağınızı açıp kapatın. Şehirde gezinmek için sürükleyin. Sahne odaktayken ok tuşlarıyla gezinin, artı ve eksiyle yakınlaştırmayı değiştirin, Home tuşuyla görünümü sıfırlayın.",
        )}
      </p>
      {power.labelPlace && !power.roomOpen && (
        <div
          ref={power.cityLabel}
          className={`city-object-label${fallback ? " is-illustrated" : ""}`}
          aria-hidden="true"
        >
          {places[power.labelPlace].label}
        </div>
      )}
    </>
  );
}

export function PowerControls({
  power,
  onReturn,
  onReplay,
}: {
  power: PowerController;
  onReturn: () => void;
  onReplay: () => void;
}) {
  const { t, language } = useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const wasInside = useRef(false);
  const part = power.transfer
    ? power.transfer === "steaming" ||
      power.transfer === "turbine" ||
      power.transfer === "leaving"
      ? "turbine"
      : "heat"
    : (power.selected ?? (power.stage === "ready" ? "city" : power.stage));
  const transferMoving =
    power.transfer === "following" ||
    power.transfer === "steaming" ||
    power.transfer === "returning";
  const content = (language === "tr" ? powerPartsTr : POWER_PARTS)[part];
  const places = language === "tr" ? cityPlacesTr : CITY_PLACES;
  const place =
    !power.transfer &&
    power.stage === "ready" &&
    power.selected === "city" &&
    power.cityPlace
      ? places[power.cityPlace]
      : null;
  const cityOverview =
    power.stage === "ready" &&
    !power.transfer &&
    (!power.selected || power.selected === "city") &&
    !place;
  useEffect(() => {
    if (!power.transfer) heading.current?.focus({ preventScroll: true });
  }, [power.run, power.transferRun]);
  useEffect(() => {
    if (power.transfer === "reading" || power.transfer === "turbine")
      heading.current?.focus({ preventScroll: true });
  }, [power.transfer]);
  useEffect(() => {
    if (power.roomOpen) heading.current?.focus({ preventScroll: true });
    else if (wasInside.current)
      power.roomHotspot.current?.focus({ preventScroll: true });
    wasInside.current = power.roomOpen;
  }, [power.roomOpen, power.roomHotspot]);
  useEffect(() => {
    if (!power.roomOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") power.leaveRoom();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [power.roomOpen, power.leaveRoom]);
  if (power.roomOpen)
    return (
      <>
        <button className="reaction-back" onClick={power.leaveRoom}>
          <span aria-hidden="true">←</span>{" "}
          {t("Return to the energy journey", "Enerjinin yolculuğuna dön")}
        </button>
        <div className="reactor-copy power-copy control-room-copy">
          <div id="power-detail" aria-live="polite" aria-atomic="true">
            <p className="section-kicker">
              {t(
                "PEOPLE / SYSTEMS / OVERSIGHT",
                "İNSANLAR / SİSTEMLER / GÖZETİM",
              )}
            </p>
            <h1 id="power-title" ref={heading} tabIndex={-1}>
              {t("Inside the", "Kontrol")}
              <br />
              {t("control room.", "odasının içinde.")}
            </h1>
            <p className="reactor-description">
              {t(
                "Behind the technology, people. Trained teams monitor the plant, follow procedures and oversee its systems.",
                "Teknolojinin arkasında insanlar var. Eğitimli ekipler santrali izler, prosedürleri uygular ve sistemlerin işleyişini gözetir.",
              )}
            </p>
            <dl className="control-room-notes">
              <div>
                <dt>{t("Observe", "Gözlemle")}</dt>
                <dd>
                  {t(
                    "The wall brings the plant’s separate systems into one view.",
                    "Ekran duvarı, santralin ayrı sistemlerini tek bir görünümde bir araya getirir.",
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("Understand", "Anla")}</dt>
                <dd>
                  {t(
                    "Workstations help operators review conditions and coordinate their work.",
                    "İş istasyonları, operatörlerin koşulları değerlendirmesine ve çalışmalarını koordine etmesine yardımcı olur.",
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <button className="reaction-action" onClick={power.leaveRoom}>
            {t("Return to the landscape", "Genel görünüme dön")}{" "}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="reactor-note">
            {t(
              "Illustrative room and displays. No live data or operating controls.",
              "Oda ve ekranlar temsilidir. Canlı veri veya işletim kontrolü içermez.",
            )}
            <br />
            {t(
              "Your journey is preserved. Press Esc to return.",
              "Yolculuğunuz korunur. Dönmek için Esc tuşuna basın.",
            )}
          </p>
        </div>
      </>
    );
  return (
    <>
      <button className="reaction-back" onClick={onReturn}>
        <span aria-hidden="true">←</span>{" "}
        {t("Return to reactor", "Reaktöre dön")}
      </button>
      <div
        className="reactor-copy power-copy"
        data-stage={power.stage}
        data-transfer={power.transfer ?? "none"}
        data-guided-subject={power.transfer ? part : undefined}
        data-city-beat={power.cityBeat}
        data-city-place={place ? power.cityPlace : "overview"}
        data-overview={cityOverview ? "" : undefined}
      >
        <div id="power-detail" aria-live="polite" aria-atomic="true">
          <p className="section-kicker">
            {power.stage === "ready" && !power.selected && !power.transfer
              ? t(
                  "FROM A SINGLE ATOM TO AN ENTIRE CITY",
                  "TEK BİR ATOMDAN KOSKOCA BİR ŞEHRE",
                )
              : `${content.number} / ${content.label.toLocaleUpperCase(language)}`}
          </p>
          <h1 id="power-title" ref={heading} tabIndex={-1}>
            {cityOverview ? (
              <>
                {t("From", "Nükleer")}
                <br />
                {t("nuclear energy", "enerjiden")}
                <br />
                {t("to ", "")}
                <em>{t("everyday life.", "gündelik hayata.")}</em>
              </>
            ) : power.transfer === "following" ? (
              t("Follow the heat.", "Isıyı takip et.")
            ) : power.transfer === "steaming" ? (
              t("Follow the steam.", "Buharı takip et.")
            ) : power.transfer === "returning" ? (
              t("Back to heat transfer.", "Isı aktarımına dön.")
            ) : (
              (place?.label ?? content.title)
            )}
          </h1>
          <p className="reactor-description">
            {cityOverview
              ? t(
                  "A controlled chain reaction creates heat. Heat becomes electricity. Electricity powers homes, hospitals and everyday life.",
                  "Kontrollü bir zincirleme tepkime ısı üretir. Isı elektriğe dönüşür. Elektrik evlere, hastanelere ve gündelik yaşama güç verir.",
                )
              : power.transfer === "following"
                ? t(
                    "Pressurized primary water carries heat out of the reactor. Follow its sealed pipe to the steam generator.",
                    "Basınçlı birincil su, ısıyı reaktörden dışarı taşır. Kapalı boru hattını buhar üretecine kadar takip edin.",
                  )
                : power.transfer === "steaming"
                  ? t(
                      "A separate circuit begins here. Steam leaves the steam generator through the secondary line and expands through the turbine, turning its blades.",
                      "Burada ayrı bir devre başlar. Buhar, buhar üretecinden ikincil hat boyunca ilerler; türbinde genleşerek kanatları döndürür.",
                    )
                  : power.transfer === "returning"
                    ? t(
                        "Follow the secondary line back to its heat source. We are retracing the camera's route; steam flow does not reverse.",
                        "İkincil hattı ısı kaynağına doğru takip edin. Kamera rotayı geri izler; buharın akış yönü değişmez.",
                      )
                    : (place?.description ?? content.description)}
          </p>
          {power.transfer && (
            <p className="reactor-note">
              {power.transfer === "following" ||
              power.transfer === "reading" ? (
                <>
                  {t(
                    "Primary: liquid inside the tubes.",
                    "Birincil devre: boruların içindeki sıvı.",
                  )}
                  <br />
                  {t(
                    "Secondary: separate water around the tubes, becoming steam.",
                    "İkincil devre: boruların çevresinde buhara dönüşen ayrı su.",
                  )}
                </>
              ) : power.transfer === "steaming" ||
                power.transfer === "returning" ? (
                t(
                  "Only secondary steam reaches the turbine. Primary water remains in its own sealed circuit.",
                  "Türbine yalnızca ikincil devrenin buharı ulaşır. Birincil su kendi kapalı devresinde kalır.",
                )
              ) : (
                t(
                  "The blades turn a shaft. That motion drives the generator; the turbine does not store electricity.",
                  "Kanatlar mili döndürür. Bu hareket jeneratörü çalıştırır; türbin elektrik depolamaz.",
                )
              )}
            </p>
          )}
        </div>
        {cityOverview && (
          <div className="city-finale">
            <p className="city-closing">
              {t(
                "From the smallest of things, a world of possibilities.",
                "En küçük şeylerden, olasılıklarla dolu bir dünyaya.",
              )}
            </p>
            <nav
              className="city-signature-links"
              aria-label={t("Project and creator", "Proje ve yapımcı")}
            >
              <span>{t("BY EAABAK", "YAPIM: EAABAK")}</span>
              <a
                href="https://github.com/eaabak/nuclume"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t(
                  "NUCLUME repository on GitHub (opens in a new tab)",
                  "GitHub'da NUCLUME deposu (yeni sekmede açılır)",
                )}
              >
                GitHub ↗
              </a>
              <a
                href="https://x.com/eaa_ce"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t(
                  "eaa_ce on X (opens in a new tab)",
                  "X'te eaa_ce (yeni sekmede açılır)",
                )}
              >
                X / @eaa_ce ↗
              </a>
            </nav>
          </div>
        )}
        <div className="reactor-actions">
          {power.transfer === "reading" || power.transfer === "turbine" ? (
            <button className="reaction-action" onClick={power.continuePower}>
              {power.transfer === "reading"
                ? t("Continue to turbine", "Türbine devam et")
                : t("Continue to generator", "Jeneratöre devam et")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          ) : power.transfer ? (
            <span className="reactor-scale">
              {power.transfer === "following" ? (
                <>
                  {t("PRIMARY WATER", "BİRİNCİL DEVRE SUYU")} <span>→</span>{" "}
                  {t("HEAT TRANSFER", "ISI AKTARIMI")}
                </>
              ) : power.transfer === "leaving" ? (
                <>
                  {t("MOTION", "HAREKET")} <span>→</span>{" "}
                  {t("ELECTRICITY", "ELEKTRİK")}
                </>
              ) : power.transfer === "returning" ? (
                t("RETURNING TO HEAT TRANSFER", "ISI AKTARIMINA DÖNÜLÜYOR")
              ) : (
                <>
                  {t("SECONDARY STEAM", "İKİNCİL DEVRE BUHARI")} <span>→</span>{" "}
                  {t("TURBINE", "TÜRBİN")}
                </>
              )}
            </span>
          ) : power.stage === "ready" ? (
            <button className="reaction-action" onClick={onReplay}>
              {t("Replay this phase", "Bu aşamayı yeniden oynat")}{" "}
              <span aria-hidden="true">↺</span>
            </button>
          ) : (
            <span className="reactor-scale">
              {t("HEAT", "ISI")} <span>→</span> {t("MOTION", "HAREKET")}{" "}
              <span>→</span> {t("LIGHT", "IŞIK")}
            </span>
          )}
          {transferMoving && (
            <button className="reactor-overview" onClick={power.skipTransfer}>
              {power.transfer === "steaming"
                ? t("Skip to turbine", "Türbine geç")
                : t("Skip to heat transfer", "Isı aktarımına geç")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
          {(power.transfer === "steaming" || power.transfer === "turbine") && (
            <button className="reactor-overview" onClick={power.returnToHeat}>
              {t("Back to heat transfer", "Isı aktarımına dön")}{" "}
              <span aria-hidden="true">←</span>
            </button>
          )}
          {(power.transfer === "reading" || power.transfer === "turbine") && (
            <button className="reactor-overview" onClick={power.replayTransfer}>
              {t("Replay this route", "Bu rotayı yeniden oynat")}{" "}
              <span aria-hidden="true">↺</span>
            </button>
          )}
          {power.selected && !power.transfer && (
            <button
              className="reactor-overview"
              onClick={() => {
                power.hotspots.current[
                  POWER_PART_IDS.indexOf(power.selected!)
                ]?.focus({ preventScroll: true });
                power.setSelected(null);
                power.setCityPlace(null);
              }}
            >
              {t("Overview", "Genel görünüm")} <span aria-hidden="true">×</span>
            </button>
          )}
          {!power.transfer && power.stage !== "ready" && (
            <button
              className="reactor-overview"
              onClick={() => {
                power.finish();
                heading.current?.focus({ preventScroll: true });
              }}
            >
              {t("Skip to illuminated city", "Aydınlanan şehre geç")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
        <p className="reactor-note">
          {t(
            "Conceptual · not to scale. Flow, speed and output are illustrative.",
            "Kavramsal · ölçekli değildir. Akış, hız ve üretim temsilidir.",
          )}
          <br />
          {t(
            "Ancillary systems omitted. Primary water stays in its own circuit.",
            "Yardımcı sistemler gösterilmemiştir. Birincil su kendi devresinde kalır.",
          )}
        </p>
        {power.stage === "ready" && (
          <a
            className="reactor-source"
            href={content.source}
            target="_blank"
            rel="noreferrer"
          >
            {t(
              `The science, via the ${content.sourceLabel} ↗`,
              `Bilimsel kaynak: ${content.sourceLabel} ↗`,
            )}
          </a>
        )}
      </div>
    </>
  );
}
