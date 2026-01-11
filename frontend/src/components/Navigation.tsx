import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { navigationConfig, BREAKPOINTS, NavigationItem } from '../config/navigation';
import NavigationDropdown from './NavigationDropdown';
import MobileMenu from './MobileMenu';
import ChangePasswordDialog from './ChangePasswordDialog';

const Navigation: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

  // Handle responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
      const collapsed = width < BREAKPOINTS.tablet;
      if (!collapsed && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);

  const isCollapsed = viewportWidth < BREAKPOINTS.tablet; // mobile + tablet

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const handlePasswordChangeSuccess = (
    token?: string,
    updatedUser?: {
      id: number;
      username: string;
      email: string;
      role: string;
      passwordMustChange: boolean;
    }
  ) => {
    if (token && updatedUser) {
      updateUser(token, updatedUser);
    }
    alert('Password changed successfully!');
    navigate('/teams');
  };

  // Filter navigation items based on user role
  const getVisibleItems = () => {
    if (!user) return [];
    return navigationConfig.filter((item) =>
      item.roles.includes(user.role as 'user' | 'coach' | 'admin')
    );
  };

  // Filter children items based on user role
  const getVisibleChildren = (children?: typeof navigationConfig) => {
    if (!children || !user) return [];
    return children.filter((child) =>
      child.roles.includes(user.role as 'user' | 'coach' | 'admin')
    );
  };

  const isPathActive = (path?: string) => {
    if (!path) return false;
    if (location.pathname === path) return true;
    // Treat nested routes as active (e.g. /match/:gameId should activate /match)
    return location.pathname.startsWith(`${path}/`);
  };

  const userMenuItems: NavigationItem[] = useMemo(() => {
    if (!user) return [];
    return [
      {
        label: 'Change Password',
        icon: '🔑',
        roles: ['user', 'coach', 'admin'] as const,
        onClick: () => setShowPasswordDialog(true)
      },
      {
        label: 'My Profile',
        icon: '👤',
        roles: ['user', 'coach', 'admin'] as const,
        path: '/profile'
      },
      {
        label: 'My Achievements',
        icon: '🏆',
        roles: ['user', 'coach', 'admin'] as const,
        path: '/my-achievements'
      },
      {
        label: 'Logout',
        icon: '🚪',
        roles: ['user', 'coach', 'admin'] as const,
        onClick: handleLogout
      }
    ];
  }, [user, handleLogout]);

  const visibleItems = getVisibleItems();

  return (
    <nav className="navigation-v2" aria-label="Main navigation">
      {user ? (
        <>
          {/* Mobile/Tablet Hamburger Button */}
          {isCollapsed && (
            <button
              className="navigation-v2__hamburger"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              type="button"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          )}

          {/* Tablet: show user dropdown in header */}
          {isCollapsed && (
            <div className="navigation-v2__user-compact">
              <NavigationDropdown
                label={user.username}
                icon="👤"
                items={userMenuItems}
                isActive={isPathActive('/profile') || isPathActive('/my-achievements')}
              />
            </div>
          )}

          {/* Desktop Navigation */}
          {!isCollapsed && (
            <div className="navigation-v2__desktop">
              {visibleItems.map((item) => {
                const visibleChildren = getVisibleChildren(item.children);
                const isItemActive = isPathActive(item.path) || visibleChildren.some((c) => isPathActive(c.path));

                if (item.children && visibleChildren.length > 0) {
                  // Render dropdown menu
                  return (
                    <NavigationDropdown
                      key={item.label}
                      label={item.label}
                      icon={item.icon}
                      items={visibleChildren}
                      badge={item.badge}
                      isActive={isItemActive}
                    />
                  );
                } else if (item.path) {
                  // Render simple link
                  return (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      className={({ isActive: isNavActive }) =>
                        `navigation-v2__link ${isNavActive || isItemActive ? 'active' : ''}`
                      }
                    >
                      <span className="navigation-v2__icon">{item.icon}</span>
                      <span className="navigation-v2__label">{item.label}</span>
                      {item.badge && (
                        <span className="navigation-v2__badge">{item.badge}</span>
                      )}
                    </NavLink>
                  );
                }
                return null;
              })}

              {/* User Info & Actions */}
              <div className="navigation-v2__user">
                <span className="navigation-v2__user-info">{user.username} ({user.role})</span>
                <NavigationDropdown
                  label="User"
                  icon="👤"
                  items={userMenuItems}
                  isActive={isPathActive('/profile') || isPathActive('/my-achievements')}
                />
              </div>
            </div>
          )}

          {/* Mobile Menu */}
          <MobileMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            navigationItems={visibleItems}
            userRole={user.role}
            userMenuItems={userMenuItems}
          />

          {/* Change Password Dialog */}
          {user && (
            <ChangePasswordDialog
              userId={user.id}
              username={user.username}
              isOwnPassword={true}
              isOpen={showPasswordDialog || user.passwordMustChange === true}
              isForced={user.passwordMustChange === true}
              onClose={() => {
                if (!user.passwordMustChange) {
                  setShowPasswordDialog(false);
                }
              }}
              onSuccess={handlePasswordChangeSuccess}
            />
          )}
        </>
      ) : (
        <div className="navigation-v2__guest">
          <NavLink to="/login" className={({ isActive }) => `navigation-v2__link ${isActive ? 'active' : ''}`}>
            Login
          </NavLink>
          <NavLink to="/register" className={({ isActive }) => `navigation-v2__link ${isActive ? 'active' : ''}`}>
            Register
          </NavLink>
        </div>
      )}
    </nav>
  );
};

export default Navigation;