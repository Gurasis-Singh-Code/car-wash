'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { Sparkles, Calendar, BarChart3, Settings, LogOut, LogIn, Inbox } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Calendar, title: 'Dashboard' },
  { href: '/leads', label: 'Leads', icon: Inbox, title: 'Inbound Leads' },
  { href: '/overview', label: 'Overview', icon: BarChart3, title: 'Performance Overview' },
  { href: '/admin', label: 'Admin', icon: Settings, title: 'Admin Management' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 w-full bg-canvas/95 backdrop-blur-md border-b border-charcoal-border shadow-soft-xs">
      <div className="max-w-7xl mx-auto safe-x px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-16 sm:h-20">
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group focus:outline-none shrink-0 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sage-500 flex items-center justify-center text-white dark:text-charcoal-card shadow-soft-sm group-hover:bg-sage-600 transition-colors shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#FAF9F6]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-charcoal text-base sm:text-lg tracking-tight truncate hidden xs:inline">
                  Absolute
                </span>
                <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-sage-100 text-sage-800 hidden sm:inline-block shrink-0">
                  Detailing
                </span>
              </div>
              <p className="text-[11px] text-charcoal-muted -mt-0.5 hidden lg:block">
                Professional Detailing &amp; Wash Management
              </p>
            </div>
          </Link>

          {/* Navigation Links & Auth Actions */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <nav className="flex items-center gap-0.5 sm:gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center justify-center lg:justify-start gap-1.5 h-9 w-9 sm:h-10 sm:w-10 lg:h-auto lg:w-auto lg:px-3.5 lg:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-sage-500 text-white dark:text-charcoal-card shadow-soft-sm'
                        : 'text-charcoal-muted hover:text-charcoal hover:bg-sage-100/70'
                    }`}
                    title={item.title}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle />

            {/* Auth Sign In / Sign Out */}
            {user ? (
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center lg:justify-start gap-1 h-9 w-9 sm:h-10 sm:w-10 lg:h-auto lg:w-auto lg:px-3 lg:py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all ml-0.5 sm:ml-1"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            ) : pathname !== '/login' ? (
              <Link
                href="/login"
                className="flex items-center justify-center lg:justify-start gap-1 h-9 w-9 sm:h-10 sm:w-10 lg:h-auto lg:w-auto lg:px-3 lg:py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-sage-700 hover:bg-sage-50 border border-transparent hover:border-sage-200 transition-all ml-0.5 sm:ml-1"
                title="Sign In"
                aria-label="Sign In"
              >
                <LogIn className="w-4 h-4 shrink-0 text-sage-600" />
                <span className="hidden lg:inline">Sign In</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
