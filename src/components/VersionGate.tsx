import React, {useCallback, useEffect, useState} from 'react';
import {
  AppState,
  AppStateStatus,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Download, RefreshCw, WifiOff} from 'lucide-react-native';
import LoadingSpinner from './LoadingSpinner';
import {
  checkVersionGate,
  PLAY_STORE_URL,
  VersionGateResult,
} from '../services/versionGate';

interface VersionGateProps {
  children: React.ReactNode;
}

const VersionGate: React.FC<VersionGateProps> = ({children}) => {
  const [result, setResult] = useState<VersionGateResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    const nextResult = await checkVersionGate();
    setResult(nextResult);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        runCheck();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [runCheck]);

  const openStore = async (url: string = PLAY_STORE_URL) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Failed to open Play Store:', error);
    }
  };

  if (isChecking || result === null) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
        <View style={styles.centerContent}>
          <LoadingSpinner size="large" />
          <Text style={styles.checkingText}>Checking for updates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (result.status === 'ok') {
    return <>{children}</>;
  }

  if (result.status === 'offline') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
        <View style={styles.centerContent}>
          <WifiOff size={56} color="#fff" />
          <Text style={styles.title}>Connection Required</Text>
          <Text style={styles.message}>
            InstaLabel needs an internet connection to verify the app version.
            Please connect and try again.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={runCheck}>
            <RefreshCw size={20} color="#8A2BE2" />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (result.status === 'check_failed') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
        <View style={styles.centerContent}>
          <RefreshCw size={56} color="#fff" />
          <Text style={styles.title}>Update Check Failed</Text>
          <Text style={styles.message}>
            We could not verify your app version. Please check your connection
            and try again.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={runCheck}>
            <RefreshCw size={20} color="#8A2BE2" />
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
      <View style={styles.centerContent}>
        <Download size={56} color="#fff" />
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.message}>
          {result.message ||
            'A new version of InstaLabel is available. Please update to continue.'}
        </Text>
        {result.latestVersion ? (
          <Text style={styles.versionText}>
            Latest version: {result.latestVersion}
          </Text>
        ) : null}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => openStore(result.updateUrl)}>
          <Download size={20} color="#8A2BE2" />
          <Text style={styles.primaryButtonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8A2BE2',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  checkingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  title: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 24,
  },
  versionText: {
    marginTop: 12,
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  primaryButton: {
    marginTop: 32,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#8A2BE2',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VersionGate;
