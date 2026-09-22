import DeviceInfo from 'react-native-device-info';
import SHA256 from 'crypto-js/sha256';

const DEVICE_ID_SALT = 'instalabel-app-salt';

let cachedDeviceId: string | null = null;

export async function getHashedDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  const androidId = await DeviceInfo.getAndroidId();
  cachedDeviceId = SHA256(androidId + DEVICE_ID_SALT).toString();
  return cachedDeviceId;
}
