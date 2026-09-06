'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Ticket } from '@/lib/ticketStore';
import { FieldStatus } from '@/types/case';

function getCategoryBadge(category: string) {
  const normalized = category.toLowerCase().trim();
  switch (normalized) {
    case 'water_supply':
      return {
        label: 'Water Supply',
        className: 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/10',
        borderAccent: 'border-l-blue-500',
      };
    case 'drainage':
      return {
        label: 'Drainage & Sewage',
        className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10',
        borderAccent: 'border-l-cyan-500',
      };
    case 'garbage':
      return {
        label: 'Garbage & Waste',
        className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10',
        borderAccent: 'border-l-amber-500',
      };
    case 'road_damage':
      return {
        label: 'Road Damage',
        className: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10',
        borderAccent: 'border-l-rose-500',
      };
    case 'streetlight':
      return {
        label: 'Streetlight',
        className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-yellow-500/10',
        borderAccent: 'border-l-yellow-400',
      };
    default:
      return {
        label: category || 'Civic Grievance',
        className: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40 shadow-zinc-500/10',
        borderAccent: 'border-l-zinc-500',
      };
  }
}

function getStatusBadge(status: FieldStatus | string) {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmed',
        className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
      };
    default:
      return {
        label: 'Unverified',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      };
  }
}

