// src/components/Breadcrumbs.tsx
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

interface BreadcrumbsProps {
  returnTo: string;
  label: string;
}

export function Breadcrumbs({ returnTo, label }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link to={returnTo} className="hover:text-foreground transition-colors font-medium">
            Analytics
          </Link>
        </li>
        <li>
          <ChevronRight className="h-4 w-4" />
        </li>
        <li className="text-foreground font-medium">{label} Transactions</li>
      </ol>
    </nav>
  );
}
