import React from 'react';
import { useNavigate } from 'react-router-dom';

// Phones only (shown by index.css below 768px): the four sections as a bottom tab bar with
// labels, in thumb reach. The top bar keeps the logo, save state and logout.
export const MobileTabBar = ({ items }) => {
  const navigate = useNavigate();
  return (
    <nav className="mobile-tabbar" aria-label="เมนูหลัก">
      {items.map(({ id, path, label, icon: Icon, isActive }) => (
        <button
          key={id}
          type="button"
          onClick={() => navigate(path)}
          aria-current={isActive ? 'page' : undefined}
          data-active={isActive}
        >
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
};
