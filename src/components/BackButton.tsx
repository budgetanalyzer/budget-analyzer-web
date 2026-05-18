import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';

// Top-level routes where back button should never appear
// These are primary navigation destinations (list/index pages, navbar items)
const TOP_LEVEL_ROUTES = ['/', '/analytics'];

/**
 * BackButton component for detail/drill-down pages.
 *
 * Prefer explicit URL return context from analytics/view drilldowns. Otherwise
 * fall back to browser history when this route was reached through in-app
 * navigation.
 */
export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const handleBack = useCallback(() => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    navigate(-1);
  }, [navigate, returnTo]);

  // Check if current route is a top-level route
  const isTopLevel = TOP_LEVEL_ROUTES.includes(location.pathname);
  const hasBrowserHistory = location.key !== 'default';

  if (isTopLevel || (!returnTo && !hasBrowserHistory)) {
    return null;
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
