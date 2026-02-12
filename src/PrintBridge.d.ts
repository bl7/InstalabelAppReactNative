declare module 'react-native' {
  interface NativeModulesStatic {
    PrintBridge: {
      isBluetoothEnabled(): Promise<boolean>;
      scanForDevices(): Promise<
        Array<{
          id: string;
          name: string | null;
          address: string;
          paired: boolean;
          technology: 'CLASSIC' | 'BLE' | 'DUAL' | 'UNKNOWN';
        }>
      >;
      connectToDevice(deviceAddress: string): Promise<boolean>;
      disconnect(): Promise<boolean>;
      printTSPL(tsplCommands: string): Promise<boolean>;
      printTSPLBase64(tsplBase64: string): Promise<boolean>;
      printESC(escCommands: string): Promise<boolean>;
      printZPL(zplCommands: string): Promise<boolean>;
      getConnectionStatus(): Promise<{
        type: 'CLASSIC' | 'BLE' | 'DUAL' | 'UNKNOWN';
        connected: boolean;
        classicConnected: boolean;
        bleConnected: boolean;
      }>;
    };
  }
}
