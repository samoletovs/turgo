import { createElement, isValidElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary, ErrorFallback } from '@/components/error-boundary';

interface ElementProps {
  children?: ReactNode;
  onClick?: (...args: never[]) => unknown;
}

function findElements(node: ReactNode): Array<{ props: ElementProps; type: unknown }> {
  const matches: Array<{ props: ElementProps; type: unknown }> = [];

  function visit(child: ReactNode): void {
    if (Array.isArray(child)) {
      child.forEach(visit);
      return;
    }
    if (!isValidElement<ElementProps>(child)) return;

    matches.push({ props: child.props, type: child.type });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ErrorBoundary', () => {
  it('initially renders its children', () => {
    const child = createElement('p', null, 'Working content');
    const boundary = new ErrorBoundary({ children: child });

    expect(boundary.state.hasError).toBe(false);
    expect(boundary.render()).toBe(child);
  });

  it('stores a thrown error and logs it with component details', () => {
    const error = new Error('Render failed');
    const errorInfo = { componentStack: '\n    at CrashingChild' };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({
      hasError: true,
      error,
    });

    const boundary = new ErrorBoundary({ children: null });
    boundary.componentDidCatch(error, errorInfo);
    expect(log).toHaveBeenCalledWith('ErrorBoundary caught:', error, errorInfo);
  });

  it('renders a provided fallback after an error', () => {
    const fallback = createElement('p', null, 'Custom fallback');
    const boundary = new ErrorBoundary({ children: null, fallback });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Render failed'));

    expect(boundary.render()).toBe(fallback);
  });

  it('renders the default fallback when an error has no custom fallback', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('Render failed'));
    const fallback = boundary.render();

    expect(isValidElement(fallback) ? fallback.type : undefined).toBe(ErrorFallback);
  });

  it('shows translated recovery content and reloads when its button is clicked', () => {
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    const tree = ErrorFallback();
    const button = findElements(tree).find(({ props }) => props.onClick !== undefined);

    expect(getText(tree)).toContain('errors.boundary.title');
    expect(getText(tree)).toContain('errors.boundary.description');
    expect(getText(tree)).toContain('errors.boundary.cta');
    expect(button).toBeDefined();

    button?.props.onClick?.();
    expect(reload).toHaveBeenCalledOnce();
  });
});
