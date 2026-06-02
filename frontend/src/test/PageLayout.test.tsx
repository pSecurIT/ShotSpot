import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PageLayout from '../components/ui/PageLayout';

describe('PageLayout', () => {
  it('composes breadcrumb, section header, actions, and content', () => {
    render(
      <MemoryRouter>
        <PageLayout
          title="Team Management"
          eyebrow="Data > Teams"
          description="Manage teams and exports"
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Data', path: '/teams' },
            { label: 'Teams' },
          ]}
          actions={<button type="button">Export</button>}
        >
          <div>Team content</div>
        </PageLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team Management' })).toBeInTheDocument();
    expect(screen.getByText('Manage teams and exports')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByText('Team content')).toBeInTheDocument();
  });
});
