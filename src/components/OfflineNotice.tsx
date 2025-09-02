import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Wifi, WifiOff, RefreshCw} from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';
import {useAuth} from '../contexts/AuthContext';

// Import offline manager once at module level
import offlineManager from '../utils/offlineManager';

// Conditional import for Animated to handle React Native version differences
let Animated: any;
try {
  Animated = require('react-native').Animated;
} catch (error) {
  // Fallback for older React Native versions
  Animated = {
    Value: () => ({current: 0}),
    timing: () => ({start: () => {}}),
    View: View,
  };
}

const OfflineNotice: React.FC = () => {
  const {isOfflineMode} = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [offlineRestricted, setOfflineRestricted] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  // Check offline restrictions when offline
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkOfflineRestrictions = async () => {
      if (!isOnline && isOfflineMode) {
        try {
          const shouldRestrict =
            await offlineManager.shouldRestrictOfflineMode();
          setOfflineRestricted(shouldRestrict);
        } catch (error) {
          console.error('Error checking offline restrictions:', error);
          setOfflineRestricted(true);
        }
      } else {
        setOfflineRestricted(false);
      }
    };

    // Debounce the check to prevent excessive calls
    timeoutId = setTimeout(checkOfflineRestrictions, 300);

    return () => clearTimeout(timeoutId);
  }, [isOnline, isOfflineMode]);

  useEffect(() => {
          // Subscribe to network state updates
      const unsubscribe = NetInfo.addEventListener(state => {
        const online = Boolean(state.isConnected && state.isInternetReachable);
        setIsOnline(online);

        if (online) {
          slideOut();
          console.log('🌐 Network connection restored');
        } else {
          slideIn();
          console.log('📱 Network connection lost');
        }
      });

    // Check initial network state
    const checkInitialState = async () => {
      const state = await NetInfo.fetch();
      const online = Boolean(state.isConnected && state.isInternetReachable);
      setIsOnline(online);
      if (!online) {
        slideIn();
      }
    };

    checkInitialState();

    return unsubscribe;
  }, []);

  const slideIn = () => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const slideOut = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

      const handleRetry = async () => {
      setIsRetrying(true);
      try {
        const state = await NetInfo.fetch();
        const online = Boolean(state.isConnected && state.isInternetReachable);
        setIsOnline(online);
        console.log('🔄 Manual network retry completed:', online);
      } catch (error) {
        console.error('❌ Network retry failed:', error);
      } finally {
        setIsRetrying(false);
      }
    };

  // Show offline notice if either network is down OR app is in offline mode
  if (isOnline && !isOfflineMode) {
    return null;
  }

  // Determine background color and message based on offline reason
  let backgroundColor: string;
  let message: string;

  if (isOfflineMode && isOnline) {
    if (offlineRestricted) {
      backgroundColor = '#FF6B35'; // Dark orange for restricted offline mode
      message = 'Offline Mode Restricted - Data Too Old';
    } else {
      backgroundColor = '#FFA500'; // Orange for offline mode (using cached data)
      message = 'Offline Mode - Using Cached Data';
    }
  } else {
    backgroundColor = '#f44336'; // Red for network offline
    message = "You're offline";
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, 0],
              }),
            },
          ],
        },
      ]}>
      <View style={styles.content}>
        <WifiOff size={20} color="#fff" />
        <Text style={styles.text}>{message}</Text>
        {!isOfflineMode && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={isRetrying}
            accessibilityRole="button"
            accessibilityLabel="Retry network connection">
            <RefreshCw
              size={16}
              color="#fff"
              style={[styles.retryIcon, isRetrying && styles.spinning]}
            />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f44336', // Will be overridden dynamically
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    textAlign: 'center',
  },
  retryButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  retryIcon: {
    opacity: 1,
  },
  spinning: {
    opacity: 0.7,
  },
});

export default OfflineNotice;
