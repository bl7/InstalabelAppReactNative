import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {apiService, LoginRequest} from '../services/api';
import {ENV, ERROR_MESSAGES} from '../config/env';
import NetInfo from '@react-native-community/netinfo';

// Import offline manager once at module level
import offlineManager from '../utils/offlineManager';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER_DATA: 'user_data',
} as const;

interface User {
  id: string;
  email: string;
  name: string;
  company_name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  isOfflineMode: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Check authentication status from stored tokens
  const checkAuthStatus = useCallback(async () => {
    try {
      console.log('🔍 Checking authentication status...');

      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

      console.log('🔍 Stored auth data:', {
        hasToken: !!storedToken,
        hasUserData: !!userData,
        tokenLength: storedToken?.length || 0,
      });

      if (storedToken && userData) {
        console.log('✅ Token and user data found, attempting validation...');

        // Parse and set user data immediately for offline access
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        setAccessToken(storedToken);

        // Set token in API service
        apiService.setAccessToken(storedToken);

        console.log(
          '✅ Authentication restored from storage (offline mode enabled)',
        );

        // Try to validate token with server in background (non-blocking)
        try {
          console.log('🔄 Attempting background token validation...');
          await apiService.getIngredients();
          console.log('✅ Background token validation successful');
          setIsOfflineMode(false);
        } catch (error) {
          console.warn('⚠️ Background token validation failed (offline mode)');
          console.log('ℹ️ User can still access app with stored data');
          setIsOfflineMode(true);
          // Don't log out - allow offline access
        }
      } else {
        console.log('❌ Missing required auth data');
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Subscribe to global auth errors (401/403) from API service
  useEffect(() => {
    const handler = () => {
      // If we are clearly online and still getting 401/403, force logout
      const doLogout = async () => {
        try {
          const net = await NetInfo.fetch();
          const clearlyOnline = !!(net.isConnected && net.isInternetReachable);
          if (clearlyOnline) {
            console.warn(
              '🔒 Auth error detected while online. Logging out user.',
            );
            await clearAuthData();
          } else {
            // If offline, prefer staying in offline mode rather than logging out immediately
            console.warn(
              '🔒 Auth error detected but offline. Keeping offline mode.',
            );
            setIsOfflineMode(true);
          }
        } catch (e) {
          // As a safety, clear auth
          await clearAuthData();
        }
      };
      doLogout();
    };

    // Register
    apiService.onAuthError(handler);
    return () => {
      // Cleanup
      apiService.offAuthError(handler);
    };
  }, []);

  // Monitor network status for offline mode
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        if (isOfflineMode) {
          console.log('🌐 Network restored, attempting to validate token...');
          // Try to validate token when network comes back
          validateTokenInBackground();

          // Clear offline manager caches to force fresh checks
          try {
            offlineManager.clearCachesOnNetworkRestore().catch(error => {
              console.error('Error clearing offline manager caches:', error);
            });
          } catch (error) {
            console.error('Error clearing offline manager caches:', error);
          }
        }
        // Immediately reset offline mode if we have a good connection
        if (isOfflineMode && state.isConnected && state.isInternetReachable) {
          console.log('🌐 Network confirmed online, resetting offline mode');
          setIsOfflineMode(false);
        }
      } else if (!state.isConnected || !state.isInternetReachable) {
        if (isAuthenticated) {
          console.log('📡 Network lost, switching to offline mode');
          setIsOfflineMode(true);
        }
      }
    });

    return () => unsubscribe();
  }, [isOfflineMode, isAuthenticated]);

  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);

      // Clear from API service
      apiService.clearAccessToken();

      // Clear state
      setUser(null);
      setIsAuthenticated(false);
      setAccessToken(null);
      setIsOfflineMode(false);
    } catch (err) {
      console.error('Error clearing auth data:', err);
    }
  };

  // Background token validation function
  const validateTokenInBackground = async () => {
    if (!accessToken) return;

    try {
      console.log('🔄 Validating token in background...');
      await apiService.getIngredients();
      console.log('✅ Background validation successful');
      setIsOfflineMode(false);
    } catch (error) {
      console.warn('⚠️ Background validation failed, staying in offline mode');
      setIsOfflineMode(true);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);

      console.log('🔐 Attempting login with credentials:', {
        email: credentials.email,
        passwordLength: credentials.password?.length || 0,
      });

      const response = await apiService.login(credentials);

      console.log('🔐 Login API response received:', {
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : 'No response',
        hasToken: !!response?.token,
        hasUuid: !!response?.uuid,
        hasEmail: !!response?.email,
        hasName: !!response?.name,
        fullResponse: response,
      });

      // Fetch profile data to get company name
      let companyName: string | undefined;
      try {
        const userId = response.uuid;
        if (!userId) {
          console.warn('⚠️ No user ID available for profile fetch');
          return;
        }

        console.log('🔍 Fetching profile data for user:', userId);
        console.log(
          '🔍 Profile API endpoint:',
          `https://webdashboard-two.vercel.app/api/profile?user_id=${userId}`,
        );

        const profileResponse = await apiService.getProfile(userId);

        console.log('📡 Raw profile API response:', profileResponse);
        console.log('📋 Profile response type:', typeof profileResponse);
        console.log('📋 Profile response keys:', Object.keys(profileResponse));

        if (profileResponse && profileResponse.profile) {
          console.log(
            '👤 Profile object keys:',
            Object.keys(profileResponse.profile),
          );
          console.log(
            '🏢 Company name from profile:',
            profileResponse.profile.company_name,
          );
          companyName = profileResponse.profile.company_name;
        } else {
          console.warn(
            '⚠️ Profile response structure unexpected:',
            profileResponse,
          );
        }

        console.log('✅ Profile data fetched successfully:', {
          company_name: companyName,
          full_profile: profileResponse.profile,
        });
      } catch (profileError) {
        console.warn('⚠️ Failed to fetch profile data:', profileError);
        console.error('❌ Profile fetch error details:', {
          error: profileError,
          errorMessage:
            profileError instanceof Error
              ? profileError.message
              : 'Unknown error',
          errorStack:
            profileError instanceof Error
              ? profileError.stack
              : 'No stack trace',
        });
        // Continue without company name if profile fetch fails
      }

      // Transform API response to our User interface
      // Handle potential API response structure mismatches
      const userData: User = {
        id: response.uuid || 'unknown',
        email: response.email || credentials.email,
        name: response.name || 'Unknown User',
        company_name: companyName, // Include company name if available
      };

      console.log('👤 Transformed user data:', userData);

      // Store tokens and user data
      console.log('💾 Storing authentication data...');
      console.log('💾 Token length:', response.token?.length || 0);
      console.log('💾 Full response structure:', Object.keys(response));

      // Check if required fields exist
      if (!response.token) {
        throw new Error('No access token received from server');
      }

      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.token);

      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_DATA,
        JSON.stringify(userData),
      );

      console.log('✅ Authentication data stored successfully');

      // Set token in API service
      apiService.setAccessToken(response.token);

      // Update state
      setUser(userData);
      setIsAuthenticated(true);
      setAccessToken(response.token);
      setIsOfflineMode(false);

      console.log('✅ Login completed successfully');
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);

      // Clear all local data
      await clearAuthData();
    } catch (err) {
      console.error('Logout error:', err);
      // Force clear data even if there's an error
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    accessToken,
    isOfflineMode,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
