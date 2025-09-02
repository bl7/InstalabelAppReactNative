import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {Alert} from 'react-native';

// Storage keys for offline data
const STORAGE_KEYS = {
  INGREDIENTS_CACHE: 'offline_ingredients_cache',
  MENU_ITEMS_CACHE: 'offline_menu_items_cache',
  SUBSCRIPTION_CACHE: 'offline_subscription_cache',
  LABEL_SETTINGS_CACHE: 'offline_label_settings_cache',
  LABEL_INITIALS_CACHE: 'offline_label_initials_cache',
  CACHE_TIMESTAMP: 'offline_cache_timestamp',
  USER_PREFERENCES: 'offline_user_preferences',
  PRINT_QUEUE_LABELS: 'offline_print_queue_labels',
  PRINT_QUEUE_PPDS: 'offline_print_queue_ppds',
  RECENT_ITEMS: 'offline_recent_items',
  LAST_SYNC: 'offline_last_sync',
} as const;

// Legacy keys for backward compatibility
const LEGACY_KEYS = {
  PRINT_QUEUE: 'offline_print_queue',
} as const;

// Cache expiration times (in milliseconds) - Reduced to prevent abuse
const CACHE_EXPIRATION = {
  INGREDIENTS: 24 * 60 * 60 * 1000, // 24 hours (reduced from 48)
  MENU_ITEMS: 24 * 60 * 60 * 1000, // 24 hours (reduced from 48)
  SUBSCRIPTION: 12 * 60 * 60 * 1000, // 12 hours (reduced from 24)
  LABEL_SETTINGS: 3 * 24 * 60 * 60 * 1000, // 3 days (reduced from 7)
  LABEL_INITIALS: 3 * 24 * 60 * 60 * 1000, // 3 days (reduced from 7)
  RECENT_ITEMS: 3 * 24 * 60 * 60 * 1000, // 3 days (reduced from 7)
  USER_PREFERENCES: 7 * 24 * 60 * 60 * 1000, // 7 days (reduced from 30)
} as const;

interface CacheData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

class OfflineManager {
  private static instance: OfflineManager;
  private networkState: NetworkState = {
    isConnected: false,
    isInternetReachable: false,
    type: 'unknown',
  };
  private listeners: Array<(state: NetworkState) => void> = [];

  private constructor() {
    this.initializeNetworkListener();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  // Network state management
  private initializeNetworkListener() {
    NetInfo.addEventListener(state => {
      const newState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type ?? 'unknown',
      };

      this.networkState = newState;
      this.notifyListeners(newState);
    });
  }

  addNetworkListener(callback: (state: NetworkState) => void) {
    this.listeners.push(callback);
    // Immediately call with current state
    callback(this.networkState);
  }

