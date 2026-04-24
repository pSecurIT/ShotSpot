import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Breadcrumbs from '../components/ui/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders links for ancestors and marks the current page', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Data', path: '/teams' },
            { label: 'Teams' },
          ]}
        />
      </MemoryRouter>
    );

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Data' })).toHaveAttribute('href', '/teams');
    expect(screen.getByText('Teams')).toHaveAttribute('aria-current', 'page');
  });

  it('renders nothing when no items are provided', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumbs items={[]} />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
