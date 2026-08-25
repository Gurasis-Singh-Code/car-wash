'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Sparkles, Calendar, Settings, LogOut, LogIn } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut, isConfigured } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full bg-[#FAF9F6]/90 backdrop-blur-md border-b border-[#E5E4DE]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none">
            <div className="w-10 h-10 rounded-xl bg-sage-500 flex items-center justify-center text-white shadow-soft-sm group-hover:bg-sage-600 transition-colors">
              <Sparkles className="w-5 h-5 text-[#FAF9F6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-charcoal text-base sm:text-lg tracking-tight">
                  Absolute
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 hidden sm:inline-block">
                  Mobile Detailing
                </span>
              </div>
              <p className="text-xs text-charcoal-muted -mt-0.5 hidden sm:block">
                Professional Detailing & Wash Management
              </p>
            </div>
          </Link>

          {/* Navigation Links & Auth Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === '/'
                    ? 'bg-sage-500 text-white shadow-soft-sm'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-sage-100/60'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/admin"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === '/admin'
                    ? 'bg-sage-500 text-white shadow-soft-sm'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-sage-100/60'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Admin Panel</span>
              </Link>
            </nav>

            {/* Auth Sign In / Sign Out */}
            {user ? (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all ml-1"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : pathname !== '/login' ? (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-sage-700 hover:bg-sage-50 border border-transparent hover:border-sage-200 transition-all ml-1"
                title="Sign In"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
