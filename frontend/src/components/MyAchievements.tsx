import React from 'react';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';

const MyAchievements: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();

  return (
    <PageLayout
      title="My Achievements"
      eyebrow="Analytics > My Achievements"
      description="Personal progress and unlocked badges."
      breadcrumbs={breadcrumbs}
    >
      <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
        <p style={{ marginTop: 12 }}>
          Achievements are currently shown inside Match Analytics for a selected game.
        </p>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          This page is a placeholder so the new navigation links are non-breaking.
        </p>
      </div>
    </PageLayout>
  );
};

export default MyAchievements;
