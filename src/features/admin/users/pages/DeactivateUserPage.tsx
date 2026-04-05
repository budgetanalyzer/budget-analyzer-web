import { useState, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, UserMinus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MessageBanner } from '@/components/MessageBanner';
import { useDeactivateUser } from '@/hooks/useUsers';
import { formatApiError } from '@/utils/errorMessages';
import { UserDeactivationResponse } from '@/types/user';

export function DeactivateUserPage() {
  const navigate = useNavigate();
  const { mutate: deactivateUser, isPending } = useDeactivateUser();
  const [userId, setUserId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearError = useCallback(() => setErrorMessage(null), []);
  const clearSuccess = useCallback(() => setSuccessMessage(null), []);

  const formatSuccess = (res: UserDeactivationResponse): string =>
    `User ${res.userId} is now ${res.status}. Roles removed: ${res.rolesRemoved}. Sessions revoked: ${res.sessionsRevoked}.`;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = userId.trim();
      if (!trimmed) return;

      setErrorMessage(null);
      setSuccessMessage(null);

      deactivateUser(trimmed, {
        onSuccess: (data) => {
          setSuccessMessage(formatSuccess(data));
          setUserId('');
        },
        onError: (error: Error) => {
          setErrorMessage(formatApiError(error, 'Failed to deactivate user'));
        },
      });
    },
    [userId, deactivateUser],
  );

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        <Button variant="ghost" className="mb-8 gap-2" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <UserMinus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Deactivate User</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deactivate a user account, remove their roles, and revoke all sessions
            </p>
          </div>
        </div>

        <div className="max-w-2xl space-y-4">
          <AnimatePresence mode="wait">
            {errorMessage && (
              <MessageBanner type="error" message={errorMessage} onClose={clearError} />
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {successMessage && (
              <MessageBanner type="success" message={successMessage} onClose={clearSuccess} />
            )}
          </AnimatePresence>

          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="userId" className="mb-2 block text-sm font-medium">
                  User ID
                </label>
                <Input
                  id="userId"
                  type="text"
                  required
                  placeholder="e.g. usr_abc123"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={isPending}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The unique identifier of the user to deactivate
                </p>
              </div>
              <Button type="submit" disabled={isPending || !userId.trim()}>
                {isPending ? 'Deactivating...' : 'Deactivate User'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
