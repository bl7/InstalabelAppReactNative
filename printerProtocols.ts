// Comprehensive Printer Protocol Support
// Supports TSPL, ESC/POS, ZPL, and other thermal printer languages

// ============================================================================
// TSPL (Thermal Printer Standard Language) - Label Printers
// ============================================================================

export interface TSPLLabelSize {
  width: number; // in mm
  height: number; // in mm
}

export interface TSPLLabelData {
  text: string;
  barcode?: string;
  qrCode?: string;
  image?: string; // Base64 encoded image
}

export const generateTSPLCommands = (
  data: TSPLLabelData,
  size: TSPLLabelSize,
): string => {
  const commands = [
    'SIZE ' + size.width + ' mm,' + size.height + ' mm',
    'GAP 2 mm,0',
    'DIRECTION 0',
    'CLS',
    'TEXT 100,100,"3",0,1,1,"' + data.text + '"',
  ];

  if (data.barcode) {
    commands.push('BARCODE 100,200,"128",100,1,0,2,2,"' + data.barcode + '"');
  }

  if (data.qrCode) {
    commands.push('QRCODE 100,300,L,5,A,0,"' + data.qrCode + '"');
  }

  commands.push('PRINT 1,1');
  return commands.join('\n');
};

// ============================================================================
// ESC/POS (Epson Standard Code for Printers) - Receipt Printers
// ============================================================================

export interface ESCPOSData {
  text: string;
  items?: Array<{name: string; price: number; quantity?: number}>;
  total?: number;
  storeName?: string;
  storeAddress?: string;
  receiptNumber?: string;
  date?: string;
}

export const generateESCCommands = (data: ESCPOSData): string => {
  const commands = [
    '\x1B\x40', // Initialize printer
    '\x1B\x61\x01', // Center alignment
    '\x1B\x21\x10', // Double height and width
    data.storeName || 'STORE RECEIPT',
    '\x1B\x21\x00', // Normal size
    '\n',
    data.storeAddress || '123 Main Street',
    '\n',
    'Receipt #: ' + (data.receiptNumber || '000001'),
    '\n',
    'Date: ' + (data.date || new Date().toLocaleDateString()),
    '\n',
    '\x1B\x61\x00', // Left alignment
    '--------------------------------',
    '\n',
  ];

  if (data.items) {
    data.items.forEach(item => {
      const qty = item.quantity || 1;
      const lineTotal = item.price * qty;
      commands.push(
        `${item.name.padEnd(20)} $${item.price.toFixed(
          2,
        )} x${qty} $${lineTotal.toFixed(2)}`,
      );
    });
  }

  commands.push(
    '--------------------------------',
    '\n',
    '\x1B\x61\x02', // Right alignment
    'TOTAL: $' + (data.total || '0.00'),
    '\n\n\n\n', // Feed paper
    '\x1B\x69', // Cut paper
  );

  return commands.join('\n');
};

// ============================================================================
// ZPL (Zebra Programming Language) - Industrial Label Printers
// ============================================================================

export interface ZPLLabelData {
  text: string;
  barcode?: string;
  qrCode?: string;
  serialNumber?: string;
  partNumber?: string;
  location?: string;
  date?: string;
}

export const generateZPLCommands = (data: ZPLLabelData): string => {
  const commands = [
    '^XA', // Start of label
    '^FO50,50', // Field origin
    '^A0N,50,50', // Font
    '^FD' + data.text + '^FS', // Field data
  ];

  if (data.partNumber) {
    commands.push(
      '^FO50,120',
      '^A0N,30,30',
      '^FDPart: ' + data.partNumber + '^FS',
    );
  }

  if (data.serialNumber) {
    commands.push(
      '^FO50,160',
      '^BY3', // Barcode field defaults
      '^BCN,100,Y,N,N', // Code 128 barcode
      '^FD' + data.serialNumber + '^FS',
    );
  }

  if (data.qrCode) {
    commands.push(
      '^FO50,280',
      '^BQN,2,5', // QR Code
      '^FD' + data.qrCode + '^FS',
    );
  }

  if (data.location) {
    commands.push(
      '^FO50,400',
      '^A0N,25,25',
      '^FDLoc: ' + data.location + '^FS',
    );
  }

  if (data.date) {
    commands.push('^FO50,440', '^A0N,25,25', '^FDDate: ' + data.date + '^FS');
  }

  commands.push('^XZ'); // End of label
  return commands.join('\n');
};

// ============================================================================
// CPCL (Command Printer Control Language) - Mobile Printers
// ============================================================================

export interface CPCLData {
  text: string;
  barcode?: string;
  qrCode?: string;
  image?: string;
}

