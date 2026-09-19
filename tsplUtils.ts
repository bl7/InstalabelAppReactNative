/**
 * TSPL Utility Functions for Label Printers
 * Supports MUNBYN, Zebra, and other TSPL-compatible printers
 */

import {parseDate} from './src/utils/labelManagement';

export interface LabelSize {
  width: number; // in mm
  height: number; // in mm
}

export interface LabelData {
  text: string;
  barcode?: string;
  qrCode?: string;
  image?: string; // Base64 encoded image
}

export interface TSPLConfig {
  dpi: number; // Printer DPI (default: 203)
  gap: number; // Gap between labels in mm (default: 3)
  direction: number; // Print direction (0: normal, 1: reverse)
  density: number; // Print density (0-15)
}

export interface PPDSLabelExtras {
  storageInstruction?: string;
  showNetWt?: boolean;
  showPrice?: boolean;
  netWt?: string;
  price?: string;
}

/**
 * Convert millimeters to dots based on printer DPI
 */
export const mmToDots = (mm: number, dpi: number): number => {
  return Math.round((mm * dpi) / 25.4);
};

/**
 * Center text horizontally on a label
 */
export const centerText = (
  labelWidth: number,
  text: string,
  font: number,
  mag: number,
): number => {
  // TSPL font width approximations (more accurate)
  const fontWidths: {[key: number]: number} = {
    1: 6, // Font 1: ~6 dots wide
    2: 8, // Font 2: ~8 dots wide
    3: 10, // Font 3: ~10 dots wide
    4: 12, // Font 4: ~12 dots wide
    5: 14, // Font 5: ~14 dots wide
  };

  const baseCharWidth = fontWidths[font] || 8; // Default to 8 if unknown
  const charWidth = baseCharWidth * mag;
  const textWidth = text.length * charWidth;

  return Math.max(0, Math.floor((labelWidth - textWidth) / 2));
};

/**
 * Center text with custom character width (most flexible)
 */
export const centerTextCustom = (
  labelWidth: number,
  text: string,
  charWidth: number,
): number => {
  const textWidth = text.length * charWidth;
  return Math.max(0, Math.floor((labelWidth - textWidth) / 2));
};

/**
 * Center text without magnification (simple centering)
 */
export const centerTextSimple = (
  labelWidth: number,
  text: string,
  font: number,
): number => {
  return centerText(labelWidth, text, font, 1);
};

/**
 * Get font height for a given TSPL font size
 */
export const getFontHeight = (font: number): number => {
  const fontHeights: {[key: number]: number} = {
    1: 8, // Font 1: ~8 dots tall
    2: 12, // Font 2: ~12 dots tall
    3: 16, // Font 3: ~16 dots tall
    4: 20, // Font 4: ~20 dots tall
    5: 24, // Font 5: ~24 dots tall
  };

  return fontHeights[font] || 12; // Default to 12 if unknown
};

/**
 * Generate basic TSPL label setup commands
 */
export const generateLabelSetup = (
  size: LabelSize,
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label
  tspl += `SIZE ${size.width}mm,${size.height}mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  return tspl;
};

/**
 * Generate TSPL text command
 */
export const generateTextCommand = (
  text: string,
  x: number,
  y: number,
  font: number = 3,
  rotation: number = 0,
  xMultiplier: number = 1,
  yMultiplier: number = 1,
): string => {
  return `TEXT ${x},${y},"${font}",${rotation},${xMultiplier},${yMultiplier},"${text}"\n`;
};

/**
 * Generate TSPL barcode command (Code 128)
 */
export const generateBarcodeCommand = (
  data: string,
  x: number,
  y: number,
  height: number = 50,
  rotation: number = 0,
  narrow: number = 2,
  wide: number = 2,
): string => {
  return `BARCODE ${x},${y},"128",${height},${rotation},${narrow},${wide},"${data}"\n`;
};

/**
 * Generate TSPL QR code command
 */
export const generateQRCodeCommand = (
  data: string,
  x: number,
  y: number,
  level: string = 'L', // L, M, Q, H
  cellWidth: number = 7,
  rotation: number = 0,
): string => {
  return `QRCODE ${x},${y},${level},${cellWidth},${rotation},"${data}"\n`;
};

/**
 * Generate TSPL image command
 */
export const generateImageCommand = (
  imageData: string,
  x: number,
  y: number,
  mode: number = 0,
): string => {
  return `PUTBMP ${x},${y},"${imageData}",${mode}\n`;
};

/**
 * Generate TSPL commands for printing a base64 PNG image
 * This function handles the conversion and printing of captured label images
 */
export const generateImagePrintCommands = async (
  base64Image: string,
  labelWidth: number = 60, // mm
  labelHeight: number = 40, // mm
  config: Partial<TSPLConfig> = {},
  item?: any,
  ingredients?: any[],
  menuItems?: any[],
  customExpiry?: Record<string, string>,
  initials?: string,
  companyName?: string,
): Promise<string> => {
  console.log('🖼️ Generating image print commands...');
  console.log('📏 Label dimensions:', labelWidth, 'x', labelHeight, 'mm');

  try {
    return generateFallbackLabel(labelWidth, labelHeight, config);
  } catch (error) {
    console.error('❌ Error in generateImagePrintCommands:', error);
    // Fall back to basic text-based printing
    return generateFallbackLabel(labelWidth, labelHeight, config);
  }
};

/**
 * Generate a fallback label when image processing fails
 */
const generateFallbackLabel = (
  labelWidth: number,
  labelHeight: number,
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label with specified dimensions
  tspl += `SIZE ${labelWidth}mm,${labelHeight}mm\n`;
  tspl += `GAPSENSOR\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // Add fallback text
  tspl += `TEXT 10,10,"3",0,1,1,"LABEL PRINTED"\n`;
  tspl += `TEXT 10,30,"2",0,1,1,"Size: ${labelWidth}mm x ${labelHeight}mm"\n`;

  // Add timestamp
  const timestamp = new Date().toLocaleString();
  tspl += `TEXT 10,50,"2",0,1,1,"${timestamp}"\n`;

  // Print the label
  tspl += 'PRINT 1\n';

  return tspl;
};

/**
 * Generate product label template
 */

/**
 * Generate TSPL commands for direct label printing (60mm × 40mm)
 * This function creates TSPL commands that match the exact format shown in the example
 */
export const generateDirectTSPLLabel = (
  labelData: {
    header: string;
    expiryLine: string; // Use the same format as label preview
    printedLine: string; // Use the same format as label preview
    ingredientsLine?: string; // Use the same format as label preview
    initialsLine?: string; // Use the same format as label preview
  },
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 1, density = 8} = config;

  let tspl = '';

  // Initialize label with exact 60x40mm dimensions
  tspl += `SIZE 60 mm,40 mm\n`;
  tspl += `GAP 3 mm,0 mm\n`;
  tspl += `DIRECTION 1\n`;
  tspl += 'CLS\n';

  // Using 203 DPI: 60mm = ~480 dots, 40mm = ~320 dots

  // ===== Item Name Header =====
  // Implement proper word wrapping for header text
  const labelWidth = 480; // 60mm = 480 dots at 203 DPI
  const availableWidth = 460; // Leave 10 dots margin on each side
  const charWidth = 8; // Font 3 character width in dots
  const maxCharsPerLine = Math.floor(availableWidth / charWidth);

  // Determine font size and magnification based on text length
  let headerFontSize = 3; // Default font size
  let headerMagnification = 1;

  if (labelData.header.length <= maxCharsPerLine) {
    // Text fits on one line - use larger font
    if (labelData.header.split(' ').length === 1) {
      headerFontSize = 3;
      headerMagnification = 3;
    } else if (labelData.header.split(' ').length === 2) {
      headerFontSize = 3;
      headerMagnification = 2;
    } else {
      headerFontSize = 2;
      headerMagnification = 2;
    }
  } else {
    // Text needs wrapping - use smaller font
    headerFontSize = 2;
    headerMagnification = 2;
  }

  // Set magnification for header
  tspl += `SETMAG ${headerMagnification},${headerMagnification}\n`;

  // Word wrapping for header
  const words = labelData.header.split(' ');
  const headerLines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    // Check if adding this word would exceed the line length
    const testLine = currentLine + (currentLine ? ' ' : '') + word;

    if (testLine.length <= maxCharsPerLine) {
      // Word fits on current line
      currentLine = testLine;
    } else {
      // Word doesn't fit, start new line
      if (currentLine) {
        headerLines.push(currentLine.trim());
      }
      currentLine = word;
    }
  });

  // Add the last line if there's content
  if (currentLine) {
    headerLines.push(currentLine.trim());
  }

  // Print each header line, centered individually
  headerLines.forEach((line, index) => {
    const lineWidth = line.length * (headerFontSize * 8 * headerMagnification);
    const lineX = Math.max(10, (labelWidth - lineWidth) / 2);
    const lineY = 15 + index * (headerFontSize * 8 * headerMagnification + 8); // Increased starting Y and spacing to prevent bottom cutoff

    tspl += `TEXT ${lineX},${lineY},"${headerFontSize}",0,${headerMagnification},${headerMagnification},"${line}"\n`;
  });

  // Reset magnification
  tspl += 'SETMAG 1,1\n';

  // ===== Single Black Line Below Item Name =====
  // Add a black line below the header for visual separation
  // Position it below the header text (adjust Y position based on font size and magnification)
  const headerHeight =
    headerLines.length * (headerFontSize * 8 * headerMagnification + 8) - 8; // Total height of all header lines with new spacing
  const lineY = 15 + headerHeight + 5; // 5 dots below the header text, adjusted for new starting Y
  tspl += `LINE 0,${lineY},480,${lineY},2\n`;

  // ===== Expiry Line =====
  if (labelData.expiryLine) {
    // Position expiry line closer to the header line
    tspl += `TEXT 10,45,"3",0,1,1,"${labelData.expiryLine}"\n`;
  }

  // ===== Printed Info =====
  if (labelData.printedLine) {
    // Position printed line below expiry
    tspl += `TEXT 10,70,"3",0,1,1,"${labelData.printedLine}"\n`;
  }

  // Add initials line if provided
  if (labelData.initialsLine) {
    tspl += `TEXT 270,70,"3",0,1,1,"${labelData.initialsLine}"\n`;
  }

  // ===== Ingredients =====
  if (labelData.ingredientsLine) {
    // Word wrapping with 45 character limit
    const maxCharsPerLine = 45; // Fixed 45 character limit

    const words = labelData.ingredientsLine.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      // Check if adding this word would exceed 45 characters
      const testLine = currentLine + (currentLine ? ' ' : '') + word;

      if (testLine.length <= maxCharsPerLine) {
        // Word fits on current line
        currentLine = testLine;
      } else {
        // Word doesn't fit, start new line
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        // Start new line with the word that didn't fit
        currentLine = word;
      }
    });

    // Add the last line if there's content
    if (currentLine) {
      lines.push(currentLine.trim());
    }

    // Print each line with consistent left alignment
    lines.forEach((line, index) => {
      // All lines start at the same X position (10 dots from left)
      tspl += `TEXT 10,${110 + index * 25},"3",0,1,1,"${line}"\n`;
    });
  }

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate PPDS label with larger size and different formatting
 */
