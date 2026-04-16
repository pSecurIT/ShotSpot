import React from 'react';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import SectionHeader from './SectionHeader';

interface PageLayoutProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  eyebrow,
  description,
  actions,
  breadcrumbs = [],
  children,
}) => {
  return (
    <section className="page-layout">
      {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="page-layout__breadcrumbs" />}

      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        actions={actions}
      />

      <div className="page-layout__content">{children}</div>
    </section>
  );
};

export default PageLayout;