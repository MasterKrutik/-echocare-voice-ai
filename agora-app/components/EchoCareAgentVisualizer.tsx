'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { AgentVisualizerState } from 'agora-agent-uikit';

interface EchoCareAgentVisualizerProps {
  state: AgentVisualizerState | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const stateLabels: Record<string, { en: string; hi: string; color: string; ringColor: string }> = {
  ambient: {
    en: 'EchoCare Agent Ready',
    hi: 'सहायक तैयार है',
    color: 'from-cyan-500 via-blue-500 to-indigo-500',
    ringColor: 'border-cyan-500/30',
  },
  listening: {
    en: 'Listening to you...',
    hi: 'आपकी बात सुन रहे हैं...',
    color: 'from-emerald-400 via-teal-500 to-cyan-500',
    ringColor: 'border-emerald-500/40',
  },
  analyzing: {
    en: 'Processing grievance...',
    hi: 'जानकारी दर्ज हो रही है...',
    color: 'from-amber-400 via-orange-500 to-yellow-500',
    ringColor: 'border-amber-500/40',
  },
  talking: {
    en: 'EchoCare Assistant Speaking',
    hi: 'सहायक बोल रहे हैं',
    color: 'from-blue-500 via-indigo-500 to-purple-500',
    ringColor: 'border-blue-500/40',
  },
  joining: {
    en: 'Connecting to Helpline...',
    hi: 'हेल्पलाइन से जुड़ रहे हैं...',
    color: 'from-sky-400 via-blue-500 to-indigo-500',
    ringColor: 'border-sky-500/30',
  },
  'not-joined': {
    en: 'Helpline Agent Offline',
    hi: 'सहायक ऑफलाइन है',
    color: 'from-gray-500 via-slate-600 to-gray-700',
    ringColor: 'border-gray-500/20',
  },
  disconnected: {
    en: 'Call Disconnected',
    hi: 'कॉल समाप्त हो गई',
    color: 'from-rose-500 via-red-600 to-orange-600',
    ringColor: 'border-rose-500/30',
  },
};

export function EchoCareAgentVisualizer({
  state,
  size = 'lg',
  className,
}: EchoCareAgentVisualizerProps) {
  const meta = stateLabels[state] || stateLabels.ambient;
  const isListening = state === 'listening';
  const isTalking = state === 'talking';
  const isAnalyzing = state === 'analyzing';
  const isOffline = state === 'not-joined' || state === 'disconnected';

  const containerSizes = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64 md:w-72 md:h-72',
  };

  const orbSizes = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32 md:w-36 md:h-36',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-6 select-none', className)}>
      {/* Visualizer Orb Container */}
      <div className={cn('relative flex items-center justify-center', containerSizes[size])}>
        {/* Animated Outer Ripple Rings for Talking & Listening */}
        {!isOffline && (
          <>
            <span
              className={cn(
                'absolute inset-0 rounded-full border border-dashed transition-all duration-700',
                meta.ringColor,
                isTalking && 'animate-ping opacity-30 duration-1000',
                isListening && 'scale-110 opacity-40 animate-pulse',
                isAnalyzing && 'animate-spin opacity-40 duration-3000'
              )}
            />
            <span
              className={cn(
                'absolute -inset-4 rounded-full border transition-all duration-500',
                meta.ringColor,
                isTalking && 'scale-110 opacity-30 animate-pulse duration-700',
                isListening && 'scale-125 opacity-20 animate-ping duration-1500'
              )}
            />
          </>
        )}

        {/* Ambient Glow Backdrop */}
        <div
          className={cn(
            'absolute inset-4 rounded-full blur-2xl transition-all duration-700 opacity-60 bg-gradient-to-tr',
            meta.color,
            isTalking && 'scale-125 opacity-80 blur-3xl',
            isListening && 'scale-115 opacity-75 blur-2xl',
            isAnalyzing && 'opacity-60 scale-105'
          )}
        />

        {/* Core Glowing Orb */}
        <div
          className={cn(
            'relative z-10 flex items-center justify-center rounded-full bg-gradient-to-tr shadow-2xl transition-transform duration-500 border border-white/20 backdrop-blur-md',
            orbSizes[size],
            meta.color,
            isTalking && 'scale-110 shadow-cyan-500/50',
            isListening && 'scale-105 shadow-emerald-500/50',
            isAnalyzing && 'animate-pulse'
          )}
        >
          {/* Internal Graphic Waves */}
          {isTalking ? (
            <div className="flex items-center gap-1.5 h-10">
              <span className="w-1.5 bg-white rounded-full animate-[bounce_0.8s_infinite_100ms] h-6" />
              <span className="w-1.5 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms] h-10" />
              <span className="w-1.5 bg-white rounded-full animate-[bounce_0.8s_infinite_300ms] h-8" />
              <span className="w-1.5 bg-white rounded-full animate-[bounce_0.8s_infinite_400ms] h-10" />
              <span className="w-1.5 bg-white rounded-full animate-[bounce_0.8s_infinite_500ms] h-5" />
            </div>
          ) : isListening ? (
            <div className="flex items-center gap-1 h-8">
              <span className="w-1 bg-white/90 rounded-full animate-pulse h-4" />
              <span className="w-1 bg-white/90 rounded-full animate-pulse h-7 duration-500" />
              <span className="w-1 bg-white/90 rounded-full animate-pulse h-5 duration-700" />
              <span className="w-1 bg-white/90 rounded-full animate-pulse h-6 duration-300" />
            </div>
          ) : isAnalyzing ? (
            <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : isOffline ? (
            <div className="w-4 h-4 rounded-full bg-white/40" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-white/80 shadow-md animate-ping duration-1500" />
          )}
        </div>
      </div>

      {/* State Text Badge */}
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isTalking && 'bg-cyan-400 animate-ping',
              isListening && 'bg-emerald-400 animate-pulse',
              isAnalyzing && 'bg-amber-400 animate-spin',
              isOffline ? 'bg-red-400' : 'bg-blue-400'
            )}
          />
          {meta.en}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {meta.hi}
        </span>
      </div>
    </div>
  );
}

export default EchoCareAgentVisualizer;
