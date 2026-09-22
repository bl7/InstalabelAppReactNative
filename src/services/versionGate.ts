import DeviceInfo from 'react-native-device-info';
import {apiService, AppVersionConfig} from './api';
import offlineManager from '../utils/offlineManager';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.instalabel.co.app';

export type VersionGateResult =
  | {status: 'ok'}
  | {
      status: 'update_required';
      installedVersionCode: number;
      minSupportedVersionCode: number;
      latestVersion?: string;
      message?: string;
      updateUrl: string;
    }
  | {status: 'offline'}
  | {status: 'check_failed'};

export async function checkVersionGate(): Promise<VersionGateResult> {
  if (__DEV__) {
    return {status: 'ok'};
  }

  if (!offlineManager.isOnline()) {
    return {status: 'offline'};
  }

  try {
    const config: AppVersionConfig = await apiService.getAppVersionConfig();
    const installedVersionCode = parseInt(
      DeviceInfo.getBuildNumber(),
      10,
    );

    if (
      Number.isNaN(installedVersionCode) ||
      installedVersionCode < config.minSupportedVersionCode
    ) {
      return {
        status: 'update_required',
        installedVersionCode,
        minSupportedVersionCode: config.minSupportedVersionCode,
        latestVersion: config.latestVersion,
        message: config.message,
        updateUrl: config.updateUrl || PLAY_STORE_URL,
      };
    }

    return {status: 'ok'};
  } catch (error) {
    console.warn('Version gate check failed:', error);
    return {status: 'check_failed'};
  }
}
