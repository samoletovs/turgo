import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: {
    fabOpen: boolean;
    pathname: string;
    session: { user: { id: string } } | null;
    socketUnreadCount: number | undefined;
    isConnected: boolean;
    polledUnreadCount: number | undefined;
  } = {
    fabOpen: false,
    pathname: '/',
    session: null,
    socketUnreadCount: 0,
    isConnected: true,
    polledUnreadCount: 0 as number | undefined,
  };
  const setFabOpen = vi.fn((update: boolean | ((open: boolean) => boolean)) => {
    state.fabOpen = typeof update === 'function' ? update(state.fabOpen) : update;
  });

  return {
    state,
    setFabOpen,
    useQuery: vi.fn(() => ({ data: state.polledUnreadCount })),
  };
});

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: vi.fn(() => [mocks.state.fabOpen, mocks.setFabOpen]),
  };
});

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mocks.state.session }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: () => null,
  usePathname: () => mocks.state.pathname,
}));

vi.mock('@/lib/socket-client', () => ({
  useSocket: () => ({
    unreadCount: mocks.state.socketUnreadCount,
    isConnected: mocks.state.isConnected,
  }),
}));

vi.mock('@/lib/trpc/client', () => ({
  trpc: { message: { unreadCount: { useQuery: mocks.useQuery } } },
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: 'div',
  motion: { div: 'div' },
}));

import { BottomNav } from '@/components/bottom-nav';

interface ElementProps {
  children?: ReactNode;
  href?: string;
  className?: string;
  'aria-label'?: string;
  'aria-current'?: string;
  onClick?: (...args: never[]) => unknown;
}

function findElements(
  node: ReactNode,
  predicate: (props: ElementProps, type: unknown) => boolean,
): Array<{ props: ElementProps; type: unknown }> {
  const matches: Array<{ props: ElementProps; type: unknown }> = [];

  function visit(child: ReactNode): void {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (!isValidElement<ElementProps>(child)) return;

    if (predicate(child.props, child.type)) {
      matches.push({ props: child.props, type: child.type });
    }
    visit(child.props.children);
  }

  visit(node);
  return matches;
}

function getText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return getText(node.props.children);
  return '';
}

function renderBottomNav() {
  return BottomNav();
}

describe('BottomNav', () => {
  beforeEach(() => {
    mocks.state.fabOpen = false;
    mocks.state.pathname = '/';
    mocks.state.session = null;
    mocks.state.socketUnreadCount = 0;
    mocks.state.isConnected = true;
    mocks.state.polledUnreadCount = 0;
    mocks.setFabOpen.mockClear();
    mocks.useQuery.mockClear();
  });

  it('renders translated navigation tabs and marks the current route active', () => {
    mocks.state.pathname = '/messages/thread';
    const tree = renderBottomNav();
    const nav = findElements(tree, (_props, type) => type === 'nav')[0];
    const links = findElements(tree, (props) => props.href !== undefined);

    expect(nav.props['aria-label']).toBe('mobileNav');
    expect(links.map(({ props }) => props.href)).toEqual(['/', '/search', '/messages', '/profile']);
    expect(links.find(({ props }) => props.href === '/messages')?.props['aria-current']).toBe(
      'page',
    );
    expect(links.find(({ props }) => props.href === '/')?.props['aria-current']).toBeUndefined();
    expect(getText(tree)).toContain('home');
    expect(getText(tree)).toContain('profile');
  });

  it('marks the home tab active for the empty path', () => {
    mocks.state.pathname = '';
    const tree = renderBottomNav();
    const home = findElements(tree, (props) => props.href === '/')[0];

    expect(home.props['aria-current']).toBe('page');
  });

  it('opens and closes the Buy/Sell action sheet from its button and links', () => {
    const closedTree = renderBottomNav();
    const fabButton = findElements(closedTree, (_props, type) => type === 'button')[0];

    expect(getText(fabButton.props.children)).toBe('new');
    expect(findElements(closedTree, (props) => props.href === '/sell')).toHaveLength(0);

    fabButton.props.onClick?.();
    expect(mocks.state.fabOpen).toBe(true);

    const openTree = renderBottomNav();
    expect(findElements(openTree, (props) => props.href === '/sell')).toHaveLength(1);
    expect(findElements(openTree, (props) => props.href === '/buy')).toHaveLength(1);
    expect(getText(openTree)).toContain('sell');
    expect(getText(openTree)).toContain('buy');

    findElements(openTree, (props) => props.href === '/sell')[0].props.onClick?.();
    expect(mocks.state.fabOpen).toBe(false);

    mocks.state.fabOpen = true;
    const reopenedTree = renderBottomNav();
    findElements(reopenedTree, (props) => props.href === '/buy')[0].props.onClick?.();
    expect(mocks.state.fabOpen).toBe(false);
  });

  it('closes the action sheet when its overlay is clicked', () => {
    mocks.state.fabOpen = true;
    const tree = renderBottomNav();
    const overlay = findElements(
      tree,
      (props) => props.className?.includes('bg-black/40') ?? false,
    )[0];

    expect(overlay).toBeDefined();
    overlay.props.onClick?.();
    expect(mocks.state.fabOpen).toBe(false);
  });

  it('uses the connected socket count and caps large unread badges', () => {
    mocks.state.socketUnreadCount = 120;
    mocks.state.polledUnreadCount = 3;
    const tree = renderBottomNav();
    const badge = findElements(tree, (props) => getText(props.children) === '99+')[0];

    expect(badge).toBeDefined();
    expect(mocks.useQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ refetchInterval: 30_000, retry: false, enabled: false }),
    );
  });

  it('enables polling for a signed-in user when the socket is disconnected', () => {
    mocks.state.session = { user: { id: 'user-1' } };
    mocks.state.isConnected = false;
    mocks.state.polledUnreadCount = 4;
    const tree = renderBottomNav();
    const badge = findElements(tree, (props) => getText(props.children) === '4')[0];

    expect(badge).toBeDefined();
    expect(mocks.useQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ refetchInterval: 30_000, retry: false, enabled: true }),
    );
  });

  it('does not show a badge when there are no unread messages', () => {
    mocks.state.isConnected = false;
    mocks.state.polledUnreadCount = undefined;
    const tree = renderBottomNav();

    expect(
      findElements(tree, (props) => props.className?.includes('bg-destructive') ?? false),
    ).toHaveLength(0);
  });

  it('omits the badge when the socket count is not numeric', () => {
    mocks.state.socketUnreadCount = undefined;
    const tree = renderBottomNav();

    expect(
      findElements(tree, (props) => props.className?.includes('bg-destructive') ?? false),
    ).toHaveLength(0);
  });
});
