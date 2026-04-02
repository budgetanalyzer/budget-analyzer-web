import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';

export function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Something went wrong
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            We ran into a problem and couldn&apos;t complete your request. Please try again.
          </p>
        </div>
        <div className="mt-8 space-y-4">
          <Link
            to="/login"
            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Signing In Again
          </Link>
          <Link
            to="/"
            className="group relative flex w-full justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
