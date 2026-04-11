import React, { useEffect, useState } from 'react';
import { NavigationItem as NavigationItemType } from '../config/navigation';
import NavigationItem from './NavigationItem';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navigationItems: NavigationItemType[];
  userRole: string;
  userMenuItems?: NavigationItemType[];
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  navigationItems,
  userRole,
  userMenuItems = []
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const roleLabel = userRole.charAt(0).toUpperCase() + userRole.slice(1);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(label)) {
        newSet.delete(label);
      } else {
        newSet.add(label);
      }
      return newSet;
    });
  };

  const handleItemClick = () => {
    onClose();
  };

  // Filter items based on user role
  const filterItemsByRole = (items: NavigationItemType[]): NavigationItemType[] => {
    return items.filter((item) => item.roles.includes(userRole as 'user' | 'coach' | 'admin'));
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel */}
      <div
        className={`mobile-menu-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal={isOpen ? true : undefined}
        aria-hidden={!isOpen}
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="mobile-menu-header">
          <div className="mobile-menu-header__copy">
            <span className="mobile-menu-header__eyebrow">Navigation</span>
            <h2 className="mobile-menu-header__title">Match menu</h2>
            <p className="mobile-menu-header__subtitle">Fast access to capture, review, and account tools.</p>
          </div>
          <span className="mobile-menu-header__role-chip">{roleLabel}</span>
          <button
            className="mobile-menu-header__close"
            onClick={onClose}
            aria-label="Close menu"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Menu Items */}
        <nav className="mobile-menu-nav">
          <div className="mobile-menu-nav__intro">
            <span className="mobile-menu-nav__intro-label">Quick access</span>
            <span className="mobile-menu-nav__intro-copy">Choose a section to jump straight back into match operations.</span>
          </div>

          {filterItemsByRole(navigationItems).map((item) => {
            const isExpanded = expandedSections.has(item.label);
            const hasChildren = item.children && item.children.length > 0;
            const visibleChildren = hasChildren
              ? filterItemsByRole(item.children!)
              : [];

            return (
              <div key={item.label} className="mobile-menu-section">
                {hasChildren ? (
                  <>
                    <button
                      className={`mobile-menu-section__header ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleSection(item.label)}
                      aria-expanded={isExpanded}
                      type="button"
                    >
                      <span className="mobile-menu-section__icon">{item.icon}</span>
                      <span className="mobile-menu-section__label">{item.label}</span>
                      {item.badge && (
                        <span className="mobile-menu-section__badge">{item.badge}</span>
                      )}
                      <span className={`mobile-menu-section__arrow ${isExpanded ? 'open' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {isExpanded && visibleChildren.length > 0 && (
                      <div className="mobile-menu-section__children">
                        {visibleChildren.map((child) => (
                          <div key={child.label} className="mobile-menu-section__child">
                            {child.divider ? (
                              <hr className="mobile-menu-section__divider" />
                            ) : (
                              <NavigationItem
                                item={child}
                                onClick={handleItemClick}
                                isMobile
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mobile-menu-section__single">
                    <NavigationItem
                      item={item}
                      onClick={handleItemClick}
                      isMobile
                    />
                  </div>
                )}
              </div>
            );
          })}

          {userMenuItems.length > 0 && (
            <div className="mobile-menu-section mobile-menu-section--user">
              <div className="mobile-menu-section__header mobile-menu-section__header--static">
                <span className="mobile-menu-section__icon">👤</span>
                <span className="mobile-menu-section__label">User</span>
              </div>
              <div className="mobile-menu-section__children">
                {filterItemsByRole(userMenuItems).map((child) => (
                  <div key={child.label} className="mobile-menu-section__child">
                    {child.divider ? (
                      <hr className="mobile-menu-section__divider" />
                    ) : (
                      <NavigationItem item={child} onClick={handleItemClick} isMobile />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
};

export default MobileMenu;
