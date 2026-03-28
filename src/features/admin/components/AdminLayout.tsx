import { Outlet, Link, useLocation } from 'react-router';
import { DollarSign, FileText, LayoutDashboard, List, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    to: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    to: '/admin/currencies',
    label: 'Currencies',
    icon: DollarSign,
  },
  {
    to: '/admin/statement-formats',
    label: 'Statement Formats',
    icon: FileText,
  },
  {
    to: '/admin/transactions',
    label: 'Transactions',
    icon: List,
    disabled: true,
  },
];

export function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const fallback = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user?.email[0].toUpperCase() ?? '?');

  return (
    <div className="admin flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-card">
        {/* Branded header */}
        <div className="border-b bg-primary px-5 py-5">
          <div className="flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-primary-foreground" />
            <span className="text-lg font-bold text-primary-foreground">Admin Console</span>
          </div>
        </div>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <Avatar src={user.picture} alt={user.name || user.email} fallback={fallback} />
            <div className="min-w-0 flex-1">
              {user.name && (
                <p className="truncate text-sm font-medium leading-none">{user.name}</p>
              )}
              <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Management
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.to);

              if (item.disabled) {
                return (
                  <li key={item.to}>
                    <span className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50">
                      <Icon className="h-4 w-4" />
                      {item.label}
                      <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t px-3 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
