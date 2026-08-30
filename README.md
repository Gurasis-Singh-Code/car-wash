# Absolute Mobile Car Detailing — Operations Dashboard & Admin Panel

A modern, high-performance web application designed for mobile car detailing operations. Built with Next.js 14 (App Router), Tailwind CSS, TypeScript, and Supabase for real-time appointment scheduling and operations management.

## 🚀 Features

- **Operations Dashboard (`/`)**: Live statistics (Today, This Week, Upcoming, Completed) and real-time appointment queue.
- **Leads Pipeline (`/leads`)**: Inbound Instagram enquiries captured by the automation, with funnel metrics, stage filtering, search, and one-click stage progression from `new` through to `converted`.
- **Admin Management Portal (`/admin`)**: Create, update, edit, and cancel bookings with optimistic UI updates and instant live synchronization across clients.
- **Supabase Realtime Sync**: PostgreSQL triggers and realtime channels for instant UI updates.
- **Secure Authentication (`/login`)**: Role-based access protection powered by Supabase Auth.
- **Responsive & Accessible Design**: Crafted with custom Tailwind typography, fluid states, and micro-interactions.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth)
- **Language**: TypeScript

---

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Gurasis-Singh-Code/car-wash.git
cd car-wash
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create `.env.local` in the root directory (or copy from `.env.example`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database Setup (Supabase)
Execute the SQL script located in `supabase/schema.sql` inside your Supabase project's SQL Editor to create the required enums, tables, views, triggers, and RLS policies.

### 5. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## ☁️ Deploying to Vercel

1. Push your repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Under **Project Settings > Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon/Public Key
4. Click **Deploy**.
