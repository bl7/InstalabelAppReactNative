import React, {useEffect} from 'react';
import {AuthProvider, useAuth} from './src/contexts/AuthContext';
import {SubscriptionProvider} from './src/contexts/SubscriptionContext';
import {PrinterProvider} from './src/PrinterContext';
import LoginPage from './src/pages/LoginPage';
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
        <SubscriptionProvider>
          <PrinterProvider>
            <AppContent />
          </PrinterProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

// Move AppContent inside the context providers
const AppContent: React.FC = () => {
  const {isAuthenticated, accessToken} = useAuth();

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

  return (
    <>
      <OfflineNotice />
      <CustomTabNavigator />
      <Toast />
    </>
  );
};

export default App;
