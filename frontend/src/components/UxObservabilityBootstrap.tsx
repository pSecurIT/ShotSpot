import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  inferTrackedFlowFromPath,
  initializeUxObservers,
  setUxRouteContext,
  startFlowTiming,
} from '../utils/uxObservability';

const UxObservabilityBootstrap: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    initializeUxObservers();
  }, []);

  useEffect(() => {
    const flowName = inferTrackedFlowFromPath(location.pathname);
    setUxRouteContext(location.pathname, flowName);

    if (flowName) {
      startFlowTiming(flowName, location.pathname);
    }
  }, [location.pathname]);

  return null;
};

export default UxObservabilityBootstrap;