import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  X,
  Plus,
  Minus,
  Calendar,
  Trash2,
  ShoppingCart,
  AlertTriangle,
  SearchX,
} from 'lucide-react-native';
import {PrintQueueItem} from '../services/api';
import {LabelType} from '../utils/labelManagement';
import {
  getDefaultExpiryDays,
  calculateExpiryDate,
} from '../utils/labelManagement';
import LabelTypeDropdown from './LabelTypeDropdown';

interface QueueModalProps {
  visible: boolean;
  onClose: () => void;
  queueItems: PrintQueueItem[];
  onUpdateQueue: (items: PrintQueueItem[]) => void;
  onRemoveItem: (uid: string) => void;
  onUpdateQuantity: (uid: string, quantity: number) => void;
  onUpdateExpiry: (uid: string, expiry: string) => void;
  onUpdateLabelType?: (uid: string, labelType: LabelType) => void;
  customExpiry: Record<string, string>;
  onUpdateCustomExpiry: (uid: string, expiry: string) => void;
  onOpenDatePicker: (uid: string, currentDate: string) => void;
  showLabelType?: boolean;
}

const QueueModal: React.FC<QueueModalProps> = ({
  visible,
  onClose,
  queueItems,
  onUpdateQueue,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateExpiry,
  onUpdateLabelType,
  customExpiry,
  onUpdateCustomExpiry,
  onOpenDatePicker,
  showLabelType = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = queueItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleIncrementQuantity = (uid: string) => {
    const item = queueItems.find(q => q.uid === uid);
    if (item) {
      onUpdateQuantity(uid, item.quantity + 1);
    }
  };

  const handleDecrementQuantity = (uid: string) => {
    const item = queueItems.find(q => q.uid === uid);
    if (item) {
      if (item.quantity <= 1) {
        onRemoveItem(uid);
      } else {
        onUpdateQuantity(uid, item.quantity - 1);
      }
    }
  };

  const handleLabelTypeChange = (uid: string, newLabelType: LabelType) => {
    if (onUpdateLabelType) {
      onUpdateLabelType(uid, newLabelType);
    }
  };

  const handleExpiryChange = (uid: string, newExpiry: string) => {
    onUpdateCustomExpiry(uid, newExpiry);
  };

  const getAvailableLabelTypes = (item: PrintQueueItem): LabelType[] => {
    if (item.type === 'menu') {
      return ['cooked', 'prep', 'default'];
    }
    return ['prep', 'cooked', 'default'];
  };

  const getCurrentExpiry = (item: PrintQueueItem): string => {
    return customExpiry[item.uid] || item.expiryDate;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ShoppingCart size={24} color="#8A2BE2" />
              <Text style={styles.title}>Print Queue</Text>
              <View style={styles.queueCount}>
                <Text style={styles.queueCountText}>
                  {queueItems.length} item{queueItems.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
              accessibilityRole="button"
              accessibilityLabel="Close queue modal"
              activeOpacity={0.7}>
              <X size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search items in queue..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#999"
            />
            {searchTerm ? (
              <TouchableOpacity
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearchTerm('')}>
                <SearchX size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Queue Items */}
          <ScrollView
            style={styles.itemsContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            bounces={true}>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <ShoppingCart size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>
                  {searchTerm ? 'No items match your search' : 'Queue is empty'}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {searchTerm
                    ? 'Try adjusting your search terms'
                    : 'Add items from the main page to get started'}
                </Text>
              </View>
            ) : (
              filteredItems.map(item => (
                <View key={item.uid} style={styles.queueItem}>
                  {/* Item Header */}
                  <View style={styles.itemHeader}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemType}>
                        {item.type.toUpperCase()} •{' '}
                        {item.labelType.toUpperCase()} • {item.labelHeight}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => onRemoveItem(item.uid)}
                      hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.name} from queue`}
                      activeOpacity={0.8}>
                      <Trash2 size={16} color="#F44336" />
                    </TouchableOpacity>
                  </View>

                  {/* Label Type Selection (for menu items) */}
                  {showLabelType && item.type === 'menu' && (
                    <View style={styles.labelTypeRow}>
                      <Text style={styles.labelTypeLabel}>Label Type:</Text>
                      <LabelTypeDropdown
                        value={item.labelType as LabelType}
                        onValueChange={newType =>
                          handleLabelTypeChange(item.uid, newType)
                        }
                        availableTypes={getAvailableLabelTypes(item)}
                      />
                    </View>
                  )}

                  {/* Expiry Date */}
                  <View style={styles.expiryRow}>
                    <Text style={styles.expiryLabel}>Use By:</Text>
                    <TouchableOpacity
                      style={styles.expiryButton}
                      onPress={() =>
                        onOpenDatePicker(item.uid, getCurrentExpiry(item))
                      }
                      hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
                      accessibilityRole="button"
                      accessibilityLabel={`Set expiry date for ${item.name}`}
                      activeOpacity={0.8}>
                      <Text style={styles.expiryText}>
                        {getCurrentExpiry(item)}
                      </Text>
                      <Calendar size={16} color="#8A2BE2" />
                    </TouchableOpacity>
                  </View>

                  {/* Allergens */}
                  {item.allergens && item.allergens.length > 0 && (
                    <View style={styles.allergensRow}>
                      <Text style={styles.allergensLabel}>Allergens:</Text>
                      <View style={styles.allergensList}>
                        {item.allergens.map((allergen, index) => (
                          <View key={index} style={styles.allergenTag}>
                            <AlertTriangle size={12} color="#856404" />
                            <Text style={styles.allergenText}>{allergen}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Quantity Controls */}
                  <View style={styles.quantityRow}>
                    <Text style={styles.quantityLabel}>Quantity:</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => handleDecrementQuantity(item.uid)}
                        hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease quantity for ${item.name}`}
                        activeOpacity={0.8}>
                        <Minus size={16} color="#666" />
                      </TouchableOpacity>
                      <Text style={styles.quantityDisplay}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => handleIncrementQuantity(item.uid)}
                        hitSlop={{top: 14, bottom: 14, left: 14, right: 14}}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase quantity for ${item.name}`}
                        activeOpacity={0.8}>
                        <Plus size={16} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close queue modal"
              activeOpacity={0.8}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    marginTop: 60,
    marginBottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  queueCount: {
    backgroundColor: '#f0f0ff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  queueCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A2BE2',
  },
  closeButton: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  queueItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemType: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    padding: 10,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7d7',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  labelTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 80,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  expiryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 80,
  },
  expiryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 8,
    minHeight: 44,
    minWidth: 120,
  },
  expiryText: {
    fontSize: 14,
    color: '#333',
  },
  allergensRow: {
    marginBottom: 12,
  },
  allergensLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  allergensList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  allergenTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffeaa7',
    gap: 4,
  },
  allergenText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
  ingredientsRow: {
    marginBottom: 12,
  },
  ingredientsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientTag: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  ingredientText: {
    fontSize: 12,
    color: '#666',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
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
    fontWeight: '600',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  closeModalButton: {
    backgroundColor: '#8A2BE2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 44,
    minWidth: 100,
  },
  closeModalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QueueModal;