function getConfidenceStyle(confidence: number) {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) {
    return {
      textClass: 'text-emerald-400',
      label: `${pct}%`,
    };
  }
  if (pct >= 50) {
    return {
      textClass: 'text-amber-400',
      label: `${pct}%`,
    };
  }
  return {
    textClass: 'text-rose-400',
    label: `${pct}%`,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check officer authentication gate on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/officer-auth');
        const data = await res.json();
        if (!data.authenticated) {
          router.replace('/officer-login');
        } else {
          setIsAuthenticated(true);
        }
      } catch {
        router.replace('/officer-login');
      }
    }
    checkAuth();
  }, [router]);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const data = await res.json();
        const ticketList: Ticket[] = Array.isArray(data)
          ? data
          : data.tickets || [];
        setTickets(ticketList);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTickets();
    const interval = setInterval(fetchTickets, 3000);
    return () => clearInterval(interval);
  }, [fetchTickets, isAuthenticated]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchTickets();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/officer-auth', { method: 'DELETE' });
    } finally {
      router.push('/officer-login');
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 text-xs gap-3">
        <span className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
        <span>Verifying municipal officer credentials...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="px-4 py-8 md:px-8 max-w-7xl mx-auto">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                EchoCare Grievance Dashboard
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-zinc-900/90 border-zinc-700/80 text-zinc-300 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live polling (3s)
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1.5">
              Real-time municipal grievance intake tickets &amp; escalation records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="border-zinc-700/80 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800 hover:text-white text-xs font-medium"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </Button>

            <Link href="/call">
              <Button
                size="sm"
                className="bg-primary text-black hover:bg-primary/90 text-xs font-bold shadow-sm"
              >
                &larr; Voice Intake
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-rose-900/50 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 text-xs font-medium"
            >
              Sign Out
            </Button>
          </div>
        </header>

        {/* Overview KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-zinc-900 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Tickets
            </p>
            <p className="text-3xl font-bold text-white mt-1.5">{tickets.length}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Escalated to Officers
            </p>
            <p className="text-3xl font-bold text-rose-400 mt-1.5">
              {tickets.filter((t) => t.caseSnapshot?.escalated).length}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Confirmed Locations
            </p>
            <p className="text-3xl font-bold text-emerald-400 mt-1.5">
              {
                tickets.filter(
                  (t) => t.caseSnapshot?.location?.status === 'confirmed',
                ).length
              }
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/90 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Last Polled
            </p>
            <p className="text-sm font-semibold text-zinc-300 mt-3 font-mono">
              {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Active Grievance Tickets ({tickets.length})
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            Auto-refreshes every 3 seconds
          </span>
        </div>

        {/* Ticket List */}
        <section className="space-y-6">
          {isLoading ? (
            <div className="text-center py-20 text-zinc-500 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl">
              <p className="text-sm">Loading grievance tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/40 border border-dashed border-zinc-800/80 rounded-2xl p-6">
              <p className="text-base text-zinc-200 font-semibold">
                No tickets recorded yet
              </p>
              <p className="text-sm text-zinc-400 mt-1.5 max-w-md mx-auto">
                Start a live voice call on the intake page. When a call completes or
                triggers an escalation, it will appear here in real time.
              </p>
              <div className="mt-6">
                <Link href="/">
                  <Button className="bg-primary text-black hover:bg-primary/90 font-bold text-xs">
                    Start Voice Intake
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            tickets.map((ticket) => {
              const categoryStyle = getCategoryBadge(
                ticket.caseSnapshot?.category?.value || '',
              );
              const locationStatus = getStatusBadge(
                ticket.caseSnapshot?.location?.status || 'unverified',
              );
              const contactStatus = getStatusBadge(
                ticket.caseSnapshot?.contactNumber?.status || 'unverified',
              );
              const locationConf = getConfidenceStyle(
                ticket.caseSnapshot?.location?.confidence ?? 0,
              );
              const contactConf = getConfidenceStyle(
                ticket.caseSnapshot?.contactNumber?.confidence ?? 0,
              );

              const isEscalated = Boolean(ticket.caseSnapshot?.escalated);
              const escalationReason =
                ticket.caseSnapshot?.escalationReason ||
                (isEscalated ? 'Threshold reached' : null);

              return (
                <article
                  key={ticket.ticketId}
                  className={`rounded-xl border border-l-[6px] p-6 transition-all shadow-md ${
                    categoryStyle.borderAccent
                  } ${
                    isEscalated
                      ? 'bg-zinc-900 border-rose-800/60 ring-1 ring-rose-500/25 shadow-[0_0_25px_rgba(244,63,94,0.12)]'
                      : 'bg-zinc-900 border-zinc-800/90 hover:border-zinc-700/80'
                  }`}
                >
                  {/* Card Top Row: Category Badge, Ticket ID, Escalated Badge, Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border shadow-sm ${categoryStyle.className}`}
                      >
                        {categoryStyle.label}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">
                        #{ticket.ticketId}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEscalated && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-500/20 text-rose-300 border border-rose-500/60 shadow-[0_0_14px_rgba(244,63,94,0.35)] animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          ESCALATED
                        </span>
                      )}
                      <time className="text-xs text-zinc-400 font-mono">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>

                  {/* Card Main Body Grid: Distinct 3rd-layer inner panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5">
                    {/* Location field */}
                    <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-4 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Location
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${locationStatus.className}`}
                          >
                            {locationStatus.label}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold ${locationConf.textClass}`}
                          >
                            {locationConf.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-base font-semibold text-zinc-100 leading-snug">
                        {ticket.caseSnapshot?.location?.value || '(Not provided)'}
                      </p>
                    </div>

                    {/* Contact Number field */}
                    <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-4 shadow-inner">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Contact Number
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${contactStatus.className}`}
                          >
                            {contactStatus.label}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold ${contactConf.textClass}`}
                          >
                            {contactConf.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-zinc-100 leading-snug font-mono">
                          {ticket.caseSnapshot?.contactNumber?.value ||
                            '(Not provided)'}
                        </p>
                        {ticket.caseSnapshot?.contactNumber?.reaskCount > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            Rejections: {ticket.caseSnapshot.contactNumber.reaskCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Issue Description */}
                  <div className="mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Issue Description
                    </span>
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-xl p-3.5">
                      <p className="text-sm font-normal text-zinc-200 leading-relaxed">
                        {ticket.caseSnapshot?.description?.value ||
                          '(No description provided)'}
                      </p>
                    </div>
                  </div>

                  {/* Escalation Trigger Banner */}
                  {isEscalated && escalationReason && (
                    <div className="mb-4 bg-rose-950/30 border border-rose-800/60 rounded-xl p-3.5 shadow-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                          Escalation Trigger (Rule Fired)
                        </span>
                      </div>
                      <div className="bg-rose-950/60 border border-rose-900/60 rounded-lg px-3 py-2">
                        <p className="text-xs font-mono font-semibold text-rose-200">
                          {escalationReason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conversation Summary */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                      Conversation Summary
                    </span>
                    <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-xl p-3.5">
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {ticket.summary}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
