import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Page shown when user tries to access a route they don't have permission for
 */
export function UnauthorizedPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
        <h1 className="mb-2 text-4xl font-bold">403 - Unauthorized</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          You don&apos;t have permission to access this page.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/">
            <Button variant="default">Go to Home</Button>
          </Link>
          <Link to="/admin">
            <Button variant="outline">Admin Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