export const generatePPDSLabel = (
  labelData: {
    header: string;
    expiryLine: string;
    ingredientsLine?: string;
    allergenWarningLine?: string;
    storageInstructions?: string;
    initialsLine?: string;
    // Add support for full ingredient objects with allergen data
    fullIngredients?: any[];
    ppdsExtras?: PPDSLabelExtras;
  },
  config: Partial<TSPLConfig> = {},
): string => {
  console.log('🔍 generatePPDSLabel - Received data:', {
    header: labelData.header,
    expiryLine: labelData.expiryLine,
    storageInstructions: labelData.storageInstructions,
    initialsLine: labelData.initialsLine,
    allergenWarningLine: labelData.allergenWarningLine,
  });
  const {dpi = 203, gap = 3, direction = 1, density = 8} = config;

  let tspl = '';

  // Initialize label with 80mm height for PPDS labels
  tspl += `SIZE 56 mm,80 mm\n`;
  tspl += `GAP 3 mm,0 mm\n`;
  tspl += `DIRECTION 1\n`;
  tspl += 'CLS\n';

  // Using 203 DPI: 56mm = ~448 dots, 80mm = ~640 dots
  // Leave 40 dots margin on left, 20 dots on right to accommodate wider allergen box
  const leftMargin = 40;
  const rightMargin = 20;
  const printableWidth = 448 - leftMargin - rightMargin; // 388 dots available for text

  // ===== Item Name Header =====
  // Smart line breaking: break into 2 lines if more than 24 characters (reduced from 25 to trigger 2-line break)
  const maxCharsPerLine = 24;
  let headerLines: string[] = [];
  let headerFontSize = 4; // Larger default font for PPDS
  let headerMagnification = 1;

  if (labelData.header.length <= maxCharsPerLine) {
    // Single line - use smaller font to fit more characters
    headerLines = [labelData.header];
    headerFontSize = 2; // Reduced from Font 3 to Font 2
    headerMagnification = 2; // Keep 2x magnification
  } else {
    // Break into two lines for better readability
    const words = labelData.header.split(' ');
    let firstLine = '';
    let secondLine = '';

    // Try to create balanced lines
    for (const word of words) {
      if ((firstLine + ' ' + word).trim().length <= maxCharsPerLine) {
        firstLine += (firstLine ? ' ' : '') + word;
      } else {
        // Start second line
        secondLine = words.slice(words.indexOf(word)).join(' ');
        break;
      }
    }

    // If we couldn't create a balanced split, force a split at the middle
    if (!secondLine) {
      const midPoint = Math.ceil(labelData.header.length / 2);
      firstLine = labelData.header.substring(0, midPoint);
      secondLine = labelData.header.substring(midPoint);
    }

    headerLines = [firstLine.trim(), secondLine.trim()];
    headerFontSize = 2; // Reduced from Font 3 to Font 2
    headerMagnification = 2; // Keep 2x magnification
  }

  // Set magnification for header
  tspl += `SETMAG ${headerMagnification},${headerMagnification}\n`;

  // Print each header line, centered individually using the SAME width as ingredients (280 dots)
  headerLines.forEach((line, index) => {
    // Calculate the actual text width for Font 2×2 (each character is 8 dots wide × 2 magnification = 16 dots)
    const charWidth = 8 * headerMagnification; // Font 2 = 8 dots base width
    const textWidth = line.length * charWidth;

    // Use the SAME width as ingredients: 280 dots starting from leftMargin
    const ingredientsWidth = 280; // Same as ingredients: 35 chars × 8 dots
    const ingredientsCenter = leftMargin + ingredientsWidth / 2; // Center of the 280-dot ingredients area
    let lineX = ingredientsCenter - textWidth / 2;

    // Calculate line Y position first
    const lineY = 15 + index * (headerFontSize * 8 * headerMagnification + 15); // Increased spacing from 10 to 15 dots

    // Ensure text doesn't get cut off on the right side
    const maxX = leftMargin + ingredientsWidth - textWidth; // Right edge of ingredients area minus text width
    if (lineX > maxX) {
      lineX = maxX; // Move text left to prevent right cutoff
    }

    // Ensure text doesn't get cut off on the left side
    if (lineX < leftMargin) {
      lineX = leftMargin; // Move text right to prevent left cutoff
    }

    // Additional safety check: ensure the entire text fits within the ingredients width
    if (lineX + textWidth > leftMargin + ingredientsWidth) {
      // If text is still too wide, reduce font size to Font 1×2 for this line
      const smallerCharWidth = 6 * 2; // Font 1×2 = 12 dots per character
      const smallerTextWidth = line.length * smallerCharWidth;
      const smallerLineX = ingredientsCenter - smallerTextWidth / 2;

      // Ensure smaller text fits within bounds
      if (
        smallerLineX >= leftMargin &&
        smallerLineX + smallerTextWidth <= leftMargin + ingredientsWidth
      ) {
        // Use smaller font for this line
        tspl += `TEXT ${smallerLineX},${lineY},"1",0,2,2,"${line}"\n`;
        return; // Skip the original text command
      }
    }

    // Debug logging for header positioning
    console.log(`🔍 PPDS Header Line ${index + 1}: "${line}"`);
    console.log(
      `   Character width: ${charWidth} dots, Text width: ${textWidth} dots`,
    );
    console.log(
      `   Ingredients center: ${ingredientsCenter} dots, Final X: ${lineX} dots`,
    );
    console.log(
      `   Left margin: ${leftMargin} dots, Right edge: ${
        lineX + textWidth
      } dots`,
    );
    console.log(
      `   Max allowed X: ${maxX} dots, Text fits within bounds: ${
        lineX + textWidth <= leftMargin + ingredientsWidth
      }`,
    );

    tspl += `TEXT ${lineX},${lineY},"${headerFontSize}",0,${headerMagnification},${headerMagnification},"${line}"\n`;
  });

  // Reset magnification
  tspl += 'SETMAG 1,1\n';

  // Calculate header height for positioning (accounts for multiple lines)
  const headerHeight =
    headerLines.length * (headerFontSize * 8 * headerMagnification + 15) + 20;

  // ===== Ingredients Section =====
  if (labelData.ingredientsLine) {
    // Start ingredients below the header with reduced gap
    const ingredientsY = headerHeight + 10;

    let ingredientsText: string;

    if (labelData.fullIngredients && labelData.fullIngredients.length > 0) {
      // Use full ingredient objects to get proper allergen information
      const ingredientLines = labelData.fullIngredients.map(ingredient => {
        if (ingredient.allergens && ingredient.allergens.length > 0) {
          const allergenWarnings = ingredient.allergens
            .map((a: any) =>
              typeof a === 'string'
                ? a.toUpperCase()
                : a.allergenName?.toUpperCase() || 'UNKNOWN',
            )
            .join(', ');
          return `${ingredient.ingredientName}(${allergenWarnings})`;
        }
        return ingredient.ingredientName;
      });
      ingredientsText = `Ingredients: ${ingredientLines.join(', ')}`;
    } else {
      // Fallback to basic ingredients line
      ingredientsText = `Ingredients: ${labelData.ingredientsLine.replace(
        /\n/g,
        ', ',
      )}`;
    }

    // Proper word wrapping for PPDS labels with strict 35 character limit (adjusted for new margins)
    const maxCharsPerLine = 35; // Increased from 33 to 35 for better text fit with new margins

    const words = ingredientsText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      // Check if adding this word would exceed the line length
      const testLine = currentLine + (currentLine ? ' ' : '') + word;

      if (testLine.length <= maxCharsPerLine) {
        // Word fits on current line
        currentLine = testLine;
      } else {
        // Word doesn't fit, start new line
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        currentLine = word;
      }
    });

    // Add the last line if there's content
    if (currentLine) {
      lines.push(currentLine.trim());
    }

    // Print each line with consistent left alignment
    lines.forEach((line, index) => {
      // All lines start at the same X position (leftMargin dots from left)
      tspl += `TEXT ${leftMargin},${
        ingredientsY + index * 25
      },"3",0,1,1,"${line}"\n`;
    });
  }

  // ===== Allergen Warning Section =====
  // Extract allergens from ingredients if not provided directly
  let allergenList = labelData.allergenWarningLine;

  if (
    !allergenList &&
    labelData.fullIngredients &&
    labelData.fullIngredients.length > 0
  ) {
    // Extract allergens from full ingredient objects
    const allAllergens: string[] = [];
    labelData.fullIngredients.forEach(ingredient => {
      if (ingredient.allergens && ingredient.allergens.length > 0) {
        ingredient.allergens.forEach((allergen: any) => {
          const allergenName =
            typeof allergen === 'string' ? allergen : allergen.allergenName;
          if (allergenName && !allAllergens.includes(allergenName)) {
            allAllergens.push(allergenName);
          }
        });
      }
    });
    allergenList = allAllergens.join(', ');
  }

  if (allergenList) {
    // Calculate position after ingredients with proper spacing
    // First, calculate how many lines the ingredients actually take up
    let ingredientsLineCount = 0;
    if (labelData.ingredientsLine) {
      const ingredientsText = `Ingredients: ${labelData.ingredientsLine.replace(
        /\n/g,
        ', ',
      )}`;
      const words = ingredientsText.split(' ');
      let currentLine = '';
      let lines = 0;

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        if (testLine.length <= 35) {
          currentLine = testLine;
        } else {
          if (currentLine) lines++;
          currentLine = word;
        }
      });
      if (currentLine) lines++;
      ingredientsLineCount = lines;
    }

    // Position allergen box with proper spacing from ingredients
    const allergenY =
      headerHeight +
      10 + // Gap from header
      ingredientsLineCount * 25 + // Actual ingredients height (25 dots per line)
      45; // Increased gap from 20 to 30 dots for better spacing

    // Create allergen warning box with proper formatting
    const allergenText = `Contains: ${allergenList}`;

    // Calculate box dimensions - properly wide box
    const boxPadding = 10;
    const maxCharsPerLine = 30; // Strict 30 character limit per line
    const charWidth = 8; // Font 3 character width in dots
    const boxWidth = maxCharsPerLine * charWidth + boxPadding * 2 + 120; // 120 dots extra width for much better visual balance
    const words = allergenText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine.trim());

    const lineHeight = 25; // Height per line
    const boxHeight = lines.length * lineHeight + boxPadding * 2;

    const boxX = leftMargin;
    const boxY = allergenY - 5; // Slightly above text for padding

    // Draw box around allergen warning
    tspl += `BOX ${boxX},${boxY},${boxX + boxWidth},${boxY + boxHeight},2\n`;

    // Add warning symbol and text inside box with proper line wrapping
    lines.forEach((line, index) => {
      const lineY = allergenY + 5 + index * lineHeight;
      // Start text from left side of box (not centered)
      const textX = leftMargin + boxPadding;
      tspl += `TEXT ${textX},${lineY},"3",0,1,1,"${
        index === 0 ? '! ' : '  '
      }${line}"\n`;
    });
  }

  // ===== Date Information =====
  if (labelData.expiryLine) {
    // Calculate date position to be just below the allergen box
    let dateY;

    if (allergenList) {
      // If allergen box exists, position dates just below it
      // Use the same calculation logic as allergen box positioning
      let ingredientsLineCount = 0;
      if (labelData.ingredientsLine) {
        const ingredientsText = `Ingredients: ${labelData.ingredientsLine.replace(
          /\n/g,
          ', ',
        )}`;
        const words = ingredientsText.split(' ');
        let currentLine = '';
        let lines = 0;

        words.forEach(word => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          if (testLine.length <= 35) {
            currentLine = testLine;
          } else {
            if (currentLine) lines++;
            currentLine = word;
          }
        });
        if (currentLine) lines++;
        ingredientsLineCount = lines;
      }

      const allergenBoxY =
        headerHeight +
        10 + // Gap from header
        ingredientsLineCount * 25 + // Actual ingredients height
        20; // Gap from ingredients

      const allergenText = `Contains: ${allergenList}`;
      const words = allergenText.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length <= 30) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine.trim());
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine.trim());

      const allergenBoxHeight = lines.length * 25 + 20; // Line height + padding
      dateY = allergenBoxY + allergenBoxHeight + 25; // 25 dots below allergen box (increased from 15)
    } else {
      // If no allergen box, position below ingredients
      let ingredientsLineCount = 0;
      if (labelData.ingredientsLine) {
        const ingredientsText = `Ingredients: ${labelData.ingredientsLine.replace(
          /\n/g,
          ', ',
        )}`;
        const words = ingredientsText.split(' ');
        let currentLine = '';
        let lines = 0;

        words.forEach(word => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          if (testLine.length <= 35) {
            currentLine = testLine;
          } else {
            if (currentLine) lines++;
            currentLine = word;
          }
        });
        if (currentLine) lines++;
        ingredientsLineCount = lines;
      }

      dateY =
        headerHeight +
        10 + // Gap from header
        ingredientsLineCount * 25 + // Actual ingredients height
        25; // Gap from ingredients (increased from 20)
    }

    // Format "Use by:" date in UK standard format (DD/MM/YYYY)
    let useByDate: Date = new Date(); // Initialize with current date

    console.log(
      '🔍 PPDS Date Parsing - Original expiryLine:',
      labelData.expiryLine,
    );

    // Try to parse the expiry date from the data
    if (labelData.expiryLine) {
      // Handle different date formats that might be passed
      let dateString = labelData.expiryLine;

      // If it contains a colon, extract the date part
      if (dateString.includes(':')) {
        dateString = dateString.split(':')[1]?.trim() || dateString;
      }

      console.log('🔍 PPDS Date Parsing - Extracted date string:', dateString);

      // Try to parse the date string - handle DD.MM.YYYY format from calculateExpiryDate
      let parsedDate: Date | null = null;

      // First try to parse DD.MM.YYYY format (from calculateExpiryDate)
      const ddMMYYYYMatch = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (ddMMYYYYMatch) {
        const [, day, month, year] = ddMMYYYYMatch;
        parsedDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
        console.log(
          '🔍 PPDS Date Parsing - Parsed from DD.MM.YYYY format:',
          parsedDate,
        );
      } else {
        // Try standard Date constructor
        parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
          console.log(
            '🔍 PPDS Date Parsing - Successfully parsed with Date constructor:',
            parsedDate,
          );
        } else {
          // If parsing fails, try to extract date from YYYY-MM-DD format
          const dateMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            parsedDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
            );
            console.log(
              '🔍 PPDS Date Parsing - Parsed from YYYY-MM-DD format:',
              parsedDate,
            );
          } else {
            console.log(
              '🔍 PPDS Date Parsing - Failed to parse date, using default',
            );
          }
        }
      }

      if (parsedDate && !isNaN(parsedDate.getTime())) {
        useByDate = parsedDate;
      }
    }

    // If we still couldn't parse the date, use a default (7 days from now)
    if (isNaN(useByDate.getTime())) {
      useByDate = new Date();
      useByDate.setDate(useByDate.getDate() + 7);
    }

    // Format in UK standard: DD/MM/YYYY
    const useByDay = useByDate.getDate().toString().padStart(2, '0');
    const useByMonth = (useByDate.getMonth() + 1).toString().padStart(2, '0');
    const useByYear = useByDate.getFullYear();
    const useByText = `Use by: ${useByDay}/${useByMonth}/${useByYear}`;

    tspl += `TEXT ${leftMargin},${dateY},"3",0,1,1,"${useByText}"\n`;

    // Add "Packed:" date in UK standard format (DD/MM/YYYY)
    const today = new Date();
    const packedDay = today.getDate().toString().padStart(2, '0');
    const packedMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    const packedYear = today.getFullYear();
    const packedText = `Packed: ${packedDay}/${packedMonth}/${packedYear}`;

    tspl += `TEXT ${leftMargin},${dateY + 35},"3",0,1,1,"${packedText}"\n`;
  }

  // ===== Bottom Section - Optional Net Wt / Price + Storage / Company =====
  const extras = labelData.ppdsExtras || {};
  const showNetWt = !!extras.showNetWt && !!extras.netWt?.trim();
  const showPrice = !!extras.showPrice && !!extras.price?.trim();
  const hasFooterExtras = showNetWt || showPrice;

  // Position from bottom of label (80mm = 640 dots) to ensure it's always at bottom
  const labelHeight = 640; // 80mm at 203 DPI
  const bottomMargin = 80;

  // Calculate bottom section positions from bottom up
  const websiteY = labelHeight - bottomMargin;
  const companyY = websiteY - 25; // 25 dots above website
  const storageY = companyY - 30; // 30 dots above company info
  const extrasY = storageY - 34; // 34 dots above storage line
  const extrasSeparatorY = extrasY - 10;

  if (hasFooterExtras) {
    tspl += `LINE ${leftMargin},${extrasSeparatorY},${448 - rightMargin},${extrasSeparatorY},1\n`;
    if (showNetWt) {
      tspl += `TEXT ${leftMargin},${extrasY},"3",0,1,1,"Net Wt: ${extras.netWt?.trim()}"\n`;
    }
    if (showPrice) {
      const priceText = `Price: ${extras.price?.trim()}`;
      const priceX = 448 - rightMargin - priceText.length * 10;
      tspl += `TEXT ${Math.max(leftMargin + 150, priceX)},${extrasY},"3",0,1,1,"${priceText}"\n`;
    }
  }

  // Website (always shown, positioned at bottom)
  tspl += `TEXT ${leftMargin},${websiteY},"2",0,1,1,"www.instalabel.co"\n`;

  // Company Information (above website)
  if (labelData.initialsLine) {
    // Single line (initialsLine already contains "Prepared by: Company Name")
    // Use Font 2 (smaller) to prevent cutoff on long company names
    tspl += `TEXT ${leftMargin},${companyY},"2",0,1,1,"${labelData.initialsLine}"\n`;
  }

  // Storage Instructions (above company info)
  if (labelData.storageInstructions && labelData.storageInstructions.trim()) {
    const storageText = labelData.storageInstructions.replace(/\n/g, ' ');
    tspl += `TEXT ${leftMargin},${storageY},"2",0,1,1,"${storageText}"\n`;
  } else {
    // Default storage instructions if none provided
    const defaultStorage =
      'Keep refrigerated below 5°C. Consume within 2 days of opening.';
    tspl += `TEXT ${leftMargin},${storageY},"2",0,1,1,"${defaultStorage}"\n`;
  }

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate TSPL commands for "USE FIRST" labels
 * Simple label with large "USE FIRST" text only - 60mm × 40mm format
 */
