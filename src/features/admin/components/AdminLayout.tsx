import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import {
  DollarSign,
  FileText,
  LayoutDashboard,
  List,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Shield,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  toggleAdminSidebar,
  toggleAdminSidebarMobile,
  setAdminSidebarMobileOpen,
} from '@/store/uiSlice';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export function AdminLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((s) => s.ui.adminSidebarOpen);
  const mobileOpen = useAppSelector((s) => s.ui.adminSidebarMobileOpen);

  const canReadCurrencies = usePermission('currencies:read');
  const canReadFormats = usePermission('statementformats:read');
  const canSearchAcrossUsers = usePermission('transactions:read:any');
  const canReadUsers = usePermission('users:read');

  const navItems: NavItem[] = [
    {
      to: '/admin',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    ...(canReadCurrencies
      ? [
          {
            to: '/admin/currencies',
            label: 'Currencies',
            icon: DollarSign,
          },
        ]
      : []),
    ...(canReadFormats
      ? [
          {
            to: '/admin/statement-formats',
            label: 'Statement Formats',
            icon: FileText,
          },
        ]
      : []),
    ...(canSearchAcrossUsers
      ? [
          {
            to: '/admin/transactions',
            label: 'Transactions',
            icon: List,
          },
        ]
      : []),
    ...(canReadUsers
      ? [
          {
            to: '/admin/users',
            label: 'Users',
            icon: Users,
          },
        ]
      : []),
  ];

  // Auto-close mobile overlay when crossing up to md (avoids stale-open state)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) dispatch(setAdminSidebarMobileOpen(false));
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [dispatch]);

  // Escape closes mobile overlay
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(setAdminSidebarMobileOpen(false));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, dispatch]);

  // Body scroll lock while mobile overlay is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileOpen]);

  const handleToggle = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      dispatch(toggleAdminSidebar());
    } else {
      dispatch(toggleAdminSidebarMobile());
    }
  };

  const fallback = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user?.email[0].toUpperCase() ?? '?');

  return (
    <div className="admin relative flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        aria-label="Admin navigation"
        aria-hidden={!sidebarOpen && !mobileOpen}
        className={cn(
          'flex flex-col border-r bg-card',
          // Mobile: fixed overlay, slides via transform, always full width
          'fixed inset-y-0 left-0 z-50 w-64',
          'transition-transform duration-300 ease-in-out motion-reduce:transition-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: return to flow, animate width between rail and full
          'md:static md:z-auto md:translate-x-0',
          'md:transition-[width] md:duration-300 md:ease-in-out',
          sidebarOpen ? 'md:w-64' : 'md:w-16',
        )}
      >
        {/* Branded header */}
        <div
          className={cn(
            'flex items-center border-b px-3 py-4',
            sidebarOpen ? 'justify-between md:px-5 md:py-5' : 'md:justify-center',
          )}
        >
          <div
            className={cn('flex items-center gap-2.5 overflow-hidden', !sidebarOpen && 'md:hidden')}
          >
            <Shield className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate text-lg font-bold text-foreground">Admin Console</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-controls="admin-sidebar"
            aria-expanded={sidebarOpen || mobileOpen}
            className="shrink-0"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* User info */}
        {user && (
          <div
            className={cn(
              'flex items-center gap-3 border-b px-5 py-4',
              !sidebarOpen && 'md:hidden',
            )}
          >
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
        <nav className={cn('flex-1 overflow-y-auto py-4', sidebarOpen ? 'px-3' : 'md:px-2')}>
          <p
            className={cn(
              'mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
              !sidebarOpen && 'md:hidden',
            )}
          >
            Management
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname === item.to || location.pathname.startsWith(item.to + '/');

              if (item.disabled) {
                return (
                  <li key={item.to}>
                    <span
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        'flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/50',
                        !sidebarOpen && 'md:justify-center md:px-0',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={cn(!sidebarOpen && 'md:hidden')}>{item.label}</span>
                      <span
                        className={cn(
                          'ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                          !sidebarOpen && 'md:hidden',
                        )}
                      >
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
                    title={!sidebarOpen ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      !sidebarOpen && 'md:justify-center md:px-0',
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-primary"
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={cn(!sidebarOpen && 'md:hidden')}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className={cn('border-t px-3 py-3', !sidebarOpen && 'md:px-2')}>
          <div
            className={cn(
              'flex items-center',
              sidebarOpen ? 'justify-between' : 'md:flex-col md:gap-2',
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'gap-2 text-muted-foreground',
                !sidebarOpen && 'md:w-full md:justify-center md:gap-0 md:px-0',
              )}
              onClick={() => logout()}
              title={!sidebarOpen ? 'Logout' : undefined}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className={cn(!sidebarOpen && 'md:hidden')}>Logout</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden',
          'transition-opacity duration-300 motion-reduce:transition-none',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => dispatch(setAdminSidebarMobileOpen(false))}
        aria-hidden="true"
      />

      {/* Main content */}
      <main className="relative flex-1 overflow-y-auto">
        {/* Mobile-only open trigger; desktop always has the rail */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch(toggleAdminSidebarMobile())}
          aria-label="Open admin menu"
          aria-controls="admin-sidebar"
          aria-expanded={mobileOpen}
          className="absolute left-4 top-4 z-30 shadow-sm md:hidden"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>

        <Outlet />
      </main>
    </div>
  );
}
