import {NativeModules} from 'react-native';
import {getRongtaPrintBridge} from './rongtaPrintBridge';
import {getXprinterPrintBridge} from './xprinterPrintBridge';
import {resolvePrintEngine} from './printerRouting';

/**
 * Unified label send path.
 * - Rongta SDK → rasterize → ZPL getBitmapCmd
 * - Xprinter/Born4ship SDK → rasterize → TSPLPrinter.bitmap
 * - Everyone else (Munbyn, etc.) → original PrintBridge raw TSPL (proven alignment)
 */
export async function sendTsplPrint(
  tsplCommands: string,
  printerName?: string | null,
): Promise<boolean> {
  const engine = resolvePrintEngine(printerName);

  if (engine === 'rongta') {
    const RongtaPrintBridge = getRongtaPrintBridge();
    if (!RongtaPrintBridge) {
      throw new Error('RongtaPrintBridge native module not found');
    }
    await RongtaPrintBridge.printTsplAsBitmap(tsplCommands, 1);
    return true;
  }

  if (engine === 'xprinter') {
    const XprinterPrintBridge = getXprinterPrintBridge();
    if (!XprinterPrintBridge) {
      throw new Error('XprinterPrintBridge native module not found');
    }
    await XprinterPrintBridge.printTsplAsBitmap(tsplCommands, 1);
    return true;
  }

  const {PrintBridge} = NativeModules;
  if (!PrintBridge) {
    throw new Error('PrintBridge native module not found');
  }
  return PrintBridge.printTSPL(tsplCommands);
}
