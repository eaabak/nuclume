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
  const cityNavigation = useRef({ zoom: 1, x: 0, z: 0 });
  const zoomLabel = useRef<HTMLOutputElement>(null);
  const [viewRevision, setViewRevision] = useState(0);
  const [roomOpen, setRoomOpen] = useState(false);
  const roomAmount = useRef(0);
  const roomProgress = useRef(0);
  const roomHotspot = useRef<HTMLButtonElement>(null);
  const [run, setRun] = useState(0);
  const elapsed = useRef(0);
  const sceneTime = useRef(0);
  const transferTime = useRef(0);
  const transferProgress = useRef(0);
  const returnStart = useRef(0);
  const [transfer, setTransfer] = useState<
    | "following"
    | "reading"
    | "steaming"
    | "turbine"
    | "returning"
    | "leaving"
    | null
  >(null);
  const [transferRun, setTransferRun] = useState(0);
  const hotspots = useRef<(HTMLButtonElement | null)[]>([]);
  const begin = useCallback(() => {
    setRoomOpen(false);
    roomAmount.current = 0;
    roomProgress.current = 0;
    elapsed.current = reducedMotion ? POWER_TIMING.ready : 0;
    sceneTime.current = elapsed.current;
    transferTime.current = 0;
    transferProgress.current = 0;
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

  const enterRoom = useCallback(() => {
    setRoomOpen(true);
    if (window.innerWidth <= 760)
      window.scrollTo({
        top: 0,
        behavior: reducedMotion ? "instant" : "smooth",
      });
  }, [reducedMotion]);

  const leaveRoom = useCallback(() => {
    setRoomOpen(false);
    roomHotspot.current?.focus({ preventScroll: true });
    if (window.innerWidth <= 760)
      window.scrollTo({
        top: 0,
        behavior: reducedMotion ? "instant" : "smooth",
      });
  }, [reducedMotion]);

  const zoomCity = useCallback((direction: number) => {
    cityNavigation.current.zoom = Math.max(
      1,
      Math.min(4.5, cityNavigation.current.zoom * direction),
    );
    setViewRevision((value) => value + 1);
  }, []);

  const resetCityView = useCallback(() => {
    cityNavigation.current.zoom = 1;
    cityNavigation.current.x = 0;
    cityNavigation.current.z = 0;
    setSelected(null);
    setCityPlace(null);
    setViewRevision((value) => value + 1);
  }, []);
  const panCity = useCallback((x: number, z: number) => {
    const navigation = cityNavigation.current;
    navigation.x = Math.max(
      -10,
      Math.min(12, navigation.x + x / navigation.zoom),
    );
    navigation.z = Math.max(
      -7,
      Math.min(9, navigation.z + z / navigation.zoom),
    );
    setViewRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    cityNavigation.current.zoom = 1;
    cityNavigation.current.x = 0;
    cityNavigation.current.z = 0;
  }, [selected, cityPlace, run]);

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
    setRoomOpen(false);
    roomAmount.current = 0;
    roomProgress.current = 0;
    transferTime.current = reducedMotion ? COOLANT_TRANSFER.travel : 0;
    transferProgress.current = 0;
    sceneTime.current = reducedMotion ? COOLANT_TRANSFER.scene : 0;
    setTransfer(reducedMotion ? "reading" : "following");
    setTransferRun((value) => value + 1);
  }, [reducedMotion]);

  const continuePower = useCallback(() => {
    if (transfer === "reading") {
      transferTime.current = reducedMotion ? COOLANT_TRANSFER.steamTravel : 0;
      transferProgress.current = reducedMotion ? 1 : 0;
      sceneTime.current = reducedMotion
        ? COOLANT_TRANSFER.turbineScene
        : COOLANT_TRANSFER.scene;
      setTransfer(reducedMotion ? "turbine" : "steaming");
      return;
    }
    if (transfer !== "turbine") return;
    elapsed.current = reducedMotion
      ? POWER_TIMING.ready
      : Math.max(COOLANT_TRANSFER.turbineScene, elapsed.current);
    setStage(powerStageAt(elapsed.current));
    setCityBeat(cityBeatAt(elapsed.current));
    transferTime.current = 0;
    if (reducedMotion) sceneTime.current = elapsed.current;
    setTransfer(reducedMotion ? null : "leaving");
  }, [reducedMotion, transfer]);

  const returnToHeat = useCallback(() => {
    if (transfer !== "steaming" && transfer !== "turbine") return;
    returnStart.current = transferProgress.current;
    transferTime.current = 0;
    if (reducedMotion || returnStart.current === 0) {
      transferProgress.current = 0;
      transferTime.current = COOLANT_TRANSFER.travel;
      sceneTime.current = COOLANT_TRANSFER.scene;
      setTransfer("reading");
    } else setTransfer("returning");
  }, [reducedMotion, transfer]);

  const replayTransfer = useCallback(() => {
    if (!transfer || transfer === "leaving") return;
    followCoolant();
  }, [followCoolant, transfer]);

  const skipTransfer = useCallback(() => {
    if (transfer === "steaming") {
      transferTime.current = COOLANT_TRANSFER.steamTravel;
      transferProgress.current = 1;
      sceneTime.current = COOLANT_TRANSFER.turbineScene;
      setTransfer("turbine");
    } else if (transfer === "following" || transfer === "returning") {
      transferTime.current = COOLANT_TRANSFER.travel;
      transferProgress.current = 0;
      sceneTime.current = COOLANT_TRANSFER.scene;
      setTransfer("reading");
    }
  }, [transfer]);

  useEffect(() => {
    if (!active || roomOpen || transfer === "reading" || transfer === "turbine")
      return;
    if (transfer) {
      const leaving = transfer === "leaving";
      const steaming = transfer === "steaming";
      const returning = transfer === "returning";
      const duration = leaving
        ? COOLANT_TRANSFER.leave
        : steaming
          ? COOLANT_TRANSFER.steamTravel
          : returning
            ? COOLANT_TRANSFER.steamTravel * returnStart.current
            : COOLANT_TRANSFER.travel;
      const finish = () => {
        transferTime.current = duration;
        if (leaving) {
          sceneTime.current = elapsed.current;
          setTransfer(null);
        } else if (steaming) {
          transferProgress.current = 1;
          sceneTime.current = COOLANT_TRANSFER.turbineScene;
          setTransfer("turbine");
        } else {
          transferProgress.current = 0;
          transferTime.current = COOLANT_TRANSFER.travel;
          sceneTime.current = COOLANT_TRANSFER.scene;
          setTransfer("reading");
        }
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
            leaving || steaming || returning
              ? transferTime.current / duration
              : (transferTime.current - 0.4) / 2.2,
          ),
        );
        const eased =
          progress *
          progress *
          progress *
          (progress * (progress * 6 - 15) + 10);
        if (steaming || returning) {
          const along = steaming
            ? progress
            : returnStart.current * (1 - eased);
          transferProgress.current = along;
          const route = along * along * along * (along * (along * 6 - 15) + 10);
          sceneTime.current =
            COOLANT_TRANSFER.scene +
            (COOLANT_TRANSFER.turbineScene - COOLANT_TRANSFER.scene) * route;
        } else {
          sceneTime.current = leaving
            ? COOLANT_TRANSFER.turbineScene +
              (elapsed.current - COOLANT_TRANSFER.turbineScene) * eased
            : COOLANT_TRANSFER.scene * eased;
        }
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
    roomOpen,
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
    cityNavigation,
    zoomLabel,
    zoomCity,
    resetCityView,
    panCity,
    viewRevision,
    roomOpen,
    roomAmount,
    roomProgress,
    roomHotspot,
    enterRoom,
    leaveRoom,
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
    transferProgress,
    transferRun,
    followCoolant,
    continuePower,
    returnToHeat,
    replayTransfer,
    skipTransfer,
    hotspots,
    run,
    begin,
  };
}

export type PowerController = ReturnType<typeof usePower>;
