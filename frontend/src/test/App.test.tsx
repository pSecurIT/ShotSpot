import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  afterEach(() => {
    // Ensure BrowserRouter starts from a clean location for the next test.
    window.history.pushState({}, '', '/');
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders a 404 page for unknown routes', () => {
    window.history.pushState({}, '', '/this-route-does-not-exist');
    render(<App />);

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByText('/this-route-does-not-exist')).toBeInTheDocument();
  });
});