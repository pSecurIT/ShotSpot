import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import MobileMenu from '../components/MobileMenu';
import type { NavigationItem } from '../config/navigation';

const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: '🏠',
    roles: ['user', 'coach', 'admin']
  },
  {
    label: 'Matches',
    icon: '🎮',
    roles: ['user', 'coach', 'admin'],
    children: [
      {
        label: 'All Games',
        path: '/games',
        icon: '📋',
        roles: ['user', 'coach', 'admin']
      }
    ]
  }
];

const userMenuItems: NavigationItem[] = [
  {
    label: 'My Profile',
    path: '/profile',
    icon: '👤',
    roles: ['user', 'coach', 'admin']
  }
];

const renderMobileMenu = (isOpen = true, onClose = vi.fn()) => {
  render(
    <BrowserRouter>
      <MobileMenu
        menuId="mobile-navigation-menu"
        isOpen={isOpen}
        onClose={onClose}
        navigationItems={navigationItems}
        userRole="admin"
        userMenuItems={userMenuItems}
      />
    </BrowserRouter>
  );

  return { onClose };
};

describe('MobileMenu', () => {
  it('renders the refreshed mobile menu header when open', () => {
    renderMobileMenu();

    expect(screen.getByRole('dialog', { name: 'Match menu' })).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Match menu')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Quick access')).toBeInTheDocument();
  });

  it('expands grouped navigation sections', () => {
    renderMobileMenu();

    const matchesToggle = screen.getByRole('button', { name: /Matches/i });
    expect(matchesToggle).toHaveAttribute('aria-controls', 'mobile-section-matches');

    fireEvent.click(matchesToggle);

    expect(screen.getByText('All Games')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile site navigation' })).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const { onClose } = renderMobileMenu();

    fireEvent.click(document.querySelector('.mobile-menu-overlay') as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when swiping left on the menu panel', () => {
    const { onClose } = renderMobileMenu();
    const panel = screen.getByRole('dialog', { name: 'Match menu' });

    fireEvent.touchStart(panel, {
      touches: [{ clientX: 280, clientY: 120 }],
    });

    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 180, clientY: 126 }],
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the dialog as hidden when closed', () => {
    renderMobileMenu(false);

    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  });

  it('moves focus to the close button when opened', async () => {
    renderMobileMenu();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
    });
  });

  it('keeps keyboard focus trapped inside the open menu', async () => {
    const user = userEvent.setup();
    renderMobileMenu();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
    });

    await user.tab();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
  });

  it('supports arrow key focus movement between menu actions', async () => {
    renderMobileMenu();

    const closeButton = screen.getByRole('button', { name: 'Close menu' });
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Match menu' }), { key: 'ArrowDown' });
    expect(dashboardLink).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Match menu' }), { key: 'ArrowUp' });
    expect(closeButton).toHaveFocus();
  });
});