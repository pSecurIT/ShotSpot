import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  clearStoredAuthSession,
  clearStoredAuthToken,
  clearStoredAuthUser,
  getStoredAuthSession,
  getStoredAuthToken,
  getStoredAuthUser,
  setStoredAuthToken,
  setStoredAuthUser,
} from '../utils/authSessionStorage';
import { flushQueuedEvents, queueUxEvent } from '../utils/uxObservability';

describe('authSessionStorage', () => {
  afterEach(() => {
    clearStoredAuthSession();
  });

  it('stores and reads the auth token and user session data', () => {
    setStoredAuthToken('test-token');
    setStoredAuthUser('{"id":1,"username":"testuser"}');

    expect(getStoredAuthToken()).toBe('test-token');
    expect(getStoredAuthUser()).toBe('{"id":1,"username":"testuser"}');
  });

  it('clears the stored auth session', () => {
    setStoredAuthToken('test-token');
    setStoredAuthUser('{"id":1,"username":"testuser"}');

    clearStoredAuthSession();

    expect(getStoredAuthToken()).toBeNull();
    expect(getStoredAuthUser()).toBeNull();
  });

  it('clears token and user independently', () => {
    setStoredAuthToken('tok');
    setStoredAuthUser('{"id":2}');

    clearStoredAuthToken();
    expect(getStoredAuthToken()).toBeNull();
    expect(getStoredAuthUser()).toBe('{"id":2}');

    clearStoredAuthUser();
    expect(getStoredAuthUser()).toBeNull();
  });

  it('returns web session snapshot from localStorage', async () => {
    setStoredAuthToken('session-token');
    setStoredAuthUser('{"id":8,"username":"coach"}');

    await expect(getStoredAuthSession()).resolves.toEqual({
      token: 'session-token',
      userJson: '{"id":8,"username":"coach"}',
    });
  });

  it('returns null session snapshot when no localStorage data exists', async () => {
    clearStoredAuthSession();

    await expect(getStoredAuthSession()).resolves.toEqual({
      token: null,
      userJson: null,
    });
  });
});

describe('uxObservability flushQueuedEvents token guard', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response());
    clearStoredAuthSession();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearStoredAuthSession();
  });

  it('🚫 does not call fetch when no auth token is stored', async () => {
    // Queue an event so the length check passes
    queueUxEvent({
      routePath: '/test',
      flowName: 'test_flow',
      eventType: 'api_latency',
      metricName: 'test',
      valueMs: 100,
    });

    await flushQueuedEvents();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('✅ calls fetch when auth token is present', async () => {
    setStoredAuthToken('test-token');
    queueUxEvent({
      routePath: '/test',
      flowName: 'test_flow',
      eventType: 'api_latency',
      metricName: 'test',
      valueMs: 100,
    });

    await flushQueuedEvents();

    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe('WebSocketContext token guard', () => {
  it('🚫 does not initialise socket when no auth token is stored', async () => {
    const ioSpy = vi.fn();
    vi.doMock('socket.io-client', () => ({ io: ioSpy }));
    vi.doMock('../contexts/AuthContext', () => ({
      useAuth: () => ({ user: { id: 1, username: 'u', role: 'user', email: 'u@test.com' } }),
    }));

    clearStoredAuthSession(); // no token

    const { WebSocketProvider } = await import('../contexts/WebSocketContext');

    render(
      React.createElement(WebSocketProvider, null,
        React.createElement('div', { 'data-testid': 'child' }, 'ok')
      )
    );

    // socket.io-client should not have been called because token is absent
    expect(ioSpy).not.toHaveBeenCalled();

    vi.doUnmock('socket.io-client');
    vi.doUnmock('../contexts/AuthContext');
  });
});