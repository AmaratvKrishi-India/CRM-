import { describe, it, expect } from 'vitest';
import React from 'react';
import { ErrorBoundary } from '../src/components/common/ErrorBoundary';

describe('Production ErrorBoundary (Part 2B)', () => {
  it('instantiates and initializes with no error', () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBe(null);
  });

  it('updates state when getDerivedStateFromError is triggered', () => {
    const mockError = new Error('Database connection failed');
    const newState = ErrorBoundary.getDerivedStateFromError(mockError);

    expect(newState.hasError).toBe(true);
    expect(newState.error).toBe(mockError);
  });

  it('resets state when handleReset is called', () => {
    let resetCalled = false;
    const boundary = new ErrorBoundary({
      children: null,
      onReset: () => {
        resetCalled = true;
      },
    });

    // Mock setState for isolated unit testing
    boundary.setState = function (updater: any) {
      const updated = typeof updater === 'function' ? updater(this.state) : updater;
      this.state = { ...this.state, ...updated };
    };

    // Simulate error
    boundary.state = {
      hasError: true,
      error: new Error('Render crash'),
    };

    boundary.handleReset();

    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBe(null);
    expect(resetCalled).toBe(true);
  });

  it('renders children when no error exists', () => {
    const child = React.createElement('div', { id: 'test-child' }, 'App is running');
    const boundary = new ErrorBoundary({ children: child });

    const rendered = boundary.render();
    expect(rendered).toBe(child);
  });
});
