'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { signIn, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(signInError.message || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md bg-charcoal-card rounded-2xl p-7 sm:p-9 border border-charcoal-border/60 shadow-soft-md animate-fade-in">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-sage-500 text-white dark:text-charcoal-card flex items-center justify-center mx-auto mb-4 shadow-soft-sm">
            <Sparkles className="w-6 h-6 text-[#FAF9F6]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Absolute Mobile Detailing
          </h1>
          <p className="text-xs text-charcoal-muted mt-1.5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-sage-600" />
            <span>Admin & Operations Portal</span>
          </p>
        </div>

        {/* Configuration notice if Supabase is not configured yet */}
        {!isConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <p className="font-semibold mb-1">Supabase Setup Required</p>
            <p className="text-amber-800 leading-relaxed">
              Add your <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">.env.local</code> to activate live Supabase Auth.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="login_email"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Mail className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="login_email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="admin@absolutedetailing.com"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-charcoal-card transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login_password"
              className="block text-xs font-semibold uppercase tracking-wider text-charcoal mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-muted">
                <Lock className="w-4 h-4 text-sage-600" />
              </div>
              <input
                id="login_password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl text-base sm:text-sm bg-canvas border border-charcoal-border text-charcoal placeholder:text-charcoal-light/70 focus:border-sage-500 focus:bg-charcoal-card transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-sage-500 hover:bg-sage-600 active:scale-[0.99] text-white dark:text-charcoal-card font-medium text-sm shadow-soft-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-charcoal-border/40 text-center">
          <p className="text-xs text-charcoal-muted">
            Protected internal panel. Authorized staff only.
          </p>
        </div>
      </div>
    </div>
  );
}
