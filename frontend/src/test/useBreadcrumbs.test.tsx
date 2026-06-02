import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useBreadcrumbs from '../hooks/useBreadcrumbs';

const BreadcrumbProbe = () => {
  const items = useBreadcrumbs();
  return <pre data-testid="crumbs">{JSON.stringify(items)}</pre>;
};

const renderAt = (path: string) => {
  cleanup();
  window.history.pushState({}, '', path);

  render(<BreadcrumbProbe />);

  return JSON.parse(screen.getByTestId('crumbs').textContent ?? '[]') as Array<{ label: string; path?: string }>;
};

describe('useBreadcrumbs', () => {
  it('maps competition bracket routes', () => {
    const breadcrumbs = renderAt('/competitions/42/bracket');

    expect(breadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Data', path: '/competitions' },
      { label: 'Competitions', path: '/competitions' },
      { label: 'Competition #42' },
      { label: 'Bracket' },
    ]);
  });

  it('maps data section routes', () => {
    const teamBreadcrumbs = renderAt('/teams');
    expect(teamBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Data', path: '/teams' },
      { label: 'Teams' },
    ]);

    const playerBreadcrumbs = renderAt('/players');
    expect(playerBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Data', path: '/teams' },
      { label: 'Players' },
    ]);

    const clubBreadcrumbs = renderAt('/clubs');
    expect(clubBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Data', path: '/teams' },
      { label: 'Clubs' },
    ]);

    const seriesBreadcrumbs = renderAt('/series');
    expect(seriesBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Data', path: '/teams' },
      { label: 'Series / Divisions' },
    ]);
  });

  it('maps analytics routes', () => {
    const advancedBreadcrumbs = renderAt('/advanced-analytics');
    expect(advancedBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Analytics', path: '/achievements' },
      { label: 'Advanced Analytics' },
    ]);

    const teamAnalyticsBreadcrumbs = renderAt('/team-analytics');
    expect(teamAnalyticsBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Analytics', path: '/achievements' },
      { label: 'Team Analytics' },
    ]);

    const shotAnalyticsBreadcrumbs = renderAt('/analytics/42');
    expect(shotAnalyticsBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Matches', path: '/games' },
      { label: 'Match #42' },
      { label: 'Shot Analytics' },
    ]);
  });

  it('maps settings and profile routes', () => {
    const settingsBreadcrumbs = renderAt('/settings');
    expect(settingsBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Settings' },
    ]);

    const reportTemplatesBreadcrumbs = renderAt('/report-templates');
    expect(reportTemplatesBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Settings', path: '/settings' },
      { label: 'Report Templates' },
    ]);

    const profileBreadcrumbs = renderAt('/profile');
    expect(profileBreadcrumbs).toEqual([
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Profile' },
    ]);
  });

  it('returns an empty breadcrumb list for unknown routes', () => {
    const breadcrumbs = renderAt('/not-a-real-page');
    expect(breadcrumbs).toEqual([]);
  });
});
