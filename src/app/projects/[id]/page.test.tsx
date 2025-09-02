// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi, describe } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

import ProjectPage from './page';

const updateMock = vi.fn();

vi.mock('@/server/api/react', () => ({
  api: {
    project: {
      get: { useQuery: () => ({ data: { id: '1', title: 'Proj', description: 'Desc', instructionsUrl: null } }) },
      update: { useMutation: () => ({ mutateAsync: updateMock }) },
    },
  },
}));

describe('ProjectPage', () => {
  it('shows description and upload field', () => {
    render(<ProjectPage params={{ id: '1' }} />);
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByLabelText(/upload instructions/i)).toBeInTheDocument();
  });
});
