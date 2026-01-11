import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NavigationItem as NavigationItemType } from '../config/navigation';

interface NavigationItemProps {
  item: NavigationItemType;
  onClick?: () => void;
  isMobile?: boolean;
  role?: string;
  tabIndex?: number;
}

const NavigationItem: React.FC<NavigationItemProps> = ({
  item,
  onClick,
  isMobile = false,
  role,
  tabIndex
}) => {
  const location = useLocation();
  const isActive = item.path === location.pathname;

  const isDisabled = Boolean(item.disabled);

  const classNameBase = `nav-item ${isActive ? 'active' : ''} ${isMobile ? 'mobile' : ''} ${isDisabled ? 'disabled' : ''}`;

  if (item.path) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive: isNavActive }) =>
          `${classNameBase} ${isNavActive ? 'active' : ''}`
        }
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
        aria-current={isActive ? 'page' : undefined}
        role={role}
        tabIndex={isDisabled ? -1 : tabIndex}
      >
        <span className="nav-item__icon">{item.icon}</span>
        <span className="nav-item__label">{item.label}</span>
        {item.badge && <span className="nav-item__badge">{item.badge}</span>}
      </NavLink>
    );
  }

  // Item without path (used for dropdowns trigger)
  return (
    <button
      className={`${classNameBase} nav-item--button`}
      onClick={() => {
        if (isDisabled) return;
        (item.onClick || onClick)?.();
      }}
      type="button"
      disabled={isDisabled}
      role={role}
      tabIndex={tabIndex}
    >
      <span className="nav-item__icon">{item.icon}</span>
      <span className="nav-item__label">{item.label}</span>
      {item.badge && <span className="nav-item__badge">{item.badge}</span>}
    </button>
  );
};

export default NavigationItem;
