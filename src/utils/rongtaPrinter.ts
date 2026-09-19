export function isRongtaPrinterName(name?: string | null): boolean {
  if (!name) {
    return false;
  }
  const n = name.toUpperCase();
  return (
    n.includes('RONGTA') ||
    n.includes('RP425') ||
    n.includes('RP420') ||
    n.includes('RP421') ||
    n.includes('RP422') ||
    n.includes('RP410') ||
    n.includes('RP411') ||
    n.includes('RP415') ||
    n.startsWith('RP4')
  );
}
