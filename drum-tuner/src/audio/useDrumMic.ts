import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { HitDetector } from './HitDetector.ts';
import { analyzeHit, type PeakMode, type PitchResult } from './pitch.ts';

export type DrumHit = PitchResult & { level: number; at: number };

export type MicStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'error';

type Options = {
  mode: PeakMode;
  minHz: number;
  maxHz: number;
  /** Hits with clarity below this are ignored as noise. */
  minClarity?: number;
  onHit: (hit: DrumHit) => void;
};

/**
 * Listens to the microphone and reports the pitch of each drum hit.
 */
export function useDrumMic({ mode, minHz, maxHz, minClarity = 6, onHit }: Options) {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const settings = useRef({ mode, minHz, maxHz, minClarity, onHit });
  settings.current = { mode, minHz, maxHz, minClarity, onHit };

  const detector = useRef<HitDetector | null>(null);
  if (!detector.current) {
    detector.current = new HitDetector((captured) => {
      const s = settings.current;
      const res = analyzeHit(captured.samples, captured.sampleRate, {
        mode: s.mode,
        minHz: s.minHz,
        maxHz: s.maxHz,
      });
      if (!res || res.clarity < s.minClarity) return;
      s.onHit({ ...res, level: captured.level, at: Date.now() });
    });
  }

  const lastMeter = useRef(0);
  const onBuffer = useCallback((buffer: AudioStreamBuffer) => {
    const det = detector.current!;
    const pcm = toMonoFloat32(buffer);
    det.push(pcm, buffer.sampleRate);
    const now = Date.now();
    if (now - lastMeter.current > 66) {
      lastMeter.current = now;
      setLevel(det.level);
    }
  }, []);

  const { stream } = useAudioStream({ sampleRate: 48000, channels: 1, encoding: 'float32', onBuffer });

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      detector.current!.reset();
      await stream.start();
      setStatus('listening');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [stream]);

  const stop = useCallback(() => {
    try {
      stream.stop();
    } catch {
      // already stopped
    }
    setLevel(0);
    setStatus('idle');
  }, [stream]);

  // Release the mic when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [stop]);

  return { status, level, error, start, stop };
}

function toMonoFloat32(buffer: AudioStreamBuffer): Float32Array {
  const data = new Float32Array(buffer.data);
  const ch = buffer.channels || 1;
  if (ch === 1) return data;
  const frames = Math.floor(data.length / ch);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < ch; c++) s += data[i * ch + c];
    mono[i] = s / ch;
  }
  return mono;
}
