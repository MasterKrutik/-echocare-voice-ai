'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IMicrophoneAudioTrack } from 'agora-rtc-react';

interface EchoCareMicButtonProps {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  track?: IMicrophoneAudioTrack | MediaStream | null;
  onToggle?: () => void | Promise<void>;
  className?: string;
  'aria-label'?: string;
  enabledColor?: string;
  disabledColor?: string;
}

export function EchoCareMicButton({
  isEnabled,
  setIsEnabled,
  track,
  onToggle,
  className,
  'aria-label': ariaLabel,
}: EchoCareMicButtonProps) {
  const [level, setLevel] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Audio level meter when mic is enabled
  useEffect(() => {
    if (!isEnabled || !track) {
      setLevel(0);
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;

    try {
      const mediaStreamTrack =
        'getMediaStreamTrack' in track && typeof track.getMediaStreamTrack === 'function'
          ? track.getMediaStreamTrack()
          : track instanceof MediaStream
          ? track.getAudioTracks()[0]
          : null;

      if (mediaStreamTrack) {
        const stream = new MediaStream([mediaStreamTrack]);
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }
    } catch {
      // AudioContext fallback
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sourceNode) sourceNode.disconnect();
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [isEnabled, track]);

  const handleClick = async () => {
    if (onToggle) {
      await onToggle();
    } else {
      setIsEnabled(!isEnabled);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel || (isEnabled ? 'Mute microphone' : 'Unmute microphone')}
      className={cn(
        'relative group flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-md',
        isEnabled
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
        className
      )}
    >
      {/* Audio ripple animation ring when speaking */}
      {isEnabled && level > 15 && (
        <span
          className="absolute -inset-1.5 rounded-full border-2 border-primary/50 animate-ping opacity-50 pointer-events-none"
          style={{ animationDuration: `${Math.max(400, 1200 - level * 8)}ms` }}
        />
      )}

      {isEnabled ? (
        <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
      ) : (
        <MicOff className="w-5 h-5 transition-transform group-hover:scale-110" />
      )}
    </button>
  );
}

export default EchoCareMicButton;
