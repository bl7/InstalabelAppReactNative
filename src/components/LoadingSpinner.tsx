import React from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  showMessage?: boolean;
  variant?: 'fullscreen' | 'inline' | 'overlay' | 'button';
  containerStyle?: any;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 'large',
  color = '#8A2BE2',
  showMessage = true,
  variant = 'fullscreen',
  containerStyle,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'inline':
        return styles.inlineContainer;
      case 'overlay':
        return styles.overlayContainer;
      case 'button':
        return styles.buttonContainer;
      default:
        return styles.container;
    }
  };

  const getMessageStyle = () => {
    switch (variant) {
      case 'button':
        return styles.buttonMessage;
      case 'inline':
        return styles.inlineMessage;
      default:
        return styles.message;
    }
  };

  return (
    <View style={[getContainerStyle(), containerStyle]}>
      <ActivityIndicator size={size} color={color} />
      {showMessage && <Text style={getMessageStyle()}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  inlineMessage: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  buttonMessage: {
    marginLeft: 6,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default LoadingSpinner;
