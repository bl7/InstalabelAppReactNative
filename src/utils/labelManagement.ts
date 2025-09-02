// Label management system for InstaLabel

import {Ingredient, Allergen} from '../services/api';

export type LabelType =
  | 'cooked'
  | 'prep'
  | 'ppds'
  | 'use-first'
  | 'defrost'
  | 'default';
export type LabelHeight = '31mm' | '40mm' | '56mm' | '80mm';

// Label type configuration
export interface LabelTypeConfig {
  type: LabelType;
  name: string;
  description: string;
  defaultExpiryDays: number;
  format: 'expires' | 'best-before';
  showPrintedDate: boolean;
  showIngredients: boolean;
  showAllergens: boolean;
  specialIndicators: string[];
}

// Label type configurations
export const LABEL_TYPE_CONFIGS: Record<LabelType, LabelTypeConfig> = {
  cooked: {
    type: 'cooked',
    name: 'Cooked',
    description: 'For hot food items served immediately',
    defaultExpiryDays: 1,
    format: 'expires',
    showPrintedDate: true,
    showIngredients: true,
    showAllergens: true,
    specialIndicators: ['(COOK)'],
  },
  prep: {
    type: 'prep',
    name: 'Prep',
    description: 'For prepared items stored in advance',
    defaultExpiryDays: 3,
    format: 'expires',
    showPrintedDate: true,
    showIngredients: true,
    showAllergens: true,
    specialIndicators: ['(PREP)'],
  },
  ppds: {
    type: 'ppds',
    name: 'PPDS',
    description: 'Pre-Packaged for Direct Sale (UK compliance)',
    defaultExpiryDays: 5,
    format: 'best-before',
    showPrintedDate: false,
    showIngredients: true,
    showAllergens: true,
    specialIndicators: [],
  },
  'use-first': {
    type: 'use-first',
    name: 'Use First',
    description: 'For items that need immediate use',
    defaultExpiryDays: 0,
    format: 'expires',
    showPrintedDate: false, // No printed date for Use First labels
    showIngredients: false, // No ingredients for Use First labels
    showAllergens: false, // No allergens for Use First labels
    specialIndicators: ['USE FIRST'],
  },
  defrost: {
    type: 'defrost',
    name: 'Defrost',
    description: 'For frozen items that have been defrosted',
    defaultExpiryDays: 1, // 24 hours
    format: 'expires',
    showPrintedDate: true,
    showIngredients: true,
    showAllergens: true,
    specialIndicators: ['DEFROST'],
  },
  default: {
    type: 'default',
    name: 'Default',
    description: 'Standard label without type indicator',
    defaultExpiryDays: 2,
    format: 'expires',
    showPrintedDate: true,
    showIngredients: true,
    showAllergens: true,
    specialIndicators: [], // No special indicators for default type
  },
};

// Function to get default expiry days for label type
export function getDefaultExpiryDays(type: LabelType): number {
  return LABEL_TYPE_CONFIGS[type].defaultExpiryDays;
}

// Function to calculate expiry date
export function calculateExpiryDate(
  labelType: LabelType,
  customExpiry?: string,
  ingredientExpiryDays?: number,
): string {
  // If custom expiry is provided, use it
  if (customExpiry) {
    return customExpiry;
  }

  // Calculate based on label type and ingredient
  const baseExpiryDays = getDefaultExpiryDays(labelType);
  const finalExpiryDays = ingredientExpiryDays || baseExpiryDays;

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + finalExpiryDays);

  return formatDate(expiryDate);
}

// Function to format date for display
export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

// Function to parse date from string
export function parseDate(dateString: string): Date | null {
  const parts = dateString.split('.');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const date = new Date(year, month, day);
  if (
    date.getDate() !== day ||
    date.getMonth() !== month ||
    date.getFullYear() !== year
  ) {
    return null;
  }

  return date;
}

