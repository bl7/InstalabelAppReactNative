import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  apiService,
  SubscriptionStatus,
  SubscriptionInfo,
  canUserPrint,
  getBlockedMessage,
  getSubscriptionInfo,
} from '../services/api';
import {useAuth} from './AuthContext';

// Import offline manager once at module level
import offlineManager from '../utils/offlineManager';
import {
  SUBSCRIPTION_CACHE_KEY,
  SUBSCRIPTION_CACHE_TIMESTAMP_KEY,
  setSubscriptionUpdateListener,
} from '../utils/subscriptionPrintGate';

// Storage keys
const STORAGE_KEYS = {
  SUBSCRIPTION_CACHE: SUBSCRIPTION_CACHE_KEY,
  SUBSCRIPTION_CACHE_TIMESTAMP: SUBSCRIPTION_CACHE_TIMESTAMP_KEY,
} as const;

// Cache duration: 5 minutes
const SUBSCRIPTION_CACHE_DURATION = 5 * 60 * 1000;

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  subscriptionInfo: SubscriptionInfo;
  isLoading: boolean;
  error: string | null;
  canPrint: boolean;
  blockedMessage: string | null;
  refreshSubscription: () => Promise<void>;
  clearSubscription: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({
  children,
}) => {
  const {isAuthenticated, accessToken} = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState<boolean>(false);
  const [offlineRestricted, setOfflineRestricted] = useState<boolean>(false);

  // Check offline restrictions when network status changes
  useEffect(() => {
    const checkOfflineRestrictions = async () => {
      if (offline) {
        try {
          const shouldRestrict =
            await offlineManager.shouldRestrictOfflineMode();
          setOfflineRestricted(shouldRestrict);

          if (shouldRestrict) {
            console.log('🚫 Offline mode restricted due to old cache');
          }
        } catch (error) {
          console.error('Error checking offline restrictions:', error);
          setOfflineRestricted(true); // Restrict by default on error
        }
      } else {
        setOfflineRestricted(false);
      }
    };

    checkOfflineRestrictions();
  }, [offline]);

  // Computed values — subscription status always gates printing, even offline
  const canPrint =
    offline && offlineRestricted ? false : canUserPrint(subscription);
  const blockedMessage = offline
    ? offlineRestricted
      ? 'Offline mode restricted. Please connect to internet to refresh your data.'
      : null
    : canPrint
    ? null
    : getBlockedMessage(subscription);
  const subscriptionInfo = getSubscriptionInfo(subscription);

  // Track network status and update offline mode
  useEffect(() => {
    const checkNetworkStatus = async () => {
      const state = await NetInfo.fetch();
      const isNowOffline = !state.isConnected || !state.isInternetReachable;
      setOffline(isNowOffline);
    };

    // Check initial status
    checkNetworkStatus();

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const isNowOffline = !state.isConnected || !state.isInternetReachable;
      setOffline(isNowOffline);
    });

    return unsubscribe;
  }, []);

  // Load subscription from cache
  const loadFromCache = useCallback(async () => {
    try {
      const cachedData = await AsyncStorage.getItem(
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
      );
      const cachedTimestamp = await AsyncStorage.getItem(
        STORAGE_KEYS.SUBSCRIPTION_CACHE_TIMESTAMP,
      );

      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();

        if (now - timestamp < SUBSCRIPTION_CACHE_DURATION) {
          const parsedSubscription = JSON.parse(cachedData);
          setSubscription(parsedSubscription);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading subscription from cache:', error);
      return false;
    }
  }, []);

  // Save subscription to cache
  const saveToCache = useCallback(
    async (subscriptionData: SubscriptionStatus | null) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SUBSCRIPTION_CACHE,
          JSON.stringify(subscriptionData),
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.SUBSCRIPTION_CACHE_TIMESTAMP,
          Date.now().toString(),
        );
      } catch (error) {
        console.error('Error saving subscription to cache:', error);
      }
    },
    [],
  );

  // Clear subscription cache
  const clearCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION_CACHE);
      await AsyncStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION_CACHE_TIMESTAMP);
    } catch (error) {
      console.error('Error clearing subscription cache:', error);
    }
  }, []);

  // Fetch subscription from API
  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setSubscription(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // If offline, rely on cache only
      if (offline) {
        await loadFromCache();
        setIsLoading(false);
        return;
      }

      // Set token in API service
      apiService.setAccessToken(accessToken);

      // Online: always fetch fresh subscription status
      const response = await apiService.getSubscriptionStatus();
      setSubscription(response.subscription);
      await saveToCache(response.subscription);
    } catch (error: any) {
      console.error('Error fetching subscription:', error);

      if (error.message?.includes('Unauthorized')) {
        setError('Authentication failed. Please log in again.');
      } else if (error.message?.includes('Failed to fetch')) {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to load subscription status.');
      }

      // Do not change subscription when offline to preserve last known state
      if (!offline) {
        setSubscription(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, accessToken, saveToCache, offline]);

  // Check if online validation is required
  const needsOnlineValidation = useCallback(async (): Promise<boolean> => {
    try {
      return await offlineManager.needsOnlineValidation();
    } catch (error) {
      console.error('Error checking online validation requirement:', error);
      return true; // Require validation by default on error
    }
  }, []);

  // Enhanced refresh that enforces online validation when needed
  const refreshSubscription = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    // Check if online validation is required
    const requiresValidation = await needsOnlineValidation();
    if (offline && requiresValidation) {
      setError(
        'Online validation required. Please connect to internet to refresh your subscription.',
      );
      return;
    }

    // Skip refresh while offline to preserve cache and allow printing
    if (offline) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clear cache to force fresh fetch
      await clearCache();

      // Set token in API service
      apiService.setAccessToken(accessToken);

      // Fetch from API
      const response = await apiService.getSubscriptionStatus();
      setSubscription(response.subscription);

      // Save to cache
      await saveToCache(response.subscription);
    } catch (error: any) {
      console.error('Error refreshing subscription:', error);

      if (error.message?.includes('Unauthorized')) {
        setError('Authentication failed. Please log in again.');
      } else if (error.message?.includes('Failed to fetch')) {
        setError('Network error. Please check your connection.');
      } else {
        setError('Failed to refresh subscription status.');
      }

      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    isAuthenticated,
    accessToken,
    clearCache,
    saveToCache,
    offline,
    needsOnlineValidation,
  ]);

  // Clear subscription data
  const clearSubscription = useCallback(async () => {
    setSubscription(null);
    setError(null);
    await clearCache();
  }, [clearCache]);

  // Load subscription when authentication changes
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchSubscription();
    } else {
      clearSubscription();
    }
  }, [isAuthenticated, accessToken, fetchSubscription, clearSubscription]);

  useEffect(() => {
    setSubscriptionUpdateListener(subscriptionData => {
      setSubscription(subscriptionData);
    });

    return () => setSubscriptionUpdateListener(null);
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (
        nextState === 'active' &&
        isAuthenticated &&
        accessToken &&
        !offline
      ) {
        refreshSubscription();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [
    isAuthenticated,
    accessToken,
    offline,
    refreshSubscription,
  ]);

  // Removed periodic refresh: subscription is fetched once on app load
  // and can be refreshed manually via the refresh button

  const value: SubscriptionContextType = {
    subscription,
    subscriptionInfo,
    isLoading,
    error,
    canPrint,
    blockedMessage,
    refreshSubscription,
    clearSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider',
    );
  }
  return context;
};
