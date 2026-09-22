import {NativeModules} from 'react-native';

type XprinterNative = {
  isXprinterPrinter: (name?: string | null) => Promise<boolean>;
  isConnected: () => Promise<{connected: boolean; address?: string | null}>;
  connect: (macAddress: string) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  printBitmapBase64: (
    base64: string,
    widthMm: number,
    heightMm: number,
    copies: number,
  ) => Promise<boolean>;
  printBitmapFile: (
    imagePath: string,
    widthMm: number,
    heightMm: number,
    copies: number,
  ) => Promise<boolean>;
  printTsplAsBitmap: (
    tsplCommands: string,
    copies: number,
  ) => Promise<boolean>;
};

export function getXprinterPrintBridge(): XprinterNative | null {
  return (NativeModules.XprinterPrintBridge as XprinterNative) || null;
}
