import AsyncStorage from '@react-native-async-storage/async-storage';

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
  LAST_CACHE_CLEANUP: 'last_cache_cleanup_date',
  LAST_APP_LAUNCH: 'last_app_launch_date',
} as const;

// Legacy keys for backward compatibility
const LEGACY_KEYS = {
  PRINT_QUEUE: 'offline_print_queue',
} as const;

class BackgroundCacheService {
  private static instance: BackgroundCacheService;
  private isInitialized = false;
  private appStateListener: any = null;

  private constructor() {}

  static getInstance(): BackgroundCacheService {
    if (!BackgroundCacheService.instance) {
      BackgroundCacheService.instance = new BackgroundCacheService();
    }
    return BackgroundCacheService.instance;
  }

  // Initialize the cache service
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 Background cache service already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing background cache service...');

      // Check for cache cleanup on app launch
      await this.checkAndPerformCacheCleanup();

      // App state listener removed due to compatibility issues

      this.isInitialized = true;
      console.log('✅ Background cache service initialized');
    } catch (error) {
      console.error('❌ Error initializing background cache service:', error);
    }
  }

  // App state listener removed due to compatibility issues

  // Check if cache cleanup is needed and perform it
  private async checkAndPerformCacheCleanup(): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const today = now.toDateString();

      // Check if we already cleaned up today
      const lastCleanup = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_CACHE_CLEANUP,
      );
      const lastLaunch = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_APP_LAUNCH,
      );

      // Update last app launch
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_APP_LAUNCH, today);

      // If it's past 1 AM and we haven't cleaned up today, perform cleanup
      if (currentHour >= 1 && lastCleanup !== today) {
        console.log(
          '🧹 1 AM passed and cache not cleaned today - performing cleanup',
        );
        await this.performCacheCleanup();
      } else if (lastCleanup !== today) {
        console.log(
          `⏰ Not past 1 AM yet (${currentHour}:00) or already cleaned today`,
        );
      } else {
        console.log('✅ Cache already cleaned up today');
      }

      // Check if we missed cleanup (app wasn't launched yesterday)
      if (lastLaunch && lastLaunch !== today) {
        const lastLaunchDate = new Date(lastLaunch);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastLaunchDate.toDateString() === yesterday.toDateString()) {
          // We missed yesterday's cleanup, perform it now
          console.log("🧹 Missed yesterday's cleanup - performing now");
          await this.performCacheCleanup();
        }
      }
    } catch (error) {
      console.error('❌ Error checking cache cleanup:', error);
    }
  }

  // Perform cache cleanup
  private async performCacheCleanup(): Promise<void> {
    try {
      console.log('🧹 Starting cache cleanup...');

      const today = new Date().toDateString();

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

      // Mark today's cleanup as completed
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CACHE_CLEANUP, today);

      console.log('✅ Cache cleanup completed successfully');
    } catch (error) {
      console.error('❌ Error during cache cleanup:', error);
    }
  }

  // Stop the service
  async stop(): Promise<void> {
    try {
      if (this.appStateListener) {
        this.appStateListener.remove();
        this.appStateListener = null;
      }
      this.isInitialized = false;
      console.log('🛑 Background cache service stopped');
    } catch (error) {
      console.error('❌ Error stopping background cache service:', error);
    }
  }

  // Get service status
  getStatus(): {isInitialized: boolean; hasListener: boolean} {
    return {
      isInitialized: this.isInitialized,
      hasListener: this.appStateListener !== null,
    };
  }

  // Manual cache cleanup (for testing)
  async manualCleanup(): Promise<void> {
    console.log('🧹 Performing manual cache cleanup...');
    await this.performCacheCleanup();
  }

  // Check if cleanup is needed (for debugging)
  async checkCleanupStatus(): Promise<void> {
    try {
      const lastCleanup = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_CACHE_CLEANUP,
      );
      const lastLaunch = await AsyncStorage.getItem(
        STORAGE_KEYS.LAST_APP_LAUNCH,
      );
      const now = new Date();

      console.log('📊 Cache cleanup status:', {
        lastCleanup,
        lastLaunch,
        currentTime: now.toISOString(),
        currentHour: now.getHours(),
        needsCleanup: now.getHours() >= 1 && lastCleanup !== now.toDateString(),
      });
    } catch (error) {
      console.error('❌ Error checking cleanup status:', error);
    }
  }
}

export default BackgroundCacheService.getInstance();
