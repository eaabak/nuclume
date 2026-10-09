"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  POWER_TIMING,
  COOLANT_TRANSFER,
  powerStageAt,
  cityBeatAt,
  type CityPlace,
  type PowerPart,
  type PowerStage,
} from "@/lib/power";

export function usePower(
  active: boolean,
  playing: boolean,
  visible: boolean,
  reducedMotion: boolean,
) {
  const [stage, setStage] = useState<PowerStage>("heat");
  const [selected, setSelected] = useState<PowerPart | null>(null);
  const [cityPlace, setCityPlace] = useState<CityPlace | null>(null);
  const [cityBeat, setCityBeat] = useState(cityBeatAt(0));
  const cityView = useRef({ weight: 1, home: 0, hospital: 0 });
  const cityLabel = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const elapsed = useRef(0);
  const sceneTime = useRef(0);
  const transferTime = useRef(0);
  const [transfer, setTransfer] = useState<
    "following" | "reading" | "leaving" | null
  >(null);
  const [transferRun, setTransferRun] = useState(0);
  const hotspots = useRef<(HTMLButtonElement | null)[]>([]);
  const begin = useCallback(() => {
    elapsed.current = reducedMotion ? POWER_TIMING.ready : 0;
    sceneTime.current = elapsed.current;
    setTransfer(null);
    setStage(reducedMotion ? "ready" : "heat");
    setSelected(null);
    setCityPlace(null);
    setCityBeat(cityBeatAt(elapsed.current));
    cityView.current.weight = 1;
    cityView.current.home = 0;
    cityView.current.hospital = 0;
    setRun((value) => value + 1);
  }, [reducedMotion]);

  const exploreCity = useCallback((place: CityPlace | null) => {
    setCityPlace(place);
    setSelected("city");
  }, []);

  const finish = useCallback(() => {
    elapsed.current = POWER_TIMING.ready;
    sceneTime.current = elapsed.current;
    setStage("ready");
    setCityBeat("neighborhood");
    setSelected(null);
    setCityPlace(null);
  }, []);

  const followCoolant = useCallback(() => {
    transferTime.current = reducedMotion ? COOLANT_TRANSFER.travel : 0;
    sceneTime.current = reducedMotion ? COOLANT_TRANSFER.scene : 0;
    setTransfer(reducedMotion ? "reading" : "following");
    setTransferRun((value) => value + 1);
  }, [reducedMotion]);

  const continuePower = useCallback(() => {
    elapsed.current = reducedMotion
      ? POWER_TIMING.ready
      : Math.max(COOLANT_TRANSFER.scene, elapsed.current);
    setStage(powerStageAt(elapsed.current));
    setCityBeat(cityBeatAt(elapsed.current));
    transferTime.current = 0;
    if (reducedMotion) sceneTime.current = elapsed.current;
    setTransfer(reducedMotion ? null : "leaving");
  }, [reducedMotion]);

  useEffect(() => {
    if (!active || transfer === "reading") return;
    if (transfer) {
      const leaving = transfer === "leaving";
      const duration = leaving
        ? COOLANT_TRANSFER.leave
        : COOLANT_TRANSFER.travel;
      const finish = () => {
        transferTime.current = duration;
        sceneTime.current = leaving ? elapsed.current : COOLANT_TRANSFER.scene;
        setTransfer(leaving ? null : "reading");
      };
      if (reducedMotion) {
        finish();
        return;
      }
      if (!playing || !visible) return;
      let previous = 0;
      let frame = 0;
      const tick = (now: number) => {
        if (previous)
          transferTime.current = Math.min(
            duration,
            transferTime.current + Math.min((now - previous) / 1000, 0.1),
          );
        previous = now;
        const progress = Math.max(
          0,
          Math.min(
            1,
            leaving
              ? transferTime.current / duration
              : (transferTime.current - 0.4) / 2.2,
          ),
        );
        const eased =
          progress *
          progress *
          progress *
          (progress * (progress * 6 - 15) + 10);
        sceneTime.current = leaving
          ? COOLANT_TRANSFER.scene +
            (elapsed.current - COOLANT_TRANSFER.scene) * eased
          : COOLANT_TRANSFER.scene * eased;
        if (transferTime.current >= duration) finish();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }
    if (stage === "ready") return;
    if (reducedMotion) {
      elapsed.current = POWER_TIMING.ready;
      sceneTime.current = elapsed.current;
      setStage("ready");
      setCityBeat("neighborhood");
      return;
    }
    if (!playing || !visible) return;
    let previous = 0;
    let frame = 0;
    const tick = (now: number) => {
      if (previous)
        elapsed.current = Math.min(
          POWER_TIMING.ready,
          elapsed.current + Math.min((now - previous) / 1000, 0.1),
        );
      previous = now;
      sceneTime.current = elapsed.current;
      const next = powerStageAt(elapsed.current);
      if (next !== stage) setStage(next);
      const beat = cityBeatAt(elapsed.current);
      if (beat !== cityBeat) setCityBeat(beat);
      if (next !== "ready") frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    active,
    playing,
    visible,
    reducedMotion,
    stage,
    run,
    transfer,
    transferRun,
    cityBeat,
  ]);

  return {
    stage,
    selected,
    setSelected,
    cityPlace,
    setCityPlace,
    cityBeat,
    cityView,
    cityLabel,
    labelPlace: !transfer
      ? stage === "city" && (cityBeat === "home" || cityBeat === "hospital")
        ? cityBeat
        : stage === "ready" && selected === "city"
          ? cityPlace
          : null
      : null,
    exploreCity,
    finish,
    elapsed,
    sceneTime,
    transfer,
    transferTime,
    transferRun,
    followCoolant,
    continuePower,
    hotspots,
    run,
    begin,
  };
}

export type PowerController = ReturnType<typeof usePower>;
