import { ReactElement } from 'react';
import { render, RenderOptions, RenderResult, act } from '@testing-library/react';

/**
 * Custom render function that wraps components with act() to handle state updates
 * during initial render. This is especially useful for components that make API calls
 * or have side effects during mount.
 */
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult => {
  let result: RenderResult;
  
  act(() => {
    result = render(ui, options);
  });
  
  // @ts-ignore - result is definitely assigned in the act block
  return result;
};

// Re-export everything from testing-library/react
export * from '@testing-library/react';

// Override the default render method
export { customRender as render };