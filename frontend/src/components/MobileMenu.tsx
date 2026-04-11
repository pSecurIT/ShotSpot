import React, { useEffect, useId, useRef, useState } from 'react';
import { NavigationItem as NavigationItemType } from '../config/navigation';
import NavigationItem from './NavigationItem';

interface MobileMenuProps {
  menuId?: string;
  isOpen: boolean;
  onClose: () => void;
  navigationItems: NavigationItemType[];
  userRole: string;
  userMenuItems?: NavigationItemType[];
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  menuId,
  isOpen,
  onClose,
  navigationItems,
  userRole,
  userMenuItems = []
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
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

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      closeButtonRef.current?.focus();
      return;
    }

    previousFocusRef.current?.focus();
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

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;

    const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
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
        id={menuId}
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen ? true : undefined}
        aria-hidden={!isOpen}
        aria-labelledby={titleId}
        onKeyDown={handlePanelKeyDown}
      >
        {/* Header */}
        <div className="mobile-menu-header">
          <div className="mobile-menu-header__copy">
            <span className="mobile-menu-header__eyebrow">Navigation</span>
            <h2 className="mobile-menu-header__title" id={titleId}>Match menu</h2>
            <p className="mobile-menu-header__subtitle">Fast access to capture, review, and account tools.</p>
          </div>
          <span className="mobile-menu-header__role-chip">{roleLabel}</span>
          <button
            ref={closeButtonRef}
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
