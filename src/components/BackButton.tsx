import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useAppSelector } from '@/store/hooks';

// Top-level routes where back button should never appear
// These are primary navigation destinations (list/index pages, navbar items)
const TOP_LEVEL_ROUTES = ['/', '/analytics'];

/**
 * BackButton component that displays a back navigation button
 * only when there is application navigation history.
 *
 * Shows button only when BOTH conditions are true:
 * 1. Current route is NOT a top-level route (reserved for detail/drill-down pages)
 * 2. User has navigated within the app (not a direct/bookmarked load)
 *
 * Navigation tracking is handled by the Layout component to ensure it happens
 * before page components render.
 *
 * This ensures the button only appears on detail pages like transaction detail,
 * and only when the user actually navigated there from another page in the app.
 */
export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigated = useAppSelector((state) => state.ui.hasNavigated);

  const handleBack = () => {
    navigate(-1);
  };

  // Check if current route is a top-level route
  const isTopLevel = TOP_LEVEL_ROUTES.includes(location.pathname);

  // Don't show button if:
  // - On a top-level route (list pages, navbar destinations), OR
  // - User hasn't navigated yet (direct/bookmarked load)
  if (isTopLevel || !hasNavigated) {
    return null;
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
