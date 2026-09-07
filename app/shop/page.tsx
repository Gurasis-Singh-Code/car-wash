'use client';

import React from 'react';
import { Store } from 'lucide-react';
import ChannelBookingsPage from '@/components/ChannelBookingsPage';

export default function ShopPage() {
  return (
    <ChannelBookingsPage
      location="shop"
      heading="Shop Bookings"
      description="Live queue of jobs carried out at the shop."
      badgeLabel="Shop"
      badgeIcon={Store}
      listSubtitle="Live queue of scheduled in-shop detailing services"
    />
  );
}