export const generateUseFirstLabel = (
  quantity: number = 1,
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Label size
  tspl += `SIZE 60 mm,40 mm\n`;
  tspl += `GAP ${gap} mm,0 mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  const labelWidth = Math.round((60 / 25.4) * dpi); // 60mm → dots
  const labelHeight = Math.round((40 / 25.4) * dpi); // 40mm → dots

  // Split text into two lines
  const line1 = 'USE';
  const line2 = 'FIRST';

  // Use smaller font size for better fit
  const font = 4; // Smaller font size
  const magnification = 2; // Moderate magnification

  // Calculate positions for each line using the centering utility
  const line1X = centerText(labelWidth, line1, font, magnification);
  const line2X = centerText(labelWidth, line2, font, magnification);

  // Position lines vertically with good spacing
  const lineHeight = getFontHeight(font) * magnification;
  const totalTextHeight = lineHeight * 2 + 20; // Height of both lines plus spacing
  const startY = Math.floor((labelHeight - totalTextHeight) / 2); // Center the entire text block
  const line1Y = startY; // "USE" line
  const line2Y = startY + lineHeight + 20; // "FIRST" line below

  // Debug: Log the two-line layout calculations
  console.log('USE FIRST Label - Two-Line Layout:');
  console.log('Label width (dots):', labelWidth);
  console.log('Font:', font, 'Magnification:', magnification);
  console.log('Line 1 ("USE") - X:', line1X, 'Y:', line1Y);
  console.log('Line 2 ("FIRST") - X:', line2X, 'Y:', line2Y);

  // Debug centering calculations
  const charWidth = 12 * magnification; // Font 4 = 12 dots wide
  console.log('Character width (dots):', charWidth);
  console.log('Line 1 width (dots):', line1.length * charWidth);
  console.log('Line 2 width (dots):', line2.length * charWidth);
  console.log('Expected center positions:');
  console.log(
    'Line 1 center X:',
    Math.floor((labelWidth - line1.length * charWidth) / 2),
  );
  console.log(
    'Line 2 center X:',
    Math.floor((labelWidth - line2.length * charWidth) / 2),
  );

  // Print "USE" on first line
  tspl += `TEXT ${line1X},${line1Y},"${font}",0,${magnification},${magnification},"${line1}"\n`;

  // Print "FIRST" on second line
  tspl += `TEXT ${line2X},${line2Y},"${font}",0,${magnification},${magnification},"${line2}"\n`;

  tspl += `PRINT ${quantity},1\n`;

  return tspl;
};

/**
 * Generate TSPL commands for 80mm "USE FIRST" labels.
 * Uses large centered text on 56mm × 80mm media.
 */
export const generateUseFirstLabel80mm = (
  quantity: number = 1,
  config: Partial<TSPLConfig> = {},
): string => {
  const {gap = 3, direction = 1, density = 8} = config;

  let tspl = '';
  tspl += 'SIZE 56 mm,80 mm\n';
  tspl += `GAP ${gap} mm,0 mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  const labelWidth = 448; // 56mm at 203dpi
  const labelHeight = 640; // 80mm at 203dpi
  const line1 = 'USE';
  const line2 = 'FIRST';
  const font = 4;
  const mag = 3;

  const line1X = centerText(labelWidth, line1, font, mag);
  const line2X = centerText(labelWidth, line2, font, mag);
  const lineHeight = getFontHeight(font) * mag;
  const totalHeight = lineHeight * 2 + 40;
  const startY = Math.floor((labelHeight - totalHeight) / 2);

  tspl += `TEXT ${line1X},${startY},"${font}",0,${mag},${mag},"${line1}"\n`;
  tspl += `TEXT ${line2X},${startY + lineHeight + 40},"${font}",0,${mag},${mag},"${line2}"\n`;
  tspl += `PRINT ${quantity},1\n`;

  return tspl;
};

/**
 * Generate TSPL commands for ingredient labels
 * Standard ingredient labels with name, allergens, and expiry date
 */
