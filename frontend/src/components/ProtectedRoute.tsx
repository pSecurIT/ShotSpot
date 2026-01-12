import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Role = 'user' | 'coach' | 'admin';

const ROLE_RANK: Record<Role, number> = {
  user: 1,
  coach: 2,
  admin: 3
};

const isRole = (value: unknown): value is Role => value === 'user' || value === 'coach' || value === 'admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  minRole?: Role;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, minRole }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (minRole) {
    const userRole = isRole(user.role) ? user.role : null;
    if (!userRole || ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;