// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectsPage from './page';

vi.mock('@/server/api/react', () => ({
  api: {
    useUtils: () => ({ project: { list: { invalidate: () => {} } } }),
    project: {
      list: { useQuery: () => ({ data: [] }) },
      create: { useMutation: () => ({ mutate: () => {} }) },
    },
  },
}));

describe('ProjectsPage', () => {
  it('shows empty state message when no projects', () => {
    render(<ProjectsPage />);
    expect(
      screen.getByText('No projects yet—add one above.')
    ).toBeInTheDocument();
  });
});
