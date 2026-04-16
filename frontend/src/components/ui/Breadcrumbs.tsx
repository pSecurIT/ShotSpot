import React from 'react';
import { Link, useInRouterContext } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  const isInRouterContext = useInRouterContext();

  if (!items.length) return null;

  return (
    <nav className={`breadcrumbs ${className}`.trim()} aria-label="Breadcrumb">
      <ol className="breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const canRenderLink = !isLast && Boolean(item.path) && isInRouterContext;

          return (
            <li key={`${item.label}-${index}`} className="breadcrumbs__item">
              {canRenderLink ? (
                <Link to={item.path} className="breadcrumbs__link">
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumbs__current" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}

              {!isLast && <span className="breadcrumbs__separator" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;