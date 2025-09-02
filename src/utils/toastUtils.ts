import Toast from 'react-native-toast-message';

export const showToast = {
  success: (title: string, message?: string) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'bottom',
      visibilityTime: 3000,
    });
  },

  error: (title: string, message?: string) => {
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      position: 'bottom',
      visibilityTime: 4000,
    });
  },

  info: (title: string, message?: string) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
      position: 'bottom',
      visibilityTime: 3000,
    });
  },

  warning: (title: string, message?: string) => {
    Toast.show({
      type: 'error', // Using error type for warning since there's no warning type
      text1: title,
      text2: message,
      position: 'bottom',
      visibilityTime: 3500,
    });
  },
};

export default showToast;