export const generateIngredientLabel = (
  ingredient: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label (60mm × 40mm for ingredient labels)
  tspl += `SIZE 60mm,40mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // Calculate positions for 60mm × 40mm label using dynamic DPI
  const labelWidth = Math.round((60 / 25.4) * dpi); // 60mm → dots
  const labelHeight = Math.round((40 / 25.4) * dpi); // 40mm → dots

  // Product name with smart font sizing
  const productName = ingredient.ingredientName;

  // Calculate optimal font size to prevent overflow
  const fontConfig = calculateOptimalFontSize(productName, labelWidth);
  const nameFontSize = fontConfig.fontSize;
  const nameMagnification = fontConfig.magnification;
  const nameCharWidth = fontConfig.charWidth;

  // Word wrapping logic for long ingredient names with smart line breaking
  const maxCharsPerLine = Math.floor((labelWidth - 20) / nameCharWidth); // Leave 10 dots margin on each side to prevent cutoff
  let nameLines: string[] = [];
  let totalNameHeight = 0;

  // Smart line breaking: prefer 2 lines for better font size if possible
  if (productName.length > maxCharsPerLine || productName.length > 20) {
    // Split into multiple lines (either forced by length or preferred for readability)
    const words = productName.split(' ');

    // For 2-line preference, try to create balanced lines
    if (productName.length > 20 && words.length >= 2) {
      // Find the middle point to create balanced lines
      const midPoint = Math.ceil(productName.length / 2);
      let firstLine = '';
      let secondLine = '';

      for (const word of words) {
        if ((firstLine + ' ' + word).trim().length <= midPoint) {
          firstLine += (firstLine ? ' ' : '') + word;
        } else {
          secondLine = words.slice(words.indexOf(word)).join(' ');
          break;
        }
      }

      if (firstLine && secondLine) {
        nameLines = [firstLine.trim(), secondLine.trim()];
      } else {
        // Fallback to original logic if balanced split fails
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) nameLines.push(currentLine.trim());
            currentLine = word;
          }
        }
        if (currentLine) nameLines.push(currentLine.trim());
      }
    } else {
      // Original logic for other cases
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) nameLines.push(currentLine.trim());
          currentLine = word;
        }
      }
      if (currentLine) nameLines.push(currentLine.trim());
    }

    totalNameHeight = nameLines.length * 33; // 33 dots per line (20 for text + 13 for spacing) for better readability
  } else {
    // Single line only for very short names
    nameLines = [productName];
    totalNameHeight = 20; // Single line height
  }

  // Calculate starting Y position for the name section
  const nameY = 30;

  // Calculate X position for each line (center each line individually)
  // Use the same centering approach as Use First label that works perfectly
  // Add small offset to fine-tune centering (shift slightly left)
  const nameXPositions = nameLines.map(line => {
    const centerX =
      centerText(labelWidth, line, nameFontSize, nameMagnification) - 15; // Shift 15 dots left to fine-tune centering
    return centerX;
  });

  // Draw rectangle around the product name (adjusts for multiple lines)
  // Use same rectangle positioning as menu item labels
  const namePadding = 15; // Same padding as menu item labels
  const rectLeft = 9; // Same as menu item labels: 9 dots from left
  const rectRight = labelWidth - 18; // Increased right margin from 15 to 18 dots
  const rectTop = nameY - namePadding;
  const rectBottom = nameY + totalNameHeight + namePadding;

  // Draw rectangle outline around the product name
  tspl += `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},3\n`; // 3 = thicker outline

  // Print product name (handles multiple lines)
  nameLines.forEach((line, index) => {
    const lineY = nameY + index * 33; // 33 dots spacing between lines for better readability
    const lineX = nameXPositions[index];
    tspl += `TEXT ${lineX},${lineY},"${nameFontSize}",0,${nameMagnification},${nameMagnification},"${line}"\n`;
  });

  // Debug: Log the ingredient label positioning
  console.log('Ingredient Label - Text Positioning:');
  console.log('Product Name:', productName, 'lines:', nameLines.length);
  console.log('Font selected:', `Font ${nameFontSize} × ${nameMagnification}`);
  console.log('Character width:', nameCharWidth, 'dots');
  console.log(
    'Rectangle:',
    `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},3`,
  );
  console.log('Label width (dots):', labelWidth);
  console.log('Total name height:', totalNameHeight, 'dots');

  // Date information
  const today = new Date();

  // Use provided expiry date or calculate default (7 days from today)
  let finalExpiryDate: Date;
  if (expiryDate) {
    // Parse the provided expiry date string (handles DD.MM.YYYY format)
    const parsedDate = parseDate(expiryDate);
    if (parsedDate) {
      finalExpiryDate = parsedDate;
    } else {
      // If parsing fails, fall back to default
      finalExpiryDate = new Date(today);
      finalExpiryDate.setDate(finalExpiryDate.getDate() + 7);
    }
  } else {
    // Default to 7 days from today
    finalExpiryDate = new Date(today);
    finalExpiryDate.setDate(finalExpiryDate.getDate() + 7);
  }

  // Format dates using the same helper function as defrost label
  const formattedExpiryDate = formatDateForLabel(finalExpiryDate);
  const formattedPrintedDate = formatDateDayMonth(today);

  const dateFontSize = 3; // Increased from 2 to 3

  // Calculate expiry date position below the name rectangle
  const dateY = rectBottom + 15; // Reduced from 20 to 15 dots below the rectangle since rectangle moved up

  // Expiry line with compact format: "Expires: FRI 05 Jul"
  const expiryText = `Expires: ${formattedExpiryDate}`;
  tspl += `TEXT 10,${dateY},"${dateFontSize}",0,1,1,"${expiryText}"\n`; // Normal text (no bold)

  // Printed line: "Printed: 19 Aug        PREP               BL"
  const printedText = `Printed: ${formattedPrintedDate}`;
  const printedY = dateY + 40; // Increased from 20 to 40 dots below expiry line for more spacing
  tspl += `TEXT 10,${printedY},"${dateFontSize}",0,1,1,"${printedText}"\n`;

  // Add initials on the right side of the printed line (no label type for ingredients)
  const userInitials = initials || ''; // Use passed initials or empty string
  const initialsX = labelWidth - 50; // Position on the right side
  tspl += `TEXT ${initialsX},${printedY},"${dateFontSize}",0,1,1,"${userInitials}"\n`;

  // Allergen information - below the printed line, always show something
  const warningY = printedY + 30; // 30 dots below printed line

  if (ingredient.allergens && ingredient.allergens.length > 0) {
    // Has allergens - show warning and list
    const allergenWarning = 'CONTAINS ALLERGENS';
    const warningFont = dateFontSize; // Same font size as printed line
    const warningMag = 1; // Normal magnification

    // Use same centering logic as other text elements
    const warningCharWidth = 12; // Font 3 character width for centering
    const warningX = centerTextCustom(
      labelWidth,
      allergenWarning,
      warningCharWidth * warningMag,
    );

    tspl += `TEXT ${warningX},${warningY},"${warningFont}",0,${warningMag},${warningMag},"${allergenWarning}"\n`;

    // Add specific allergens list below the warning with word wrapping
    const allergenNames = ingredient.allergens
      .map((a: any) => {
        const allergenName = typeof a === 'string' ? a : a.allergenName;
        return allergenName ? allergenName.toUpperCase() : 'UNKNOWN';
      })
      .join(', ');

    const allergenListFont = dateFontSize; // Same font size as printed line
    const allergenListMag = 1; // Normal magnification
    const allergenListCharWidth = 12; // Font 3 character width for centering

    // Word wrapping logic for allergen list (same as other text elements)
    const maxCharsPerLine = Math.floor(
      (labelWidth - 20) / allergenListCharWidth,
    ); // Leave 10 dots margin on each side
    const allergenLines = wrapText(allergenNames, maxCharsPerLine);

    // Print each line of allergens
    allergenLines.forEach((line, index) => {
      const allergenListX = centerTextCustom(
        labelWidth,
        line,
        allergenListCharWidth * allergenListMag,
      );
      const allergenListY = warningY + 40 + index * 25; // 25 dots spacing between lines
      tspl += `TEXT ${allergenListX},${allergenListY},"${allergenListFont}",0,${allergenListMag},${allergenListMag},"${line}"\n`;
    });
  } else {
    // No allergens - show "Does not contain any allergen"
    const noAllergenText = 'DOES NOT CONTAIN ANY ALLERGEN';
    const noAllergenFont = dateFontSize; // Same font size as printed line
    const noAllergenMag = 1; // Normal magnification
    const noAllergenCharWidth = 12; // Font 3 character width for centering

    const noAllergenX = centerTextCustom(
      labelWidth,
      noAllergenText,
      noAllergenCharWidth * noAllergenMag,
    );

    tspl += `TEXT ${noAllergenX},${warningY},"${noAllergenFont}",0,${noAllergenMag},${noAllergenMag},"${noAllergenText}"\n`;
  }

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate TSPL commands for defrost labels
 * Format: Item name, Expires date, Printed date with (DEFROSTED), allergen warnings
 */
export const generateDefrostLabel = (
  ingredient: any,
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  const mmToDots = (mm: number) => Math.round((mm / 25.4) * dpi);

  const labelWidth = mmToDots(60); // 60mm
  const labelHeight = mmToDots(40); // 40mm

  tspl += `SIZE 60mm,40mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // --- HEADER: Ingredient Name + (DEFROSTED) ---
  const productName = ingredient?.ingredientName || 'UNKNOWN';

  // Always use two lines: product name on first line, (DEFROSTED) on second line
  const firstLine = productName;
  const secondLine = '(DEFROSTED)';

  // Calculate optimal font size for the product name (first line)
  const fontConfig = calculateOptimalFontSize(firstLine, labelWidth);
  const nameFont = fontConfig.fontSize;
  const nameMag = fontConfig.magnification;
  const charWidth = fontConfig.charWidth;

  // Use the same centering approach as Use First label that works perfectly
  // Add small offset to fine-tune centering (shift slightly left)
  const firstLineX = centerText(labelWidth, firstLine, nameFont, nameMag) - 15; // Shift 15 dots left to fine-tune centering
  const secondLineX =
    centerText(labelWidth, secondLine, nameFont, nameMag) - 15; // Shift 15 dots left to fine-tune centering

  const firstLineY = 20;
  const secondLineY = firstLineY + 45; // Increased spacing between lines even more

  // Draw rectangle around the header text (not filled, just outline)
  // Use same rectangle positioning as menu item labels
  const headerHeight = secondLineY + 25; // Increased bottom padding
  const headerPadding = 15; // Same padding as menu item labels
  const rectLeft = 9; // Same as menu item labels: 9 dots from left
  const rectRight = labelWidth - 9; // Same as menu item labels: 9 dots from right
  const rectTop = firstLineY - headerPadding;
  const rectBottom = headerHeight + headerPadding;

  // Draw rectangle outline
  tspl += `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},3\n`; // 3 = thicker outline

  // Print both lines in normal text (no inverse)
  tspl += `TEXT ${firstLineX},${firstLineY},"${nameFont}",0,${nameMag},${nameMag},"${firstLine}"\n`;
  tspl += `TEXT ${secondLineX},${secondLineY},"${nameFont}",0,${nameMag},${nameMag},"${secondLine}"\n`;

  // Debug: Log the text positioning
  console.log('Defrost Label - Text Positioning:');
  console.log(
    'Product Name:',
    firstLine,
    'at X:',
    firstLineX,
    'Y:',
    firstLineY,
  );
  console.log(
    'DEFROSTED:',
    secondLine,
    'at X:',
    secondLineX,
    'Y:',
    secondLineY,
  );
  console.log(
    'Rectangle:',
    `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},1`,
  );

  // Debug centering calculations
  console.log('Label width (dots):', labelWidth);
  console.log('Font selected:', `Font ${nameFont} × ${nameMag}`);
  console.log('Character width:', charWidth, 'dots');
  console.log('Product name width:', firstLine.length * charWidth);
  console.log(
    'Expected center X for product name:',
    Math.floor((labelWidth - firstLine.length * charWidth) / 2),
  );
  console.log('DEFROSTED width:', secondLine.length * charWidth);
  console.log(
    'Expected center X for DEFROSTED:',
    Math.floor((labelWidth - secondLine.length * charWidth) / 2),
  );

  // Update nameY for positioning other elements
  const nameY = secondLineY;

  // --- DATES ---
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Format dates
  const expiryDate = formatDateForLabel(tomorrow);
  const printedDate = formatDateForLabel(today);

  // Expiry line with compact format: "Expires: Sun 17 Aug"
  const expiryText = `Expires: ${expiryDate}`;
  tspl += `TEXT 10,${nameY + 50},"3",0,1,1,"${expiryText}"\n`; // Font size 3, normal text (no bold)

  // Printed line: "Printed: 16 Aug"
  const printedText = `Printed: ${printedDate}`;
  tspl += `TEXT 10,${nameY + 90},"3",0,1,1,"${printedText}"\n`; // 40 dots below expiry line (same as ingredient labels)

  // DEFROSTED is now part of the header, so no separate section needed

  // --- ALLERGEN WARNING (if ingredients contain allergens) ---
  if (ingredient?.allergens?.length) {
    const allergenWarning = 'CONTAINS ALLERGENS';
    const warningFont = 3;
    const warningMag = 2;

    // Center the allergen warning with custom character width for better centering
    const warningCharWidth = 12; // Increased character width for Font 3 to fix centering
    const warningX = centerTextCustom(
      labelWidth,
      allergenWarning,
      warningCharWidth * warningMag,
    );
    const warningY = nameY + 110; // Moved down by 30 dots (was 80, now 110)

    tspl += `TEXT ${warningX},${warningY},"${warningFont}",0,${warningMag},${warningMag},"${allergenWarning}"\n`;
  }

  tspl += 'PRINT 1,1\n';
  return tspl;
};

/**
 * Generate simple custom label (Notes) in 80mm format.
 */
export const generateSimpleCustomLabel80mm = (
  heading: string,
  subheading: string,
  config: Partial<TSPLConfig> = {},
): string => {
  return build80mmLabel({
    title: heading,
    bodyText: subheading,
    config,
  });
};

/**
 * Generate TSPL commands for 80mm defrost labels.
 * Keeps "DEFROSTED" as a strong indicator while fitting all text within bounds.
 */
export const generateDefrostLabel80mm = (
  ingredient: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
): string => {
  const ingredientName = ingredient?.ingredientName || 'Ingredient';
  const allergens =
    ingredient?.allergens && Array.isArray(ingredient.allergens)
      ? ingredient.allergens
          .map((a: any) => (typeof a === 'string' ? a : a?.allergenName))
          .filter(Boolean)
          .map((a: string) => a.toUpperCase())
      : [];

  return build80mmLabel({
    title: ingredientName,
    expiryDate,
    bodyText: `Status: DEFROSTED`,
    allergensText:
      allergens.length > 0 ? allergens.join(', ') : 'Does not contain allergens',
    packedSuffix: initials ? `DEFROST | ${initials}` : 'DEFROST',
    config,
  });
};

