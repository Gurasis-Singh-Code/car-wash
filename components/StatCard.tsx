'use client';

import React from 'react';
import { BookingStats } from '@/types/booking';
import { Calendar, CalendarDays, CheckCircle2, Clock } from 'lucide-react';

interface StatCardsGridProps {
  stats: BookingStats | null;
}

interface StatItemConfig {
  title: string;
  key: keyof BookingStats;
  description: string;
  icon: React.ElementType;
}

const STAT_CONFIGS: StatItemConfig[] = [
  {
    title: 'Today',
    key: 'today_count',
    description: 'Scheduled for today',
    icon: Clock,
  },
  {
    title: 'This Week',
    key: 'week_count',
    description: 'Current 7-day window',
    icon: CalendarDays,
  },
  {
    title: 'Upcoming',
    key: 'upcoming_count',
    description: 'Total pending appointments',
    icon: Calendar,
  },
  {
    title: 'Completed',
    key: 'completed_count',
    description: 'Finished details to date',
    icon: CheckCircle2,
  },
];

export default function StatCardsGrid({ stats }: StatCardsGridProps) {
  // If stats is null, render 4 skeleton loader cards
  if (stats === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-5 border border-charcoal-border/60 shadow-soft-sm animate-pulse"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-sage-100/80 rounded w-20"></div>
              <div className="w-9 h-9 bg-sage-100/60 rounded-lg"></div>
            </div>
            <div className="h-8 bg-sage-100/90 rounded w-16 mb-2"></div>
            <div className="h-3 bg-sage-50 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  // Populated state
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {STAT_CONFIGS.map((config) => {
        const Icon = config.icon;
        const count = stats[config.key] ?? 0;

        return (
          <div
            key={config.key}
            className="bg-white rounded-xl p-5 border border-charcoal-border/60 shadow-soft-sm hover:shadow-soft-md transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
                {config.title}
              </span>
              <div className="w-9 h-9 rounded-lg bg-sage-50 text-sage-600 flex items-center justify-center border border-sage-100">
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold tracking-tight text-charcoal">
                {count}
              </span>
              <span className="text-xs text-charcoal-muted">
                {count === 1 ? 'booking' : 'bookings'}
              </span>
            </div>

            <p className="text-xs text-charcoal-muted/80">
              {config.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
