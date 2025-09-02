import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useAuth} from '../contexts/AuthContext';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top',
}) => {
  const {isOfflineMode} = useAuth();

  if (!isOfflineMode) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
      ]}>
      <Text style={styles.text}>📡 Offline Mode - Using Cached Data</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  text: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineIndicator;
