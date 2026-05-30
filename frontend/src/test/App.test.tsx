import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  afterEach(() => {
    // Ensure BrowserRouter starts from a clean location for the next test.
    window.history.pushState({}, '', '/');
  });

  it('renders without crashing', async () => {
    render(<App />);
    expect(await screen.findByRole('main')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
  });

  it('renders a skip link to main content', async () => {
    render(<App />);

    expect(
      await screen.findByRole('link', { name: /skip to main content/i })
    ).toHaveAttribute('href', '#app-main');
  });

  it('renders a 404 page for unknown routes', async () => {
    window.history.pushState({}, '', '/this-route-does-not-exist');
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /page not found/i })
    ).toBeInTheDocument();
    expect(screen.getByText('/this-route-does-not-exist')).toBeInTheDocument();
  });
});