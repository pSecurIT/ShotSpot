import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BREAKPOINTS, NavigationItem } from '../config/navigation';
import { useNavigation } from '../hooks/useNavigation';
import NavigationDropdown from './NavigationDropdown';
import MobileMenu from './MobileMenu';
import ChangePasswordDialog from './ChangePasswordDialog';

const Navigation: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [helpTopic, setHelpTopic] = useState<'overview' | 'games' | 'players'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const { visibleNavigation } = useNavigation(user);
  const isCoachOrPlayer = user?.role === 'coach' || user?.role === 'user';
  const onboardingStorageKey = user ? `shotspot:onboarding:v1:${user.id}:${user.role}` : null;

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

  useEffect(() => {
    if (!isCoachOrPlayer || !onboardingStorageKey || typeof window === 'undefined') {
      return;
    }

    const onboardingStatus = window.localStorage.getItem(onboardingStorageKey);
    if (!onboardingStatus) {
      setShowOnboardingDialog(true);
    }
  }, [isCoachOrPlayer, onboardingStorageKey]);

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
    navigate('/dashboard');
  };


  const isPathActive = (path?: string) => {
    if (!path) return false;
    if (location.pathname === path) return true;
    // Treat nested routes as active (e.g. /match/:gameId should activate /match)
    return location.pathname.startsWith(`${path}/`);
  };

  const closeOnboardingWithStatus = useCallback((status: 'done' | 'skipped') => {
    if (onboardingStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(onboardingStorageKey, status);
    }
    setShowOnboardingDialog(false);
  }, [onboardingStorageKey]);

  const openHelpDialog = useCallback((topic: 'overview' | 'games' | 'players') => {
    setHelpTopic(topic);
    setShowHelpDialog(true);
  }, []);

  const helpMenuItems: NavigationItem[] = useMemo(() => {
    if (!isCoachOrPlayer) return [];

    return [
      {
        label: 'Quick checklist',
        icon: '✅',
        roles: ['user', 'coach'],
        onClick: () => setShowOnboardingDialog(true)
      },
      {
        label: 'Games tips',
        icon: '🎮',
        roles: ['user', 'coach'],
        onClick: () => openHelpDialog('games')
      },
      {
        label: 'Players tips',
        icon: '👥',
        roles: ['user', 'coach'],
        onClick: () => openHelpDialog('players')
      },
      {
        label: 'Overview',
        icon: '❓',
        roles: ['user', 'coach'],
        onClick: () => openHelpDialog('overview')
      }
    ];
  }, [isCoachOrPlayer, openHelpDialog]);

  const userMenuItems: NavigationItem[] = useMemo(() => {
    if (!user) return [];

    const helpItems: NavigationItem[] = isCoachOrPlayer
      ? [
          {
            label: 'Help & Tips',
            icon: '❓',
            roles: ['user', 'coach'],
            onClick: () => openHelpDialog('overview')
          }
        ]
      : [];

    return [
      ...helpItems,
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
  }, [user, handleLogout, isCoachOrPlayer, openHelpDialog]);

  const visibleItems = visibleNavigation;
  const userRoleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
  const mobileMenuId = 'mobile-navigation-menu';
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const helpDialogTitleMap: Record<'overview' | 'games' | 'players', string> = {
    overview: 'Quick Help Overview',
    games: 'Games Tips',
    players: 'Players Tips'
  };

  return (
    <>
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
              aria-controls={mobileMenuId}
              type="button"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          )}

          {/* Tablet: show user dropdown in header */}
          {isCollapsed && (
            <div className="navigation-v2__utility">
              {isCoachOrPlayer && helpMenuItems.length > 0 && (
                <NavigationDropdown
                  label="Help"
                  icon="?"
                  items={helpMenuItems}
                  isActive={showHelpDialog || showOnboardingDialog}
                />
              )}

              <div className="navigation-v2__user-compact">
                <NavigationDropdown
                  label={user.username}
                  icon="👤"
                  items={userMenuItems}
                  isActive={isPathActive('/profile') || isPathActive('/my-achievements')}
                />
              </div>
            </div>
          )}

          {/* Desktop Navigation */}
          {!isCollapsed && (
            <div className="navigation-v2__desktop">
              {visibleItems.map((item) => {
                const visibleChildren = item.children ?? [];
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
                {isCoachOrPlayer && helpMenuItems.length > 0 && (
                  <NavigationDropdown
                    label="Help"
                    icon="?"
                    items={helpMenuItems}
                    isActive={showHelpDialog || showOnboardingDialog}
                  />
                )}

                <div className="navigation-v2__user-meta" aria-label="Current user">
                  <span className="navigation-v2__user-kicker">Active profile</span>
                  <span className="navigation-v2__user-info">{user.username}</span>
                </div>
                <span className="navigation-v2__role-chip">{userRoleLabel}</span>
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
            menuId={mobileMenuId}
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

    {portalTarget && isCoachOrPlayer && showOnboardingDialog && createPortal(
      <div className="modal-overlay" role="presentation" onClick={() => closeOnboardingWithStatus('skipped')}>
        <div className="modal-content onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" onClick={(event) => event.stopPropagation()}>
          <h3 id="onboarding-title">Welcome to ShotSpot</h3>
          <p>
            Use this quick checklist to get productive fast. It is designed for coaches and players who need
            to move from login to useful actions in under a minute.
          </p>
          <p>
            You can skip now and open it later from <strong>Help</strong> without losing progress.
          </p>
          <ol className="onboarding-dialog__checklist">
            <li>
              Open <strong>Matches</strong> to review scheduled games, in-progress games, and actions that
              still need attention.
            </li>
            <li>
              Use <strong>status filters</strong> and <strong>search</strong> first to reduce noise before
              opening a game or roster item.
            </li>
            <li>
              Open <strong>Players</strong> to update roster details, check activity status, and export focused
              lists for staff or teammates.
            </li>
            <li>
              Use the <strong>Help</strong> menu anytime for targeted tips on games, player workflows, and quick
              resets.
            </li>
          </ol>
          <div className="onboarding-dialog__actions">
            <button type="button" className="secondary-button" onClick={() => closeOnboardingWithStatus('skipped')}>
              Skip for now
            </button>
            <button type="button" className="primary-button" onClick={() => closeOnboardingWithStatus('done')}>
              Got it
            </button>
          </div>
        </div>
      </div>,
      portalTarget
    )}

    {portalTarget && isCoachOrPlayer && showHelpDialog && createPortal(
      <div className="modal-overlay" role="presentation" onClick={() => setShowHelpDialog(false)}>
        <div className="modal-content onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}>
          <h3 id="help-title">{helpDialogTitleMap[helpTopic]}</h3>
          {helpTopic === 'overview' && (
            <>
              <p>
                Targeted shortcuts to keep you moving fast during match preparation and roster updates.
              </p>
              <p>
                If you are unsure where to start, use this simple flow: <strong>Matches first</strong> for
                active work, then <strong>Players</strong> for roster corrections and exports.
              </p>
              <ul className="onboarding-dialog__checklist">
                <li>
                  Start in <strong>Matches</strong> to create games, resume live work, or resolve match actions.
                </li>
                <li>
                  Use <strong>Players</strong> for roster edits, activity checks, and shareable exports.
                </li>
                <li>
                  Need a reset? Open <strong>Quick checklist</strong> from Help to get back to the core flow.
                </li>
                <li>
                  Use <strong>Games tips</strong> and <strong>Players tips</strong> for page-specific guidance.
                </li>
              </ul>
            </>
          )}
          {helpTopic === 'games' && (
            <>
              <p>Game flow tips</p>
              <p>
                These steps are optimized for speed during busy match windows and reduce mis-clicks in long lists.
              </p>
              <ul className="onboarding-dialog__checklist">
                <li>
                  Filter by status first to reduce the list quickly before searching team names.
                </li>
                <li>
                  Use templates when creating games for consistent period setup and fewer manual adjustments.
                </li>
                <li>
                  Reopen in-progress games from the list instead of creating duplicates.
                </li>
                <li>
                  Use the refresh action after live updates to verify state before your next action.
                </li>
              </ul>
            </>
          )}
          {helpTopic === 'players' && (
            <>
              <p>Player flow tips</p>
              <p>
                Use this sequence to keep roster management clean, especially when handling large squads.
              </p>
              <ul className="onboarding-dialog__checklist">
                <li>
                  Filter by team and activity before searching names to reduce list size and speed up edits.
                </li>
                <li>
                  Keep jersey numbers unique within your workflow to avoid confusion in match capture.
                </li>
                <li>
                  Mark inactive players when needed instead of deleting historical records.
                </li>
                <li>
                  Use export when sharing roster slices with staff or preparing pre-match checklists.
                </li>
              </ul>
            </>
          )}
          <div className="onboarding-dialog__actions">
            <button type="button" className="primary-button" onClick={() => setShowHelpDialog(false)}>
              Close
            </button>
          </div>
        </div>
      </div>,
      portalTarget
    )}
    </>
  );
};

export default Navigation;