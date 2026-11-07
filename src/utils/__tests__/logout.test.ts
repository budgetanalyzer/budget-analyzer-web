import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitLogoutForm } from '@/utils/logout';

describe('submitLogoutForm', () => {
  afterEach(() => {
    document.querySelectorAll('form[action="/logout"]').forEach((form) => form.remove());
    vi.restoreAllMocks();
  });

  it('submits a hidden same-origin top-level POST form', () => {
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    submitLogoutForm();

    const submittedForm = submitSpy.mock.contexts[0] as HTMLFormElement | undefined;
    expect(submittedForm).toBeInstanceOf(HTMLFormElement);
    expect(submittedForm).toHaveAttribute('action', '/logout');
    expect(submittedForm?.action).toBe(`${window.location.origin}/logout`);
    expect(submittedForm?.method).toBe('post');
    expect(submittedForm?.target).toBe('_top');
    expect(submittedForm).toHaveAttribute('hidden');
    expect(submittedForm?.parentElement).toBe(document.body);
  });
});
