import React from 'react';
import {render, act, waitFor} from '@testing-library/react-native';
import {AuthProvider, useAuth} from '../../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock API service
jest.mock('../../src/services/api', () => ({
  apiService: {
    login: jest.fn(),
    getProfile: jest.fn(),
    validateSpecificToken: jest.fn(),
    refreshToken: jest.fn(),
    setAccessToken: jest.fn(),
    clearAccessToken: jest.fn(),
    getAccessToken: jest.fn(),
  },
}));

// Test component that uses the auth context
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="is-authenticated">
        {auth.isAuthenticated.toString()}
      </div>
      <div data-testid="is-loading">{auth.isLoading.toString()}</div>
      <div data-testid="user-name">{auth.user?.name || 'No user'}</div>
      <button
        data-testid="login-button"
        onPress={() =>
          auth.login({email: 'test@test.com', password: 'password'})
        }>
        Login
      </button>
      <button data-testid="logout-button" onPress={auth.logout}>
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset AsyncStorage mocks
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(undefined);
  });

  it('provides initial auth state', () => {
    const {getByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    expect(getByTestId('is-authenticated').props.children).toBe('false');
    expect(getByTestId('is-loading').props.children).toBe('true');
    expect(getByTestId('user-name').props.children).toBe('No user');
  });

  it('loads auth state from storage on mount', async () => {
    const mockUser = {name: 'Test User', email: 'test@test.com'};
    const mockToken = 'mock-token';
    const mockExpiry = (Date.now() + 3600000).toString(); // 1 hour from now

    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce(mockToken) // ACCESS_TOKEN
      .mockResolvedValueOnce('refresh-token') // REFRESH_TOKEN
      .mockResolvedValueOnce(JSON.stringify(mockUser)) // USER_DATA
      .mockResolvedValueOnce(mockExpiry); // TOKEN_EXPIRY

    const {getByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('is-loading').props.children).toBe('false');
    });
  });

  it('handles login successfully', async () => {
    const mockUser = {name: 'Test User', email: 'test@test.com'};
    const mockResponse = {token: 'mock-token', uuid: 'user-123'};

    const {apiService} = require('../../src/contexts/AuthContext');
    apiService.login.mockResolvedValue(mockResponse);
    apiService.getProfile.mockResolvedValue({
      profile: {company_name: 'Test Company'},
    });

    const {getByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(getByTestId('login-button'));
    });

    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password',
      });
    });
  });

  it('handles logout successfully', async () => {
    const {getByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(getByTestId('logout-button'));
    });

    await waitFor(() => {
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        'ACCESS_TOKEN',
        'REFRESH_TOKEN',
        'USER_DATA',
        'TOKEN_EXPIRY',
      ]);
    });
  });

  it('handles token expiration', async () => {
    const mockUser = {name: 'Test User', email: 'test@test.com'};
    const expiredToken = (Date.now() - 3600000).toString(); // 1 hour ago

    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce('expired-token') // ACCESS_TOKEN
      .mockResolvedValueOnce('refresh-token') // REFRESH_TOKEN
      .mockResolvedValueOnce(JSON.stringify(mockUser)) // USER_DATA
      .mockResolvedValueOnce(expiredToken); // TOKEN_EXPIRY

    const {getByTestId} = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getByTestId('is-loading').props.children).toBe('false');
      expect(getByTestId('is-authenticated').props.children).toBe('false');
    });
  });
});
