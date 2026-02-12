import React, {useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';

import {useAuth} from '../contexts/AuthContext';
import {usePrinter} from '../PrinterContext';
import OfflineIndicator from '../components/OfflineIndicator';
import offlineManager from '../utils/offlineManager';
import {
  apiService,
  Ingredient,
  MenuItem,
  Allergen,
  PrintQueueItem,
} from '../services/api';
import {
  calculateExpiryDate,
  getDefaultExpiryDays,
  LabelType,
} from '../utils/labelManagement';
import {showToast} from '../utils/toastUtils';
import CalendarModal from '../components/CalendarModal';
import LoadingSpinner from '../components/LoadingSpinner';
import QueueModal from '../components/QueueModal';
import {
  Search,
  SearchX,
  Printer,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Calendar,
  AlertTriangle,
  Eye,
} from 'lucide-react-native';

// Only menu items for allergen stickers

const AllergenStickerPage: React.FC = () => {
  const {isAuthenticated, user} = useAuth();
  const {
    connectedDevice,
    isPrinting,
    printCircularAllergenSticker,
  } = usePrinter();

  // Core data state
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPrint, setIsLoadingPrint] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Print settings
  const [customExpiry, setCustomExpiry] = useState<Record<string, string>>({});

  // Label settings from InstaLabel.co API
  const [labelSettings, setLabelSettings] = useState<Record<string, number>>(
    {},
  );
  const [isLoadingLabelSettings, setIsLoadingLabelSettings] = useState(false);

  // Calendar modal state
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarInitial, setCalendarInitial] = useState<string>('');
  const [calendarTargetUid, setCalendarTargetUid] = useState<string>('');

  // Queue modal state
  const [queueModalVisible, setQueueModalVisible] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load from cache first (only menu items needed, but load ingredients for allergen detection)
      const [cachedIngredients, cachedMenuItems] = await Promise.all([
        offlineManager.getCachedIngredients(),
        offlineManager.getCachedMenuItems(),
      ]);

      if (cachedMenuItems) {
        setMenuItems(cachedMenuItems);
      }
      if (cachedIngredients) {
        setIngredients(cachedIngredients); // Still need for allergen detection
      }

      // Refresh from API if online
      if (offlineManager.isOnline()) {
        const [ingredientsData, menuItemsData] = await Promise.all([
          apiService.getIngredients(),
          apiService.getMenuItems(),
        ]);

        if (menuItemsData) {
          setMenuItems(menuItemsData);
          await offlineManager.cacheMenuItems(menuItemsData);
        }
        if (ingredientsData) {
          setIngredients(ingredientsData); // Still need for allergen detection
          await offlineManager.cacheIngredients(ingredientsData);
        }
      }

      // Load allergens
      const allergensData = await apiService.getAllergens();
      if (allergensData) {
        setAllergens(allergensData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast.error('Error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load label settings
  const loadLabelSettings = useCallback(async () => {
    try {
      setIsLoadingLabelSettings(true);
      const settings = await apiService.getLabelSettings();
      if (settings) {
        setLabelSettings(settings);
      } else {
        setLabelSettings({});
      }
    } catch (error) {
      console.error('Error loading label settings:', error);
      setLabelSettings({});
    } finally {
      setIsLoadingLabelSettings(false);
    }
  }, []);

  // Get expiry days for a specific label type
  const getExpiryDaysForLabelType = useCallback(
    (labelType: string): number => {
      // First try to get from API settings
      if (labelSettings[labelType] !== undefined) {
        return labelSettings[labelType];
      }
      // Fall back to default values
      return getDefaultExpiryDays(labelType as LabelType);
    },
    [labelSettings],
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      loadLabelSettings();
    }
  }, [isAuthenticated, fetchData, loadLabelSettings]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      await loadLabelSettings();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchData, loadLabelSettings]);

  // Filter menu items based on search
  const filteredMenuItems = menuItems.filter(item =>
    item.menuItemName?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Add to queue (only menu items) - using same allergen detection as LabelsPage
  const addToQueue = (item: MenuItem) => {
    const itemName = item.menuItemName;
    if (!itemName) {
      console.warn('Cannot add item with undefined name to queue:', item);
      return;
    }

    // Detect allergens using same logic as LabelsPage
    let detectedAllergens: string[] = [];
    let ingredientNames: string[] = [];

    // Safety check for ingredients array
    if (!item.ingredients || !Array.isArray(item.ingredients)) {
      console.warn('MenuItem has invalid ingredients:', item);
      detectedAllergens = [];
      ingredientNames = [];
    } else {
      // Map menu item ingredients to actual ingredient objects and extract names
      const ingredientObjects = item.ingredients
        .map(ingredientObj => {
          // Handle both old string format and new object format
          const ingredientName =
            typeof ingredientObj === 'string'
              ? ingredientObj
              : ingredientObj.ingredientName;

          const ingredient = ingredients.find(
            i => i.ingredientName === ingredientName,
          );
          return ingredient;
        })
        .filter((ing): ing is Ingredient => ing !== undefined); // Type guard to remove undefined

      // Extract ingredient names
      ingredientNames = ingredientObjects.map(ing => ing.ingredientName);

      // Extract all allergens from the ingredient objects
      const allAllergens: string[] = [];
      ingredientObjects.forEach(ingredient => {
        if (ingredient.allergens) {
          ingredient.allergens.forEach(allergen => {
            allAllergens.push(allergen.allergenName);
          });
        }
      });

      // Remove duplicates and set detected allergens
      detectedAllergens = [...new Set(allAllergens)];

      console.log(
        `🔍 Menu item ${itemName}: mapped ${ingredientNames.length} ingredients with ${detectedAllergens.length} allergens`,
      );
    }

    // Calculate expiry date using label settings for allergen-sticker type
    const expiryDays = getExpiryDaysForLabelType('allergen-sticker');

    const expiryDate = calculateExpiryDate(
      'allergen-sticker',
      customExpiry[item.uid || item.id || ''],
      expiryDays,
    );

    // Generate a unique ID
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const uid = `menu-${timestamp}-${randomSuffix}`;

    const queueItem: PrintQueueItem = {
      uid: uid,
      name: itemName,
      type: 'menu',
      labelType: 'allergen-sticker' as LabelType,
      quantity: 1,
      expiryDate: expiryDate,
      allergens: detectedAllergens,
      ingredients: ingredientNames, // Store ingredient names, not objects
    };

    setPrintQueue(prev => [...prev, queueItem]);
    showToast.success('Added', `${itemName} added to queue`);
  };

  // Remove from queue
  const removeFromQueue = (uid: string) => {
    setPrintQueue(prev => prev.filter(item => item.uid !== uid));
  };

  // Update quantity
  const updateQuantity = (uid: string, delta: number) => {
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid
          ? {...item, quantity: Math.max(1, item.quantity + delta)}
          : item,
      ),
    );
  };

  // Handle update quantity for modal (takes absolute quantity, not delta)
  const handleUpdateQuantity = (uid: string, quantity: number) => {
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid ? {...item, quantity: Math.max(1, quantity)} : item,
      ),
    );
  };

  // Update expiry date
  const updateExpiry = (uid: string, expiry: string) => {
    // Update the custom expiry
    setCustomExpiry(prev => ({...prev, [uid]: expiry}));
    // Also update the print queue item's expiry date
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid ? {...item, expiryDate: expiry} : item,
      ),
    );
  };

  // Helper functions for date format conversion (same as LabelsPage)
  const convertToYYYYMMDD = (dateString: string): string => {
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // Convert from DD.MM.YYYY format to YYYY-MM-DD
    const parts = dateString.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }

    // If format is unknown, return today's date in YYYY-MM-DD format
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const convertToDDMMYYYY = (dateString: string): string => {
    // If already in DD.MM.YYYY format, return as is
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) {
      return dateString;
    }

    // Convert from YYYY-MM-DD format to DD.MM.YYYY
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}.${month}.${year}`;
    }

    // If format is unknown, return today's date in DD.MM.YYYY format
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Open calendar - convert DD.MM.YYYY to YYYY-MM-DD for CalendarModal
  const openCalendar = (uid: string, initialDate: string) => {
    const yyyyMMdd = convertToYYYYMMDD(initialDate);
    setCalendarTargetUid(uid);
    setCalendarInitial(yyyyMMdd);
    setCalendarVisible(true);
  };

  const handleCalendarSelect = (selectedYmd: string) => {
    // Convert YYYY-MM-DD to DD.MM.YYYY then save
    const ddMMyyyyDate = convertToDDMMYYYY(selectedYmd);
    if (calendarTargetUid) {
      updateExpiry(calendarTargetUid, ddMMyyyyDate);
    }
    setCalendarVisible(false);
  };

  // Clear queue
  const clearQueue = () => {
    setPrintQueue([]);
    setCustomExpiry({});
    showToast.success('Queue Cleared', 'Print queue has been cleared');
  };

  // Print labels
  const printLabels = async () => {
    if (!printQueue || printQueue.length === 0) {
      showToast.error('Empty Queue', 'Please add items to the print queue first');
      return;
    }

    if (!connectedDevice) {
      showToast.error('No Printer Connected', 'Please connect a printer first');
      return;
    }

    try {
      setIsLoadingPrint(true);

      await printCircularAllergenSticker(printQueue, customExpiry);

      showToast.success(
        'Print Jobs Queued',
        `${printQueue.length} allergen stickers have been sent to the printer.`,
      );
      setPrintQueue([]);
      setCustomExpiry({});
    } catch (error) {
      console.error('Print error:', error);
      showToast.error(
        'Print Failed',
        error instanceof Error ? error.message : 'An error occurred while printing',
      );
    } finally {
      setIsLoadingPrint(false);
    }
  };

  // Get default expiry for row
  const getDefaultExpiryForRow = (item: MenuItem): string => {
    const expiryDays = getExpiryDaysForLabelType('allergen-sticker');
    return calculateExpiryDate('allergen-sticker', undefined, expiryDays);
  };

  // Handle increment (add or increase quantity)
  const handleIncrement = (item: MenuItem) => {
    const itemName = item.menuItemName;
    const queueItem = printQueue.find(q => q.name === itemName);
    
    if (queueItem) {
      // Item already in queue, increment quantity
      updateQuantity(queueItem.uid, 1);
    } else {
      // Item not in queue, add it
      addToQueue(item);
    }
  };

  // Handle decrement (decrease quantity or remove)
  const handleDecrement = (item: MenuItem) => {
    const itemName = item.menuItemName;
    const queueItem = printQueue.find(q => q.name === itemName);
    
    if (queueItem) {
      if (queueItem.quantity > 1) {
        // Decrease quantity
        updateQuantity(queueItem.uid, -1);
      } else {
        // Remove from queue
        removeFromQueue(queueItem.uid);
      }
    }
  };

  // Handle date picker open
  const handleOpenDatePicker = (item: MenuItem, currentExpiry: string) => {
    const itemName = item.menuItemName;
    const queueItem = printQueue.find(q => q.name === itemName);
    
    if (queueItem) {
      openCalendar(queueItem.uid, currentExpiry);
    } else {
      // Add to queue first, then open date picker
      addToQueue(item);
      // Wait a bit for state to update, then open calendar
      setTimeout(() => {
        const newQueueItem = printQueue.find(q => q.name === itemName) || 
          {uid: `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, name: itemName};
        openCalendar(newQueueItem.uid, currentExpiry);
      }, 100);
    }
  };

  // Render item card (only menu items) - matching LabelsPage pattern
  const renderItemCard = (item: MenuItem) => {
    const itemName = item.menuItemName;
    if (!itemName) return null;

    // Get allergens using same logic as LabelsPage
    let itemAllergens: string[] = [];
    if (item.ingredients && Array.isArray(item.ingredients)) {
      // Map menu item ingredients to actual ingredient objects
      const ingredientObjects = item.ingredients
        .map(ingredientObj => {
          const ingredientName =
            typeof ingredientObj === 'string'
              ? ingredientObj
              : ingredientObj.ingredientName;
          return ingredients.find(i => i.ingredientName === ingredientName);
        })
        .filter((ing): ing is Ingredient => ing !== undefined);

      // Extract all allergens from the ingredient objects
      const allAllergens: string[] = [];
      ingredientObjects.forEach(ingredient => {
        if (ingredient.allergens) {
          ingredient.allergens.forEach(allergen => {
            allAllergens.push(allergen.allergenName);
          });
        }
      });

      // Remove duplicates
      itemAllergens = [...new Set(allAllergens)];
    }

    const queueItem = printQueue.find(q => q.name === itemName);
    const currentQty = queueItem?.quantity ?? 0;
    const currentExpiry = queueItem
      ? customExpiry[queueItem.uid] || queueItem.expiryDate
      : getDefaultExpiryForRow(item);

    return (
      <View key={item.uid || item.id} style={styles.itemCard}>
        <View style={styles.itemTopRow}>
          <View style={styles.itemMainInfo}>
            <Text style={styles.itemName}>{itemName}</Text>
            {itemAllergens.length > 0 && (
              <View style={styles.allergenBadge}>
                <AlertTriangle size={12} color="#FF6B35" />
                <Text style={styles.allergenCount}>{itemAllergens.length}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.expiryRow, styles.expiryRowPressable]}
              hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}
              onPress={() => handleOpenDatePicker(item, currentExpiry)}>
              <Text style={styles.queueItemExpiry}>
                Use By: {currentExpiry}
              </Text>
              <Calendar size={16} color="#8A2BE2" />
            </TouchableOpacity>
          </View>

          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.quantityButton}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              onPress={() => handleDecrement(item)}>
              <Minus size={16} color="#666" />
            </TouchableOpacity>
            <Text style={styles.quantityDisplay}>{currentQty}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              onPress={() => handleIncrement(item)}>
              <Plus size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {itemAllergens.length > 0 && (
          <View style={styles.allergenList}>
            <Text style={styles.allergenText}>
              {itemAllergens.slice(0, 3).join(', ')}
              {itemAllergens.length > 3 && ` +${itemAllergens.length - 3} more`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Render queue item
  const renderQueueItem = (item: PrintQueueItem) => {
    return (
      <View key={item.uid} style={styles.queueItem}>
        <View style={styles.queueItemContent}>
          <Text style={styles.queueItemName}>{item.name}</Text>
          <Text style={styles.queueItemAllergens}>
            {item.allergens?.slice(0, 3).join(', ') || 'No allergens'}
            {item.allergens && item.allergens.length > 3 && ` +${item.allergens.length - 3}`}
          </Text>
        </View>

        <View style={styles.queueItemActions}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => openCalendar(item.uid, item.expiryDate || '')}>
            <Calendar size={14} color="#8A2BE2" />
            <Text style={styles.dateButtonText}>
              {item.expiryDate ? item.expiryDate.split(' ')[0] : 'Set Date'}
            </Text>
          </TouchableOpacity>

          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.uid, -1)}>
              <Minus size={14} color="#8A2BE2" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(item.uid, 1)}>
              <Plus size={14} color="#8A2BE2" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFromQueue(item.uid)}>
            <X size={16} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text>Please log in to continue</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
      <OfflineIndicator />

      {/* Header with Stats */}
      <View style={styles.stickersHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <View style={styles.headerStatsRow}>
              <View style={styles.headerStatItem}>
                <Text style={styles.headerStatNumber}>{menuItems.length}</Text>
                <Text style={styles.headerStatLabel}>Menu Items</Text>
              </View>
              <TouchableOpacity
                style={styles.headerStatItemPressable}
                onPress={() => setQueueModalVisible(true)}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <View style={styles.queueStatContent}>
                  <Text style={styles.headerStatNumber}>
                    {printQueue.length}
                  </Text>
                  <View style={styles.queueStatRow}>
                    <Text style={styles.headerStatLabel}>Print Queue</Text>
                    <Eye size={12} color="rgba(255,255,255,0.8)" />
                  </View>
                </View>
              </TouchableOpacity>
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
      </View>

      {/* Label Type Reminder */}
      <View style={styles.labelReminder}>
        <AlertTriangle size={16} color="#856404" />
        <Text style={styles.labelReminderText}>
          Make sure you have round sticker labels
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#999"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <SearchX size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>


      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}>
        
        {/* Items List */}
        <View style={styles.itemsSection}>
          {filteredMenuItems.length > 0 ? (
            filteredMenuItems.map(item => renderItemCard(item))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No menu items found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      {printQueue.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.printButton, (isLoadingPrint || !connectedDevice) && styles.printButtonDisabled]}
            onPress={printLabels}
            disabled={isLoadingPrint || !connectedDevice}>
            {isLoadingPrint ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Printer size={20} color="#fff" />
                <Text style={styles.printButtonText}>
                  Print {printQueue.reduce((sum, item) => sum + item.quantity, 0)} Stickers
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Queue Modal */}
      <QueueModal
        visible={queueModalVisible}
        onClose={() => setQueueModalVisible(false)}
        queueItems={printQueue}
        onUpdateQueue={setPrintQueue}
        onRemoveItem={removeFromQueue}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateExpiry={updateExpiry}
        customExpiry={customExpiry}
        onUpdateCustomExpiry={updateExpiry}
        onOpenDatePicker={(uid, currentDate) => {
          setQueueModalVisible(false);
          setTimeout(() => {
            openCalendar(uid, currentDate);
          }, 300);
        }}
        showLabelType={false}
      />

      {/* Calendar Modal */}
      <CalendarModal
        visible={calendarVisible}
        initialDate={calendarInitial}
        onSelect={handleCalendarSelect}
        onClose={() => setCalendarVisible(false)}
        onClear={() => {
          if (calendarTargetUid) {
            // Remove custom override; reset to computed expiry
            setCustomExpiry(prev => {
              const copy = {...prev};
              delete copy[calendarTargetUid];
              return copy;
            });
            // Recalculate expiry for this item
            const queueItem = printQueue.find(q => q.uid === calendarTargetUid);
            if (queueItem) {
              const expiryDays = getExpiryDaysForLabelType('allergen-sticker');
              const newExpiry = calculateExpiryDate('allergen-sticker', undefined, expiryDays);
              setPrintQueue(prev =>
                prev.map(item =>
                  item.uid === calendarTargetUid ? {...item, expiryDate: newExpiry} : item,
                ),
              );
            }
          }
          setCalendarVisible(false);
        }}
        title="Set Custom Use By Date"
      />

      {isLoading && <LoadingSpinner />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header styles matching other pages
  stickersHeader: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerStatsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  headerStatItemPressable: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  queueStatContent: {
    alignItems: 'center',
  },
  queueStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 2,
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
  },
  labelReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  labelReminderText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  queueSection: {
    marginBottom: 24,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  queueItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  queuePreviewItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  queueItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  queueItemAllergens: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  queueItemContent: {
    marginBottom: 8,
  },
  queueItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  queueItemAllergens: {
    fontSize: 12,
    color: '#666',
  },
  queueItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    gap: 4,
  },
  dateButtonText: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '500',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  itemsSection: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  expiryRowPressable: {
    paddingVertical: 4,
  },
  queueItemExpiry: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
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
  allergenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  allergenCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  allergenList: {
    marginTop: 8,
  },
  allergenText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A2BE2',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  printButtonDisabled: {
    backgroundColor: '#ccc',
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AllergenStickerPage;

