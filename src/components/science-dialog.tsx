"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "./language-provider";

function ExternalLinkArrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 18 18 6M6 6h12v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScienceDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="about-dialog"
      aria-labelledby="about-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="dialog-close"
        aria-label={t(
          "Close about the experience",
          "Deneyim hakkındaki bilgiyi kapat",
        )}
        onClick={onClose}
      >
        ×
      </button>
      <p className="section-kicker">
        {t("NUCLUME / CHAPTER 01", "NUCLUME / BÖLÜM 01")}
      </p>
      <h2 id="about-title">
        {t("A world within.", "İçinde bir dünya.")}
        <br />
        <em>{t("A world ahead.", "Önümüzde bir gelecek.")}</em>
      </h2>
      <p>
        {t(
          "From a single atom to an entire city. NUCLUME is an exploration of the science behind nuclear energy. This first chapter begins with the nucleus of uranium-235.",
          "Tek bir atomdan koca bir şehre. NUCLUME, nükleer enerjinin arkasındaki bilimi keşfe çıkarır. İlk bölüm, uranyum-235 çekirdeğiyle başlar.",
        )}
      </p>
      <p>
        {t(
          "Its 92 protons define it as uranium. Add 143 neutrons and you have 235 nucleons, giving this isotope its name.",
          "92 proton, bu elementi uranyum yapar. 143 nötronla birlikte toplam 235 nükleon oluşur; bu izotop adını buradan alır.",
        )}
      </p>
      <p className="science-note">
        {t(
          "This is a conceptual model, not a physical simulation. Colors identify particle types; positions, sizes, spacing, and motion are illustrative. The ambient motes are atmosphere, not emitted particles. Electrons are outside this view.",
          "Bu, fiziksel simülasyon değil, kavramsal bir modeldir. Renkler parçacık türlerini belirtir; konumlar, boyutlar, aralıklar ve hareket temsilidir. Çevredeki küçük noktalar görsel atmosfer içindir; yayılan parçacıkları göstermez. Elektronlar bu görünümün dışındadır.",
        )}
      </p>
      <p className="science-note">
        {t(
          "An independent educational and artistic project. This simplified experience is not engineering guidance, a safety analysis or reactor-operator training. Source links do not imply endorsement by the cited organizations.",
          "Bağımsız bir eğitim ve sanat projesidir. Bu sadeleştirilmiş deneyim mühendislik rehberi, güvenlik analizi veya reaktör operatörü eğitimi değildir. Kaynak bağlantıları, ilgili kuruluşların projeyi onayladığı anlamına gelmez.",
        )}
      </p>
      <a
        href="https://www.nrc.gov/education-regulatory-research/the-student-corner/science-101/what-is-a-chain-reaction"
        target="_blank"
        rel="noreferrer"
      >
        {t("The science, via the U.S. NRC", "Bilimsel kaynak: ABD NRC")}{" "}
        <ExternalLinkArrow />
      </a>
      <a
        href="https://www.nrc.gov/reactors/power/pwrs"
        target="_blank"
        rel="noreferrer"
      >
        {t("PWR circuits · U.S. NRC", "PWR devreleri · ABD NRC")}{" "}
        <ExternalLinkArrow />
      </a>
      <a
        href="https://www.eia.gov/energyexplained/electricity/how-electricity-is-generated.php"
        target="_blank"
        rel="noreferrer"
      >
        {t("Electricity generation · EIA", "Elektrik üretimi · EIA")}{" "}
        <ExternalLinkArrow />
      </a>
      <a href="/audio/CREDITS.md" target="_blank" rel="noreferrer">
        {t("Sound sources & CC0 licenses", "Ses kaynakları ve CC0 lisansları")}{" "}
        <ExternalLinkArrow />
      </a>
    </dialog>
  );
}
