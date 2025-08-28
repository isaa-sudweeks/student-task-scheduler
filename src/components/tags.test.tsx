// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { Tags } from './tags';

expect.extend(matchers);

describe('Tags component', () => {
  it('renders all tags when under the limit', () => {
    render(<Tags items={['math', 'science', 'english']} />);
    expect(screen.queryByText('+')).not.toBeInTheDocument();
    expect(screen.getByText('math')).toBeInTheDocument();
    expect(screen.getByText('science')).toBeInTheDocument();
    expect(screen.getByText('english')).toBeInTheDocument();
  });

  it('shows a +N counter when tags exceed the limit', () => {
    render(
      <Tags items={['a', 'b', 'c', 'd', 'e', 'f']} maxVisible={4} />
    );
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
