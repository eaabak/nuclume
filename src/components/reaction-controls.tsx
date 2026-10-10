"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { DAUGHTERS, NEUTRON_HOME, type ReactionStage } from "@/lib/fission";
import { useLanguage } from "./language-provider";
import type { FissionController } from "./use-fission";

const copy: Record<
  ReactionStage,
  { label: string; title: readonly [string, string]; detail: string }
> = {
  ready: {
    label: "01 / THE ENCOUNTER",
    title: ["One small", "arrival."],
    detail: "Drag the neutron into the nucleus. Or select it to begin.",
  },
  absorbing: {
    label: "02 / CAPTURE",
    title: ["A moment", "of contact."],
    detail: "Uranium-235 absorbs a neutron.",
  },
  excited: {
    label: "03 / EXCITATION",
    title: ["Too much", "to hold."],
    detail: "For a brief moment, an excited uranium-236 nucleus forms.",
  },
  splitting: {
    label: "04 / FISSION",
    title: ["A force", "released."],
    detail:
      "In nuclear fission, a nucleus splits, releasing neutrons and a large amount of energy.",
  },
  complete: {
    label: "04 / FISSION",
    title: ["A force", "released."],
    detail:
      "In nuclear fission, a nucleus splits, releasing neutrons and a large amount of energy.",
  },
  rewinding: {
    label: "REPLAY",
    title: ["A force", "released."],
    detail: "Returning to the start of this illustration.",
  },
};

const turkishCopy: typeof copy = {
  ready: {
    label: "01 / KARŞILAŞMA",
    title: ["Küçük bir", "başlangıç."],
    detail: "Nötronu çekirdeğe sürükleyin. Ya da başlamak için seçin.",
  },
  absorbing: {
    label: "02 / YAKALANMA",
    title: ["Bir temas", "anı."],
    detail: "Uranyum-235 bir nötron soğurur.",
  },
  excited: {
    label: "03 / UYARILMA",
    title: ["İçinde tutmak", "artık zor."],
    detail: "Kısa bir an için uyarılmış bir uranyum-236 çekirdeği oluşur.",
  },
  splitting: {
    label: "04 / FİSYON",
    title: ["Açığa çıkan", "bir güç."],
    detail:
      "Nükleer fisyonda bir çekirdek bölünür; nötronlar ve büyük miktarda enerji açığa çıkar.",
  },
  complete: {
    label: "04 / FİSYON",
    title: ["Açığa çıkan", "bir güç."],
    detail:
      "Nükleer fisyonda bir çekirdek bölünür; nötronlar ve büyük miktarda enerji açığa çıkar.",
  },
  rewinding: {
    label: "TEKRAR",
    title: ["Açığa çıkan", "bir güç."],
    detail: "Bu gösterimin başlangıcına dönülüyor.",
  },
};

