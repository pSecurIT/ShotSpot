import React, { useRef, useEffect, useState } from 'react';
import { NavigationItem as NavigationItemType } from '../config/navigation';
import NavigationItem from './NavigationItem';

interface NavigationDropdownProps {
  label: string;
  icon: string;
  children: NavigationItemType[];
  badge?: string;
  isActive?: boolean;
}

const NavigationDropdown: React.FC<NavigationDropdownProps> = ({
  label,
  icon,
  children,
  badge,
  isActive = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(!isOpen);
    } else if (event.key === 'ArrowDown' && isOpen) {
      event.preventDefault();
      const firstItem = dropdownRef.current?.querySelector('.nav-dropdown-menu a, .nav-dropdown-menu button') as HTMLElement;
      firstItem?.focus();
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
        className={`nav-dropdown__trigger ${isOpen || isActive ? 'active' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={label}
        type="button"
      >
        <span className="nav-dropdown__icon">{icon}</span>
        <span className="nav-dropdown__label">{label}</span>
        {badge && <span className="nav-dropdown__badge">{badge}</span>}
        <span className={`nav-dropdown__arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="nav-dropdown-menu" role="menu" aria-label={`${label} menu`}>
          {children.map((item, index) => (
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