// Function to validate expiry date
export function validateExpiryDate(dateString: string): boolean {
  let date: Date | null = null;

  // Try parsing as DD.MM.YYYY format first
  date = parseDate(dateString);

  // If that fails, try parsing as YYYY-MM-DD format
  if (!date && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const parts = dateString.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);

    date = new Date(year, month, day);

    // Validate the parsed date
    if (
      date.getDate() !== day ||
      date.getMonth() !== month ||
      date.getFullYear() !== year
    ) {
      date = null;
    }
  }

  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date >= today;
}

// Function to get label format text
export function getLabelFormatText(labelType: LabelType): string {
  const config = LABEL_TYPE_CONFIGS[labelType];
  return config.format === 'expires' ? 'Expires' : 'Best Before';
}

// Function to generate label content
export function generateLabelContent(
  itemName: string,
  labelType: LabelType,
  expiryDate: string,
  ingredients: string[],
  allergens: string[],
  printedDate?: string,
  initials?: string,
): string[] {
  const config = LABEL_TYPE_CONFIGS[labelType];
  const lines: string[] = [];

  // Item name (always shown in header)
  lines.push(itemName.toUpperCase());

  // For PPDS labels, show minimal content
  if (labelType === 'ppds') {
    lines.push('Best Before:');
    if (ingredients.length > 0) {
      lines.push('Ingredients:');
      lines.push(ingredients.join(', '));
    }
    return lines;
  }

  // For other label types, show full content
  // Expiry date line with specific positioning
  const formatText = getLabelFormatText(labelType);
  lines.push(`${formatText}:`);

  // Printed date and special indicators line
  if (config.showPrintedDate && printedDate) {
    const today = new Date();
    const todayFormatted = formatDate(today);
    const indicator = config.specialIndicators[0] || '';
    lines.push(`Printed: ${todayFormatted} ${indicator}`.trim());
  }

  // Ingredients and allergens (if enabled)
  if (config.showIngredients && ingredients.length > 0) {
    if (config.showAllergens && allergens.length > 0) {
      // Show ingredients with allergen warnings
      const ingredientLines = ingredients.map(ingredient => {
        const ingredientAllergens = allergens.filter(allergen =>
          ingredient.toLowerCase().includes(allergen.toLowerCase()),
        );

        if (ingredientAllergens.length > 0) {
          const allergenWarnings = ingredientAllergens
            .map(a => `*${a.toUpperCase()}*`)
            .join(', ');
          return `${ingredient} (${allergenWarnings})`;
        }
        return ingredient;
      });

      lines.push(`Contains: ${ingredientLines.join(', ')}`);
    } else {
      // Show ingredients without allergen warnings
      lines.push(`Contains: ${ingredients.join(', ')}`);
    }
  }

  // Initials (if provided)
  if (initials) {
    lines.push(`Initials: ${initials}`);
  }

  return lines;
}

// Function to get label height description
export function getLabelHeightDescription(height: LabelHeight): string {
  const descriptions: Record<LabelHeight, string> = {
    '31mm': 'Compact labels - Minimal information',
    '40mm': 'Standard labels - Moderate detail',
    '56mm': 'Wide labels - 56mm width with full information',
    '80mm': 'Extended labels - Full-size with maximum information',
  };

  return descriptions[height];
}

// Function to validate label type
export function isValidLabelType(type: string): type is LabelType {
  return Object.keys(LABEL_TYPE_CONFIGS).includes(type);
}

// Function to get label type display name
export function getLabelTypeDisplayName(type: LabelType): string {
  return LABEL_TYPE_CONFIGS[type].name;
}

// Function to get label type description
export function getLabelTypeDescription(type: LabelType): string {
  return LABEL_TYPE_CONFIGS[type].description;
}

// Function to check if label type requires ingredients
export function requiresIngredients(type: LabelType): boolean {
  return LABEL_TYPE_CONFIGS[type].showIngredients;
}

// Function to check if label type requires allergens
export function requiresAllergens(type: LabelType): boolean {
  return LABEL_TYPE_CONFIGS[type].showAllergens;
}

// Function to get special indicators for label type
export function getSpecialIndicators(type: LabelType): string[] {
  return LABEL_TYPE_CONFIGS[type].specialIndicators;
}

