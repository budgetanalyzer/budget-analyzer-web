// src/components/ViewSelector.tsx
import { Link, useLocation } from 'react-router';
import { ChevronDown, Bookmark } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';
import { useViews } from '@/hooks/useViews';
import { cn } from '@/utils/cn';

export function ViewSelector() {
  const location = useLocation();
  const { data: views, isLoading } = useViews();

  // Determine if we're in the views section
  const isActive = location.pathname === '/views' || location.pathname.startsWith('/views/');
  const currentViewId = location.pathname.startsWith('/views/')
    ? location.pathname.split('/views/')[1]
    : null;

  // Ensure views is an array
  const viewsList = Array.isArray(views) ? views : [];

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex items-center">
      {/* Main link to /views */}
      <Link
        to="/views"
        className={cn(
          'flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm font-medium transition-colors hover:text-primary',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <Bookmark className={cn('h-4 w-4', isActive && 'fill-current')} />
        <span>Views</span>
      </Link>

      {/* Dropdown for quick access */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'rounded-r-md px-1 py-1.5 transition-colors hover:text-primary',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* Saved Views */}
          {viewsList.map((view) => (
            <DropdownMenuItem
              key={view.id}
              asChild
              className={cn(currentViewId === view.id && 'bg-accent')}
            >
              <Link to={`/views/${view.id}`} className="flex w-full items-center justify-between">
                <span className="truncate">{view.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({view.transactionCount})
                </span>
              </Link>
            </DropdownMenuItem>
          ))}

          {/* Empty state */}
          {viewsList.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No saved views yet</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
