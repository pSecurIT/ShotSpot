import React from 'react';
import { Navigate } from 'react-router-dom';

const MyAchievements: React.FC = () => {
  return <Navigate to="/achievements" replace />;
};

export default MyAchievements;
