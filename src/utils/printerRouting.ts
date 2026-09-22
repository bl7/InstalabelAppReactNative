export type PrintEngine = 'rongta' | 'xprinter' | 'printbridge';

let activePrinterName: string | null = null;
let activePrintEngine: PrintEngine | null = null;

export function setActivePrinter(
  name: string | null | undefined,
  engine: PrintEngine | null,
): void {
  activePrinterName = name ?? null;
  activePrintEngine = engine;
}

export function clearActivePrinter(): void {
  activePrinterName = null;
  activePrintEngine = null;
}

export function getActivePrinterName(): string | null {
  return activePrinterName;
}

export function getActivePrintEngine(): PrintEngine | null {
  return activePrintEngine;
}

export function resolvePrintEngine(printerName?: string | null): PrintEngine {
  if (activePrintEngine) {
    return activePrintEngine;
  }
  const {isRongtaPrinterName} = require('./rongtaPrinter');
  const {isXprinterPrinterName} = require('./xprinterPrinter');
  if (isRongtaPrinterName(printerName)) {
    return 'rongta';
  }
  if (isXprinterPrinterName(printerName)) {
    return 'xprinter';
  }
  return 'printbridge';
}