// Simple word wrap helper
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length <= maxChars) {
      line += (line ? ' ' : '') + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Helper function to format date like "MON. 01 Jul 2025"
function formatDateForLabel(date: Date): string {
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const dayName = dayNames[date.getDay()];
  const day = date.getDate().toString().padStart(2, '0');
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}. ${day} ${month} ${year}`;
}

// Helper function to format date for the "Printed:" line like "14 Aug 2025"
function formatDateDayMonth(date: Date): string {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = date.getDate().toString().padStart(2, '0');
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Calculate optimal font size and magnification for item names
 * Prevents text overflow by automatically reducing font size for long names
 */
function calculateOptimalFontSize(
  itemName: string,
  labelWidth: number,
  maxWidthPercentage: number = 0.75, // Increased from 65% to 75% for better space utilization
): {fontSize: number; magnification: number; charWidth: number} {
  // Enhanced font configurations with more options for better readability
  const fontConfigs = [
    {
      font: 2,
      mag: 2,
      charWidth: 10,
      description: 'Font 2 × 2 (24×32 dots)',
      priority: 1,
    },
    {
      font: 2,
      mag: 1,
      charWidth: 5,
      description: 'Font 2 × 1 (12×16 dots)',
      priority: 2,
    },
    {
      font: 1,
      mag: 2,
      charWidth: 8,
      description: 'Font 1 × 2 (16×24 dots)',
      priority: 3,
    },
    {
      font: 1,
      mag: 1,
      charWidth: 4,
      description: 'Font 1 × 1 (8×12 dots)',
      priority: 4,
    },
    // Additional configurations for better handling of long names
    {
      font: 3,
      mag: 1,
      charWidth: 6,
      description: 'Font 3 × 1 (14×20 dots)',
      priority: 2.5,
    },
    {
      font: 4,
      mag: 1,
      charWidth: 7,
      description: 'Font 4 × 1 (16×24 dots)',
      priority: 2.2,
    },
    {
      font: 5,
      mag: 1,
      charWidth: 8,
      description: 'Font 5 × 1 (18×28 dots)',
      priority: 2.1,
    },
  ];

  // Sort by priority (lower number = higher priority)
  fontConfigs.sort((a, b) => a.priority - b.priority);

  // Calculate maximum allowed width (75% of label width for better space utilization)
  const maxAllowedWidth = labelWidth * maxWidthPercentage;

  console.log(`🔍 Font Size Calculation for: "${itemName}"`);
  console.log(`   Label width: ${labelWidth} dots`);
  console.log(`   Max allowed width (75%): ${maxAllowedWidth} dots`);
  console.log(`   Text length: ${itemName.length} characters`);

  // Special handling for very long names - prioritize readability with multi-line support
  if (itemName.length > 30) {
    console.log(
      `   📝 Long name detected (${itemName.length} chars), prioritizing readability`,
    );

    // For very long names, use a more readable font even if it requires multiple lines
    const readableConfigs = fontConfigs.filter(config => config.priority <= 3);

    for (const config of readableConfigs) {
      const textWidth = itemName.length * config.charWidth;
      console.log(`   Testing ${config.description}: ${textWidth} dots`);

      // For long names, allow up to 90% of label width to maximize readability
      const longNameMaxWidth = labelWidth * 0.9;

      if (textWidth <= longNameMaxWidth) {
        console.log(`✅ Font selected for long name: ${config.description}`);
        console.log(`   Text: "${itemName}" (${itemName.length} chars)`);
        console.log(
          `   Width: ${textWidth} dots (${longNameMaxWidth} max for long names)`,
        );
        console.log(`   Character width: ${config.charWidth} dots`);
        console.log(`   Safety margin: ${longNameMaxWidth - textWidth} dots`);

        return {
          fontSize: config.font,
          magnification: config.mag,
          charWidth: config.charWidth,
        };
      }
    }
  }

  // Standard font selection for normal length names
  for (const config of fontConfigs) {
    const textWidth = itemName.length * config.charWidth;

    console.log(`   Testing ${config.description}: ${textWidth} dots`);

    if (textWidth <= maxAllowedWidth) {
      console.log(`✅ Font selected: ${config.description}`);
      console.log(`   Text: "${itemName}" (${itemName.length} chars)`);
      console.log(`   Width: ${textWidth} dots (${maxAllowedWidth} max)`);
      console.log(`   Character width: ${config.charWidth} dots`);
      console.log(`   Safety margin: ${maxAllowedWidth - textWidth} dots`);

      return {
        fontSize: config.font,
        magnification: config.mag,
        charWidth: config.charWidth,
      };
    }
  }

  // If no font fits, use the smallest available
  const smallestConfig = fontConfigs[fontConfigs.length - 1];
  console.log(
    `⚠️ Text too long, using smallest font: ${smallestConfig.description}`,
  );
  console.log(`   Text: "${itemName}" (${itemName.length} chars)`);
  console.log(
    `   Required width: ${itemName.length * smallestConfig.charWidth} dots`,
  );
  console.log(`   Available width: ${maxAllowedWidth} dots`);

  return {
    fontSize: smallestConfig.font,
    magnification: smallestConfig.mag,
    charWidth: smallestConfig.charWidth,
  };
}

/**
 * Generate TSPL commands for menu item labels
 * Menu item labels with name, ingredients list, dates, and label type indicator
 */
export const generateMenuItemLabel = (
  menuItem: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label (60mm × 40mm for menu item labels)
  tspl += `SIZE 60mm,40mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // Calculate positions for 60mm × 40mm label using dynamic DPI
  const labelWidth = Math.round((60 / 25.4) * dpi); // 60mm → dots
  const labelHeight = Math.round((40 / 25.4) * dpi); // 40mm → dots

  // Menu item name with optimal font sizing (same as defrosted label)
  const itemName = menuItem.menuItemName || menuItem.name;

  // Use the same calculateOptimalFontSize function as defrosted label
  const fontConfig = calculateOptimalFontSize(itemName, labelWidth);
  const nameFontSize = fontConfig.fontSize;
  const nameMagnification = fontConfig.magnification;
  const nameCharWidth = fontConfig.charWidth;

  console.log(`🔍 Menu Item Font Selection:`);
  console.log(`   Item: "${itemName}"`);
  console.log(`   Selected Font: ${nameFontSize} × ${nameMagnification}`);
  console.log(`   Character Width: ${nameCharWidth} dots`);
  console.log(`   Total Text Width: ${itemName.length * nameCharWidth} dots`);
  console.log(`   Label Width: ${labelWidth} dots`);

  // Enhanced word wrapping logic for long item names with improved space utilization
  const marginDots = 20; // Total margin (10 dots on each side)
  const maxCharsPerLine = Math.floor((labelWidth - marginDots) / nameCharWidth);
  let nameLines: string[] = [];
  let totalNameHeight = 0;

  console.log(`🔍 Word Wrapping Analysis:`);
  console.log(`   Item name: "${itemName}" (${itemName.length} chars)`);
  console.log(`   Character width: ${nameCharWidth} dots`);
  console.log(`   Max chars per line: ${maxCharsPerLine}`);
  console.log(`   Label width: ${labelWidth} dots`);

  // Smart line breaking: prefer 2 lines for better font size if possible
  if (itemName.length > maxCharsPerLine || itemName.length > 20) {
    // Split into multiple lines (either forced by length or preferred for readability)
    const words = itemName.split(' ');

    // Enhanced line breaking logic for better readability
    if (itemName.length > 20 && words.length >= 2) {
      // For longer names, try to create balanced lines that work well with the improved font sizes
      const targetCharsPerLine = Math.max(15, Math.floor(itemName.length / 2)); // Aim for balanced lines
      let firstLine = '';
      let secondLine = '';
      let bestSplit = false;

      // Try to find a good split point that creates balanced lines
      for (let i = 1; i < words.length; i++) {
        const firstPart = words.slice(0, i).join(' ');
        const secondPart = words.slice(i).join(' ');

        // Check if both parts fit well within reasonable limits
        if (
          firstPart.length <= maxCharsPerLine &&
          secondPart.length <= maxCharsPerLine
        ) {
          // Prefer splits that create more balanced lines
          const balance = Math.abs(firstPart.length - secondPart.length);
          if (balance <= 8 || !bestSplit) {
            // Allow up to 8 character difference for balance
            firstLine = firstPart;
            secondLine = secondPart;
            bestSplit = true;
          }
        }
      }

      if (firstLine && secondLine) {
        nameLines = [firstLine.trim(), secondLine.trim()];
        console.log(`   📝 Balanced split: "${firstLine}" | "${secondLine}"`);
      } else {
        // Fallback to word-based wrapping if balanced split fails
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) nameLines.push(currentLine.trim());
            currentLine = word;
          }
        }
        if (currentLine) nameLines.push(currentLine.trim());
        console.log(`   📝 Word-based wrapping: ${nameLines.length} lines`);
      }
    } else {
      // Standard word-based wrapping for shorter names
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) nameLines.push(currentLine.trim());
          currentLine = word;
        }
      }
      if (currentLine) nameLines.push(currentLine.trim());
      console.log(`   📝 Standard wrapping: ${nameLines.length} lines`);
    }

    totalNameHeight = nameLines.length * 33; // 33 dots per line (20 for text + 13 for spacing) for better readability
  } else {
    // Single line only for very short names
    nameLines = [itemName];
    totalNameHeight = 20; // Single line height
  }

  // Calculate starting Y position for the name section
  const nameY = 20; // Reduced from 45 to 20 to remove extra space above rectangle

  // Calculate X position for each line (center each line individually)
  // Use the same centering approach as Use First label that works perfectly
  const nameXPositions = nameLines.map(line => {
    const centerX = centerText(
      labelWidth,
      line,
      nameFontSize,
      nameMagnification,
    );
    console.log(
      `🔍 Centering "${line}": fontSize=${nameFontSize}, mag=${nameMagnification}, centerX=${centerX}`,
    );
    return centerX;
  });

  // Draw rectangle around the menu item name (adjusts for multiple lines)
  const namePadding = 15; // Reduced from 20 to 15 for tighter fit
  const rectLeft = 15; // Fixed left margin to prevent cutoff
  const rectRight = labelWidth - 9; // Extended 6 more dots to the right (was 15, now 9)
  const rectTop = nameY - namePadding;
  const rectBottom = nameY + totalNameHeight + namePadding;

  // Draw rectangle outline around the menu item name
  tspl += `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},3\n`; // 3 = thicker outline

  // Print menu item name (handles multiple lines)
  nameLines.forEach((line, index) => {
    const lineY = nameY + index * 33; // Increased from 28 to 33 dots spacing between lines for better readability
    const lineX = nameXPositions[index];
    tspl += `TEXT ${lineX},${lineY},"${nameFontSize}",0,${nameMagnification},${nameMagnification},"${line}"\n`;
  });

  // Date information
  const today = new Date();

  // Use provided expiry date or calculate default (7 days from today)
  let finalExpiryDate: Date;
  if (expiryDate) {
    // Parse the provided expiry date string (handles DD.MM.YYYY format)
    const parsedDate = parseDate(expiryDate);
    if (parsedDate) {
      finalExpiryDate = parsedDate;
    } else {
      // If parsing fails, fall back to default
      finalExpiryDate = new Date(today);
      finalExpiryDate.setDate(finalExpiryDate.getDate() + 7);
    }
  } else {
    // Default to 7 days from today
    finalExpiryDate = new Date(today);
    finalExpiryDate.setDate(finalExpiryDate.getDate() + 7);
  }

  // Format dates using the same helper function as other labels
  const formattedExpiryDate = formatDateForLabel(finalExpiryDate);
  const formattedPrintedDate = formatDateDayMonth(today);

  const dateFontSize = 3; // Increased from 2 to 3

  // Calculate expiry date position below the name rectangle (adjusts for multiple lines)
  const dateY = rectBottom + 15; // Reduced from 20 to 15 dots below the rectangle since rectangle moved up

  // Expiry line with compact format: "Expires: TUE 26 Aug"
  const expiryText = `Expires: ${formattedExpiryDate}`;
  tspl += `TEXT 10,${dateY},"${dateFontSize}",0,1,1,"${expiryText}"\n`; // Normal text (no bold)

  // Printed line: "Printed: 19 Aug        PREP               BL"
  const printedText = `Printed: ${formattedPrintedDate}`;
  const printedY = dateY + 40; // Increased from 20 to 40 dots below expiry line for more spacing
  tspl += `TEXT 10,${printedY},"${dateFontSize}",0,1,1,"${printedText}"\n`;

  // Add label type (middle) and initials (right side)
  const userInitials = initials || ''; // Use passed initials or empty string

  // Only show label type if it's not 'default'
  let labelType = '';
  if (menuItem.labelType && menuItem.labelType !== 'default') {
    labelType = menuItem.labelType.toUpperCase();
  }

  // Add label type after the printed date with proper spacing
  if (labelType) {
    // Calculate where the printed date text ends with more accurate character width
    const printedDateTextWidth = printedText.length * 12; // More accurate character width for font 3
    const spacing = 8; // 8 dots spacing between date and label type
    const labelTypeX = 10 + printedDateTextWidth + spacing; // Start after date + spacing
    tspl += `TEXT ${labelTypeX},${printedY},"${dateFontSize}",0,1,1,"${labelType}"\n`;
  }

  // Add initials on the right side
  const initialsX = labelWidth - 50; // Position on the right side
  tspl += `TEXT ${initialsX},${printedY},"${dateFontSize}",0,1,1,"${userInitials}"\n`;

  // Allergens list for menu items (only show allergens, not all ingredients)
  if (menuItem.ingredients && menuItem.ingredients.length > 0) {
    const containsY = printedY + 20; // Position below printed line

    // Collect all unique allergens from the menu item's ingredients
    const allAllergens = new Set<string>();

    for (let i = 0; i < menuItem.ingredients.length; i++) {
      const ingredient = menuItem.ingredients[i];
      const ingredientName =
        typeof ingredient === 'string' ? ingredient : ingredient.ingredientName;

      let fullIngredientObject = null as any;
      if (menuItem.fullIngredients && Array.isArray(menuItem.fullIngredients)) {
        const foundIngredient = menuItem.fullIngredients.find(
          (ing: any) => ing.ingredientName === ingredientName,
        );
        fullIngredientObject = foundIngredient;
      } else {
        fullIngredientObject = ingredient;
      }

      // Extract allergens from the ingredient object
      if (
        fullIngredientObject &&
        fullIngredientObject.allergens &&
        fullIngredientObject.allergens.length > 0
      ) {
        fullIngredientObject.allergens.forEach((a: any) => {
          const allergenName = typeof a === 'string' ? a : a.allergenName;
          if (allergenName) {
            allAllergens.add(allergenName.toUpperCase());
          }
        });
      }
    }

    // Build the allergens text
    let allergensText: string;
    if (allAllergens.size > 0) {
      // Show allergens: "Contains: GLUTEN, MILK, EGGS"
      allergensText = `Contains: ${Array.from(allAllergens).join(', ')}`;
    } else {
      // No allergens: "Contains: Does not contain any allergens"
      allergensText = 'Contains: Does not contain any allergens';
    }

    // Word wrapping logic with 40 character limit (prevents right overflow)
    const maxCharsPerLine = 40; // Fixed 40 character limit (prevents right overflow)
    const words = allergensText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      // Check if adding this word would exceed 40 characters
      const testLine = currentLine + (currentLine ? ' ' : '') + word;

      if (testLine.length <= maxCharsPerLine) {
        // Word fits on current line
        currentLine = testLine;
      } else {
        // Word doesn't fit, start new line
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        currentLine = word;
      }
    });

    // Add the last line if there's content
    if (currentLine) {
      lines.push(currentLine.trim());
    }

    // Print each line with consistent left alignment
    lines.forEach((line, index) => {
      // All lines start at the same X position (10 dots from left)
      tspl += `TEXT 10,${
        containsY + index * 20
      },"${dateFontSize}",0,1,1,"${line}"\n`;
    });
  }

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate TSPL commands for PPD (Pre-Packaged for Direct Sale) labels
 * Custom format: Product name, Best Before date, Ingredients with allergens
 */
