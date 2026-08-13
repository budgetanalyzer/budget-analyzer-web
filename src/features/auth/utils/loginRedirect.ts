const LOGIN_PATH = '/oauth2/authorization/idp';

let automaticRedirectInProgress = false;

export function isSafeReturnUrl(returnUrl: string): boolean {
  if (!returnUrl.startsWith('/') || returnUrl.startsWith('//') || returnUrl.startsWith('/\\')) {
    return false;
  }

  const parsedUrl = new URL(returnUrl, window.location.origin);
  return parsedUrl.origin === window.location.origin;
}

export function buildLoginRedirectUrl(returnUrl?: string | null): string {
  if (!returnUrl || !isSafeReturnUrl(returnUrl)) {
    return LOGIN_PATH;
  }

  return `${LOGIN_PATH}?returnUrl=${encodeURIComponent(returnUrl)}`;
}

export function navigateToLogin(returnUrl?: string | null): void {
  window.location.assign(buildLoginRedirectUrl(returnUrl));
}

export function replaceWithLogin(returnUrl?: string | null): void {
  if (automaticRedirectInProgress) {
    return;
  }

  automaticRedirectInProgress = true;
  window.location.replace(buildLoginRedirectUrl(returnUrl));
}
