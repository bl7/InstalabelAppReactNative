import {AppState, AppStateStatus} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {apiService} from './api';
import {getHashedDeviceId} from '../utils/deviceId';
import offlineManager from '../utils/offlineManager';

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

class DeviceHeartbeatService {
  private interval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;
  private isRunning = false;
  private lastAppState: AppStateStatus = AppState.currentState;

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.lastAppState = AppState.currentState;

    await this.sendHeartbeat();

    this.interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        this.sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
  }

  stop(): void {
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  private handleAppStateChange = (nextState: AppStateStatus): void => {
    const wasBackground =
      this.lastAppState === 'background' || this.lastAppState === 'inactive';
    this.lastAppState = nextState;

    if (wasBackground && nextState === 'active') {
      this.sendHeartbeat();
    }
  };

  async sendHeartbeat(): Promise<void> {
    try {
      if (!offlineManager.isOnline()) {
        return;
      }

      const deviceId = await getHashedDeviceId();
      await apiService.sendDeviceHeartbeat({
        deviceId,
        platform: 'mobile',
        deviceModel: DeviceInfo.getModel(),
        appVersion: DeviceInfo.getVersion(),
      });
    } catch (error) {
      console.warn('Device heartbeat failed:', error);
    }
  }
}

export default new DeviceHeartbeatService();
