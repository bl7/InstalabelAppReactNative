import React, {useEffect} from 'react';
import {AuthProvider, useAuth} from './src/contexts/AuthContext';
import {SubscriptionProvider} from './src/contexts/SubscriptionContext';
import {PrinterProvider} from './src/PrinterContext';
import {ModeProvider, useMode} from './src/contexts/ModeContext';
import LoginPage from './src/pages/LoginPage';
import ModeSelectionPage from './src/pages/ModeSelectionPage';
import CustomTabNavigator from './src/components/CustomTabNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineNotice from './src/components/OfflineNotice';
import Toast from 'react-native-toast-message';
import backgroundSyncService from './src/services/backgroundSync';
import backgroundCacheService from './src/services/backgroundCacheService';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ModeProvider>
          <SubscriptionProvider>
            <PrinterProvider>
              <AppContent />
            </PrinterProvider>
          </SubscriptionProvider>
        </ModeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

// Move AppContent inside the context providers
const AppContent: React.FC = () => {
  const {isAuthenticated, accessToken} = useAuth();
  const {selectedMode, isLoading: isModeLoading} = useMode();

  // Initialize background services
  useEffect(() => {
    backgroundSyncService.initialize();
    backgroundCacheService.initialize();

    return () => {
      backgroundSyncService.stop();
      backgroundCacheService.stop();
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <>
        <OfflineNotice />
        <LoginPage />
      </>
    );
  }

  // Show mode selection if authenticated but no mode selected
  if (!isModeLoading && !selectedMode) {
    return (
      <>
        <OfflineNotice />
        <ModeSelectionPage />
        <Toast />
      </>
    );
  }

  // Show loading while mode is being loaded
  if (isModeLoading) {
    return (
      <>
        <OfflineNotice />
        <Toast />
      </>
    );
  }

  return (
    <>
      <OfflineNotice />
      <CustomTabNavigator />
      <Toast />
    </>
  );
};

export default App;
