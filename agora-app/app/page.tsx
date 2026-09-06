'use client';

import Link from 'next/link';
import {
  PhoneCall,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Users,
  Building2,
  Cpu,
  Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-primary selection:text-black">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-black text-base shadow-sm">
              EC
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">
                EchoCare
              </span>
              <span className="text-[11px] text-zinc-400 block -mt-1 font-medium">
                Municipal Grievance Helpline
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/officer-login">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-semibold"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5 text-rose-400" />
                Officer Login
              </Button>
            </Link>

            <Link href="/call">
              <Button
                size="sm"
                className="bg-primary text-black hover:bg-primary/90 text-xs font-bold shadow-sm"
              >
                <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                Report Civic Issue
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[22rem] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-zinc-900/90 border border-zinc-800 text-zinc-300 shadow-inner mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Built on Agora Conversational AI</span>
            </div>

            {/* Main Tagline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.1] mb-6">
              Don&apos;t transfer the conversation.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-cyan-400">
                Transfer the case.
              </span>
            </h1>

            {/* Explanatory Paragraph */}
            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl mx-auto mb-10">
              Multilingual (Hindi/English) civic grievance intake with
              confidence-based human escalation, built on Agora Conversational
              AI. EchoCare listens calmly, extracts and verifies critical
              incident parameters, and automatically transfers structured case
              snapshots—not raw phone lines—to municipal officers when rules
              fire.
            </p>

            {/* Two Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
              <Link href="/call" className="w-full sm:w-auto flex-1">
                <Button className="w-full h-12 bg-primary text-black hover:bg-primary/90 font-bold text-sm rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group transition-all">
                  <PhoneCall className="h-4 w-4" />
                  Report a Civic Issue
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>

              <Link href="/officer-login" className="w-full sm:w-auto flex-1">
                <Button
                  variant="outline"
                  className="w-full h-12 border-zinc-700/80 bg-zinc-900/90 text-white hover:bg-zinc-800 hover:text-white font-semibold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2"
                >
                  <Shield className="h-4 w-4 text-rose-400" />
                  Municipal Officer Login
                </Button>
              </Link>
            </div>

            {/* Live Indicator */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Zero-latency voice streaming active &bull; Hindi &amp; English
                Code-switching supported
              </span>
            </div>
          </div>
        </section>

        {/* Built For Section (Two Distinct User Types) */}
        <section className="py-12 border-t border-zinc-800/80 bg-zinc-950/60 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-12">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
                User Personas
              </h2>
              <p className="text-2xl font-bold text-white tracking-tight">
                Engineered for Citizens and Municipal Officers
              </p>
              <p className="text-sm text-zinc-400 mt-2">
                A unified civic intake architecture separating public citizen
                voice reporting from internal officer escalation workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Citizens (Reporting) */}
              <div className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-md relative overflow-hidden group hover:border-zinc-700 transition-all">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                      <Users className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Public Citizen Intake
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">
                    For Citizens (Reporting)
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                    A calm, voice-first civic assistant that never uses rigid
                    phone trees. Citizens speak naturally in their language of
                    choice to lodge municipal grievances.
                  </p>

                  <ul className="space-y-3 mb-6 text-xs text-zinc-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Natural Language Mirroring:</strong> Speaks pure
                        Hindi (देवनागरी) or pure English turn by turn without
                        Hinglish confusion.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>5 Civic Categories:</strong> Water supply,
                        drainage, garbage, road damage, or streetlights.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Confirmation Verification:</strong> Repeats back
                        location and contact number for confirmation before
                        finalizing.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-zinc-800/80">
                  <Link href="/call">
                    <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2">
                      Report a Civic Issue Now
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Card 2: Municipal Officers (Handling Escalations) */}
              <div className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-md relative overflow-hidden group hover:border-zinc-700 transition-all">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      Internal Officer Portal
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">
                    For Municipal Officers (Escalation)
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                    Eliminates the &quot;cold transfer&quot; problem. Officers
                    receive clean case snapshots, conversation transcripts, and
                    the exact rule trigger that necessitated escalation.
                  </p>

                  <ul className="space-y-3 mb-6 text-xs text-zinc-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Deterministic Escalation Triggers:</strong> Shows
                        exact rule triggers (e.g.{' '}
                        <code className="bg-zinc-950 px-1 py-0.5 rounded text-rose-300 font-mono text-[11px]">
                          reaskCount &gt;= 2 on contactNumber
                        </code>
                        ).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Structured Case Snapshots:</strong> Category,
                        location, confidence score %, contact phone, and
                        citizen description.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Real-Time Live Polling:</strong> 3-second live
                        feed updating automatically without manual browser
                        refreshes.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-zinc-800/80">
                  <Link href="/officer-login">
                    <Button className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm">
                      Officer Dashboard Login
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* System Features Bar */}
        <section className="py-10 border-t border-zinc-800/80 bg-zinc-950 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <Languages className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-xs font-bold text-white">
                Bilingual Turn-by-Turn
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Pure Hindi in Devanagari script &amp; natural English with MiniMax
                speech synthesis.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <Cpu className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-white">
                In-Memory State Tracking
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Zero repeat questions. State machine retains verified fields
                throughout the session.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
              <Shield className="h-5 w-5 text-rose-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-white">
                Human-in-the-Loop Handoff
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Deterministic escalation for failed confirmations and multi-factor
                confidence risks.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 bg-zinc-950 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">EchoCare</span>
            <span>&bull;</span>
            <span>Municipal Grievance Intake &amp; Escalation Platform</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <Link
              href="/call"
              className="hover:text-primary transition-colors font-medium"
            >
              Public Intake
            </Link>
            <span>&bull;</span>
            <Link
              href="/officer-login"
              className="hover:text-rose-400 transition-colors font-medium"
            >
              Officer Portal
            </Link>
            <span>&bull;</span>
            <span className="text-zinc-400 font-mono">
              Demo Passcode: officer2026
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