export const generatePPDLabel = (
  menuItem: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  ppdsExtras?: PPDSLabelExtras,
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label (60mm × 40mm for PPD labels)
  tspl += `SIZE 60mm,40mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // Calculate positions for 60mm × 40mm label using dynamic DPI
  const labelWidth = Math.round((60 / 25.4) * dpi); // 60mm → dots
  const labelHeight = Math.round((40 / 25.4) * dpi); // 40mm → dots

  // Menu item name with optimal font sizing (same as menu item label)
  const itemName = menuItem.menuItemName || menuItem.name;

  // Use the same calculateOptimalFontSize function as menu item label
  const fontConfig = calculateOptimalFontSize(itemName, labelWidth);
  const nameFontSize = fontConfig.fontSize;
  const nameMagnification = fontConfig.magnification;
  const nameCharWidth = fontConfig.charWidth;

  console.log(`🔍 PPD Label Font Selection:`);
  console.log(`   Item: "${itemName}"`);
  console.log(`   Selected Font: ${nameFontSize} × ${nameMagnification}`);
  console.log(`   Character Width: ${nameCharWidth} dots`);
  console.log(`   Total Text Width: ${itemName.length * nameCharWidth} dots`);
  console.log(`   Label Width: ${labelWidth} dots`);

  // Word wrapping logic for long item names with smart line breaking
  const maxCharsPerLine = Math.floor((labelWidth - 20) / nameCharWidth); // Leave 10 dots margin on each side to prevent cutoff
  let nameLines: string[] = [];
  let totalNameHeight = 0;

  // Smart line breaking: prefer 2 lines for better font size if possible
  if (itemName.length > maxCharsPerLine || itemName.length > 20) {
    // Split into multiple lines (either forced by length or preferred for readability)
    const words = itemName.split(' ');

    // For 2-line preference, try to create balanced lines
    if (itemName.length > 20 && words.length >= 2) {
      // Find the middle point to create balanced lines
      const midPoint = Math.ceil(itemName.length / 2);
      let firstLine = '';
      let secondLine = '';

      for (const word of words) {
        if ((firstLine + ' ' + word).trim().length <= midPoint) {
          firstLine += (firstLine ? ' ' : '') + word;
        } else {
          secondLine = words.slice(words.indexOf(word)).join(' ');
          break;
        }
      }

      if (firstLine && secondLine) {
        nameLines = [firstLine.trim(), secondLine.trim()];
      } else {
        // Fallback to original logic if balanced split fails
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) nameLines.push(currentLine.trim());
            currentLine = word;
          }
        }
        if (currentLine) nameLines.push(currentLine.trim());
      }
    } else {
      // Original logic for other cases
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) nameLines.push(currentLine.trim());
          currentLine = word;
        }
      }
      if (currentLine) nameLines.push(currentLine.trim());
    }

    totalNameHeight = nameLines.length * 33; // 33 dots per line (20 for text + 13 for spacing) for better readability
  } else {
    // Single line only for very short names
    nameLines = [itemName];
    totalNameHeight = 20; // Single line height
  }

  // Calculate starting Y position for the name section
  const nameY = 20; // Reduced from 45 to 20 to remove extra space above rectangle

  // Calculate X position for each line (center each line individually)
  // Use the same centering approach as menu item label that works perfectly
  const nameXPositions = nameLines.map(line => {
    const centerX = centerText(
      labelWidth,
      line,
      nameFontSize,
      nameMagnification,
    );
    console.log(
      `🔍 Centering "${line}": fontSize=${nameFontSize}, mag=${nameMagnification}, centerX=${centerX}`,
    );
    return centerX;
  });

  // Draw rectangle around the menu item name (adjusts for multiple lines)
  const namePadding = 15; // Reduced from 20 to 15 for tighter fit
  const rectLeft = 15; // Fixed left margin to prevent cutoff
  const rectRight = labelWidth - 9; // Extended 6 more dots to the right (was 15, now 9)
  const rectTop = nameY - namePadding;
  const rectBottom = nameY + totalNameHeight + namePadding;

  // Draw rectangle outline around the menu item name
  tspl += `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},3\n`; // 3 = thicker outline

  // Print menu item name (handles multiple lines)
  nameLines.forEach((line, index) => {
    const lineY = nameY + index * 33; // Increased from 28 to 33 dots spacing between lines for better readability
    const lineX = nameXPositions[index];
    tspl += `TEXT ${lineX},${lineY},"${nameFontSize}",0,${nameMagnification},${nameMagnification},"${line}"\n`;
  });

  // Best Before date
  let finalExpiryDate: Date;
  if (expiryDate) {
    // Handle different date formats that might be passed
    let dateString = expiryDate;

    // If it contains a colon, extract the date part
    if (dateString.includes(':')) {
      dateString = dateString.split(':')[1]?.trim() || dateString;
    }

    // Try to parse the date string - handle DD.MM.YYYY format from calculateExpiryDate
    let parsedDate: Date | null = null;

    // First try to parse DD.MM.YYYY format (from calculateExpiryDate)
    const ddMMYYYYMatch = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (ddMMYYYYMatch) {
      const [, day, month, year] = ddMMYYYYMatch;
      parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Try standard Date constructor
      parsedDate = new Date(dateString);
      if (isNaN(parsedDate.getTime())) {
        // If parsing fails, try to extract date from YYYY-MM-DD format
        const dateMatch = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          parsedDate = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
        }
      }
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      finalExpiryDate = parsedDate;
    } else {
      // If we still couldn't parse the date, use a default (7 days from now)
      finalExpiryDate = new Date();
      finalExpiryDate.setDate(finalExpiryDate.getDate() + 7);
    }
  } else {
    finalExpiryDate = new Date();
    finalExpiryDate.setDate(finalExpiryDate.getDate() + 7); // Default 7 days
  }

  // Format date as "05 Sept 2025"
  const day = finalExpiryDate.getDate().toString().padStart(2, '0');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = monthNames[finalExpiryDate.getMonth()];
  const year = finalExpiryDate.getFullYear();
  const formattedDate = `${day} ${month} ${year}`;

  // Position the date below the name section with rectangle
  const dateY = nameY + totalNameHeight + namePadding + 20; // 20 dots spacing after rectangle
  const dateX = centerText(labelWidth, `Best Before: ${formattedDate}`, 3, 1);
  tspl += `TEXT ${dateX},${dateY},"3",0,1,1,"Best Before: ${formattedDate}"\n`;

  // Ingredients with allergens
  const hasStorageInstruction = !!ppdsExtras?.storageInstruction?.trim();
  const showNetWt = !!ppdsExtras?.showNetWt && !!ppdsExtras?.netWt?.trim();
  const showPrice = !!ppdsExtras?.showPrice && !!ppdsExtras?.price?.trim();
  const hasFooterExtras = hasStorageInstruction || showNetWt || showPrice;
  const reservedFooterHeight = hasFooterExtras ? 70 : 0; // line + storage + netwt/price

  if (menuItem.ingredients && menuItem.ingredients.length > 0) {
    let ingredientsText = 'Ingredients: ';

    // Process ingredients with allergen highlighting
    // Handle both string arrays and object arrays
    const ingredientList = menuItem.ingredients.map((ingredient: any) => {
      // Extract ingredient name from object or use string directly
      const ingredientName =
        typeof ingredient === 'string'
          ? ingredient
          : ingredient.ingredientName || ingredient.name || String(ingredient);

      // Check if ingredient contains allergens using fullIngredients data
      let fullIngredientObject = null as any;
      if (menuItem.fullIngredients && Array.isArray(menuItem.fullIngredients)) {
        const foundIngredient = menuItem.fullIngredients.find(
          (ing: any) => ing.ingredientName === ingredientName,
        );
        fullIngredientObject = foundIngredient;
      } else {
        fullIngredientObject = ingredient;
      }

      // Extract allergens from the ingredient object
      if (
        fullIngredientObject &&
        fullIngredientObject.allergens &&
        fullIngredientObject.allergens.length > 0
      ) {
        const allergenWarnings = fullIngredientObject.allergens
          .map((a: any) => {
            const allergenName = typeof a === 'string' ? a : a.allergenName;
            return allergenName ? `*${allergenName.toUpperCase()}*` : '';
          })
          .filter(Boolean)
          .join(', ');
        return `${ingredientName} ${allergenWarnings}`;
      }
      return ingredientName;
    });

    ingredientsText += ingredientList.join(', ');

    // Word wrapping for ingredients (40 character limit - prevents right overflow)
    const maxCharsPerLine = 40;
    const words = ingredientsText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        currentLine = word;
      }
    });
    if (currentLine) {
      lines.push(currentLine.trim());
    }

    // Print ingredients lines
    const ingredientsStartY = dateY + 20;
    const maxIngredientY = 320 - reservedFooterHeight - 5;
    const maxIngredientLines = Math.max(
      1,
      Math.floor((maxIngredientY - ingredientsStartY) / 20),
    );
    const visibleLines =
      lines.length > maxIngredientLines
        ? [
            ...lines.slice(0, maxIngredientLines - 1),
            `${lines[maxIngredientLines - 1].slice(0, 34)}...`,
          ]
        : lines;

    visibleLines.forEach((line, index) => {
      const lineY = ingredientsStartY + index * 20;
      tspl += `TEXT 10,${lineY},"3",0,1,1,"${line}"\n`;
    });
  }

  if (hasFooterExtras) {
    const separatorY = 285;
    const storageY = 258;
    const extrasY = 292;

    tspl += `LINE 8,${separatorY},472,${separatorY},1\n`;

    if (hasStorageInstruction) {
      const storageLine = sanitizeTSPLText(
        (ppdsExtras?.storageInstruction || '').replace(/\n/g, ' ').trim(),
      );
      const wrappedStorage = wrapText(`Storage: ${storageLine}`, 46);
      tspl += `TEXT 10,${storageY},"2",0,1,1,"${
        sanitizeTSPLText(wrappedStorage[0] || 'Storage: Keep refrigerated below 5C')
      }"\n`;
    }

    if (showNetWt) {
      tspl += `TEXT 10,${extrasY},"3",0,1,1,"Net Wt: ${sanitizeTSPLText(
        ppdsExtras?.netWt?.trim() || '',
      )}"\n`;
    }
    if (showPrice) {
      const priceText = `Price: ${sanitizeTSPLText(ppdsExtras?.price?.trim() || '')}`;
      const priceX = Math.max(290, 470 - priceText.length * 10);
      tspl += `TEXT ${priceX},${extrasY},"3",0,1,1,"${priceText}"\n`;
    }
  }

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate TSPL commands for ETC (Custom) labels
 * Similar to menu item labels but uses custom "contains" text instead of allergen detection
 */