// Function to calculate label height in pixels for UI (scaled down for preview)
export function getLabelHeightPixels(height: LabelHeight): number {
  const heightMap: Record<LabelHeight, number> = {
    '31mm': 174, // 70% of printer dots: 248 * 0.7 = 174
    '40mm': 224, // 70% of printer dots: 320 * 0.7 = 224
    '56mm': 313, // 70% of printer dots: 447 * 0.7 = 313
    '80mm': 447, // 70% of printer dots: 639 * 0.7 = 447
  };

  return heightMap[height] || 224;
}

// Function to calculate label width in pixels for UI (scaled down for preview)
export function getLabelWidthPixels(height: LabelHeight): number {
  // Standard label width is 60mm, PPDS is 56mm
  const isPPDS = height === '80mm'; // PPDS labels are 80mm height
  const actualWidth = isPPDS ? 56 : 60; // mm

  // Convert to dots: width × 203 DPI ÷ 25.4
  const dotsWidth = (actualWidth * 203) / 25.4;

  // Scale down to 70% for preview (more realistic size)
  return Math.round(dotsWidth * 0.7);
}

// Function to calculate label height in pixels for capture (full printer size)
export function getLabelHeightPixelsForCapture(height: LabelHeight): number {
  const heightMap: Record<LabelHeight, number> = {
    '31mm': 248, // Full printer dots: 31mm × 203 DPI / 25.4 = 248 dots
    '40mm': 320, // Full printer dots: 40mm × 203 DPI / 25.4 = 320 dots
    '56mm': 447, // Full printer dots: 56mm × 203 DPI / 25.4 = 447 dots
    '80mm': 639, // Full printer dots: 80mm × 203 DPI / 25.4 = 639 dots
  };

  return heightMap[height] || 320;
}

// Function to get optimal font size for label height
export function getOptimalFontSize(height: LabelHeight): number {
  const fontSizeMap: Record<LabelHeight, number> = {
    '31mm': 12,
    '40mm': 14,
    '56mm': 16, // Larger font for better readability on wider labels
    '80mm': 18,
  };

  return fontSizeMap[height] || 14;
}

