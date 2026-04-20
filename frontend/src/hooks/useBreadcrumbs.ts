import { useMemo } from 'react';
import { matchPath } from 'react-router-dom';
import { BreadcrumbItem } from '../components/ui/Breadcrumbs';

export const useBreadcrumbs = (): BreadcrumbItem[] => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  return useMemo(() => {
    if (pathname === '/' || pathname.startsWith('/dashboard')) {
      return [
        { label: 'Home', path: '/dashboard' },
        { label: 'Overview' },
      ];
    }

    const analyticsGameMatch = matchPath('/analytics/:gameId', pathname);
    if (analyticsGameMatch) {
      const gameId = analyticsGameMatch.params.gameId;
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Matches', path: '/games' },
        { label: `Match #${gameId}` },
        { label: 'Shot Analytics' },
      ];
    }

    const bracketMatch = matchPath('/competitions/:id/bracket', pathname);
    if (bracketMatch) {
      const competitionId = bracketMatch.params.id;
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/competitions' },
        { label: 'Competitions', path: '/competitions' },
        { label: `Competition #${competitionId}` },
        { label: 'Bracket' },
      ];
    }

    const standingsMatch = matchPath('/competitions/:id/standings', pathname);
    if (standingsMatch) {
      const competitionId = standingsMatch.params.id;
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/competitions' },
        { label: 'Competitions', path: '/competitions' },
        { label: `Competition #${competitionId}` },
        { label: 'Standings' },
      ];
    }

    if (pathname.startsWith('/competitions')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/teams' },
        { label: 'Competitions' },
      ];
    }

    if (pathname.startsWith('/games')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Matches', path: '/games' },
        { label: 'Games' },
      ];
    }

    if (pathname.startsWith('/templates')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Matches', path: '/games' },
        { label: 'Match Templates' },
      ];
    }

    if (pathname.startsWith('/advanced-analytics')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Analytics', path: '/achievements' },
        { label: 'Advanced Analytics' },
      ];
    }

    if (pathname.startsWith('/team-analytics')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Analytics', path: '/achievements' },
        { label: 'Team Analytics' },
      ];
    }

    if (pathname.startsWith('/achievements')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Analytics', path: '/achievements' },
        { label: 'Achievements' },
      ];
    }

    if (pathname.startsWith('/my-achievements')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Analytics', path: '/achievements' },
        { label: 'My Achievements' },
      ];
    }

    if (pathname.startsWith('/teams')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/teams' },
        { label: 'Teams' },
      ];
    }

    if (pathname.startsWith('/players')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/teams' },
        { label: 'Players' },
      ];
    }

    if (pathname.startsWith('/clubs')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/teams' },
        { label: 'Clubs' },
      ];
    }

    if (pathname.startsWith('/series')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Data', path: '/teams' },
        { label: 'Series / Divisions' },
      ];
    }

    if (pathname.startsWith('/exports')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
        { label: 'Exports' },
      ];
    }

    if (pathname.startsWith('/report-templates')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
        { label: 'Report Templates' },
      ];
    }

    if (pathname.startsWith('/scheduled-reports')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
        { label: 'Scheduled Reports' },
      ];
    }

    if (pathname.startsWith('/twizzit')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
        { label: 'Twizzit' },
      ];
    }

    if (pathname.startsWith('/users')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings', path: '/settings' },
        { label: 'Users' },
      ];
    }

    if (pathname.startsWith('/settings')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Settings' },
      ];
    }

    if (pathname.startsWith('/profile')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Profile' },
      ];
    }

    return [];
  }, [pathname]);
};

export default useBreadcrumbs;