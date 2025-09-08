// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { act } from 'react-dom/test-utils';
import { ErrorBoundary } from './error-boundary';

expect.extend(matchers);

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom');
  }
  return <div>Safe</div>;
}

describe('ErrorBoundary', () => {
  it('captures errors and resets via button', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <ErrorBoundary onReset={onReset}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    const button = screen.getByRole('button', { name: /try again/i });

    rerender(
      <ErrorBoundary onReset={onReset}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    fireEvent.click(button);
    expect(onReset).toHaveBeenCalled();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('allows reset via ref', () => {
    const onReset = vi.fn();
    const ref = React.createRef<ErrorBoundary>();
    const { rerender } = render(
      <ErrorBoundary ref={ref} onReset={onReset}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary ref={ref} onReset={onReset}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    act(() => {
      ref.current?.reset();
    });
    expect(onReset).toHaveBeenCalled();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });
});
