// src/components/Layout.tsx
import { Outlet, Link, useLocation } from 'react-router';
import { Wallet } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CurrencySelector } from '@/components/CurrencySelector';
import { cn } from '@/lib/utils';

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <Wallet className="h-6 w-6 text-primary" />
              <span className="text-xl">Budget Analyzer</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  location.pathname === '/' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Transactions
              </Link>
              <Link
                to="/analytics"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  location.pathname === '/analytics' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Analytics
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <CurrencySelector />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
