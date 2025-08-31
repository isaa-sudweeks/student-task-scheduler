// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import CoursesPage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ course: { list: { invalidate: vi.fn() } } }),
    course: {
      list: { useQuery: () => ({ data: [] }) },
      create: { useMutation: () => ({ mutate: vi.fn() }) },
      update: { useMutation: () => ({ mutate: vi.fn() }) },
      delete: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
}));

describe('CoursesPage', () => {
  it('shows swatch preview when color changes', () => {
    render(<CoursesPage />);
    const input = screen.getByLabelText('Course color') as HTMLInputElement;
    const swatch = screen.getByTestId('color-preview');
    expect(swatch).toHaveStyle({ backgroundColor: '#000000' });
    fireEvent.change(input, { target: { value: '#123456' } });
    expect(swatch).toHaveStyle({ backgroundColor: '#123456' });
  });
});
