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

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="mobile-menu-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel */}
      <div
        className="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="mobile-menu-header">
          <h2 className="mobile-menu-header__title">Menu</h2>
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
