import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {PrintQueueItem, Ingredient, MenuItem} from '../services/api';
import {parseDate} from '../utils/labelManagement';

interface CircularLabelPreviewProps {
  item: PrintQueueItem;
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  customExpiry?: string;
  initials: string;
}

const CircularLabelPreview: React.FC<CircularLabelPreviewProps> = ({
  item,
  ingredients,
  menuItems,
  customExpiry,
}) => {
  // Format expiry date
  const formatExpiryDate = (dateString: string): string => {
    if (!dateString) return '';

    try {
      let date: Date | null = null;

      // Try DD.MM.YYYY format first
      date = parseDate(dateString);

      // If that fails, try YYYY-MM-DD format
      if (!date && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const parts = dateString.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      }

      if (!date || isNaN(date.getTime())) {
        return dateString;
      }

      // Format as DD/MM/YYYY for "Use By" display
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return dateString;
    }
  };

  const formattedExpiryDate = formatExpiryDate(
    customExpiry || item.expiryDate || '',
  );
  const allergens = item.allergens || [];
  const itemIngredients = item.ingredients || [];

  // Build ingredients line similar to PPDS labels
  let ingredientsText = '';
  if (itemIngredients.length > 0) {
    if (allergens.length > 0) {
      const ingredientLines = itemIngredients.map(ingredient => {
        const ingredientAllergens = allergens.filter(allergen =>
          ingredient.toLowerCase().includes(allergen.toLowerCase()),
        );
        if (ingredientAllergens.length > 0) {
          const allergenWarnings = ingredientAllergens
            .map(a => a.toUpperCase())
            .join(', ');
          return `${ingredient} (${allergenWarnings})`;
        }
        return ingredient;
      });
      ingredientsText = ingredientLines.join(', ');
    } else {
      ingredientsText = itemIngredients.join(', ');
    }
  } else if (allergens.length > 0) {
    ingredientsText = `Contains: ${allergens
      .map(a => a.toUpperCase())
      .join(', ')}`;
  } else {
    ingredientsText = 'Does not contain any allergens';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.previewLabel}>Preview</Text>
      <View style={styles.circularLabel}>
        {/* Item Name */}
        <View style={styles.section}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name.toUpperCase()}
          </Text>
        </View>

        {/* Ingredients Section */}
        <View style={styles.section}>
          <Text style={styles.containsLabel}>Ingredients:</Text>
          <Text style={styles.allergenText} numberOfLines={4}>
            {ingredientsText}
          </Text>
        </View>

        {/* Best Before Date */}
        <View style={styles.section}>
          <Text style={styles.useByLabel}>Best Before:</Text>
          <Text style={styles.dateText}>{formattedExpiryDate}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  circularLabel: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    lineHeight: 18,
  },
  containsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  allergenText: {
    fontSize: 9,
    color: '#000',
    textAlign: 'center',
    lineHeight: 12,
  },
  useByLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 10,
    color: '#000',
    fontWeight: '600',
  },
});

export default React.memo(CircularLabelPreview);