export const generateCPCLCommands = (data: CPCLData): string => {
  const commands = [
    '! 0 200 200 210 1', // Start job
    'T 7 0 0 0 ' + data.text, // Text
  ];

  if (data.barcode) {
    commands.push('B 128 1 1 50 50 ' + data.barcode); // Barcode
  }

  if (data.qrCode) {
    commands.push('B QR 50 100 M 2 U 5 ' + data.qrCode); // QR Code
  }

  commands.push('FORM', 'PRINT'); // End job
  return commands.join('\n');
};

// ============================================================================
// EPL (Eltron Programming Language) - Label Printers
// ============================================================================

export interface EPLLabelData {
  text: string;
  barcode?: string;
  qrCode?: string;
}

export const generateEPLCommands = (data: EPLLabelData): string => {
  const commands = [
    'N', // Clear image buffer
    'q609', // Set label width
    'Q203,0', // Set label height
    'ZT', // Top of form
    'A50,50,0,4,1,1,N,"' + data.text + '"', // Text
  ];

  if (data.barcode) {
    commands.push('B50,100,0,1,3,3,50,B,"' + data.barcode + '"'); // Barcode
  }

  if (data.qrCode) {
    commands.push('b50,200,Q,s7,e7,"' + data.qrCode + '"'); // QR Code
  }

  commands.push('P1'); // Print
  return commands.join('\n');
};

// ============================================================================
// Universal Printer Detection and Auto-Protocol Selection
// ============================================================================

export interface PrinterInfo {
  name: string;
  manufacturer: string;
  model: string;
  supportedProtocols: string[];
  defaultProtocol: string;
  connectionType: 'CLASSIC' | 'BLE' | 'DUAL';
}

export const detectPrinterProtocol = (
  deviceName: string,
  manufacturer: string = '',
): string => {
  const name = deviceName.toLowerCase();
  const mfg = manufacturer.toLowerCase();

  // TSPL Printers (Label Printers)
  if (
    name.includes('tspl') ||
    name.includes('label') ||
    name.includes('munbyn') ||
    name.includes('qn') ||
    name.includes('gprinter') ||
    name.includes('gp-')
  ) {
    return 'TSPL';
  }

  // ESC/POS Printers (Receipt Printers)
  if (
    name.includes('esc') ||
    name.includes('pos') ||
    name.includes('receipt') ||
    name.includes('thermal') ||
    name.includes('epson') ||
    name.includes('star') ||
    name.includes('citizen') ||
    name.includes('bixolon')
  ) {
    return 'ESC/POS';
  }

  // ZPL Printers (Industrial)
  if (
    name.includes('zpl') ||
    name.includes('zebra') ||
    name.includes('industrial') ||
    name.includes('warehouse')
  ) {
    return 'ZPL';
  }

  // CPCL Printers (Mobile)
  if (
    name.includes('cpcl') ||
    name.includes('mobile') ||
    name.includes('portable') ||
    name.includes('handheld')
  ) {
    return 'CPCL';
  }

  // EPL Printers (Eltron)
  if (
    name.includes('epl') ||
    name.includes('eltron') ||
    name.includes('datamax') ||
    name.includes('honeywell')
  ) {
    return 'EPL';
  }

  // Default to TSPL for unknown printers
  return 'TSPL';
};

export const generateUniversalPrintCommands = (
  data: any,
  size: any,
  protocol: string = 'AUTO',
): string => {
  if (protocol === 'AUTO') {
    // Auto-detect based on data structure
    if (data.items && data.total) {
      protocol = 'ESC/POS';
    } else if (data.serialNumber || data.partNumber) {
      protocol = 'ZPL';
    } else {
      protocol = 'TSPL';
    }
  }

  switch (protocol.toUpperCase()) {
    case 'TSPL':
      return generateTSPLCommands(data, size);
    case 'ESC/POS':
      return generateESCCommands(data);
    case 'ZPL':
      return generateZPLCommands(data);
    case 'CPCL':
      return generateCPCLCommands(data);
    case 'EPL':
      return generateEPLCommands(data);
    default:
      return generateTSPLCommands(data, size);
  }
};

// ============================================================================
// Printer-Specific Optimizations
// ============================================================================

export const optimizeForPrinter = (
  commands: string,
  printerModel: string,
): string => {
  const model = printerModel.toLowerCase();

  // Munbyn QN800 specific optimizations
  if (model.includes('qn800')) {
    return commands.replace(
      /SIZE (\d+) mm,(\d+) mm/g,
      'SIZE $1 mm,$2 mm\nGAP 2 mm,0',
    );
  }

  // Generic thermal printer optimizations
  if (model.includes('thermal') || model.includes('label')) {
    return commands + '\nFEED'; // Add paper feed
  }

  return commands;
};

// ============================================================================
// Export all functions
// ============================================================================

export {
  generateDirectTSPLLabel,
  generatePPDSLabel,
  generateUseFirstLabel,
  generateIngredientLabel,
  generateMenuItemLabel,
  generateDefrostLabel,
} from './tsplUtils';
