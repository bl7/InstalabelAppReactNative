export function isXprinterPrinterName(name?: string | null): boolean {
  if (!name) {
    return false;
  }
  const n = name.toUpperCase().replace(/\s+/g, '');
  return (
    n.includes('XPRINTER') ||
    n.includes('BORN4SHIP') ||
    n.includes('BORN4') ||
    n.includes('DB403') ||
    n.includes('DB-403') ||
    n.includes('XP-420') ||
    n.includes('XP-421') ||
    n.includes('XP-423') ||
    n.includes('XP-450') ||
    n.includes('XP-460') ||
    n.includes('XP-470') ||
    n.includes('XP-480') ||
    n.includes('XP-490') ||
    n.includes('XP420') ||
    n.includes('XP421') ||
    n.includes('XP423') ||
    n.includes('XP450') ||
    n.includes('XP460') ||
    n.includes('XP470') ||
    n.includes('XP480') ||
    n.includes('XP490') ||
    n.startsWith('XP-') ||
    n.startsWith('XP4') ||
    // Common OEM Bluetooth aliases for Xprinter-class desktops
    n.includes('POSPRINTER') ||
    /^XP[0-9]/.test(n)
  );
}
