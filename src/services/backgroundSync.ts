import offlineManager from '../utils/offlineManager';

class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private syncInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  initialize() {
    if (this.isInitialized) return;

    console.log('🔄 Initializing background sync service...');

    // Start periodic sync (every 30 minutes)
    this.startPeriodicSync();

    // Start periodic cleanup (every 6 hours)
    this.startPeriodicCleanup();

    // Perform initial cleanup
    this.performCleanup();

    this.isInitialized = true;
    console.log('✅ Background sync service initialized');
  }

  private startPeriodicSync() {
    // Clear existing interval if any
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Set up new interval (30 minutes)
    this.syncInterval = setInterval(() => {
      this.performBackgroundSync();
    }, 30 * 60 * 1000);

    console.log('⏰ Periodic sync started (30-minute intervals)');
  }

  private startPeriodicCleanup() {
    // Clear existing interval if any
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Set up new interval (6 hours)
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 6 * 60 * 60 * 1000);

    console.log('🧹 Periodic cleanup started (6-hour intervals)');
  }

  private async performBackgroundSync() {
    try {
      if (!offlineManager.isOnline()) {
        console.log('🔄 Background sync skipped - offline');
        return;
      }

      console.log('🔄 Performing background sync...');

      // Sync pending offline logs first
      try {
        const {apiService} = require('./api');
        await apiService.syncPendingLogs();
      } catch (error) {
        console.error('❌ Failed to sync pending logs:', error);
      }

      // Get cache status to see what needs updating
      const cacheStatus = await offlineManager.getCacheStatus();

      // Check if any cache is expired or missing
      const needsSync =
        !cacheStatus.ingredients.exists ||
        !cacheStatus.menuItems.exists ||
        (cacheStatus.ingredients.expiresAt &&
          Date.now() > cacheStatus.ingredients.expiresAt - 60 * 60 * 1000) || // 1 hour before expiry
        (cacheStatus.menuItems.expiresAt &&
          Date.now() > cacheStatus.menuItems.expiresAt - 60 * 60 * 1000);

      if (needsSync) {
        console.log('🔄 Cache needs refresh, triggering sync...');
        // The actual sync will happen when the user next opens the app
        // or when the API service is called
      } else {
        console.log('✅ Cache is fresh, no sync needed');
      }
    } catch (error) {
      console.error('❌ Background sync failed:', error);
    }
  }

  private async performCleanup() {
    try {
      console.log('🧹 Performing cache cleanup...');
      await offlineManager.cleanupExpiredCache();
      console.log('✅ Cache cleanup completed');
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
    }
  }

  // Manual sync trigger (can be called from UI)
  async triggerManualSync() {
    console.log('🔄 Manual sync triggered...');
    await this.performBackgroundSync();
  }

  // Manual cleanup trigger (can be called from UI)
  async triggerManualCleanup() {
    console.log('🧹 Manual cleanup triggered...');
    await this.performCleanup();
  }

  // Stop all background processes
  stop() {
    console.log('🛑 Stopping background sync service...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isInitialized = false;

    console.log('✅ Background sync service stopped');
  }

  // Get service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasSyncInterval: !!this.syncInterval,
      hasCleanupInterval: !!this.cleanupInterval,
    };
  }
}

export default BackgroundSyncService.getInstance();
