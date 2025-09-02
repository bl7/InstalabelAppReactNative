import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  PRINT_QUEUE: 'print_queue',
  CUSTOM_EXPIRY: 'custom_expiry',
  DEFAULT_INITIALS: 'default_initials',
  PRINTER_SETTINGS: 'printer_settings',
  LABEL_SETTINGS: 'label_settings',
  RECENT_ITEMS: 'recent_items',
} as const;

// User preferences interface
export interface UserPreferences {
  defaultInitials: string;
  defaultLabelType: 'cooked' | 'prep' | 'ppds' | 'use-first' | 'defrost';
  defaultLabelHeight: '31mm' | '40mm' | '56mm' | '80mm';
  useInitials: boolean;
  autoSaveQueue: boolean;
  showDebugInfo: boolean;
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  defaultInitials: 'NG',
  defaultLabelType: 'prep',
  defaultLabelHeight: '40mm',
  useInitials: true,
  autoSaveQueue: true,
  showDebugInfo: false,
};

// Storage utility functions
export const StorageUtils = {
  // User preferences
  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (stored) {
        return {...DEFAULT_PREFERENCES, ...JSON.parse(stored)};
      }
      return DEFAULT_PREFERENCES;
    } catch (error) {
      console.warn('Failed to load user preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  },

  async saveUserPreferences(
    preferences: Partial<UserPreferences>,
  ): Promise<void> {
    try {
      const current = await this.getUserPreferences();
      const updated = {...current, ...preferences};
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PREFERENCES,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  },

  // Print queue persistence
  async savePrintQueue(queue: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PRINT_QUEUE,
        JSON.stringify(queue),
      );
    } catch (error) {
      console.error('Failed to save print queue:', error);
    }
  },

  async loadPrintQueue(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PRINT_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load print queue:', error);
      return [];
    }
  },

  // Custom expiry dates
  async saveCustomExpiry(customExpiry: Record<string, string>): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CUSTOM_EXPIRY,
        JSON.stringify(customExpiry),
      );
    } catch (error) {
      console.error('Failed to save custom expiry:', error);
    }
  },

  async loadCustomExpiry(): Promise<Record<string, string>> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXPIRY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load custom expiry:', error);
      return {};
    }
  },

  // Printer settings
  async savePrinterSettings(settings: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PRINTER_SETTINGS,
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error('Failed to save printer settings:', error);
    }
  },

  async loadPrinterSettings(): Promise<any> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PRINTER_SETTINGS);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load printer settings:', error);
      return {};
    }
  },

  // Recent items
  async saveRecentItems(items: string[]): Promise<void> {
    try {
      // Keep only the last 20 items
      const recentItems = items.slice(-20);
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_ITEMS,
        JSON.stringify(recentItems),
      );
    } catch (error) {
      console.error('Failed to save recent items:', error);
    }
  },

  async loadRecentItems(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_ITEMS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load recent items:', error);
      return [];
    }
  },

  async addRecentItem(itemName: string): Promise<void> {
    try {
      const recentItems = await this.loadRecentItems();
      const updatedItems = [...new Set([...recentItems, itemName])]; // Remove duplicates
      await this.saveRecentItems(updatedItems);
    } catch (error) {
      console.error('Failed to add recent item:', error);
    }
  },

  // Clear all data
  async clearAllData(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
      console.log('All app data cleared successfully');
    } catch (error) {
      console.error('Failed to clear app data:', error);
    }
  },

  // Get storage info
  async getStorageInfo(): Promise<{size: number; keys: string[]}> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const size = keys.length;
      return {size, keys: [...keys]};
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {size: 0, keys: []};
    }
  },
};

export default StorageUtils;
