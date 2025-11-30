import { Outlet, Link, useLocation } from 'react-router-dom';
import { Settings, DollarSign, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    to: '/admin/currencies',
    label: 'Currencies',
    icon: DollarSign,
  },
  // Add more admin sections here as you build them:
  // { to: '/admin/users', label: 'Users', icon: Users },
  // { to: '/admin/settings', label: 'Settings', icon: Settings },
];

/**
 * Admin console layout with sidebar navigation
 */
export function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b p-6">
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6" />
              <h1 className="text-xl font-bold">Admin Console</h1>
            </div>
            {user && <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== '/admin' && location.pathname.startsWith(item.to));

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
          <div className="border-t p-4">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
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
