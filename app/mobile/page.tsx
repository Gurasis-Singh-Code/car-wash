'use client';

import React from 'react';
import { Truck } from 'lucide-react';
import ChannelBookingsPage from '@/components/ChannelBookingsPage';

export default function MobilePage() {
  return (
    <ChannelBookingsPage
      location="mobile"
      heading="Mobile Bookings"
      description="Live queue of jobs where the team travels to the customer."
      badgeLabel="Mobile"
      badgeIcon={Truck}
      listSubtitle="Live queue of scheduled mobile detailing services"
    />
  );
}
