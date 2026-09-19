import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiService,
  canUserPrint,
  getBlockedMessage,
  SubscriptionStatus,
} from '../services/api';
import offlineManager from './offlineManager';

export const SUBSCRIPTION_CACHE_KEY = 'subscription_cache';
export const SUBSCRIPTION_CACHE_TIMESTAMP_KEY = 'subscription_cache_timestamp';

async function readCachedSubscription(): Promise<SubscriptionStatus | null> {
  try {
    const cached = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function writeCachedSubscription(
  subscription: SubscriptionStatus | null,
): Promise<void> {
  await AsyncStorage.setItem(
    SUBSCRIPTION_CACHE_KEY,
    JSON.stringify(subscription),
  );
  await AsyncStorage.setItem(
    SUBSCRIPTION_CACHE_TIMESTAMP_KEY,
    Date.now().toString(),
  );
}

function assertSubscriptionAllowsPrint(
  subscription: SubscriptionStatus | null,
): void {
  if (!canUserPrint(subscription)) {
    throw new Error(getBlockedMessage(subscription));
  }
}

let subscriptionUpdateListener:
  | ((subscription: SubscriptionStatus | null) => void)
  | null = null;

export function setSubscriptionUpdateListener(
  listener: ((subscription: SubscriptionStatus | null) => void) | null,
): void {
  subscriptionUpdateListener = listener;
}

export async function validateSubscriptionForPrint(): Promise<void> {
  if (!offlineManager.isOnline()) {
    const shouldRestrict = await offlineManager.shouldRestrictOfflineMode();
    if (shouldRestrict) {
      throw new Error(
        'Offline mode restricted. Please connect to internet to refresh your data.',
      );
    }

    assertSubscriptionAllowsPrint(await readCachedSubscription());
    return;
  }

  try {
    const response = await apiService.getSubscriptionStatus();
    await writeCachedSubscription(response.subscription);
    subscriptionUpdateListener?.(response.subscription);
    assertSubscriptionAllowsPrint(response.subscription);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Printing is disabled')
    ) {
      throw error;
    }

    throw new Error(
      'Unable to verify subscription. Please check your connection and try again.',
    );
  }
}
