import React, {memo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Calendar, Plus, Minus, X} from 'lucide-react-native';
import LabelTypeDropdown from './LabelTypeDropdown';

interface QueueItemProps {
  item: any;
  customExpiry: Record<string, string>;
  useInitials: boolean;
  initials: string;
  onDatePickerPress: (uid: string, currentDate: string) => void;
  onIncrementQuantity: (uid: string) => void;
  onDecrementQuantity: (uid: string) => void;
  onRemoveFromQueue: (uid: string) => void;
  onUpdateLabelType?: (uid: string, labelType: string) => void;
  renderAllergenIcon: (allergen: string, size: number) => React.ReactNode;
}

const QueueItem: React.FC<QueueItemProps> = memo(
  ({
    item,
    customExpiry,
    useInitials,
    initials,
    onDatePickerPress,
    onIncrementQuantity,
    onDecrementQuantity,
    onRemoveFromQueue,
    onUpdateLabelType,
    renderAllergenIcon,
  }) => {
    return (
      <View style={styles.queueItem}>
        <View style={styles.queueItemInfo}>
          <Text style={styles.queueItemName}>{item.name}</Text>
          <Text style={styles.queueItemType}>
            {item.type === 'ingredients' ? 'Ingredient' : 'Menu Item'} •{' '}
            {item.labelType}
          </Text>

          <View style={styles.expiryRow}>
            <Text style={styles.queueItemExpiry}>
              Expires: {customExpiry[item.uid] || item.expiryDate}
            </Text>
            <TouchableOpacity
              style={styles.calendarButton}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              onPress={() =>
                onDatePickerPress(
                  item.uid,
                  customExpiry[item.uid] || item.expiryDate,
                )
              }>
              <Calendar size={16} color="#8A2BE2" />
            </TouchableOpacity>
          </View>

          {/* Initials display only - no change button */}
          {useInitials && (
            <View style={styles.initialsDisplayRow}>
              <Text style={styles.queueItemInitials}>
                Initials: {item.customInitials || initials}
              </Text>
            </View>
          )}

          {/* Allergen display */}
          {item.allergens && item.allergens.length > 0 && (
            <View style={styles.queueItemAllergens}>
              {item.allergens
                .slice(0, 3)
                .map((allergen: string, index: number) => (
                  <View key={index} style={styles.queueAllergenTag}>
                    {renderAllergenIcon(allergen, 12)}
                    <Text style={styles.queueAllergenText}>
                      {allergen || 'Unknown'}
                    </Text>
                  </View>
                ))}
              {item.allergens.length > 3 && (
                <Text style={styles.moreAllergens}>
                  +{Math.max(0, item.allergens.length - 3)} more
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.queueItemControls}>
          {/* Quantity Controls with +/- buttons */}
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              onPress={() => onDecrementQuantity(item.uid)}>
              <Minus size={16} color="#666" />
            </TouchableOpacity>
            <Text style={styles.quantityDisplay}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              onPress={() => onIncrementQuantity(item.uid)}>
              <Plus size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Label Type Dropdown for Menu Items */}
          {item.type === 'menu' && onUpdateLabelType && (
            <View style={styles.labelTypeContainer}>
              <LabelTypeDropdown
                value={item.labelType === 'ppds' ? 'prep' : item.labelType}
                onValueChange={newType => onUpdateLabelType(item.uid, newType)}
                availableTypes={['cooked', 'prep']}
              />
            </View>
          )}

          {/* Remove Button */}
          <TouchableOpacity
            style={styles.removeButton}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            onPress={() => onRemoveFromQueue(item.uid)}>
            <X size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  queueItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  queueItemInfo: {
    marginBottom: 10,
  },
  queueItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  queueItemType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  queueItemExpiry: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarButton: {
    padding: 12,
    marginLeft: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsDisplayRow: {
    marginTop: 10,
    marginBottom: 10,
  },
  queueItemInitials: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  queueItemAllergens: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  queueAllergenTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 6,
  },
  queueAllergenText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 6,
  },
  moreAllergens: {
    fontSize: 12,
    color: '#856404',
    alignSelf: 'center',
    marginLeft: 4,
  },
  queueItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityDisplay: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    paddingHorizontal: 10,
  },
  labelTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginLeft: 10,
  },
  labelTypeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelTypeDropdownText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  removeButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default QueueItem;