export const generateETCLabel = (
  menuItem: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
  customContains?: string,
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label (60mm × 40mm for ETC labels)
  tspl += `SIZE 60mm,40mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // Calculate positions for 60mm × 40mm label using dynamic DPI
  const labelWidth = Math.round((60 / 25.4) * dpi); // 60mm → dots
  const labelHeight = Math.round((40 / 25.4) * dpi); // 40mm → dots

  // Menu item name with optimal font sizing (same as menu item label)
  const itemName = menuItem.menuItemName || menuItem.name;

  // Use the same calculateOptimalFontSize function as menu item label
  const fontConfig = calculateOptimalFontSize(itemName, labelWidth);
  const nameFontSize = fontConfig.fontSize;
  const nameMagnification = fontConfig.magnification;
  const nameCharWidth = fontConfig.charWidth;

  console.log(`🔍 ETC Label Font Selection:`);
  console.log(`   Item: "${itemName}"`);
  console.log(`   Selected Font: ${nameFontSize} × ${nameMagnification}`);
  console.log(`   Character Width: ${nameCharWidth} dots`);
  console.log(`   Total Text Width: ${itemName.length * nameCharWidth} dots`);
  console.log(`   Label Width: ${labelWidth} dots`);

  // Word wrapping logic for long item names with smart line breaking
  const maxCharsPerLine = Math.floor((labelWidth - 20) / nameCharWidth); // Leave 10 dots margin on each side to prevent cutoff
  let nameLines: string[] = [];
  let totalNameHeight = 0;

  // Smart line breaking: prefer 2 lines for better font size if possible
  if (itemName.length > maxCharsPerLine || itemName.length > 20) {
    // Split into multiple lines (either forced by length or preferred for readability)
    const words = itemName.split(' ');

    // For 2-line preference, try to create balanced lines
    if (itemName.length > 20 && words.length >= 2) {
      // Find the middle point to create balanced lines
      const midPoint = Math.ceil(itemName.length / 2);
      let firstLine = '';
      let secondLine = '';

      for (const word of words) {
        if ((firstLine + ' ' + word).trim().length <= midPoint) {
          firstLine += (firstLine ? ' ' : '') + word;
        } else {
          secondLine = words.slice(words.indexOf(word)).join(' ');
          break;
        }
      }

      if (firstLine && secondLine) {
        nameLines = [firstLine.trim(), secondLine.trim()];
      } else {
        // Fallback to original logic if balanced split fails
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) nameLines.push(currentLine.trim());
            currentLine = word;
          }
        }
        if (currentLine) nameLines.push(currentLine.trim());
      }
    } else {
      // Original logic for other cases
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) nameLines.push(currentLine.trim());
          currentLine = word;
        }
      }
      if (currentLine) nameLines.push(currentLine.trim());
    }

    totalNameHeight = nameLines.length * 33; // 33 dots per line (20 for text + 13 for spacing) for better readability
  } else {
    // Single line only for very short names
    nameLines = [itemName];
    totalNameHeight = 20; // Single line height
  }

  // Calculate starting Y position for the name section
  const nameY = 20; // Reduced from 45 to 20 to remove extra space above rectangle

  // Calculate X position for each line (center each line individually)
  // Use the same centering approach as menu item label that works perfectly
  const nameXPositions = nameLines.map(line => {
    const centerX = centerText(
      labelWidth,
      line,
      nameFontSize,
      nameMagnification,
    );
    console.log(
      `🔍 Centering "${line}": fontSize=${nameFontSize}, mag=${nameMagnification}, centerX=${centerX}`,
    );
    return centerX;
  });

  // Draw rectangle around the menu item name (adjusts for multiple lines)
  const namePadding = 15; // Reduced from 20 to 15 for tighter fit
  const rectLeft = 15; // Fixed left margin to prevent cutoff
  const rectRight = labelWidth - 9; // Extended 6 more dots to the right (was 15, now 9)
  const rectTop = nameY - namePadding;
  const rectBottom = nameY + totalNameHeight + namePadding;

  // Draw rectangle outline around the menu item name
  tspl += `BOX ${rectLeft},${rectTop},${rectRight},${rectBottom},3\n`; // 3 = thicker outline

  // Print menu item name (handles multiple lines)
  nameLines.forEach((line, index) => {
    const lineY = nameY + index * 33; // Increased from 28 to 33 dots spacing between lines for better readability
    const lineX = nameXPositions[index];
    tspl += `TEXT ${lineX},${lineY},"${nameFontSize}",0,${nameMagnification},${nameMagnification},"${line}"\n`;
  });

  // Date information
  const today = new Date();

  // Use provided expiry date or calculate default (7 days from today)
  let finalExpiryDate: Date;
  if (expiryDate) {
    // Parse the provided expiry date string
    finalExpiryDate = new Date(expiryDate);
  } else {
    // Default to 7 days from today for menu items
    finalExpiryDate = new Date();
    finalExpiryDate.setDate(finalExpiryDate.getDate() + 7);
  }

  // Format date as "DD.MM.YYYY"
  const day = finalExpiryDate.getDate().toString().padStart(2, '0');
  const month = (finalExpiryDate.getMonth() + 1).toString().padStart(2, '0');
  const year = finalExpiryDate.getFullYear();
  const formattedDate = `${day}.${month}.${year}`;

  // Calculate date position (below the name section with rectangle)
  const dateY = nameY + totalNameHeight + namePadding + 20; // 20 dots spacing after rectangle
  const dateX = centerText(labelWidth, `Expires: ${formattedDate}`, 3, 1);
  tspl += `TEXT ${dateX},${dateY},"3",0,1,1,"Expires: ${formattedDate}"\n`;

  // Printed date and initials
  const printedDateY = dateY + 20;
  const todayFormatted = `${today.getDate().toString().padStart(2, '0')}.${(
    today.getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}.${today.getFullYear()}`;
  const printedText = initials
    ? `Printed: ${todayFormatted} ${initials}`
    : `Printed: ${todayFormatted}`;
  const printedX = centerText(labelWidth, printedText, 3, 1);
  tspl += `TEXT ${printedX},${printedDateY},"3",0,1,1,"${printedText}"\n`;

  // Custom contains text (instead of allergen detection)
  if (customContains && customContains.trim()) {
    const containsY = printedDateY + 20;
    const containsText = `Contains: ${customContains.trim()}`;

    // Word wrapping for contains text (45 character limit)
    const maxCharsPerLine = 45;
    const words = containsText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        currentLine = word;
      }
    });
    if (currentLine) {
      lines.push(currentLine.trim());
    }

    // Print contains lines
    lines.forEach((line, index) => {
      const lineY = containsY + index * 20;
      tspl += `TEXT 10,${lineY},"3",0,1,1,"${line}"\n`;
    });
  }

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

const sanitizeTSPLText = (value: string): string => value.replace(/"/g, "'");

const parseExpiryDateSafe = (expiryDate?: string): Date => {
  if (!expiryDate) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    return fallback;
  }

  const parsed = parseDate(expiryDate);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed;
  }

  const colonSplit = expiryDate.includes(':')
    ? expiryDate.split(':')[1]?.trim()
    : expiryDate;
  const nativeDate = new Date(colonSplit || expiryDate);
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate;
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 7);
  return fallback;
};

const formatDateDDMMYYYY = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getIngredientNames = (menuItem: any): string[] => {
  if (!menuItem?.ingredients || !Array.isArray(menuItem.ingredients)) {
    return [];
  }
  return menuItem.ingredients
    .map((ingredient: any) =>
      typeof ingredient === 'string'
        ? ingredient
        : ingredient?.ingredientName || ingredient?.name,
    )
    .filter(Boolean);
};

const getAllergenNames = (source: any): string[] => {
  const allergenSet = new Set<string>();

  const ingredientsForLookup =
    source?.fullIngredients && Array.isArray(source.fullIngredients)
      ? source.fullIngredients
      : source?.ingredients && Array.isArray(source.ingredients)
      ? source.ingredients
      : [];

  ingredientsForLookup.forEach((ingredient: any) => {
    if (!ingredient?.allergens || !Array.isArray(ingredient.allergens)) {
      return;
    }
    ingredient.allergens.forEach((allergen: any) => {
      const name =
        typeof allergen === 'string' ? allergen : allergen?.allergenName;
      if (name) {
        allergenSet.add(name.toUpperCase());
      }
    });
  });

  if (allergenSet.size === 0 && source?.allergens && Array.isArray(source.allergens)) {
    source.allergens.forEach((allergen: any) => {
      const name =
        typeof allergen === 'string' ? allergen : allergen?.allergenName;
      if (name) {
        allergenSet.add(name.toUpperCase());
      }
    });
  }

  return Array.from(allergenSet);
};

const build80mmLabel = ({
  title,
  expiryDate,
  bodyText,
  allergensText,
  packedSuffix,
  config,
}: {
  title: string;
  expiryDate?: string;
  bodyText: string;
  allergensText?: string;
  packedSuffix?: string;
  config?: Partial<TSPLConfig>;
}): string => {
  const {gap = 3, direction = 1, density = 8} = config || {};
  const labelWidth = 448; // 56mm @ 203dpi
  const labelHeight = 640; // 80mm @ 203dpi
  const left = 24;
  const right = 24;
  const usableWidth = labelWidth - left - right;
  const maxBodyLines = 8;

  let tspl = '';
  tspl += 'SIZE 56 mm,80 mm\n';
  tspl += `GAP ${gap} mm,0 mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  const safeTitle = sanitizeTSPLText(title || 'LABEL');
  const font = calculateOptimalFontSize(safeTitle, usableWidth, 0.9);
  const maxHeaderChars = Math.max(
    12,
    Math.floor((usableWidth - 16) / Math.max(font.charWidth, 6)),
  );
  let headerLines = wrapText(safeTitle, maxHeaderChars).slice(0, 3);
  if (headerLines.length === 0) {
    headerLines = ['LABEL'];
  }
  if (wrapText(safeTitle, maxHeaderChars).length > 3) {
    const last = headerLines[2];
    headerLines[2] = `${last.substring(0, Math.max(0, last.length - 3))}...`;
  }

  const headerStartY = 20;
  const headerLineHeight = 30;
  const headerBoxTop = headerStartY - 10;
  const headerBoxBottom =
    headerStartY + headerLines.length * headerLineHeight + 6;
  tspl += `BOX ${left},${headerBoxTop},${labelWidth - right},${headerBoxBottom},2\n`;

  headerLines.forEach((line, index) => {
    const x = left + centerText(usableWidth, line, font.fontSize, font.magnification);
    const y = headerStartY + index * headerLineHeight;
    tspl += `TEXT ${x},${y},"${font.fontSize}",0,${font.magnification},${font.magnification},"${sanitizeTSPLText(
      line,
    )}"\n`;
  });

  const parsedExpiry = parseExpiryDateSafe(expiryDate);
  const today = new Date();
  const useBy = `Use by: ${formatDateDDMMYYYY(parsedExpiry)}`;
  const packed = `Packed: ${formatDateDDMMYYYY(today)}`;

  let cursorY = headerBoxBottom + 18;
  tspl += `TEXT ${left},${cursorY},"3",0,1,1,"${useBy}"\n`;
  cursorY += 28;
  tspl += `TEXT ${left},${cursorY},"3",0,1,1,"${packed}"\n`;
  cursorY += 28;

  if (packedSuffix) {
    tspl += `TEXT ${left},${cursorY},"3",0,1,1,"${sanitizeTSPLText(packedSuffix)}"\n`;
    cursorY += 30;
  }

  const safeBody = sanitizeTSPLText(bodyText || '');
  const maxBodyChars = 42;
  let bodyLines = wrapText(safeBody, maxBodyChars);
  if (bodyLines.length > maxBodyLines) {
    bodyLines = bodyLines.slice(0, maxBodyLines);
    const last = bodyLines[bodyLines.length - 1];
    bodyLines[bodyLines.length - 1] = `${last.substring(
      0,
      Math.max(0, last.length - 3),
    )}...`;
  }

  bodyLines.forEach(line => {
    tspl += `TEXT ${left},${cursorY},"2",0,1,1,"${line}"\n`;
    cursorY += 24;
  });

  if (allergensText) {
    const safeAllergens = sanitizeTSPLText(allergensText);
    const warningLines = wrapText(`Contains: ${safeAllergens}`, 34).slice(0, 3);
    const warningHeight = warningLines.length * 24 + 12;
    const warningTop = Math.min(cursorY + 8, labelHeight - 180);
    const warningBottom = Math.min(warningTop + warningHeight, labelHeight - 100);
    tspl += `BOX ${left},${warningTop},${labelWidth - right},${warningBottom},2\n`;

    warningLines.forEach((line, index) => {
      const y = warningTop + 8 + index * 24;
      tspl += `TEXT ${left + 8},${y},"2",0,1,1,"${line}"\n`;
    });
  }

  tspl += 'PRINT 1,1\n';
  return tspl;
};

/**
 * 80mm formatter variants for non-PPDS label types.
 */
export const generateIngredientLabel80mm = (
  ingredient: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
): string => {
  const ingredientName = ingredient?.ingredientName || 'Ingredient';
  const allergens = getAllergenNames(ingredient);
  return build80mmLabel({
    title: ingredientName,
    expiryDate,
    bodyText: `Ingredient: ${ingredientName}`,
    allergensText:
      allergens.length > 0 ? allergens.join(', ') : 'Does not contain allergens',
    packedSuffix: initials ? `PREP | ${initials}` : 'PREP',
    config,
  });
};

export const generateMenuItemLabel80mm = (
  menuItem: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
): string => {
  const itemName = menuItem?.menuItemName || menuItem?.name || 'Menu Item';
  const ingredientNames = getIngredientNames(menuItem);
  const allergens = getAllergenNames(menuItem);
  const labelType =
    menuItem?.labelType && menuItem.labelType !== 'default'
      ? String(menuItem.labelType).toUpperCase()
      : '';
  const suffixParts = [labelType, initials].filter(Boolean);

  return build80mmLabel({
    title: itemName,
    expiryDate,
    bodyText: `Ingredients: ${
      ingredientNames.length > 0 ? ingredientNames.join(', ') : 'None'
    }`,
    allergensText:
      allergens.length > 0 ? allergens.join(', ') : 'Does not contain allergens',
    packedSuffix: suffixParts.join(' | '),
    config,
  });
};

export const generatePPDLabel80mm = (
  menuItem: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
): string => {
  const itemName = menuItem?.menuItemName || menuItem?.name || 'PPD Label';
  const ingredientNames = getIngredientNames(menuItem);
  const allergens = getAllergenNames(menuItem);

  return build80mmLabel({
    title: itemName,
    expiryDate,
    bodyText: `Ingredients: ${
      ingredientNames.length > 0 ? ingredientNames.join(', ') : 'None'
    }`,
    allergensText:
      allergens.length > 0 ? allergens.join(', ') : 'Does not contain allergens',
    packedSuffix: 'PPD',
    config,
  });
};

export const generateETCLabel80mm = (
  menuItem: any,
  expiryDate?: string,
  config: Partial<TSPLConfig> = {},
  initials?: string,
  customContains?: string,
): string => {
  const itemName = menuItem?.menuItemName || menuItem?.name || 'ETC Label';
  const ingredientNames = getIngredientNames(menuItem);
  const containsText =
    customContains && customContains.trim()
      ? customContains.trim()
      : ingredientNames.join(', ');

  return build80mmLabel({
    title: itemName,
    expiryDate,
    bodyText: `Contains: ${containsText || 'None'}`,
    packedSuffix: initials ? `ETC | ${initials}` : 'ETC',
    config,
  });
};

/**
 * Generate debug TSPL label with dots and measurements for calibration
 * This helps understand exact printer dimensions and positioning
 */
export const generateDebugTSPLLabel = (): string => {
  let tspl = '';

  // Initialize label with exact 60x40mm dimensions
  tspl += `SIZE 60 mm,40 mm\n`;
  tspl += `GAP 3 mm,0 mm\n`;
  tspl += `DIRECTION 1\n`;
  tspl += `CLS\n`;

  // Label dimensions at 203 DPI
  const labelWidth = 480; // 60mm = 480 dots
  const labelHeight = 320; // 40mm = 320 dots

  // ===== BORDER FRAME =====
  // Draw border around entire label to see exact boundaries
  tspl += `BOX 0,0,${labelWidth},${labelHeight},2\n`;

  // ===== GRID LINES =====
  // Vertical grid lines every 50 dots
  for (let x = 50; x < labelWidth; x += 50) {
    tspl += `LINE ${x},0,${x},${labelHeight},1\n`;
  }

  // Horizontal grid lines every 50 dots
  for (let y = 50; y < labelHeight; y += 50) {
    tspl += `LINE 0,${y},${labelWidth},${y},1\n`;
  }

  // ===== CENTER LINES =====
  // Center vertical line
  tspl += `LINE ${labelWidth / 2},0,${labelWidth / 2},${labelHeight},2\n`;
  // Center horizontal line
  tspl += `LINE 0,${labelHeight / 2},${labelWidth},${labelHeight / 2},2\n`;

  // ===== FONT TESTING =====
  // Test each font size with sample text
  const fontTests = [
    {font: 1, text: 'Font1', y: 30},
    {font: 2, text: 'Font2', y: 60},
    {font: 3, text: 'Font3', y: 90},
    {font: 4, text: 'Font4', y: 120},
    {font: 5, text: 'Font5', y: 150},
  ];

  fontTests.forEach(test => {
    // Left-aligned text
    tspl += `TEXT 10,${test.y},"${test.font}",0,1,1,"${test.text}"\n`;

    // Right-aligned text
    const textWidth =
      test.text.length *
      (test.font === 1
        ? 6
        : test.font === 2
        ? 8
        : test.font === 3
        ? 8
        : test.font === 4
        ? 12
        : 16);
    const rightX = labelWidth - textWidth - 10;
    tspl += `TEXT ${rightX},${test.y},"${test.font}",0,1,1,"${test.text}"\n`;

    // Centered text
    const centerX = (labelWidth - textWidth) / 2;
    tspl += `TEXT ${centerX},${test.y + 20},"${test.font}",0,1,1,"${
      test.text
    }"\n`;
  });

  // ===== DOT PATTERNS =====
  // Corner dots to mark exact boundaries
  tspl += `PUTB 0,0,1\n`; // Top-left
  tspl += `PUTB ${labelWidth - 1},0,1\n`; // Top-right
  tspl += `PUTB 0,${labelHeight - 1},1\n`; // Bottom-left
  tspl += `PUTB ${labelWidth - 1},${labelHeight - 1},1\n`; // Bottom-right

  // Center dot
  tspl += `PUTB ${labelWidth / 2},${labelHeight / 2},1\n`;

  // ===== MEASUREMENT MARKERS =====
  // Add measurement text
  tspl += `TEXT 10,200,"3",0,1,1,"Label: 60mm x 40mm"\n`;
  tspl += `TEXT 10,220,"3",0,1,1,"Dots: ${labelWidth} x ${labelHeight}"\n`;
  tspl += `TEXT 10,240,"3",0,1,1,"DPI: 203"\n`;
  tspl += `TEXT 10,260,"3",0,1,1,"1mm = ${Math.round(203 / 25.4)} dots"\n`;

  // ===== POSITIONING TEST =====
  // Test text at various positions
  tspl += `TEXT 100,280,"2",0,1,1,"X:100 Y:280"\n`;
  tspl += `TEXT 200,280,"2",0,1,1,"X:200 Y:280"\n`;
  tspl += `TEXT 300,280,"2",0,1,1,"X:300 Y:280"\n`;

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate simple custom label with heading and subheading
 * Uses the same font sizing and centering logic as menu item labels
 */
export const generateSimpleCustomLabel = (
  heading: string,
  subheading: string,
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 0, density = 8} = config;

  let tspl = '';

  // Initialize label (60mm × 40mm for custom labels)
  tspl += `SIZE 60mm,40mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += `DENSITY ${density}\n`;
  tspl += 'CLS\n';

  // Calculate positions for 60mm × 40mm label using dynamic DPI
  const labelWidth = Math.round((60 / 25.4) * dpi); // 60mm → dots
  const labelHeight = Math.round((40 / 25.4) * dpi); // 40mm → dots

  // Heading with optimal font sizing (same as menu item labels)
  const fontConfig = calculateOptimalFontSize(heading, labelWidth);
  const headingFontSize = fontConfig.fontSize;
  const headingMagnification = fontConfig.magnification;
  const headingCharWidth = fontConfig.charWidth;

  console.log(`🔍 Simple Custom Label Font Selection:`);
  console.log(`   Heading: "${heading}"`);
  console.log(`   Selected Font: ${headingFontSize} × ${headingMagnification}`);
  console.log(`   Character Width: ${headingCharWidth} dots`);
  console.log(`   Total Text Width: ${heading.length * headingCharWidth} dots`);
  console.log(`   Label Width: ${labelWidth} dots`);

  // Word wrapping logic for long headings with smart line breaking
  const maxCharsPerLine = Math.floor((labelWidth - 20) / headingCharWidth); // Leave 10 dots margin on each side
  let headingLines: string[] = [];
  let totalHeadingHeight = 0;

  // Smart line breaking: prefer 2 lines for better font size if possible
  if (heading.length > maxCharsPerLine || heading.length > 20) {
    // Split into multiple lines (either forced by length or preferred for readability)
    const words = heading.split(' ');

    // For 2-line preference, try to create balanced lines
    if (heading.length > 20 && words.length >= 2) {
      // Find the middle point to create balanced lines
      const midPoint = Math.ceil(heading.length / 2);
      let firstLine = '';
      let secondLine = '';

      for (const word of words) {
        if ((firstLine + ' ' + word).trim().length <= midPoint) {
          firstLine += (firstLine ? ' ' : '') + word;
        } else {
          secondLine = words.slice(words.indexOf(word)).join(' ');
          break;
        }
      }

      if (firstLine && secondLine) {
        headingLines = [firstLine.trim(), secondLine.trim()];
      } else {
        // Fallback to original logic if balanced split fails
        let currentLine = '';
        for (const word of words) {
          if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) headingLines.push(currentLine.trim());
            currentLine = word;
          }
        }
        if (currentLine) headingLines.push(currentLine.trim());
      }
    } else {
      // Original logic for other cases
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) headingLines.push(currentLine.trim());
          currentLine = word;
        }
      }
      if (currentLine) headingLines.push(currentLine.trim());
    }

    totalHeadingHeight = headingLines.length * 33; // 33 dots per line (20 for text + 13 for spacing)
  } else {
    // Single line only for very short headings
    headingLines = [heading];
    totalHeadingHeight = 20; // Single line height
  }

  // Calculate starting Y position for the heading section
  const headingY = 20; // Same as menu item labels

  // Calculate X position for each line (center each line individually)
  const headingXPositions = headingLines.map(line => {
    const centerX = centerText(
      labelWidth,
      line,
      headingFontSize,
      headingMagnification,
    );
    console.log(
      `🔍 Centering heading "${line}": fontSize=${headingFontSize}, mag=${headingMagnification}, centerX=${centerX}`,
    );
    return centerX;
  });

  // Print heading (handles multiple lines) - NO RECTANGLE for simple labels
  headingLines.forEach((line, index) => {
    const lineY = headingY + index * 33; // Same spacing as menu item labels
    const lineX = headingXPositions[index];
    tspl += `TEXT ${lineX},${lineY},"${headingFontSize}",0,${headingMagnification},${headingMagnification},"${line}"\n`;
  });

  // Subheading below the heading (no rectangle, so adjust position)
  const subheadingY = headingY + totalHeadingHeight + 20; // 20 dots spacing after heading
  const subheadingFontSize = 3; // Same as menu item labels

  // Word wrapping for subheading with 45 character limit (same as menu item labels)
  const maxSubheadingCharsPerLine = 45; // Fixed 45 character limit
  const subheadingWords = subheading.split(' ');
  const subheadingLines: string[] = [];
  let currentSubheadingLine = '';

  subheadingWords.forEach(word => {
    // Check if adding this word would exceed 45 characters
    const testLine =
      currentSubheadingLine + (currentSubheadingLine ? ' ' : '') + word;

    if (testLine.length <= maxSubheadingCharsPerLine) {
      // Word fits on current line
      currentSubheadingLine = testLine;
    } else {
      // Word doesn't fit, start new line
      if (currentSubheadingLine) {
        subheadingLines.push(currentSubheadingLine.trim());
      }
      currentSubheadingLine = word;
    }
  });

  // Add the last line if there's content
  if (currentSubheadingLine) {
    subheadingLines.push(currentSubheadingLine.trim());
  }

  // Print each subheading line with consistent left alignment
  subheadingLines.forEach((line, index) => {
    // All lines start at the same X position (10 dots from left)
    tspl += `TEXT 10,${
      subheadingY + index * 20
    },"${subheadingFontSize}",0,1,1,"${line}"\n`;
  });

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

/**
 * Generate TSPL commands for circular allergen sticker (50mm diameter)
 * Format: Item name, Contains allergens, Use By date
 * Layout matches the circular label design with horizontal separators
 */
export const generateCircularAllergenSticker = (
  labelData: {
    itemName: string;
    allergens: string[];
    expiryDate: string;
    ingredientsLine?: string;
  },
  config: Partial<TSPLConfig> = {},
): string => {
  const {dpi = 203, gap = 3, direction = 1, density = 8} = config;

  let tspl = '';

  // Initialize label with 50mm × 50mm dimensions (square, die-cut to circle)
  tspl += `SIZE 50mm,50mm\n`;
  tspl += `GAP ${gap}mm,0mm\n`;
  tspl += `DIRECTION ${direction}\n`;
  tspl += 'CLS\n';

  // Using 203 DPI: 50mm = ~400 dots. Use narrower effective width to shift content further left (fix right cutoff).
  const labelWidth = 400;
  const effectiveLabelWidth = 320;
  const labelHeight = 400;
  const centerX = labelWidth / 2;
  const leftOffset = Math.floor((labelWidth - effectiveLabelWidth) / 2) - 5; // shift all text left (+ half char)

  // Format expiry date to DD/MM/YYYY
  let formattedDate = labelData.expiryDate || '';
  try {
    // Try to parse and format the date
    let date: Date | null = null;
    
    // Try DD.MM.YYYY format
    const parts = formattedDate.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else if (formattedDate.includes('-')) {
      // Try YYYY-MM-DD format
      date = new Date(formattedDate);
    } else {
      date = new Date(formattedDate);
    }

    if (date && !isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      formattedDate = `${day}/${month}/${year}`;
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    // Keep original date string if parsing fails
  }

  // ===== Item Name Section (Top) =====
  // Big font (3×2): only ~10 chars fit per line. If >20 chars, use small font and fit in 2 lines.
  const itemName = labelData.itemName.toUpperCase();
  const BIG_FONT_MAX_CHARS = 10;
  const SMALL_FONT_MAX_CHARS = 18;

  let itemNameLines: string[] = [];
  let useSmallItemFont: boolean;

  if (itemName.length <= BIG_FONT_MAX_CHARS) {
    itemNameLines = [itemName];
    useSmallItemFont = false;
  } else if (itemName.length <= 20) {
    // 2 lines, max 10 chars per line (word wrap then hard break)
    const words = itemName.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      const candidate = (line1 + (line1 ? ' ' : '') + word).trim();
      if (candidate.length <= BIG_FONT_MAX_CHARS) {
        line1 = candidate;
      } else {
        line2 = words.slice(words.indexOf(word)).join(' ').trim();
        break;
      }
    }
    if (!line2 && line1) {
      line1 = itemName.substring(0, BIG_FONT_MAX_CHARS).trim();
      line2 = itemName.substring(BIG_FONT_MAX_CHARS).trim();
    }
    if (line1.length > BIG_FONT_MAX_CHARS) {
      line1 = line1.substring(0, BIG_FONT_MAX_CHARS);
      line2 = (line1.length ? itemName.substring(line1.length) : itemName).trim();
    }
    itemNameLines = [line1, line2].filter(Boolean);
    useSmallItemFont = false;
  } else {
    // >20 chars: small font, 2 lines
    useSmallItemFont = true;
    const words = itemName.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      const candidate = (line1 + (line1 ? ' ' : '') + word).trim();
      if (candidate.length <= SMALL_FONT_MAX_CHARS) {
        line1 = candidate;
      } else {
        line2 = words.slice(words.indexOf(word)).join(' ').trim();
        break;
      }
    }
    if (!line2 && line1) {
      const mid = Math.ceil(itemName.length / 2);
      line1 = itemName.substring(0, mid).trim();
      line2 = itemName.substring(mid).trim();
    }
    if (line1.length > SMALL_FONT_MAX_CHARS) {
      line1 = line1.substring(0, SMALL_FONT_MAX_CHARS);
      line2 = itemName.substring(line1.length).trim();
    }
    if (line2.length > SMALL_FONT_MAX_CHARS) {
      line2 = line2.substring(0, SMALL_FONT_MAX_CHARS);
    }
    itemNameLines = [line1, line2].filter(Boolean).slice(0, 2);
  }

  const itemFontScale = useSmallItemFont ? 1 : 2;
  const itemLineSpacing = useSmallItemFont ? 28 : 40;
  const itemNameStartY = 60;
  itemNameLines.forEach((line, index) => {
    const lineX = leftOffset + centerText(effectiveLabelWidth, line, 3, itemFontScale);
    const lineY = itemNameStartY + index * itemLineSpacing;
    tspl += `TEXT ${lineX},${lineY},"3",0,${itemFontScale},${itemFontScale},"${line}"\n`;
  });

  const itemNameEndY = itemNameStartY + itemNameLines.length * itemLineSpacing;

  // ===== Ingredients Section =====
  let ingredientsText = '';
  if (labelData.ingredientsLine && labelData.ingredientsLine.trim().length > 0) {
    ingredientsText = `Ingredients: ${labelData.ingredientsLine}`;
  }

  const maxIngredientsChars = 22;
  const words = ingredientsText.split(' ');
  const ingredientLines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    if (testLine.length <= maxIngredientsChars) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        ingredientLines.push(currentLine.trim());
      }
      currentLine = word;
    }
  });
  if (currentLine) {
    ingredientLines.push(currentLine.trim());
  }

  const ingredientsStartY = itemNameEndY + 25;
  ingredientLines.forEach((line, index) => {
    const lineX = leftOffset + centerText(effectiveLabelWidth, line, 3, 1);
    const lineY = ingredientsStartY + index * 22;
    tspl += `TEXT ${lineX},${lineY},"3",0,1,1,"${line}"\n`;
  });

  // ===== Best Before Date Section (Bottom) =====
  const useByStartY = ingredientsStartY + ingredientLines.length * 22 + 35;
  const useByLabelX = leftOffset + centerText(effectiveLabelWidth, 'Best Before:', 3, 1);
  tspl += `TEXT ${useByLabelX},${useByStartY},"3",0,1,1,"Best Before:"\n`;
  const dateX = leftOffset + centerText(effectiveLabelWidth, formattedDate, 3, 1);
  tspl += `TEXT ${dateX},${useByStartY + 20},"3",0,1,1,"${formattedDate}"\n`;

  // Print the label
  tspl += 'PRINT 1,1\n';

  return tspl;
};

export default {
  mmToDots,
  generateLabelSetup,
  generateTextCommand,
  generateBarcodeCommand,
  generateQRCodeCommand,
  generateImageCommand,
  generateDirectTSPLLabel,
  generatePPDSLabel,
  generateUseFirstLabel,
  generateUseFirstLabel80mm,
  generateIngredientLabel,
  generateIngredientLabel80mm,
  generateMenuItemLabel,
  generateMenuItemLabel80mm,
  generatePPDLabel,
  generatePPDLabel80mm,
  generateETCLabel,
  generateETCLabel80mm,
  generateDefrostLabel,
  generateDefrostLabel80mm,
  generateDebugTSPLLabel,
  generateSimpleCustomLabel,
  generateSimpleCustomLabel80mm,
  generateCircularAllergenSticker,
};
