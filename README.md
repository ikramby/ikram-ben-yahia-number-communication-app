# NumCom - Structured Numerical Communication

NumCom is a full-stack Next.js application designed for building and managing complex, hierarchical numerical operations. It features a nested tree interface that allows users to break down calculations into manageable branches while ensuring real-time synchronization and security through Supabase.

## Features

- **Nested Structures**: Organize calculations in intuitive hierarchies.
- **Real-time Synchronization**: Powered by Supabase for seamless data persistence across devices.
- **Secure Authentication**: Native Supabase Auth with custom middleware for session management.
- **Modern UI**: Built with Tailwind CSS 4, shadcn/ui, and Lucide icons.
- **Pixel-Perfect Design**: Custom styled components for a high-fidelity visual experience.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js installed
- A Supabase project with authentication and database tables configured (see `/scripts` for schema).

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file with the following variables found in your Supabase dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. Run the development server:
   ```bash
   npm run dev
   ```

## Database Schema

The database schema is managed via SQL scripts located in the `/scripts` folder. Run these in your Supabase SQL editor to set up the necessary tables (`profiles`, `calculations`) and Row Level Security (RLS) policies.

## Project Structure

- `app/`: Next.js pages and API routes.
- `components/`: Reusable UI components.
- `lib/`: Supabase client and utility functions.
- `scripts/`: SQL migration and seeding scripts.
- `public/`: Static assets and images.
