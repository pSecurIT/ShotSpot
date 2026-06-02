import React, { useRef, useEffect, useState, useId } from 'react';
import { NavigationItem as NavigationItemType } from '../config/navigation';
import NavigationItem from './NavigationItem';

interface NavigationDropdownProps {
  label: string;
  icon: string;
  items: NavigationItemType[];
  badge?: string;
  isActive?: boolean;
}

const NavigationDropdown: React.FC<NavigationDropdownProps> = ({
  label,
  icon,
  items,
  badge,
  isActive = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusFirstItemRef = useRef(false);
  const [focusLastItemOnOpen, setFocusLastItemOnOpen] = useState(false);
  const generatedId = useId().replace(/:/g, '');
  const menuId = `${generatedId}-menu`;
  const triggerId = `${generatedId}-trigger`;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const focusables = dropdownRef.current?.querySelectorAll('.nav-dropdown-menu a, .nav-dropdown-menu button') as NodeListOf<HTMLElement> | undefined;
    if (!focusables || focusables.length === 0) return;

    if (focusFirstItemRef.current) {
      focusables[0]?.focus();
      focusFirstItemRef.current = false;
      return;
    }

    if (focusLastItemOnOpen) {
      focusables[focusables.length - 1]?.focus();
      setFocusLastItemOnOpen(false);
    }
  }, [focusLastItemOnOpen, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleFocusOut = (event: FocusEvent) => {
      if (!dropdownRef.current) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && dropdownRef.current.contains(nextTarget)) return;
      setIsOpen(false);
    };

    const dropdown = dropdownRef.current;
    dropdown?.addEventListener('focusout', handleFocusOut);

    return () => {
      dropdown?.removeEventListener('focusout', handleFocusOut);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusFirstItemRef.current = true;
      setIsOpen(true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusLastItemOnOpen(true);
      setIsOpen(true);
    }
  };

  // Handle menu item keyboard navigation
  const handleMenuKeyDown = (event: React.KeyboardEvent, index: number) => {
    const items = dropdownRef.current?.querySelectorAll('.nav-dropdown-menu a, .nav-dropdown-menu button') as NodeListOf<HTMLElement>;
    
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = index === 0 ? items.length - 1 : index - 1;
      items[prevIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') {
      // Allow natural tab behavior to close the dropdown
      setIsOpen(false);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMenuItemClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="nav-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        id={triggerId}
        className={`nav-dropdown__trigger ${isOpen || isActive ? 'active' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={label}
        type="button"
      >
        <span className="nav-dropdown__icon" aria-hidden="true">{icon}</span>
        <span className="nav-dropdown__label">{label}</span>
        {badge && <span className="nav-dropdown__badge">{badge}</span>}
        <span className={`nav-dropdown__arrow ${isOpen ? 'open' : ''}`} aria-hidden="true">▼</span>
      </button>

      {isOpen && (
        <div className="nav-dropdown-menu" id={menuId} role="menu" aria-label={`${label} menu`}>
          {items.map((item, index) => (
            <div
              key={item.label}
              className="nav-dropdown-menu__item"
              role="none"
              onKeyDown={(e) => handleMenuKeyDown(e, index)}
            >
              {item.divider ? (
                <hr className="nav-dropdown-menu__divider" />
              ) : (
                <NavigationItem
                  item={item}
                  onClick={handleMenuItemClick}
                  role="menuitem"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NavigationDropdown;
