'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Sparkles, Calendar, BarChart3, Settings, LogOut, LogIn } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#E5E4DE] shadow-soft-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 sm:h-20 py-2 sm:py-0">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-2.5 group focus:outline-none shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sage-500 flex items-center justify-center text-white shadow-soft-sm group-hover:bg-sage-600 transition-colors shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#FAF9F6]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-charcoal text-base sm:text-lg tracking-tight">
                  Absolute
                </span>
                <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 hidden xs:inline-block">
                  Detailing
                </span>
              </div>
              <p className="text-[11px] text-charcoal-muted -mt-0.5 hidden md:block">
                Professional Detailing & Wash Management
              </p>
            </div>
          </Link>

          {/* Navigation Links & Auth Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <nav className="flex items-center gap-1 sm:gap-1.5">
              <Link
                href="/"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  pathname === '/'
                    ? 'bg-sage-500 text-white shadow-soft-sm'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-sage-100/70'
                }`}
                title="Dashboard"
              >
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/overview"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  pathname === '/overview'
                    ? 'bg-sage-500 text-white shadow-soft-sm'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-sage-100/70'
                }`}
                title="Performance Overview"
              >
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Overview</span>
              </Link>

              <Link
                href="/admin"
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  pathname === '/admin'
                    ? 'bg-sage-500 text-white shadow-soft-sm'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-sage-100/70'
                }`}
                title="Admin Management"
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Admin</span>
              </Link>
            </nav>

            {/* Auth Sign In / Sign Out */}
            {user ? (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all ml-0.5 sm:ml-1"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5 text-charcoal-muted hover:text-red-600" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : pathname !== '/login' ? (
              <Link
                href="/login"
                className="flex items-center gap-1 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-sage-700 hover:bg-sage-50 border border-transparent hover:border-sage-200 transition-all ml-0.5 sm:ml-1"
                title="Sign In"
                aria-label="Sign In"
              >
                <LogIn className="w-3.5 h-3.5 text-sage-600" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
