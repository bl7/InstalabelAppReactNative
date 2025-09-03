import React, {useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {Package, Printer, Eye} from 'lucide-react-native';

import PrintQueueStatus from '../components/PrintQueueStatus';
import {useAuth} from '../contexts/AuthContext';
import {usePrinter} from '../PrinterContext';
import {
  apiService,
  BulkPrintList,
  BulkPrintItem,
  Ingredient,
  MenuItem,
  PrintQueueItem,
} from '../services/api';
import {showToast} from '../utils/toastUtils';
import {calculateExpiryDate, LabelType} from '../utils/labelManagement';
import offlineManager from '../utils/offlineManager';

const BulkPage: React.FC = () => {
  const {isAuthenticated, user} = useAuth();
  const {connectedDevice, printTSPLLabels} = usePrinter();

  // State management
  const [bulkLists, setBulkLists] = useState<BulkPrintList[]>([]);
  const [selectedList, setSelectedList] = useState<BulkPrintList | null>(null);
  const [listItems, setListItems] = useState<BulkPrintItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Modal states
  const [viewListModalVisible, setViewListModalVisible] = useState(false);

  // Load bulk print lists
  const loadBulkLists = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await apiService.getBulkPrintLists();
      setBulkLists(response.lists);
    } catch (error) {
      console.error('Error loading bulk lists:', error);
      showToast.error('Error', 'Failed to load bulk print lists');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Load list items
  const loadListItems = useCallback(async (listId: string) => {
    setIsLoadingItems(true);
    try {
      const response = await apiService.getBulkPrintList(listId);
      setListItems(response.items || []);
    } catch (error) {
      console.error('Error loading list items:', error);
      showToast.error('Error', 'Failed to load list items');
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  // Load ingredients and menu items for reference
  const loadReferenceData = useCallback(async () => {
    try {
      const [ingredientsData, menuItemsData] = await Promise.all([
        apiService.getIngredients(),
        apiService.getMenuItems(),
      ]);
      setIngredients(ingredientsData);
      setMenuItems(menuItemsData);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  }, []);

  // View list items in modal
  const viewListItems = async (list: BulkPrintList) => {
    setSelectedList(list);
    setViewListModalVisible(true);
    await loadListItems(list.id);
  };

  // Print list items
  const printListItems = async (items: BulkPrintItem[]) => {
    if (!connectedDevice) {
      showToast.error('No Printer Connected', 'Please connect a printer first');
      return;
    }

    if (items.length === 0) {
      showToast.error('Empty List', 'No items to print');
      return;
    }

    setIsPrinting(true);
    try {
      // Convert bulk print items to print queue items
      const printQueueItems: PrintQueueItem[] = items.map(item => {
        // Find the full item data
        const fullItem =
          item.item_type === 'ingredient'
            ? ingredients.find(ing => ing.ingredientID === item.item_id)
            : menuItems.find(menu => menu.menuItemID === item.item_id);

        // Get allergens and ingredients
        let allergens: string[] = [];
        let ingredientNames: string[] = [];

        if (item.item_type === 'ingredient' && fullItem) {
          const ingredient = fullItem as Ingredient;
          allergens = ingredient.allergens?.map(a => a.allergenName) || [];
          ingredientNames = [ingredient.ingredientName];
        } else if (item.item_type === 'menu' && fullItem) {
          const menuItem = fullItem as MenuItem;
          // Extract allergens from menu item ingredients
          const allAllergens: string[] = [];
          menuItem.ingredients?.forEach(ing => {
            const ingredient = ingredients.find(
              i => i.ingredientID === ing.uuid,
            );
            if (ingredient?.allergens) {
              ingredient.allergens.forEach(allergen => {
                allAllergens.push(allergen.allergenName);
              });
            }
          });
          allergens = [...new Set(allAllergens)];
          ingredientNames =
            menuItem.ingredients?.map(ing => ing.ingredientName) || [];
        }

        // Determine label type and expiry (same logic as Labels page)
        let labelType: LabelType;
        let expiryDays: number;

        if (item.item_type === 'ingredient') {
          // For ingredients, use their original expiryDays from data
          labelType = (item.label_type as LabelType) || 'prep';
          expiryDays = fullItem?.expiryDays || 3;
        } else {
          // For menu items, use label settings for the label type
          // Map 'ppds' to 'ppd' to avoid confusion with the bigger PPDS label
          let mappedLabelType = item.label_type;
          if (mappedLabelType === 'ppds') {
            mappedLabelType = 'ppd';
          }
          labelType = (mappedLabelType as LabelType) || 'default';
          expiryDays = fullItem?.expiryDays || 7;
        }

        const expiryDate = calculateExpiryDate(
          labelType,
          undefined,
          expiryDays,
        );

        return {
          uid: `bulk-${item.id}`,
          name: item.item_name,
          type: item.item_type === 'ingredient' ? 'ingredients' : 'menu',
          quantity: item.quantity,
          labelType,
          expiryDate,
          allergens,
          ingredients: ingredientNames,
          labelHeight: '31mm',
        };
      });

      // Generate session ID for this bulk print job
      const sessionId = apiService.generateSessionId();

      // Print using TSPL
      await printTSPLLabels(
        printQueueItems,
        ingredients,
        menuItems,
        {},
        '', // initials (empty for bulk)
        undefined, // storageInstructions
        user?.company_name || 'InstaLabel Ltd', // companyName
        sessionId, // Pass session ID for logging
      );

      showToast.success(
        'Print Jobs Queued',
        `${printQueueItems.length} labels have been sent to the printer.`,
      );
    } catch (error) {
      console.error('Print error:', error);
      showToast.error(
        'Print Failed',
        error instanceof Error
          ? error.message
          : 'An error occurred while printing',
      );
    } finally {
      setIsPrinting(false);
    }
  };

  // Refresh data
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadBulkLists(), loadReferenceData()]);
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadBulkLists, loadReferenceData]);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadBulkLists();
      loadReferenceData();
    }
  }, [isAuthenticated, loadBulkLists, loadReferenceData]);

  // Load items when list is selected
  useEffect(() => {
    if (selectedList) {
      loadListItems(selectedList.id);
    }
  }, [selectedList, loadListItems]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Package size={64} color="#ccc" />
          <Text style={styles.authRequiredText}>Authentication Required</Text>
          <Text style={styles.authRequiredSubtext}>
            Please log in to access bulk printing.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Bulk Printing</Text>
          <View style={styles.headerStatsRow}>
            <View style={styles.headerStatItem}>
              <Printer
                size={18}
                color={connectedDevice ? '#C8FACC' : '#FFD0D0'}
              />
              <Text style={styles.headerStatLabel}>
                {connectedDevice ? 'Ready' : 'No Printer'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }>
        {/* Lists Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Lists ({bulkLists.length})
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={styles.loadingText}>Loading lists...</Text>
            </View>
          ) : bulkLists.length === 0 ? (
            <View style={styles.emptyState}>
              <Package size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No lists found</Text>
              <Text style={styles.emptyStateSubtext}>
                Create your first bulk print list to get started
              </Text>
            </View>
          ) : (
            <View style={styles.listsContainer}>
              {bulkLists.map(list => (
                <View key={list.id} style={styles.listCard}>
                  <View style={styles.listCardHeader}>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{list.name}</Text>
                      {list.description && (
                        <Text style={styles.listDescription}>
                          {list.description}
                        </Text>
                      )}
                      <Text style={styles.listMeta}>
                        {list.item_count || 0} items • Created{' '}
                        {new Date(list.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.listActions}>
                      <TouchableOpacity
                        style={styles.listActionButton}
                        onPress={() => viewListItems(list)}>
                        <Eye size={16} color="#8A2BE2" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* View List Modal */}
      <Modal
        visible={viewListModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewListModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.viewListModalContainer}>
            <View style={styles.viewListModalHeader}>
              <Text style={styles.viewListModalTitle}>
                {selectedList?.name}
              </Text>
              {selectedList?.description && (
                <Text style={styles.viewListModalDescription}>
                  {selectedList.description}
                </Text>
              )}
              <TouchableOpacity
                style={styles.viewListModalCloseButton}
                onPress={() => setViewListModalVisible(false)}>
                <Text style={styles.viewListModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.viewListModalContent}>
              {isLoadingItems ? (
                <View style={styles.viewListLoadingContainer}>
                  <ActivityIndicator size="large" color="#8A2BE2" />
                  <Text style={styles.viewListLoadingText}>
                    Loading items...
                  </Text>
                </View>
              ) : listItems.length === 0 ? (
                <View style={styles.viewListEmptyState}>
                  <Package size={48} color="#ccc" />
                  <Text style={styles.viewListEmptyStateText}>
                    No items in this list
                  </Text>
                  <Text style={styles.viewListEmptyStateSubtext}>
                    Add items to this list to start bulk printing
                  </Text>
                </View>
              ) : (
                <View style={styles.viewListItemsContainer}>
                  {listItems.map(item => (
                    <View key={item.id} style={styles.viewListItemCard}>
                      <View style={styles.viewListItemInfo}>
                        <Text style={styles.viewListItemName}>
                          {item.item_name}
                        </Text>
                        <Text style={styles.viewListItemType}>
                          {item.item_type === 'ingredient'
                            ? 'Ingredient'
                            : 'Menu Item'}
                        </Text>
                        <Text style={styles.viewListItemQuantity}>
                          Quantity: {item.quantity}
                        </Text>
                        {item.label_type && (
                          <Text style={styles.viewListItemLabelType}>
                            Label Type: {item.label_type}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.viewListPrintItemButton}
                        onPress={() => printListItems([item])}
                        disabled={isPrinting}>
                        <Printer size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.viewListModalActions}>
              <TouchableOpacity
                style={styles.viewListPrintAllButton}
                onPress={() => printListItems(listItems)}
                disabled={isPrinting || listItems.length === 0}>
                <Printer size={16} color="white" />
                <Text style={styles.viewListPrintAllButtonText}>
                  {isPrinting
                    ? 'Printing...'
                    : `Print All (${listItems.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Print Queue Status */}
      <PrintQueueStatus />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#8A2BE2',
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 6,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  authRequired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  authRequiredText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  authRequiredSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  selectedListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  printAllButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  printAllButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  listsContainer: {
    gap: 12,
  },
  listCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listInfo: {
    flex: 1,
    marginRight: 12,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  listDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  listMeta: {
    fontSize: 12,
    color: '#999',
  },
  listActions: {
    flexDirection: 'row',
    gap: 8,
  },
  listActionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  itemsContainer: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemType: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '500',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemLabelType: {
    fontSize: 12,
    color: '#999',
  },
  printItemButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // View List Modal Styles
  viewListModalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '95%',
    maxWidth: 500,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  viewListModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    position: 'relative',
  },
  viewListModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    paddingRight: 40,
  },
  viewListModalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  viewListModalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewListModalCloseText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  viewListModalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  viewListPrintAllButton: {
    backgroundColor: '#8A2BE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  viewListPrintAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewListModalContent: {
    flex: 1,
    padding: 16,
    minHeight: 300,
  },
  viewListLoadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  viewListLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  viewListEmptyState: {
    alignItems: 'center',
    padding: 40,
  },
  viewListEmptyStateText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
    marginBottom: 4,
  },
  viewListEmptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  viewListItemsContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  viewListItemCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 80,
  },
  viewListItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  viewListItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  viewListItemType: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '500',
    marginBottom: 2,
  },
  viewListItemQuantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  viewListItemLabelType: {
    fontSize: 12,
    color: '#999',
  },
  viewListPrintItemButton: {
    backgroundColor: '#8A2BE2',
    padding: 12,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BulkPage;
