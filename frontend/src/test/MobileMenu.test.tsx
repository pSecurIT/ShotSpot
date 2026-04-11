import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Match menu')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Quick access')).toBeInTheDocument();
  });

  it('expands grouped navigation sections', () => {
    renderMobileMenu();

    fireEvent.click(screen.getByRole('button', { name: /Matches/i }));

    expect(screen.getByText('All Games')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const { onClose } = renderMobileMenu();

    fireEvent.click(document.querySelector('.mobile-menu-overlay') as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the dialog as hidden when closed', () => {
    renderMobileMenu(false);

    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('aria-hidden', 'true');
  });

  it('locks body scrolling while the menu is open', () => {
    renderMobileMenu(true);

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes when escape is pressed', () => {
    const { onClose } = renderMobileMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});