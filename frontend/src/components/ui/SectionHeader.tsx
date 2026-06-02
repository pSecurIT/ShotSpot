import React from 'react';

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, eyebrow, description, actions }) => {
  return (
    <header className="section-header">
      <div className="section-header__content">
        {eyebrow && <span className="section-header__eyebrow">{eyebrow}</span>}
        <h1 className="section-header__title">{title}</h1>
        {description && <p className="section-header__description">{description}</p>}
      </div>

      {actions && <div className="section-header__actions">{actions}</div>}
    </header>
  );
};

export default SectionHeader;