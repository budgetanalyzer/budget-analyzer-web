import type { MouseEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

function expectStaticPopoverPlacement(styleCount: number, ...elements: HTMLElement[]) {
  expect(document.querySelectorAll('style')).toHaveLength(styleCount);
  elements.forEach((element) => {
    expect(element).not.toHaveAttribute('style');
  });
}

function BasicMenu({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent data-testid="menu" align="start">
          <DropdownMenuItem>First</DropdownMenuItem>
          <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
          <DropdownMenuSeparator data-testid="separator" />
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button">After</button>
    </>
  );
}

describe('DropdownMenu', () => {
  it('opens uncontrolled with static popover placement and exposes menu metadata', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const styleCount = document.querySelectorAll('style').length;
    render(<BasicMenu onOpenChange={onOpenChange} />);

    const trigger = screen.getByRole('button', { name: 'Actions' });
    const menu = screen.getByTestId('menu');
    expect(trigger).toHaveAttribute('aria-controls', menu.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveAttribute('popover', 'auto');
    expect(menu).toHaveAttribute('data-align', 'start');
    expect(screen.getByTestId('separator')).toHaveAttribute('role', 'separator');
    const showPopover = vi.spyOn(menu, 'showPopover');

    await user.click(trigger);

    expect(showPopover).toHaveBeenCalledWith({ source: trigger });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBe(menu);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('menuitem', { name: 'Disabled' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'data-destructive',
      'true',
    );
    expectStaticPopoverPlacement(styleCount, trigger, menu);
    showPopover.mockRestore();
  });

  it('preserves controlled state and does not duplicate open-change callbacks', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const view = render(
      <DropdownMenu open={false} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Controlled</DropdownMenuTrigger>
        <DropdownMenuContent data-testid="controlled-menu">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Controlled' }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Controlled' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    view.rerender(
      <DropdownMenu open onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Controlled</DropdownMenuTrigger>
        <DropdownMenuContent data-testid="controlled-menu">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it('composes asChild handlers, class names, and forwarded refs', async () => {
    const user = userEvent.setup();
    const childClick = vi.fn();
    const triggerClick = vi.fn();
    const triggerRef = { current: null as HTMLElement | null };
    const contentRef = { current: null as HTMLDivElement | null };
    const itemRef = { current: null as HTMLElement | null };
    render(
      <DropdownMenu>
        <DropdownMenuTrigger ref={triggerRef} asChild onClick={triggerClick} className="wrapper">
          <button type="button" className="child" onClick={childClick}>
            Composed
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent ref={contentRef}>
          <DropdownMenuItem ref={itemRef} asChild>
            <a href="#item">Item</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Composed' });
    await user.click(trigger);

    expect(childClick).toHaveBeenCalledTimes(1);
    expect(triggerClick).toHaveBeenCalledTimes(1);
    expect(triggerRef.current).toBe(trigger);
    expect(contentRef.current).toBe(screen.getByRole('menu'));
    expect(itemRef.current).toBe(screen.getByRole('menuitem', { name: 'Item' }));
    expect(trigger).toHaveClass('child', 'wrapper');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('runs item handlers before closing and honors preventDefault', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const preventClose = vi.fn((event: MouseEvent<HTMLElement>) => event.preventDefault());
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Choose</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={preventClose}>Keep open</DropdownMenuItem>
          <DropdownMenuItem onClick={select}>Select</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Choose' }));
    await user.click(screen.getByRole('menuitem', { name: 'Keep open' }));
    expect(preventClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Select' }));
    expect(select).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports Arrow keys, Home, End, wraparound, and keyboard activation', async () => {
    const user = userEvent.setup();
    const selectFirst = vi.fn();
    const selectDisabled = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Keyboard</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onClick={selectDisabled}>
            Unavailable
          </DropdownMenuItem>
          <DropdownMenuItem onClick={selectFirst}>First enabled</DropdownMenuItem>
          <DropdownMenuItem>Last enabled</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Keyboard' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const first = screen.getByRole('menuitem', { name: 'First enabled' });
    const last = screen.getByRole('menuitem', { name: 'Last enabled' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unavailable' }));
    expect(selectDisabled).not.toHaveBeenCalled();
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(last).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();
    await user.keyboard('{End}');
    expect(last).toHaveFocus();
    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(selectFirst).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('light-dismisses outside, restores focus on Escape, and does not trap Tab', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<BasicMenu onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports asChild links, disabled links, and child handler composition', async () => {
    const user = userEvent.setup();
    const childClick = vi.fn();
    const itemClick = vi.fn();
    const disabledClick = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Links</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild onClick={itemClick}>
            <a href="#destination" onClick={childClick}>
              Destination
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild disabled>
            <a href="#disabled" onClick={disabledClick}>
              Disabled destination
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Links' }));
    const link = screen.getByRole('menuitem', { name: 'Destination' });
    expect(link).toHaveAttribute('href', '#destination');
    await user.click(link);
    expect(childClick).toHaveBeenCalledTimes(1);
    expect(itemClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Links' }));
    const disabledLink = screen.getByRole('menuitem', { name: 'Disabled destination' });
    expect(disabledLink).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(disabledLink);
    expect(disabledClick).not.toHaveBeenCalled();
    expect(window.location.hash).not.toBe('#disabled');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('opens and closes nested menus with static popover placement', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const styleCount = document.querySelectorAll('style').length;
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Nested</DropdownMenuTrigger>
        <DropdownMenuContent data-testid="parent-menu" align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Add to view</DropdownMenuSubTrigger>
            <DropdownMenuSubContent data-testid="submenu">
              <DropdownMenuItem disabled>Unavailable view</DropdownMenuItem>
              <DropdownMenuItem onClick={select}>Monthly</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled>Disabled submenu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Hidden item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>Other</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const rootTrigger = screen.getByRole('button', { name: 'Nested' });
    await user.click(rootTrigger);
    const subTrigger = screen.getByRole('menuitem', { name: 'Add to view' });
    await user.hover(subTrigger);
    const menus = screen.getAllByRole('menu');
    const submenu = screen.getByTestId('submenu');
    expect(menus).toHaveLength(2);
    expect(subTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(submenu.className).toContain('[position-anchor:auto]');
    expectStaticPopoverPlacement(
      styleCount,
      rootTrigger,
      screen.getByTestId('parent-menu'),
      submenu,
    );

    const disabledSubTrigger = screen.getByRole('menuitem', { name: 'Disabled submenu' });
    fireEvent.pointerEnter(disabledSubTrigger);
    fireEvent.click(disabledSubTrigger);
    expect(disabledSubTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.unhover(subTrigger);
    subTrigger.focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    expect(subTrigger).toHaveFocus();
    expect(submenu).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('menu')).toHaveLength(1);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Monthly' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(subTrigger).toHaveFocus();
    expect(rootTrigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(select).toHaveBeenCalledTimes(1);
    expect(rootTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(subTrigger).toHaveAttribute('aria-expanded', 'false');
    expectStaticPopoverPlacement(
      styleCount,
      rootTrigger,
      screen.getByTestId('parent-menu'),
      submenu,
    );
  });

  it('keeps the implicit invoker anchor and alignment as static metadata', () => {
    render(
      <>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Start</DropdownMenuTrigger>
          <DropdownMenuContent data-testid="start" align="start" />
        </DropdownMenu>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>End</DropdownMenuTrigger>
          <DropdownMenuContent data-testid="end" align="end" />
        </DropdownMenu>
      </>,
    );

    expect(screen.getByTestId('start')).toHaveAttribute('data-align', 'start');
    expect(screen.getByTestId('end')).toHaveAttribute('data-align', 'end');
    expect(screen.getByTestId('start').className).toContain('[position-anchor:auto]');
    expect(screen.getByTestId('end').className).toContain('[position-anchor:auto]');
  });
});