  removeNetworkListener(callback: (state: NetworkState) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners(state: NetworkState) {
    this.listeners.forEach(listener => listener(state));
  }

  getNetworkState(): NetworkState {
    return this.networkState;
  }

  isOnline(): boolean {
    return (
      this.networkState.isConnected && this.networkState.isInternetReachable
    );
  }

  // Data caching methods
  async cacheIngredients(ingredients: any[]): Promise<void> {
    try {
      const cacheData: CacheData<any[]> = {
        data: ingredients,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION.INGREDIENTS,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.INGREDIENTS_CACHE,
        JSON.stringify(cacheData),
      );
      console.log('Ingredients cached successfully');
    } catch (error) {
      console.error('Failed to cache ingredients:', error);
    }
  }

  async getCachedIngredients(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.INGREDIENTS_CACHE);
      if (!cached) return null;

      const cacheData: CacheData<any[]> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > cacheData.expiresAt) {
        await this.removeCachedIngredients();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached ingredients:', error);
      return null;
    }
  }

  async cacheMenuItems(menuItems: any[]): Promise<void> {
    try {
      const cacheData: CacheData<any[]> = {
        data: menuItems,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION.MENU_ITEMS,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.MENU_ITEMS_CACHE,
        JSON.stringify(cacheData),
      );
      console.log('Menu items cached successfully');
    } catch (error) {
      console.error('Failed to cache menu items:', error);
    }
  }

  async getCachedMenuItems(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.MENU_ITEMS_CACHE);
      if (!cached) return null;

      const cacheData: CacheData<any[]> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > cacheData.expiresAt) {
        await this.removeCachedMenuItems();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached menu items:', error);
      return null;
    }
  }

  async cacheRecentItems(items: any[]): Promise<void> {
    try {
      const cacheData: CacheData<any[]> = {
        data: items,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION.RECENT_ITEMS,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_ITEMS,
        JSON.stringify(cacheData),
      );
    } catch (error) {
      console.error('Failed to cache recent items:', error);
    }
  }

  async getCachedRecentItems(): Promise<any[] | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_ITEMS);
      if (!cached) return null;

      const cacheData: CacheData<any[]> = JSON.parse(cached);

      if (Date.now() > cacheData.expiresAt) {
        await this.removeCachedRecentItems();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached recent items:', error);
      return null;
    }
  }

  // User preferences (persistent)
  async saveUserPreferences(preferences: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PREFERENCES,
        JSON.stringify(preferences),
      );
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }

  async getUserPreferences(): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  // Subscription caching
  async cacheSubscription(subscription: any): Promise<void> {
    try {
      const cacheData: CacheData<any> = {
        data: subscription,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION.SUBSCRIPTION,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
        JSON.stringify(cacheData),
      );
      console.log('Subscription cached successfully');
    } catch (error) {
      console.error('Failed to cache subscription:', error);
    }
  }

  async getCachedSubscription(): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
      );
      if (!cached) return null;

      const cacheData: CacheData<any> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > cacheData.expiresAt) {
        await this.removeCachedSubscription();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached subscription:', error);
      return null;
    }
  }

  // Label settings caching
  async cacheLabelSettings(settings: any): Promise<void> {
    try {
      const cacheData: CacheData<any> = {
        data: settings,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION.LABEL_SETTINGS,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.LABEL_SETTINGS_CACHE,
        JSON.stringify(cacheData),
      );
      console.log('Label settings cached successfully');
    } catch (error) {
      console.error('Failed to cache label settings:', error);
    }
  }

  async getCachedLabelSettings(): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(
        STORAGE_KEYS.LABEL_SETTINGS_CACHE,
      );
      if (!cached) return null;

      const cacheData: CacheData<any> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > cacheData.expiresAt) {
        await this.removeCachedLabelSettings();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached label settings:', error);
      return null;
    }
  }

  // Label initials caching
  async cacheLabelInitials(initials: any): Promise<void> {
    try {
      const cacheData: CacheData<any> = {
        data: initials,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRATION.LABEL_INITIALS,
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.LABEL_INITIALS_CACHE,
        JSON.stringify(cacheData),
      );
      console.log('Label initials cached successfully');
    } catch (error) {
      console.error('Failed to cache label initials:', error);
    }
  }

  async getCachedLabelInitials(): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(
        STORAGE_KEYS.LABEL_INITIALS_CACHE,
      );
      if (!cached) return null;

      const cacheData: CacheData<any> = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() > cacheData.expiresAt) {
        await this.removeCachedLabelInitials();
        return null;
      }
      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cached label initials:', error);
      return null;
    }
  }

  // Print queue (persistent) - page-specific
  async savePrintQueue(
    queue: any[],
    page: 'labels' | 'ppds' = 'labels',
  ): Promise<void> {
    try {
      const key =
        page === 'labels'
          ? STORAGE_KEYS.PRINT_QUEUE_LABELS
          : STORAGE_KEYS.PRINT_QUEUE_PPDS;
      await AsyncStorage.setItem(key, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save print queue:', error);
    }
  }

  async getPrintQueue(
    page: 'labels' | 'ppds' = 'labels',
  ): Promise<any[] | null> {
    try {
      const key =
        page === 'labels'
          ? STORAGE_KEYS.PRINT_QUEUE_LABELS
          : STORAGE_KEYS.PRINT_QUEUE_PPDS;
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback: try legacy key and migrate if present
      const legacy = await AsyncStorage.getItem(LEGACY_KEYS.PRINT_QUEUE);
      if (legacy) {
        const legacyQueue = JSON.parse(legacy);
        await AsyncStorage.setItem(key, legacy);
        return legacyQueue;
      }

      return [];
    } catch (error) {
      console.error('Failed to get print queue:', error);
      return [];
    }
  }

  // Cache cleanup methods
  async removeCachedIngredients(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.INGREDIENTS_CACHE);
    } catch (error) {
      console.error('Failed to remove cached ingredients:', error);
    }
  }

  async removeCachedMenuItems(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.MENU_ITEMS_CACHE);
    } catch (error) {
      console.error('Failed to remove cached menu items:', error);
    }
  }

  async removeCachedRecentItems(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_ITEMS);
    } catch (error) {
      console.error('Failed to remove cached recent items:', error);
    }
  }

  async removeCachedSubscription(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SUBSCRIPTION_CACHE);
    } catch (error) {
      console.error('Failed to remove cached subscription:', error);
    }
  }

  async removeCachedLabelSettings(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.LABEL_SETTINGS_CACHE);
    } catch (error) {
      console.error('Failed to remove cached label settings:', error);
    }
  }

  async removeCachedLabelInitials(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.LABEL_INITIALS_CACHE);
    } catch (error) {
      console.error('Failed to remove cached label initials:', error);
    }
  }

  async cleanupExpiredCache(): Promise<void> {
    try {
      const keys = [
        STORAGE_KEYS.INGREDIENTS_CACHE,
        STORAGE_KEYS.MENU_ITEMS_CACHE,
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
        STORAGE_KEYS.LABEL_SETTINGS_CACHE,
        STORAGE_KEYS.LABEL_INITIALS_CACHE,
        STORAGE_KEYS.RECENT_ITEMS,
      ];

      for (const key of keys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const cacheData: CacheData<any> = JSON.parse(cached);
          if (Date.now() > cacheData.expiresAt) {
            await AsyncStorage.removeItem(key);
            console.log(`Cleaned up expired cache: ${key}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
      console.log('All cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }

  // Cache status methods
  async getCacheStatus(): Promise<{
    ingredients: {exists: boolean; expiresAt: number | null};
    menuItems: {exists: boolean; expiresAt: number | null};
    subscription: {exists: boolean; expiresAt: number | null};
    labelSettings: {exists: boolean; expiresAt: number | null};
    labelInitials: {exists: boolean; expiresAt: number | null};
    recentItems: {exists: boolean; expiresAt: number | null};
  }> {
    try {
      const [
        ingredients,
        menuItems,
        subscription,
        labelSettings,
        labelInitials,
        recentItems,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INGREDIENTS_CACHE),
        AsyncStorage.getItem(STORAGE_KEYS.MENU_ITEMS_CACHE),
        AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION_CACHE),
        AsyncStorage.getItem(STORAGE_KEYS.LABEL_SETTINGS_CACHE),
        AsyncStorage.getItem(STORAGE_KEYS.LABEL_INITIALS_CACHE),
        AsyncStorage.getItem(STORAGE_KEYS.RECENT_ITEMS),
      ]);

      return {
        ingredients: {
          exists: !!ingredients,
          expiresAt: ingredients ? JSON.parse(ingredients).expiresAt : null,
        },
        menuItems: {
          exists: !!menuItems,
          expiresAt: menuItems ? JSON.parse(menuItems).expiresAt : null,
        },
        subscription: {
          exists: !!subscription,
          expiresAt: subscription ? JSON.parse(subscription).expiresAt : null,
        },
        labelSettings: {
          exists: !!labelSettings,
          expiresAt: labelSettings ? JSON.parse(labelSettings).expiresAt : null,
        },
        labelInitials: {
          exists: !!labelInitials,
          expiresAt: labelInitials ? JSON.parse(labelInitials).expiresAt : null,
        },
        recentItems: {
          exists: !!recentItems,
          expiresAt: recentItems ? JSON.parse(recentItems).expiresAt : null,
        },
      };
    } catch (error) {
      console.error('Failed to get cache status:', error);
      return {
        ingredients: {exists: false, expiresAt: null},
        menuItems: {exists: false, expiresAt: null},
        subscription: {exists: false, expiresAt: null},
        labelSettings: {exists: false, expiresAt: null},
        labelInitials: {exists: false, expiresAt: null},
        recentItems: {exists: false, expiresAt: null},
      };
    }
  }

  // Background sync
  async performBackgroundSync(): Promise<void> {
    if (!this.isOnline()) {
      console.log('Skipping background sync - offline');
      return;
    }

    try {
      console.log('Performing background sync...');
      // This will be called by the API service when network is restored
      // The actual sync logic will be implemented in the API service
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  // Show offline warning
  showOfflineWarning(): void {
    Alert.alert(
      'Offline Mode',
      'You are currently offline. Some features may be limited. Data will sync when connection is restored.',
      [{text: 'OK'}],
    );
  }

  // Fast cache validation without parsing (for performance)
  private async isCacheValidFast(
    key: string,
    maxAge: number,
  ): Promise<boolean> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return false;

      // Quick timestamp check without full JSON parsing
      const timestampMatch = cached.match(/"timestamp":(\d+)/);
      if (!timestampMatch) return false;

      const timestamp = parseInt(timestampMatch[1], 10);
      const cacheAge = Date.now() - timestamp;

      return cacheAge <= maxAge;
    } catch (error) {
      return false;
    }
  }

  // Optimized offline restriction check (cached result)
  private offlineRestrictionCache: {result: boolean; timestamp: number} | null =
    null;
  private readonly OFFLINE_RESTRICTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async shouldRestrictOfflineMode(): Promise<boolean> {
    // Use cached result if still valid
    if (
      this.offlineRestrictionCache &&
      Date.now() - this.offlineRestrictionCache.timestamp <
        this.OFFLINE_RESTRICTION_CACHE_TTL
    ) {
      return this.offlineRestrictionCache.result;
    }

    try {
      // Check if any critical cache is too old using fast validation
      const criticalChecks = [
        {key: STORAGE_KEYS.SUBSCRIPTION_CACHE, maxAge: 12 * 60 * 60 * 1000},
        {key: STORAGE_KEYS.INGREDIENTS_CACHE, maxAge: 12 * 60 * 60 * 1000},
        {key: STORAGE_KEYS.MENU_ITEMS_CACHE, maxAge: 12 * 60 * 60 * 1000},
      ];

      for (const {key, maxAge} of criticalChecks) {
        const isValid = await this.isCacheValidFast(key, maxAge);
        if (!isValid) {
          const result = true; // Restrict offline mode
          this.offlineRestrictionCache = {result, timestamp: Date.now()};
          return result;
        }
      }

      const result = false; // Don't restrict offline mode
      this.offlineRestrictionCache = {result, timestamp: Date.now()};
      return result;
    } catch (error) {
      console.error('Error checking offline mode restrictions:', error);
      const result = true; // Restrict by default if there's an error
      this.offlineRestrictionCache = {result, timestamp: Date.now()};
      return result;
    }
  }

  // Optimized online validation check (cached result)
  private onlineValidationCache: {result: boolean; timestamp: number} | null =
    null;
  private readonly ONLINE_VALIDATION_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  async needsOnlineValidation(): Promise<boolean> {
    // Use cached result if still valid
    if (
      this.onlineValidationCache &&
      Date.now() - this.onlineValidationCache.timestamp <
        this.ONLINE_VALIDATION_CACHE_TTL
    ) {
      return this.onlineValidationCache.result;
    }

    try {
      const subscriptionCache = await AsyncStorage.getItem(
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
      );
      if (!subscriptionCache) {
        const result = true;
        this.onlineValidationCache = {result, timestamp: Date.now()};
        return result;
      }

      // Quick timestamp check without full JSON parsing
      const timestampMatch = subscriptionCache.match(/"timestamp":(\d+)/);
      if (!timestampMatch) {
        const result = true;
        this.onlineValidationCache = {result, timestamp: Date.now()};
        return result;
      }

      const timestamp = parseInt(timestampMatch[1], 10);
      const cacheAge = Date.now() - timestamp;

      // Require online validation if subscription cache is older than 6 hours
      const result = cacheAge > 6 * 60 * 60 * 1000;
      this.onlineValidationCache = {result, timestamp: Date.now()};
      return result;
    } catch (error) {
      console.error('Error checking online validation requirement:', error);
      const result = true; // Require validation by default if there's an error
      this.onlineValidationCache = {result, timestamp: Date.now()};
      return result;
    }
  }

  // Get cache age information for debugging
  async getCacheAgeInfo(): Promise<
    Record<string, {age: number; maxAge: number; isExpired: boolean}>
  > {
    try {
      const result: Record<
        string,
        {age: number; maxAge: number; isExpired: boolean}
      > = {};

      for (const [key, expiration] of Object.entries(CACHE_EXPIRATION)) {
        const storageKey = STORAGE_KEYS[key as keyof typeof STORAGE_KEYS];
        if (storageKey) {
          const cached = await AsyncStorage.getItem(storageKey);
          if (cached) {
            const cacheData: CacheData<any> = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            const maxAge = expiration;
            const isExpired = age > maxAge;

            result[key] = {
              age: Math.round(age / (60 * 60 * 1000)), // Convert to hours
              maxAge: Math.round(maxAge / (60 * 60 * 1000)), // Convert to hours
              isExpired,
            };
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting cache age info:', error);
      return {};
    }
  }

  // Clear caches when network comes back online
  async clearCachesOnNetworkRestore(): Promise<void> {
    try {
      // Clear the restriction caches to force fresh checks
      this.offlineRestrictionCache = null;
      this.onlineValidationCache = null;

      console.log('🔄 Caches cleared on network restore');
    } catch (error) {
      console.error('Error clearing caches on network restore:', error);
    }
  }

  // Invalidate cached results (useful for testing or manual refresh)
  invalidateCaches(): void {
    this.offlineRestrictionCache = null;
    this.onlineValidationCache = null;
    console.log('🔄 Offline manager caches invalidated');
  }

  // Manual cache cleanup (for testing or immediate cleanup)
  async clearAllCaches(): Promise<void> {
    try {
      console.log('🧹 Manually clearing all caches...');

      // Clear all cached data
      const keysToClear = [
        STORAGE_KEYS.INGREDIENTS_CACHE,
        STORAGE_KEYS.MENU_ITEMS_CACHE,
        STORAGE_KEYS.SUBSCRIPTION_CACHE,
        STORAGE_KEYS.LABEL_SETTINGS_CACHE,
        STORAGE_KEYS.LABEL_INITIALS_CACHE,
        STORAGE_KEYS.CACHE_TIMESTAMP,
        STORAGE_KEYS.PRINT_QUEUE_LABELS,
        STORAGE_KEYS.PRINT_QUEUE_PPDS,
        STORAGE_KEYS.RECENT_ITEMS,
        STORAGE_KEYS.LAST_SYNC,
        LEGACY_KEYS.PRINT_QUEUE,
      ];

      await AsyncStorage.multiRemove(keysToClear);

      // Clear internal caches
      this.offlineRestrictionCache = null;
      this.onlineValidationCache = null;

      console.log('✅ Manual cache cleanup completed');
    } catch (error) {
      console.error('❌ Error during manual cache cleanup:', error);
    }
  }
}

export default OfflineManager.getInstance();
