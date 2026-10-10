"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { POWER_TIMING, type PowerPart } from "@/lib/power";
import { REACTOR_TIMING, type ReactorPart } from "@/lib/reactor";
import {
  createJourneySound,
  fadeAudio,
  type SoundMix,
} from "@/lib/journey-sound";
import type { ReactionStage } from "@/lib/fission";
import type { JourneyPhase } from "./use-journey";

type AudioOptions = {
  phase: JourneyPhase;
  reactionStage: ReactionStage;
  reactorTime: RefObject<number>;
  reactorSelected: ReactorPart | null;
  reactorInspection: RefObject<{ time: number }>;
  powerTime: RefObject<number>;
  powerTransfer?: string | null;
  powerSelected?: PowerPart | null;
  roomOpen?: boolean;
  playing: boolean;
  visible: boolean;
  reducedMotion: boolean;
};

function ease(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function updateMix(
  audio: ReturnType<typeof createJourneySound>,
  options: AudioOptions,
) {
  const mix: SoundMix = {
    air: 0.035,
    mechanical: 0,
    water: 0,
    steam: 0,
    drive: 0,
    speed: 1,
  };
  if (options.phase === 1) {
    mix.air = options.reactionStage === "excited" ? 0.09 : 0.025;
  } else if (options.phase === 2) {
    const reveal = ease(
      (options.reactorTime.current - REACTOR_TIMING.core) / 3,
    );
    const selected = options.reactorSelected;
    mix.mechanical = reveal * (selected === "control" ? 0.21 : 0.16);
    mix.water = reveal * (selected === "coolant" ? 0.28 : 0.11);
    mix.steam = selected ? 0 : reveal * 0.035;
    if (selected === "control" && !options.reducedMotion) {
      const time = options.reactorInspection.current.time;
      mix.drive = 0.18 * ease(time / 0.22) * (1 - ease((time - 0.55) / 0.95));
    }
  } else if (options.phase === 3) {
    const selected = options.powerTransfer ? null : options.powerSelected;
    const time = selected
      ? {
          heat: 2.5,
          turbine: 5.7,
          generator: 7.5,
          transmission: 10,
          city: POWER_TIMING.ready,
        }[selected]
      : options.powerTime.current;
    const city = ease((time - POWER_TIMING.city) / 7);
    const turbine = ease((time - POWER_TIMING.turbine) / 2.7);
    mix.mechanical = (0.15 + turbine * 0.15) * (1 - city);
    mix.water = 0.15 * (1 - turbine * 0.7) * (1 - city);
    mix.steam = (0.11 + turbine * 0.1) * (1 - city);
    mix.speed = 1 + turbine * 0.22;
    mix.air = 0.035 + city * 0.015;
    if (options.powerTransfer === "following") {
      mix.mechanical = 0.12;
      mix.water = 0.28;
      mix.steam = 0;
    } else if (options.powerTransfer === "reading") {
      mix.mechanical = 0.11;
      mix.water = 0.12;
      mix.steam = 0.2;
    }
    if (options.roomOpen) {
      mix.mechanical = 0.025;
      mix.water = 0;
      mix.steam = 0;
      mix.air = 0.025;
    }
  }
  audio.mix(mix);
}

export function useJourneyAudio(options: AudioOptions) {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(true);
  const audio = useRef<ReturnType<typeof createJourneySound> | null>(null);
  const latest = useRef(options);
  const requested = useRef(false);
  const request = useRef(0);
  const mounted = useRef(true);
  const previous = useRef({
    phase: options.phase,
    stage: options.reactionStage,
  });

  useEffect(() => {
    latest.current = options;
  }, [options]);

  useEffect(() => {
    mounted.current = true;
    setAvailable(typeof window.AudioContext === "function");
    return () => {
      mounted.current = false;
      request.current++;
      requested.current = false;
      const current = audio.current;
      audio.current = null;
      if (current) {
        fadeAudio(current.output.gain, 0, current.context.currentTime, 0.045);
        window.setTimeout(() => current.dispose(), 60);
      }
    };
  }, []);

  const toggle = useCallback(async () => {
    const id = ++request.current;
    requested.current = !requested.current;
    if (!requested.current) {
      setEnabled(false);
      return;
    }
    if (typeof window.AudioContext !== "function") {
      requested.current = false;
      setAvailable(false);
      return;
    }
    try {
      const current = audio.current ?? (audio.current = createJourneySound());
      await current.context.resume();
      if (mounted.current && request.current === id) setEnabled(true);
      else if (!requested.current && current.context.state !== "closed")
        await current.context.suspend();
    } catch {
      if (mounted.current && request.current === id) {
        requested.current = false;
        setEnabled(false);
      }
    }
  }, []);

  useEffect(() => {
    const current = audio.current;
    if (!enabled || options.phase < 2 || !current) return;
    let canceled = false;
    void current.prepareIndustrial().catch(() => {
      if (!canceled && mounted.current) {
        requested.current = false;
        setEnabled(false);
      }
    });
    return () => {
      canceled = true;
    };
  }, [enabled, options.phase]);

  useEffect(() => {
    const current = audio.current;
    if (!current) return;
    if (!enabled || !options.playing || !options.visible) {
      current.stopHits();
      fadeAudio(current.output.gain, 0, current.context.currentTime, 0.045);
      const timer = window.setTimeout(() => {
        if (current.context.state === "running")
          void current.context.suspend().catch(() => {});
      }, 60);
      return () => window.clearTimeout(timer);
    }
    let stopped = false;
    updateMix(current, latest.current);
    void current.context
      .resume()
      .then(() => {
        if (!stopped)
          fadeAudio(current.output.gain, 0.6, current.context.currentTime, 0.2);
      })
      .catch(() => {
        if (!stopped) {
          requested.current = false;
          setEnabled(false);
        }
      });
    const timer = window.setInterval(
      () => updateMix(current, latest.current),
      100,
    );
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled, options.playing, options.visible]);

  useEffect(() => {
    const prior = previous.current;
    previous.current = { phase: options.phase, stage: options.reactionStage };
    if (
      prior.phase === 1 &&
      options.phase === 1 &&
      prior.stage === "excited" &&
      options.reactionStage === "splitting" &&
      enabled &&
      options.playing &&
      options.visible &&
      !options.reducedMotion &&
      audio.current?.context.state === "running"
    )
      audio.current.hit();
  }, [
    enabled,
    options.phase,
    options.reactionStage,
    options.playing,
    options.visible,
    options.reducedMotion,
  ]);

  return { enabled, available, toggle };
}