export function ReactionNeutron({
  reaction,
  fallback,
  autoFocus = true,
}: {
  reaction: FissionController;
  fallback: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useLanguage();
  const [dragging, setDragging] = useState(false);
  const gesture = useRef({
    x: 0,
    y: 0,
    moved: false,
    canceled: false,
    pointerId: -1,
  });
  const home = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (autoFocus && reaction.stage === "ready")
      reaction.handle.current?.focus({ preventScroll: true });
  }, [autoFocus, reaction.handle, reaction.stage]);

  useEffect(() => {
    const button = reaction.handle.current;
    const parent = button?.parentElement;
    if (!fallback || !parent || !button) return;
    const update = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (!reaction.dragPoint.current.active)
        button.style.transform = `translate3d(${width * 0.13}px, ${height / 2}px, 0)`;
      if (reaction.captureTarget.current) {
        reaction.captureTarget.current.style.transform = `translate3d(${width / 2}px, ${height / 2}px, 0)`;
        reaction.captureTarget.current.style.width = `${Math.min(width, height) * 0.48}px`;
        reaction.captureTarget.current.style.height = `${Math.min(width, height) * 0.48}px`;
      }
      DAUGHTERS.forEach((daughter, index) => {
        const label = reaction.fragmentLabels.current[index];
        if (label)
          label.style.transform = `translate3d(${width / 2 + (daughter.center[0] / 12) * Math.min(width, height)}px, ${height / 2 + ((-daughter.center[1] + 2.6) / 12) * Math.min(width, height)}px, 0)`;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [
    fallback,
    reaction.stage,
    reaction.handle,
    reaction.captureTarget,
    reaction.dragPoint,
    reaction.fragmentLabels,
  ]);

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    gesture.current.moved ||=
      Math.hypot(
        event.clientX - gesture.current.x,
        event.clientY - gesture.current.y,
      ) > 5;
    const x = Math.max(
      28,
      Math.min(bounds.width - 28, event.clientX - bounds.left),
    );
    const y = Math.max(
      28,
      Math.min(bounds.height - 28, event.clientY - bounds.top),
    );
    reaction.dragPoint.current = {
      x: (x / bounds.width) * 2 - 1,
      y: 1 - (y / bounds.height) * 2,
      active: true,
    };
    event.currentTarget.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const restore = () => {
    reaction.dragPoint.current.active = false;
    reaction.incoming.current = [...NEUTRON_HOME];
    if (reaction.handle.current)
      reaction.handle.current.style.transform = `translate3d(${home.current.x}px, ${home.current.y}px, 0)`;
    setDragging(false);
  };

  return (
    <>
      <div
        ref={reaction.captureTarget}
        className={`capture-target${dragging ? " is-dragging" : ""}`}
        aria-hidden="true"
      >
        <span>{t("RELEASE TO CAPTURE", "YAKALANMASI İÇİN BIRAKIN")}</span>
      </div>
      <button
        ref={reaction.handle}
        className={`incoming-neutron${fallback ? " is-illustrated" : ""}${dragging ? " is-dragging" : ""}`}
        hidden={reaction.stage !== "ready"}
        id="incoming-neutron"
        aria-label={t("Send neutron into nucleus", "Nötronu çekirdeğe gönder")}
        aria-describedby="reaction-instruction"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const parent =
            event.currentTarget.parentElement?.getBoundingClientRect();
          if (!parent) return;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            moved: false,
            canceled: false,
            pointerId: event.pointerId,
          };
          home.current = {
            x: bounds.left + bounds.width / 2 - parent.left,
            y: bounds.top + bounds.height / 2 - parent.top,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          const bounds =
            event.currentTarget.parentElement?.getBoundingClientRect();
          if (
            !bounds ||
            !event.currentTarget.hasPointerCapture(event.pointerId)
          )
            return;
          const target = fallback
            ? {
                x: bounds.width / 2,
                y: bounds.height / 2,
                radius: Math.min(bounds.width, bounds.height) * 0.24,
              }
            : reaction.target.current;
          const hit =
            Math.hypot(
              event.clientX - bounds.left - target.x,
              event.clientY - bounds.top - target.y,
            ) < target.radius;
          if (gesture.current.moved && !gesture.current.canceled && hit) {
            reaction.start();
            setDragging(false);
          } else restore();
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          gesture.current.canceled = true;
          restore();
        }}
        onLostPointerCapture={() => {
          if (reaction.dragPoint.current.active) restore();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            gesture.current.canceled = true;
            restore();
            if (
              event.currentTarget.hasPointerCapture(gesture.current.pointerId)
            )
              event.currentTarget.releasePointerCapture(
                gesture.current.pointerId,
              );
          }
        }}
        onClick={(event) => {
          if (
            event.detail === 0 ||
            (!gesture.current.moved && !gesture.current.canceled)
          )
            reaction.start();
        }}
      >
        <span className="neutron-orb" aria-hidden="true" />
        <span className="neutron-caption">
          {t("1 NEUTRON", "1 NÖTRON")}
          <span>{t("DRAG / TAP", "SÜRÜKLE / DOKUN")}</span>
        </span>
      </button>
      <div
        className="fragment-labels"
        aria-hidden="true"
        hidden={reaction.stage !== "complete"}
      >
        {DAUGHTERS.map((daughter, index) => (
          <span
            key={daughter.symbol}
            ref={(node) => {
              reaction.fragmentLabels.current[index] = node;
            }}
          >
            <sup>{daughter.mass}</sup>
            {daughter.symbol}
            <small>
              {t(
                daughter.name,
                daughter.symbol === "Ba" ? "Baryum-141" : "Kripton-92",
              )}
            </small>
          </span>
        ))}
      </div>
      <span
        ref={reaction.emissionLabel}
        className="fission-neutron-label"
        aria-hidden="true"
        hidden={reaction.stage !== "complete" || fallback}
      >
        n
        <small>
          {t("NEUTRON", "NÖTRON")}
          <br />
          {t("RELEASED", "AÇIĞA ÇIKTI")}
        </small>
      </span>
    </>
  );
}

