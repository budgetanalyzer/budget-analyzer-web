// src/components/ErrorBanner.tsx
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ApiError } from '@/types/apiError';

interface ErrorBannerProps {
  error: ApiError | Error;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const isApiError = error instanceof ApiError;

  const getErrorIcon = () => {
    if (!isApiError) return <AlertCircle className="h-5 w-5 text-destructive" />;

    switch (error.status) {
      case 404:
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 503:
        return <AlertCircle className="h-5 w-5 text-warning" />;
      default:
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getErrorTitle = () => {
    if (isApiError) {
      return error.response.message;
    }
    return 'An Error Occurred';
  };

  const getErrorDetail = () => {
    if (isApiError && error.response.code) {
      return `Error code: ${error.response.code}`;
    }
    return error.message;
  };

  return (
    <Card className="border-destructive/50 bg-destructive/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          {getErrorIcon()}
          <CardTitle className="text-lg">{getErrorTitle()}</CardTitle>
        </div>
        <CardDescription className="text-foreground/80">{getErrorDetail()}</CardDescription>
      </CardHeader>
      {onRetry && (
        <CardContent>
          <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
