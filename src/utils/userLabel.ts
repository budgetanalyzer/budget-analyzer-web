type LabelableUser = {
  id?: string | null;
  displayName?: string | null;
  email?: string | null;
};

export function getUserLabel(user: LabelableUser): string {
  return user.displayName?.trim() || user.email || user.id || '';
}
