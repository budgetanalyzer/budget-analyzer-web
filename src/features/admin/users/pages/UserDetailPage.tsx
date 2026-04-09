// src/features/admin/users/pages/UserDetailPage.tsx
import { useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useParams } from 'react-router';
import {
  Calendar,
  Clock,
  Hash,
  Key,
  Mail,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  UserMinus,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { ErrorBanner } from '@/components/ErrorBanner';
import { IconLabel } from '@/components/IconLabel';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MessageBanner } from '@/components/MessageBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDeactivateUserDialog } from '@/features/admin/users/components/ConfirmDeactivateUserDialog';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useDeactivateUser, useUser } from '@/hooks/useUsers';
import { formatTimestamp } from '@/utils/dates';
import { formatApiError } from '@/utils/errorMessages';
import { getUserLabel } from '@/utils/userLabel';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, error, refetch } = useUser(id);
  const { mutate: deactivateUser, isPending } = useDeactivateUser();
  const canDeactivateUsers = usePermission('users:write');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  const handleOpenConfirmDialog = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsConfirmDialogOpen(true);
  }, []);

  const handleCloseConfirmDialog = useCallback(() => {
    if (isPending) {
      return;
    }
    setIsConfirmDialogOpen(false);
  }, [isPending]);

  const handleConfirmDeactivation = useCallback(() => {
    if (!user?.id) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    deactivateUser(user.id, {
      onSuccess: (data) => {
        setIsConfirmDialogOpen(false);
        setSuccessMessage(`User ${data.userId} deactivated successfully.`);
      },
      onError: (mutationError: Error) => {
        setIsConfirmDialogOpen(false);
        setErrorMessage(formatApiError(mutationError, 'Failed to deactivate user'));
      },
    });
  }, [deactivateUser, user?.id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading user..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="w-full max-w-md">
            <ErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const headingText = getUserLabel(user);
  const roles = user.roleIds ?? [];
  const showDeactivateAction = canDeactivateUsers && user.status === 'ACTIVE';

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <BackButton />
          <Link to="/admin/users">
            <Button variant="outline">All users</Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{headingText}</h1>
            {user.status === 'ACTIVE' ? (
              <Badge variant="success">ACTIVE</Badge>
            ) : (
              <Badge variant="secondary">DEACTIVATED</Badge>
            )}
          </div>
          {showDeactivateAction && (
            <Button variant="destructive" onClick={handleOpenConfirmDialog} disabled={isPending}>
              {isPending ? 'Deactivating...' : 'Deactivate User'}
            </Button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {errorMessage && (
            <MessageBanner type="error" message={errorMessage} onClose={clearErrorMessage} />
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {successMessage && (
            <MessageBanner type="success" message={successMessage} onClose={clearSuccessMessage} />
          )}
        </AnimatePresence>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>Core user identifiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IconLabel icon={Mail} label="Email" value={user.email} />
              <IconLabel icon={User} label="Display Name" value={user.displayName} />
              <IconLabel
                icon={Hash}
                label="Internal ID"
                value={user.id}
                valueClassName="text-sm font-mono break-all"
              />
              <IconLabel
                icon={Key}
                label="IdP Subject"
                value={user.idpSub}
                valueClassName="text-sm font-mono break-all"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
              <CardDescription>Status and role assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">
                    {user.status === 'ACTIVE' ? (
                      <Badge variant="success">ACTIVE</Badge>
                    ) : (
                      <Badge variant="secondary">DEACTIVATED</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Tag className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Roles</p>
                  {roles.length === 0 ? (
                    <p className="text-base text-muted-foreground">—</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {roles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timestamps</CardTitle>
              <CardDescription>Creation and last update</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IconLabel icon={Calendar} label="Created" value={formatTimestamp(user.createdAt)} />
              <IconLabel icon={Clock} label="Updated" value={formatTimestamp(user.updatedAt)} />
            </CardContent>
          </Card>

          {user.deactivatedAt && (
            <Card>
              <CardHeader>
                <CardTitle>Deactivation</CardTitle>
                <CardDescription>When and by whom this user was deactivated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <IconLabel
                  icon={UserMinus}
                  label="Deactivated At"
                  value={formatTimestamp(user.deactivatedAt)}
                />
                {user.deactivatedBy && (
                  <IconLabel
                    icon={User}
                    label="Deactivated By"
                    value={
                      <>
                        {getUserLabel(user.deactivatedBy)}
                        <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                          {user.deactivatedBy.id}
                        </span>
                      </>
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}

          {user.deletedAt && (
            <Card>
              <CardHeader>
                <CardTitle>Deletion</CardTitle>
                <CardDescription>When and by whom this user was deleted</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <IconLabel
                  icon={Trash2}
                  label="Deleted At"
                  value={formatTimestamp(user.deletedAt)}
                />
                {user.deletedBy && (
                  <IconLabel
                    icon={User}
                    label="Deleted By"
                    value={
                      <>
                        {getUserLabel(user.deletedBy)}
                        <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                          {user.deletedBy.id}
                        </span>
                      </>
                    }
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <ConfirmDeactivateUserDialog
          userLabel={headingText}
          isOpen={isConfirmDialogOpen}
          isSubmitting={isPending}
          onConfirm={handleConfirmDeactivation}
          onCancel={handleCloseConfirmDialog}
        />
      </div>
    </div>
  );
}
