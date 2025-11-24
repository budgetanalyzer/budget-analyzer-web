import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/Button';

/**
 * User profile dropdown component
 * Displays user avatar and provides logout functionality
 */
export function UserProfileDropdown() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  // Generate fallback initials from name or email
  const fallback = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar src={user.picture} alt={user.name || user.email} fallback={fallback} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* User info section */}
        <div className="flex items-center gap-3 p-2">
          <Avatar src={user.picture} alt={user.name || user.email} fallback={fallback} />
          <div className="flex flex-col space-y-1">
            {user.name && <p className="text-sm font-medium leading-none">{user.name}</p>}
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Logout button */}
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
