'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, KeyRound, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Municipal Officer Login Gate
 *
 * NOTE: This is intentionally simple — a single shared password gate for demonstration
 * purposes, not a real multi-user authentication system. There is no user database,
 * no signup, and no individual officer accounts.
 */

export default function OfficerLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Please enter the officer dashboard password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/officer-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirect to protected dashboard
        router.push('/dashboard');
      } else {
        setErrorMessage(
          data.error || 'Incorrect officer password. Please verify and try again.',
        );
      }
    } catch (err) {
      console.error('Officer login error:', err);
      setErrorMessage('Unable to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Top bar */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full pt-2">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
            EC
          </div>
          <div>
            <span className="font-semibold text-sm tracking-wide text-white group-hover:text-emerald-400 transition-colors">
              EchoCare
            </span>
            <span className="text-[11px] text-zinc-400 block -mt-0.5">
              Municipal Grievance Helpline
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          &larr; Public Citizen Portal
        </Link>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/40">
          {/* Header icon and badge */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-inner">
              <Shield className="h-6 w-6" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-950 border border-zinc-800 text-zinc-400 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Internal Access Gate
            </div>

            <h1 className="text-xl font-bold text-white tracking-tight">
              Municipal Officer Login
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              Enter the department passcode to review and manage escalated civic grievance tickets.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="officer-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Officer Passcode
              </label>
              <div className="relative">
                <input
                  id="officer-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter officer passcode"
                  autoFocus
                  disabled={isLoading}
                  className="w-full h-11 px-3.5 pl-10 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/70 focus:ring-1 focus:ring-rose-500/30 transition-all font-mono"
                />
                <KeyRound className="h-4 w-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs tracking-wide rounded-xl shadow-lg shadow-rose-950/40 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Passcode...
                </>
              ) : (
                <>
                  Access Grievance Dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Demonstration Notice */}
          <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <span className="font-semibold text-zinc-400">Demo Passcode:</span>{' '}
              <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-rose-300 font-mono text-[11px] border border-zinc-800">
                officer2026
              </code>
            </p>
            <p className="text-[10px] text-zinc-400 mt-1">
              Shared password gate for demo inspection &bull; No database required
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-3 text-[11px] text-zinc-400 max-w-5xl mx-auto w-full">
        EchoCare Civic Intelligence Platform &bull; Authorized Municipal Personnel Only
      </footer>
    </div>
  );
}
