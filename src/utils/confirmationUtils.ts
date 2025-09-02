import {Alert} from 'react-native';

interface ConfirmationOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export const showConfirmation = (
  options: ConfirmationOptions,
): Promise<boolean> => {
  return new Promise(resolve => {
    Alert.alert(options.title || 'Confirm Action', options.message, [
      {
        text: options.cancelText || 'Cancel',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: options.confirmText || 'Confirm',
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
};

export const showDeleteConfirmation = (itemName: string): Promise<boolean> => {
  return showConfirmation({
    title: 'Delete Item',
    message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  });
};

export const showClearQueueConfirmation = (
  itemCount: number,
): Promise<boolean> => {
  return showConfirmation({
    title: 'Clear Print Queue',
    message: `Are you sure you want to clear the print queue? This will remove ${itemCount} item${
      itemCount !== 1 ? 's' : ''
    } and cannot be undone.`,
    confirmText: 'Clear Queue',
    cancelText: 'Cancel',
    destructive: true,
  });
};

export const showDisconnectConfirmation = (
  deviceName: string,
): Promise<boolean> => {
  return showConfirmation({
    title: 'Disconnect Printer',
    message: `Are you sure you want to disconnect from "${deviceName}"?`,
    confirmText: 'Disconnect',
    cancelText: 'Cancel',
  });
};

export const showPrintConfirmation = (itemCount: number): Promise<boolean> => {
  return showConfirmation({
    title: 'Print Labels',
    message: `Are you ready to print ${itemCount} label${
      itemCount !== 1 ? 's' : ''
    }? Make sure your printer is connected and ready.`,
    confirmText: 'Print Now',
    cancelText: 'Cancel',
  });
};
