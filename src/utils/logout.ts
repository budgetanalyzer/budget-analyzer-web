const LOGOUT_PATH = '/logout';

/**
 * Ends the browser session through a top-level form navigation so logout uses
 * the Session Gateway's state-changing POST contract and follows its redirects.
 */
export function submitLogoutForm(): void {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = LOGOUT_PATH;
  form.target = '_top';
  form.hidden = true;
  document.body.append(form);
  form.submit();
}