// Function to generate label content with proper positioning for TSC printing
export function generateTSCLabelContent(
  itemName: string,
  labelType: LabelType,
  expiryDate: string,
  ingredients: string[] | Ingredient[],
  allergens: string[] | Allergen[],
  printedDate?: string,
  initials?: string,
  companyName?: string,
): {
  header: string;
  expiryLine: string;
  printedLine: string;
  ingredientsLine?: string;
  initialsLine?: string;
  allergenWarningLine?: string;
  storageInstructions?: string;
} {
  const config = LABEL_TYPE_CONFIGS[labelType];

  // Header is always the item name
  const header = itemName.toUpperCase();

  // For PPDS labels, show Use by date and ingredients list
  if (labelType === 'ppds') {
    const expiryLine = `Use by: ${expiryDate}`;

    let ingredientsLine: string | undefined;
    let allergenWarningLine: string | undefined;

    if (config.showIngredients && ingredients.length > 0) {
      if (config.showAllergens && allergens.length > 0) {
        // For PPDS: show ingredients with allergen warnings in parentheses
        const ingredientLines = ingredients.map(ingredient => {
          if (typeof ingredient === 'string') {
            // If ingredient is a string, check if it contains allergens
            const ingredientAllergens = allergens.filter(allergen =>
              ingredient
                .toLowerCase()
                .includes(
                  typeof allergen === 'string'
                    ? allergen.toLowerCase()
                    : allergen.allergenName?.toLowerCase() || '',
                ),
            );
            if (ingredientAllergens.length > 0) {
              const allergenWarnings = ingredientAllergens
                .map(a =>
                  typeof a === 'string'
                    ? a.toUpperCase()
                    : a.allergenName?.toUpperCase() || 'UNKNOWN',
                )
                .join(', ');
              return `${ingredient} (${allergenWarnings})`;
            }
            return ingredient;
          } else {
            // If ingredient is an object, check for allergens
            const ingredientAllergens = ingredient.allergens || [];
            if (ingredientAllergens.length > 0) {
              const allergenWarnings = ingredientAllergens
                .map((a: any) =>
                  typeof a === 'string'
                    ? a.toUpperCase()
                    : a.allergenName?.toUpperCase() || 'UNKNOWN',
                )
                .join(', ');
              return `${ingredient.ingredientName} (${allergenWarnings})`;
            }
            return ingredient.ingredientName;
          }
        });
        ingredientsLine = ingredientLines.join(', ');

        // Create allergen warning line for the separate box
        allergenWarningLine = allergens
          .map(a =>
            typeof a === 'string'
              ? a.toUpperCase()
              : a.allergenName?.toUpperCase() || 'UNKNOWN',
          )
          .join(', ');
      } else {
        // If no allergens, just show ingredients
        const ingredientNames = ingredients.map(ing =>
          typeof ing === 'string' ? ing : ing.ingredientName,
        );
        ingredientsLine = ingredientNames.join(', ');
      }
    }

    // Add storage instructions for PPDS labels
    const storageInstructions =
      'Keep refrigerated below 5°C. Consume within 2 days of opening.';

    return {
      header,
      expiryLine,
      printedLine: '', // No printed date for PPDS
      ingredientsLine,
      allergenWarningLine,
      storageInstructions,
      initialsLine: companyName ? `Prepared by: ${companyName}` : undefined, // Show company name for PPDS
    };
  }

  // For other label types
  const formatText = getLabelFormatText(labelType);
  const expiryLine = `${formatText}:`;

  let printedLine = '';
  if (config.showPrintedDate) {
    const today = new Date();
    const todayFormatted = formatDate(today);

    // For ingredients, don't show special indicators
    const isIngredientLabel = labelType === 'prep' && ingredients.length === 1;
    if (isIngredientLabel) {
      printedLine = `Printed: ${todayFormatted}`;
    } else if (labelType === 'default') {
      // For default type, don't show any special indicators
      printedLine = `Printed: ${todayFormatted}`;
    } else {
      // For menu items, show the special indicator
      const indicator = config.specialIndicators[0] || '';
      printedLine = `Printed: ${todayFormatted} ${indicator}`.trim();
    }
  }

  let ingredientsLine: string | undefined;
  let allergenWarningLine: string | undefined;
  // Determine if it's an ingredient label (single item, prep type)
  const isIngredientLabel = labelType === 'prep' && ingredients.length === 1;

  if (config.showIngredients && ingredients.length > 0) {
    if (isIngredientLabel) {
      // This is an ingredient label
      if (__DEV__) {
        console.log(
          '🔍 generateTSCLabelContent - Ingredient label allergens:',
          {
            labelType,
            allergens,
            allergensLength: allergens.length,
            showAllergens: config.showAllergens,
          },
        );
      }

      if (allergens.length > 0) {
        // For ingredient labels, don't show individual allergens in ingredients line
        // Just show "CONTAINS ALLERGENS" warning
        ingredientsLine = undefined; // No ingredients line for ingredient labels
        allergenWarningLine = 'CONTAINS ALLERGENS';

        if (__DEV__) {
          console.log(
            '✅ Setting allergenWarningLine for ingredient label:',
            allergenWarningLine,
          );
        }
      }
      // If no allergens for an ingredient label, ingredientsLine remains undefined (nothing to show)
    } else {
      // This is a menu item label - show only allergens, not all ingredients
      if (config.showAllergens && allergens.length > 0) {
        // For menu items: show "Contains:" with only allergens
        const allergenNames = allergens.map(allergen =>
          typeof allergen === 'string'
            ? allergen.toUpperCase()
            : allergen.allergenName?.toUpperCase() || 'UNKNOWN',
        );
        ingredientsLine = `Contains: ${allergenNames.join(', ')}`;
      } else {
        // If no allergens, show "Does not contain any allergens"
        ingredientsLine = 'Contains: Does not contain any allergens';
      }
    }
  }

  const initialsLine = initials ? `Initials: ${initials}` : undefined;

  return {
    header,
    expiryLine,
    printedLine,
    ingredientsLine,
    initialsLine,
    allergenWarningLine, // Now includes allergen warnings for ingredient labels
    storageInstructions: undefined, // Not used for non-PPDS labels
  };
}
