import {logger} from './logger';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
}

class NetworkManager {
  private networkState: NetworkState = {
    isConnected: true, // Default to true, will be updated on first check
    isInternetReachable: true,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
  };

  private listeners: ((state: NetworkState) => void)[] = [];

  constructor() {
    this.initializeNetworkMonitoring();
  }

  private async initializeNetworkMonitoring() {
    try {
      // Test initial connectivity
      await this.testInternetConnectivity();

      // Set up periodic connectivity checks
      setInterval(() => {
        this.testInternetConnectivity();
      }, 30000); // Check every 30 seconds

      logger.info('Network monitoring initialized', 'NetworkManager');
    } catch (error) {
      logger.error(
        'Failed to initialize network monitoring',
        'NetworkManager',
        error,
      );
    }
  }

  private async updateNetworkState(isConnected: boolean) {
    const newState: NetworkState = {
      isConnected,
      isInternetReachable: isConnected,
      type: 'unknown',
      isWifi: false,
      isCellular: false,
    };

    this.networkState = newState;
    this.notifyListeners(newState);

    logger.info(
      `Network state changed: Connected: ${newState.isConnected}`,
      'NetworkManager',
    );
  }

  private notifyListeners(state: NetworkState) {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        logger.error(
          'Error in network state listener',
          'NetworkManager',
          error,
        );
      }
    });
  }

  // Get current network state
  getNetworkState(): NetworkState {
    return {...this.networkState};
  }

  // Check if device is online
  isOnline(): boolean {
    return (
      this.networkState.isConnected && this.networkState.isInternetReachable
    );
  }

  // Check if device is offline
  isOffline(): boolean {
    return (
      !this.networkState.isConnected || !this.networkState.isInternetReachable
    );
  }

  // Check if connected to WiFi
  isWifiConnected(): boolean {
    return this.networkState.isWifi;
  }

  // Check if connected to cellular
  isCellularConnected(): boolean {
    return this.networkState.isCellular;
  }

  // Add network state listener
  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Remove all listeners
  removeAllListeners() {
    this.listeners = [];
  }

  // Test internet connectivity
  async testInternetConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
      });
      const isConnected = response.ok;
      await this.updateNetworkState(isConnected);
      return isConnected;
    } catch (error) {
      logger.warn('Internet connectivity test failed', 'NetworkManager', error);
      await this.updateNetworkState(false);
      return false;
    }
  }

  // Get network quality indicator
  getNetworkQuality(): 'excellent' | 'good' | 'poor' | 'unknown' {
    if (!this.networkState.isConnected) return 'unknown';

    // This is a simplified implementation
    // In production, you might want to measure actual network performance
    if (this.networkState.isWifi) return 'excellent';
    if (this.networkState.isCellular) return 'good';

    return 'unknown';
  }
}

// Export singleton instance
export const networkManager = new NetworkManager();

// Convenience functions
export const isOnline = () => networkManager.isOnline();
export const isOffline = () => networkManager.isOffline();
export const getNetworkState = () => networkManager.getNetworkState();
export const addNetworkListener = (listener: (state: NetworkState) => void) =>
  networkManager.addListener(listener);

export default networkManager;
