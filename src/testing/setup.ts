// src/testing/setup.ts
import { expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';
import { resetMockHandlerState } from '@/testing/mocks/handlers';
import { server } from '@/testing/mocks/server';

expect.extend(matchers);

// jsdom does not implement the HTML Popover API. Keep this shim limited to
// browser-owned open state, toggle events, Escape, and light dismissal so
// component tests can exercise application behavior without emulating layout.
if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover !== 'function') {
  const openPopovers: HTMLElement[] = [];
  const nativeMatches = Element.prototype.matches;

  const createToggleEvent = (
    type: 'beforetoggle' | 'toggle',
    oldState: string,
    newState: string,
  ) => {
    const event = new Event(type, {
      bubbles: false,
      cancelable: type === 'beforetoggle' && newState === 'open',
    });
    Object.defineProperties(event, {
      oldState: { value: oldState },
      newState: { value: newState },
    });
    return event;
  };

  const getInvoker = (popover: HTMLElement) =>
    Array.from(document.querySelectorAll<HTMLElement>('[popovertarget]')).find(
      (element) => element.getAttribute('popovertarget') === popover.id,
    );

  const isPopoverAncestor = (ancestor: HTMLElement, descendant: HTMLElement) => {
    const invoker = getInvoker(descendant);
    return Boolean(invoker && ancestor.contains(invoker));
  };

  const hidePopover = function (this: HTMLElement) {
    const index = openPopovers.indexOf(this);
    if (index === -1) return;

    const descendants = openPopovers
      .slice(index + 1)
      .filter((popover) => isPopoverAncestor(this, popover));
    descendants.reverse().forEach((popover) => popover.hidePopover());

    const beforeToggle = createToggleEvent('beforetoggle', 'open', 'closed');
    this.dispatchEvent(beforeToggle);
    openPopovers.splice(openPopovers.indexOf(this), 1);
    this.dispatchEvent(createToggleEvent('toggle', 'open', 'closed'));
  };

  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    configurable: true,
    value: function (this: HTMLElement) {
      if (openPopovers.includes(this)) return;

      const beforeToggle = createToggleEvent('beforetoggle', 'closed', 'open');
      if (!this.dispatchEvent(beforeToggle)) return;

      [...openPopovers]
        .reverse()
        .filter((popover) => !isPopoverAncestor(popover, this))
        .forEach((popover) => popover.hidePopover());
      openPopovers.push(this);
      this.dispatchEvent(createToggleEvent('toggle', 'closed', 'open'));
    },
  });

  Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
    configurable: true,
    value: hidePopover,
  });

  Object.defineProperty(HTMLElement.prototype, 'togglePopover', {
    configurable: true,
    value: function (this: HTMLElement, force?: boolean) {
      const shouldOpen = force ?? !openPopovers.includes(this);
      if (shouldOpen) this.showPopover();
      else this.hidePopover();
      return openPopovers.includes(this);
    },
  });

  Element.prototype.matches = function (selectors: string) {
    if (selectors === ':popover-open') {
      return this instanceof HTMLElement && openPopovers.includes(this);
    }
    return nativeMatches.call(this, selectors);
  };

  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;

    const connectedPopovers = openPopovers.filter((popover) => popover.isConnected);
    let containingIndex = -1;
    connectedPopovers.forEach((popover, index) => {
      const invoker = getInvoker(popover);
      if (popover.contains(target) || invoker?.contains(target)) containingIndex = index;
    });

    connectedPopovers
      .slice(containingIndex + 1)
      .reverse()
      .forEach((popover) => popover.hidePopover());
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const topmost = [...openPopovers].reverse().find((popover) => popover.isConnected);
    topmost?.hidePopover();
  });
}

// jsdom does not implement matchMedia; modules that read it at import time
// (e.g., src/store/uiSlice.ts) need a stub.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  resetMockHandlerState();
});
afterAll(() => server.close());
