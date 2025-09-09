// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

const transforms = new Map<string, (t: any) => void>();
vi.mock('@dnd-kit/core', () => {
  return {
    __esModule: true,
    useDraggable: ({ id }: any) => {
      const [transform, setTransform] = React.useState<any>(null);
      React.useEffect(() => {
        transforms.set(id, setTransform);
      }, [id]);
      return { attributes: {}, listeners: {}, setNodeRef: () => {}, transform };
    },
    useDndMonitor: () => {},
  };
});

import { EventBox } from './EventBox';

describe('EventBox', () => {
  afterEach(() => {
    cleanup();
    transforms.clear();
  });

  it('updates event box position while dragging resize handles', () => {
    render(
      <EventBox
        id="e1"
        title="Study"
        style={{ position: 'absolute', top: 432, left: 0, width: 100, height: 48 }}
        pxPerMin={48 / 60}
      />
    );
    const box = screen.getByText('Study').parentElement!.parentElement as HTMLElement;
    expect(box.style.height).toBe('48px');
    expect(box.style.top).toBe('432px');
    act(() => {
      const setter = transforms.get('event-resize-start-e1');
      setter?.({ x: 0, y: -24 });
    });
    expect(box.style.top).toBe('408px');
    expect(box.style.height).toBe('72px');
  });
});
