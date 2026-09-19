import {NativeModules} from 'react-native';
import {isRongtaPrinterName} from './rongtaPrinter';
import {getRongtaPrintBridge} from './rongtaPrintBridge';

/**
 * Send TSPL to the active printer.
 * Rongta: rasterize exact TSPL layout → official ZplFactory.getBitmapCmd
 * Others: existing PrintBridge TSPL byte stream
 */
export async function sendTsplPrint(
  tsplCommands: string,
  printerName?: string | null,
): Promise<boolean> {
  const RongtaPrintBridge = getRongtaPrintBridge();
  if (isRongtaPrinterName(printerName) && RongtaPrintBridge) {
    await RongtaPrintBridge.printTsplAsBitmap(tsplCommands, 1);
    return true;
  }

  const {PrintBridge} = NativeModules;
  if (!PrintBridge) {
    throw new Error('PrintBridge native module not found');
  }
  return PrintBridge.printTSPL(tsplCommands);
}