export function ReactionControls({
  reaction,
  onBack,
  onReplay,
  onContinue,
}: {
  reaction: FissionController;
  onBack: () => void;
  onReplay: () => void;
  onContinue: () => void;
}) {
  const { language, t } = useLanguage();
  const status = useRef<HTMLDivElement>(null);
  const details = (language === "tr" ? turkishCopy : copy)[reaction.stage];
  useEffect(() => {
    if (
      reaction.stage === "absorbing" ||
      reaction.stage === "complete" ||
      reaction.stage === "rewinding"
    )
      status.current?.focus({ preventScroll: true });
  }, [reaction.stage]);

  return (
    <>
      <button className="reaction-back" onClick={onBack}>
        <span aria-hidden="true">←</span> {t("The first atom", "İlk atom")}
      </button>
      <div className="reaction-copy" data-stage={reaction.stage}>
        <div
          id="reaction-status"
          ref={status}
          tabIndex={-1}
          className="reaction-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="section-kicker">{details.label}</p>
          <h1 id="reaction-title">
            <span>{details.title[0]}</span>
            <em>{details.title[1]}</em>
          </h1>
          <p id="reaction-instruction">{details.detail}</p>
          {reaction.stage === "complete" && (
            <p
              className="reaction-equation"
              aria-label={t(
                "Uranium 235 plus one neutron forms excited uranium 236, then barium 141, krypton 92, three neutrons and energy",
                "Uranyum 235 ve bir nötron, uyarılmış uranyum 236 oluşturur; ardından baryum 141, kripton 92, üç nötron ve enerji açığa çıkar",
              )}
            >
              <sup>235</sup>U + n <span>→</span> <sup>236</sup>U* <span>→</span>{" "}
              <sup>141</sup>Ba + <sup>92</sup>Kr + 3n + {t("energy", "enerji")}
            </p>
          )}
        </div>
        <div className="reaction-actions">
          {reaction.stage === "ready" && (
            <button className="reaction-action" onClick={reaction.start}>
              {t("Send the neutron", "Nötronu gönder")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
          {reaction.stage === "complete" && (
            <button
              id="reactor-entry"
              className="reaction-action reactor-entry"
              onClick={onContinue}
            >
              {t("Inside the reactor", "Reaktörün içinde")}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          )}
          {reaction.stage === "complete" && (
            <button className="reaction-action" onClick={onReplay}>
              {t("Replay reaction", "Tepkimeyi tekrarla")}{" "}
              <span aria-hidden="true">↺</span>
            </button>
          )}
          <p className="reaction-note">
            {t(
              "Conceptual · not to scale",
              "Kavramsal gösterim · ölçekli değildir",
            )}
            {reaction.stage === "complete" && (
              <>
                <br />
                {t(
                  "One possible channel. Light and trails are illustrative; most energy becomes fragment motion.",
                  "Olası bölünme yollarından biri. Işık ve izler temsili olup enerjinin büyük bölümü parçaların hareketine dönüşür.",
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}
