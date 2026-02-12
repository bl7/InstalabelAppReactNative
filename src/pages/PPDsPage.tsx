import React, {useState, useEffect, useCallback, useRef} from 'react';
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
  Platform,
  StatusBar,
  Modal,
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
  PrintLabelRequest,
} from '../services/api';
import {
  getAllergensFromIngredients,
  ALLERGEN_ICON_MAP,
} from '../utils/allergenDetection';
import {
  calculateExpiryDate,
  getDefaultExpiryDays,
  generateTSCLabelContent,
  LabelType,
} from '../utils/labelManagement';

import {showToast} from '../utils/toastUtils';
// Removed LabelPreview: no longer showing on-screen preview

import LabelSettingsDisplay from '../components/LabelSettingsDisplay';

import CalendarModal from '../components/CalendarModal';
import LoadingSpinner from '../components/LoadingSpinner';
import QueueModal from '../components/QueueModal';
import {
  Search,
  SearchX,
  FileText,
  Lock,
  Printer,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Eye,
  AlertTriangle,
  CheckCircle,
  Calendar,
} from 'lucide-react-native';

// Types for the labels system
type TabType = 'menu'; // Only menu items for PPDS

const isTablet = false; // Simplified for mobile-first design

// Function to render allergen icon
const renderAllergenIcon = (allergen: string, size: number = 12) => {
  // Safety check for undefined/null allergen
  if (!allergen || typeof allergen !== 'string') {
    console.warn('Invalid allergen passed to renderAllergenIcon:', allergen);
    return <AlertTriangle size={size} color="#856404" />;
  }

  // Return the allergen icon for valid allergens
  return <AlertTriangle size={size} color="#856404" />;
};

const PPDSPage: React.FC = () => {
  const {isAuthenticated, user} = useAuth();
  const {
    connectedDevice,
    isPrinting,
    setIsPrinting,
    addToPrintQueue,
    printQueue: spoolerQueue,
    queueStatus,
    clearPrintQueue: clearSpoolerQueue,
    printTSPLLabels,
  } = usePrinter();

  // Core data state
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('menu');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPrint, setIsLoadingPrint] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isSavingQueue, setIsSavingQueue] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Print settings
  const [customExpiry, setCustomExpiry] = useState<Record<string, string>>({});
  const [storageInstructions, setStorageInstructions] = useState<string>(
    'Keep refrigerated at 5°C',
  );

  // Label settings from InstaLabel.co API
  const [labelSettings, setLabelSettings] = useState<Record<string, number>>(
    {},
  );
  const [isLoadingLabelSettings, setIsLoadingLabelSettings] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calendar modal state
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarInitial, setCalendarInitial] = useState<string>('');
  const [calendarTargetUid, setCalendarTargetUid] = useState<string>('');

  // Queue modal state
  const [queueModalVisible, setQueueModalVisible] = useState(false);

  // Company name from user context
  const companyName = user?.company_name || 'Your Company';

  // Date selection uses CalendarModal
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      let ingredientsData: any[], menuItemsData: any[];

      // Always try to load from cache first for better offline experience
      console.log('🔄 PPDS: Attempting to load cached data first...');

      const [cachedIngredients, cachedMenuItems] = await Promise.all([
        offlineManager.getCachedIngredients(),
        offlineManager.getCachedMenuItems(),
      ]);

      if (
        cachedIngredients &&
        cachedMenuItems &&
        cachedIngredients.length > 0 &&
        cachedMenuItems.length > 0
      ) {
        console.log('✅ PPDS: Loaded cached data:', {
          ingredients: cachedIngredients.length,
          menuItems: cachedMenuItems.length,
        });

        ingredientsData = cachedIngredients;
        menuItemsData = cachedMenuItems;

        // Set the data immediately from cache
        const validIngredients = Array.isArray(ingredientsData)
          ? ingredientsData.filter(
              item => item && typeof item === 'object' && item.ingredientName,
            )
          : [];
        const validMenuItems = Array.isArray(menuItemsData)
          ? menuItemsData.filter(
              item => item && typeof item === 'object' && item.menuItemName,
            )
          : [];

        setIngredients(validIngredients);
        setMenuItems(validMenuItems);

        console.log('✅ PPDS: Data loaded from cache successfully');
      }

      // Check if we're online and try to refresh from API
      const isOnline = offlineManager.isOnline();
      if (isOnline) {
        console.log('🌐 PPDS: Online mode - refreshing from API...');

        try {
          // Load from API
          [ingredientsData, menuItemsData] = await Promise.all([
            apiService.getIngredients(),
            apiService.getMenuItems(),
          ]);

          // Cache the data for offline use
          if (ingredientsData && menuItemsData) {
            await Promise.all([
              offlineManager.cacheIngredients(ingredientsData),
              offlineManager.cacheMenuItems(menuItemsData),
            ]);
          }

          // Update state with fresh data
          const validIngredients = Array.isArray(ingredientsData)
            ? ingredientsData.filter(
                item => item && typeof item === 'object' && item.ingredientName,
              )
            : [];
          const validMenuItems = Array.isArray(menuItemsData)
            ? menuItemsData.filter(
                item => item && typeof item === 'object' && item.menuItemName,
              )
            : [];

          setIngredients(validIngredients);
          setMenuItems(validMenuItems);

          console.log('✅ PPDS: Data refreshed from API successfully');
        } catch (error) {
          console.warn(
            '⚠️ PPDS: API refresh failed, keeping cached data:',
            error,
          );
          // Don't show error toast if we have cached data
          if (!cachedIngredients || !cachedMenuItems) {
            showToast.error('Error', 'Failed to fetch data. Please try again.');
          }
        }
      } else {
        console.log('📱 PPDS: Offline mode - using cached data only');
        if (!cachedIngredients || !cachedMenuItems) {
          showToast.error(
            'Offline',
            'No cached data available. Please connect to internet first.',
          );
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching PPDS data:', error);
      showToast.error('Error', 'Failed to fetch data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLabelSettings = useCallback(async () => {
    try {
      setIsLoadingLabelSettings(true);
      let settingsMap: Record<string, number> = {};

      // Try to load from cache first
      const cachedSettings = await offlineManager.getCachedLabelSettings();
      if (cachedSettings && Object.keys(cachedSettings).length > 0) {
        console.log(
          '✅ PPDS: Loaded label settings from cache:',
          cachedSettings,
        );
        settingsMap = cachedSettings;
        setLabelSettings(settingsMap);
      }

      // Check if we're online and try to refresh from API
      const isOnline = offlineManager.isOnline();
      if (isOnline) {
        console.log('🔍 PPDS: Loading label settings from API...');
        try {
          const settings = await apiService.getLabelSettings();
          if (settings && Array.isArray(settings.settings)) {
            settings.settings.forEach((s: any) => {
              if (s.label_type && typeof s.expiry_days === 'number') {
                settingsMap[s.label_type] = s.expiry_days;
              }
            });
          }
          setLabelSettings(settingsMap);

          // Cache the settings for offline use
          await offlineManager.cacheLabelSettings(settingsMap);
          console.log('✅ PPDS: Label settings loaded from API and cached');
        } catch (error) {
          console.warn(
            '⚠️ PPDS: API label settings fetch failed, keeping cached data:',
            error,
          );
          if (!cachedSettings) {
            setLabelSettings({});
          }
        }
      } else {
        console.log('📱 PPDS: Offline mode - using cached label settings');
        if (!cachedSettings) {
          setLabelSettings({});
        }
      }
    } catch (error) {
      console.warn('PPDS label settings fetch failed:', error);
      setLabelSettings({});
    } finally {
      setIsLoadingLabelSettings(false);
    }
  }, []);

  // Load cached print queue on app start
  const loadCachedPrintQueue = useCallback(async () => {
    try {
      setIsLoadingQueue(true);
      console.log('🔄 PPDS: Loading cached print queue...');
      const cachedQueue = await offlineManager.getPrintQueue('ppds');
      console.log('🔄 PPDS: Retrieved cached queue:', cachedQueue);

      if (cachedQueue) {
        setPrintQueue(cachedQueue);
        console.log(
          '✅ PPDS: Loaded cached print queue:',
          cachedQueue.length,
          'items',
        );
      } else {
        console.log(
          'ℹ️ PPDS: No cached queue found, starting with empty queue',
        );
        setPrintQueue([]);
      }

      // Mark that we've loaded the cache, so future changes will be saved
      hasLoadedCache.current = true;
    } catch (error) {
      console.error('❌ PPDS: Error loading cached print queue:', error);
      setPrintQueue([]);
      hasLoadedCache.current = true;
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  // Save print queue to cache whenever it changes
  const hasLoadedCache = useRef(false);

  useEffect(() => {
    if (hasLoadedCache.current) {
      setIsSavingQueue(true);
      console.log(
        '💾 PPDS: Saving print queue to cache:',
        printQueue.length,
        'items',
      );
      // Always persist, including empty arrays so clears are respected
      offlineManager.savePrintQueue(printQueue, 'ppds').finally(() => {
        setIsSavingQueue(false);
      });
    }
  }, [printQueue]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchLabelSettings();
      loadCachedPrintQueue();
    }
  }, [isAuthenticated, fetchData, fetchLabelSettings, loadCachedPrintQueue]);

  const convertToYYYYMMDD = (dateString: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    const parts = dateString.split('.');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const convertToDDMMYYYY = (dateString: string): string => {
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) return dateString;
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}.${month}.${year}`;
    }
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}.${m}.${y}`;
  };

  const openDatePicker = (uid: string, currentDate: string) => {
    const yyyyMMdd = convertToYYYYMMDD(currentDate);
    setCalendarTargetUid(uid);
    setCalendarInitial(yyyyMMdd);
    setCalendarVisible(true);
  };

  const updateCustomExpiry = (uid: string, expiry: string) => {
    setCustomExpiry(prev => ({...prev, [uid]: expiry}));
  };

  // Queue management functions for modal
  const handleUpdateQuantity = (uid: string, quantity: number) => {
    setPrintQueue(prev =>
      prev.map(item => (item.uid === uid ? {...item, quantity} : item)),
    );
  };

  const addItemToPrintQueue = (item: MenuItem, _type: TabType) => {
    const defaultLabelType: LabelType = 'ppds';
    let expiryDays = 5;
    try {
      expiryDays = labelSettings[defaultLabelType]
        ? labelSettings[defaultLabelType]
        : getDefaultExpiryDays(defaultLabelType);
    } catch {}
    const expiryDate = calculateExpiryDate(
      defaultLabelType,
      undefined,
      expiryDays,
    );
    const newQueueItem: PrintQueueItem = {
      uid: item.menuItemID,
      name: item.menuItemName,
      type: 'menu',
      quantity: 1,
      labelType: defaultLabelType,
      expiryDate,
      allergens: [],
      ingredients: item.ingredients?.map(i => i.ingredientName) || [],
      labelHeight: '80mm',
    };
    setPrintQueue(prev => [...prev, newQueueItem]);
  };

  const removeFromQueue = (uid: string) => {
    setPrintQueue(prev => prev.filter(item => item.uid !== uid));
  };

  const incrementQuantity = (uid: string) => {
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid ? {...item, quantity: item.quantity + 1} : item,
      ),
    );
  };

  const decrementQuantity = (uid: string) => {
    setPrintQueue(prev => {
      const found = prev.find(item => item.uid === uid);
      if (!found) return prev;
      if (found.quantity <= 1) return prev.filter(item => item.uid !== uid);
      return prev.map(item =>
        item.uid === uid ? {...item, quantity: item.quantity - 1} : item,
      );
    });
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const clearPrintQueue = () => {
    // For now, we'll just clear the queue directly since toast doesn't support confirmations
    // In a real app, you might want to use a custom modal for confirmations
    setPrintQueue([]);
    setCustomExpiry({});
    showToast.success('Queue Cleared', 'Print queue has been cleared');
  };

  // Printing functionality
  const printLabels = async () => {
    if (!printQueue || printQueue.length === 0) {
      showToast.error(
        'Empty Queue',
        'Please add items to the print queue first',
      );
      return;
    }

    try {
      setIsLoadingPrint(true);

      console.log('🔍 PPDS Print - Data being sent:', {
        printQueueLength: printQueue.length,
        storageInstructions,
        companyName,
        customExpiry,
        sampleItem: printQueue[0],
      });

      // Generate session ID for this print job
      const sessionId = apiService.generateSessionId();

      // Use TSPL direct printing instead of image capture
      await printTSPLLabels(
        printQueue,
        ingredients,
        menuItems,
        customExpiry,
        '', // No initials for PPDS
        storageInstructions, // Pass storage instructions
        companyName, // Pass company name for "Prepared by" line
        sessionId, // Pass session ID for logging
        true, // Use full PPDS format (56mm × 80mm)
      );

      showToast.success(
        'Print Jobs Queued',
        `${printQueue.length} PPDS labels have been sent to the printer using TSPL protocol.`,
      );
      setPrintQueue([]);
      setCustomExpiry({});
    } catch (error) {
      console.error('Print error:', error);
      showToast.error(
        'Print Failed',
        error instanceof Error
          ? error.message
          : 'An error occurred while printing',
      );
    } finally {
      setIsLoadingPrint(false);
    }
  };

  // Enhanced tab content with better design
  const renderTabContent = () => {
    const items = menuItems || [];

    // Simple filtering by name only
    let filteredItems = items.filter(item => {
      const name = item.menuItemName;
      if (!name) return false;

      return name.toLowerCase().includes((searchTerm || '').toLowerCase());
    });

    // Sort by name alphabetically (case-insensitive)
    filteredItems.sort((a, b) => {
      const aName = a.menuItemName || '';
      const bName = b.menuItemName || '';
      return aName.toLowerCase().localeCompare(bName.toLowerCase());
    });

    // Calculate pagination
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredItems.slice(startIndex, endIndex);

    const getDefaultExpiryForRow = (item: MenuItem): string => {
      const defaultLabelType: LabelType = 'ppds';
      let expiryDays = 5;
      try {
        if (labelSettings[defaultLabelType]) {
          expiryDays = labelSettings[defaultLabelType];
        } else {
          expiryDays = getDefaultExpiryDays(defaultLabelType);
        }
      } catch {}
      return calculateExpiryDate(defaultLabelType, undefined, expiryDays);
    };

    const handleIncrement = (item: MenuItem) => {
      const q = printQueue.find(qItem => qItem.uid === item.menuItemID);
      if (q) {
        incrementQuantity(q.uid);
      } else {
        addItemToPrintQueue(item, 'menu');
      }
    };

    const handleDecrement = (item: MenuItem) => {
      const q = printQueue.find(qItem => qItem.uid === item.menuItemID);
      if (q) {
        decrementQuantity(q.uid);
      }
    };

    const handleOpenDatePickerRow = (item: MenuItem, current: string) => {
      const q = printQueue.find(qItem => qItem.uid === item.menuItemID);
      if (q) {
        openDatePicker(q.uid, current);
      } else {
        addItemToPrintQueue(item, 'menu');
        setTimeout(() => {
          const created = printQueue.find(x => x.uid === item.menuItemID);
          if (created) openDatePicker(created.uid, current);
        }, 0);
      }
    };

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Loading menu items...</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* Enhanced Search and Filter Bar */}
        <View style={styles.searchFilterContainer}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items..."
              value={searchTerm || ''}
              onChangeText={(text: string) => setSearchTerm(text || '')}
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
        </View>

        {/* Items List */}
        <View style={styles.itemsList}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <SearchX size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No menu items found</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'No items available'}
              </Text>
            </View>
          ) : (
            <>
              {currentItems.map(item => {
                const q = printQueue.find(
                  qItem => qItem.uid === item.menuItemID,
                );
                const currentQty = q?.quantity ?? 0;
                const currentExpiry = q
                  ? customExpiry[q.uid] || q.expiryDate
                  : getDefaultExpiryForRow(item);

                return (
                  <View key={item.menuItemID} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <View style={styles.itemMainInfo}>
                        <Text style={styles.itemName}>{item.menuItemName}</Text>
                        <TouchableOpacity
                          style={[styles.expiryRow, styles.expiryRowPressable]}
                          hitSlop={{top: 16, bottom: 16, left: 16, right: 16}}
                          pressRetentionOffset={{
                            top: 20,
                            bottom: 20,
                            left: 20,
                            right: 20,
                          }}
                          delayPressIn={0}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Set custom expiry date"
                          onPress={() =>
                            handleOpenDatePickerRow(item, currentExpiry)
                          }>
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
                  </View>
                );
              })}

              {/* Enhanced Pagination */}
              {totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <View style={styles.paginationControls}>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}>
                      <Text
                        style={[
                          styles.paginationButtonText,
                          currentPage === 1 &&
                            styles.paginationButtonTextDisabled,
                        ]}>
                        Previous
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.pageInfo}>
                      Page {currentPage} of {totalPages}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === totalPages &&
                          styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(prev => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}>
                      <Text
                        style={[
                          styles.paginationButtonText,
                          currentPage === totalPages &&
                            styles.paginationButtonTextDisabled,
                        ]}>
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  // Enhanced print queue with better design
  const renderPrintQueue = () => (
    <View style={styles.queueSection}>
      <View style={styles.queueHeader}>
        <View style={styles.queueHeaderTop}>
          <View style={styles.queueHeaderLeft}>
            <ShoppingCart size={24} color="#8A2BE2" />
            <Text style={styles.sectionTitle}>PPDS Print Queue</Text>
            <View style={styles.queueCount}>
              <Text style={styles.queueCountText}>
                {printQueue.length} item{printQueue.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {printQueue.length > 0 && (
          <View style={styles.queueHeaderButtons}>
            <TouchableOpacity
              style={styles.clearQueueButton}
              onPress={clearPrintQueue}>
              <X size={16} color="#F44336" />
              <Text style={styles.clearQueueText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.printButton}
              onPress={printLabels}
              disabled={
                !printQueue || printQueue.length === 0 || isLoadingPrint
              }>
              {isLoadingPrint ? (
                <LoadingSpinner
                  variant="button"
                  message="Printing..."
                  size="small"
                  color="#fff"
                />
              ) : (
                <>
                  <Printer size={16} color="#fff" />
                  <Text style={styles.printButtonText}>Print All</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {printQueue.length === 0 ? (
        <View style={styles.emptyQueue}>
          <ShoppingCart size={48} color="#ccc" />
          <Text style={styles.emptyQueueText}>Print queue is empty</Text>
          <Text style={styles.emptyQueueSubtext}>
            Add menu items from above to start printing PPDS labels
          </Text>
        </View>
      ) : (
        <View style={styles.queueItems}>
          {printQueue.map(item => (
            <View key={item.uid} style={styles.queueItem}>
              <View style={styles.queueItemInfo}>
                <Text style={styles.queueItemName}>{item.name}</Text>
                <Text style={styles.queueItemType}>
                  {item.labelType.toUpperCase()} • {item.labelHeight}
                </Text>

                {/* Expiry Date Row */}
                <View style={styles.expiryRow}>
                  <Text style={styles.queueItemExpiry}>
                    Use By: {customExpiry[item.uid] || item.expiryDate}
                  </Text>
                  <TouchableOpacity
                    style={styles.calendarButton}
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    onPress={() =>
                      openDatePicker(
                        item.uid,
                        customExpiry[item.uid] || item.expiryDate,
                      )
                    }>
                    <Calendar size={16} color="#8A2BE2" />
                  </TouchableOpacity>
                </View>

                {/* Allergens in queue */}
                {item.allergens && item.allergens.length > 0 && (
                  <View style={styles.queueAllergens}>
                    <Text style={styles.queueAllergensLabel}>Allergens:</Text>
                    <View style={styles.queueAllergensList}>
                      {item.allergens.map((allergen, index) => (
                        <View key={index} style={styles.queueAllergenTag}>
                          <Text style={styles.queueAllergenText}>
                            {allergen}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.queueItemControls}>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    onPress={() => decrementQuantity(item.uid)}>
                    <Minus size={16} color="#666" />
                  </TouchableOpacity>

                  <Text style={styles.quantityDisplay}>{item.quantity}</Text>

                  <TouchableOpacity
                    style={styles.quantityButton}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    onPress={() => incrementQuantity(item.uid)}>
                    <Plus size={16} color="#666" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.removeButton}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  onPress={() => removeFromQueue(item.uid)}>
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Removed PPDS label preview renderer

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Lock size={64} color="#ccc" />
          <Text style={styles.authRequiredText}>Authentication Required</Text>
          <Text style={styles.authRequiredSubtext}>
            Please log in to access the PPDS labels system.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
      {/* Calendar Modal */}
      <CalendarModal
        visible={calendarVisible}
        initialDate={calendarInitial}
        onClose={() => setCalendarVisible(false)}
        onSelect={selectedYmd => {
          const ddMMyyyy = convertToDDMMYYYY(selectedYmd);
          if (calendarTargetUid) {
            updateCustomExpiry(calendarTargetUid, ddMMyyyy);
          }
          setCalendarVisible(false);
        }}
        onClear={() => {
          if (calendarTargetUid) {
            setCustomExpiry(prev => {
              const copy = {...prev};
              delete copy[calendarTargetUid];
              return copy;
            });
          }
          setCalendarVisible(false);
        }}
        title="Set Custom Expiry Date"
      />

      {/* Queue Modal */}
      <QueueModal
        visible={queueModalVisible}
        onClose={() => setQueueModalVisible(false)}
        queueItems={printQueue}
        onUpdateQueue={setPrintQueue}
        onRemoveItem={removeFromQueue}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateExpiry={updateCustomExpiry}
        customExpiry={customExpiry}
        onUpdateCustomExpiry={updateCustomExpiry}
        onOpenDatePicker={(uid, currentDate) => {
          setQueueModalVisible(false);
          setTimeout(() => {
            openDatePicker(uid, currentDate);
          }, 300);
        }}
        showLabelType={false}
      />

      {/* Enhanced PPDS Header */}
      <View style={styles.ppdsHeader}>
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
          Make sure you have 80mm labels for this
        </Text>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }>
        {/* Stats moved to header */}
        {/* Menu Items Tab Content */}
        {renderTabContent()}

        {/* Spacer for footer */}
        <View style={{height: 140}} />
        {/* Preview removed */}
      </ScrollView>

      {/* Persistent Footer with Storage Instructions, Clear/Print All, and FAB */}
      <View style={styles.footerContainer}>
        <View style={styles.footerStorageContainer}>
          <View style={styles.footerStorageRow}>
            <TextInput
              style={styles.footerStorageInput}
              placeholder="Storage instructions (e.g., Keep refrigerated at 5°C)"
              value={storageInstructions}
              onChangeText={(text: string) => setStorageInstructions(text)}
              placeholderTextColor="#999"
              maxLength={36}
            />
            <Text style={styles.footerCharacterCount}>
              {storageInstructions.length}/36
            </Text>
          </View>
        </View>
        <View style={styles.footerContent}>
          <TouchableOpacity
            style={styles.footerClearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear print queue"
            onPress={clearPrintQueue}
            disabled={!printQueue || printQueue.length === 0}>
            <Text style={styles.footerClearText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerPrintButton}
            accessibilityRole="button"
            accessibilityLabel="Print all labels"
            onPress={printLabels}
            disabled={!printQueue || printQueue.length === 0 || isLoadingPrint}>
            <Text style={styles.footerPrintText}>Print all</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Loading Overlays */}
      {isLoading && (
        <LoadingSpinner
          variant="overlay"
          message="Loading data..."
          color="#8A2BE2"
        />
      )}

      {isLoadingPrint && (
        <LoadingSpinner
          variant="overlay"
          message="Printing labels..."
          color="#4CAF50"
        />
      )}

      {isLoadingQueue && (
        <LoadingSpinner
          variant="overlay"
          message="Loading queue..."
          color="#8A2BE2"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authRequiredText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  authRequiredSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  mainScrollView: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // Enhanced PPDS Header
  ppdsHeader: {
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
  // Stats Section
  statsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8A2BE2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },

  // Enhanced Tab Content
  tabContent: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 16,
    marginBottom: 0,
    shadowColor: 'transparent',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },

  // Enhanced Items List
  itemsList: {
    width: '100%',
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 56,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  itemActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8A2BE2',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    minWidth: 80,
    minHeight: 44,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#4CAF50',
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
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 10,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  expiryRowPressable: {
    paddingVertical: 6,
    paddingRight: 6,
    minHeight: 44,
  },
  queueItemExpiry: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  // calendarButton removed; entire row is pressable now
  // Enhanced Print Queue
  queueSection: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  queueHeader: {
    marginBottom: 20,
  },
  queueHeaderTop: {
    marginBottom: 16,
  },
  queueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  queueHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  clearQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fed7d7',
    gap: 4,
  },
  clearQueueText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '600',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyQueue: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyQueueText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyQueueSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  queueItems: {
    gap: 12,
  },
  queueItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  queueItemInfo: {
    marginBottom: 16,
  },
  queueItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  queueItemType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  queueIngredients: {
    marginTop: 8,
  },
  queueIngredientsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  queueIngredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  queueIngredientTag: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  queueIngredientText: {
    fontSize: 11,
    color: '#666',
  },
  queueAllergens: {
    marginTop: 8,
  },
  queueAllergensLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  queueAllergensList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  queueAllergenTag: {
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  queueAllergenText: {
    fontSize: 10,
    color: '#000',
    fontWeight: '500',
  },

  globalStorageContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  globalStorageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  globalStorageInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // removed legacy queue/quantity styles

  // Enhanced Preview Section
  previewSection: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  previewSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  previewPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  previewText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  previewScroll: {
    width: '100%',
  },
  previewContainer: {
    marginBottom: 16,
  },
  ppdsPreviewContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: '#000',
    borderStyle: 'solid',
    // Compact 56mm × 80mm dimensions - scaled for mobile
    width: 280, // 56mm scaled down
    height: 400, // 80mm scaled down (maintains 56:80 ratio)
    alignSelf: 'center',
    // Ensure content stays within boundaries
    overflow: 'hidden',
    // Use flexbox for proper positioning
    flexDirection: 'column',
    justifyContent: 'space-between',
  },

  ppdsPreviewProductName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 6,
    textTransform: 'uppercase',
    lineHeight: 20,
  },
  ppdsPreviewIngredients: {
    marginBottom: 8,
  },
  ppdsPreviewIngredientsLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  ppdsPreviewSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  ppdsPreviewIngredientsText: {
    fontSize: 12,
    color: '#000',
    lineHeight: 16,
    flex: 1,
  },
  ppdsPreviewAllergenBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  ppdsPreviewAllergenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  ppdsPreviewDates: {
    marginBottom: 8,
  },
  ppdsPreviewDateText: {
    fontSize: 11,
    color: '#000',
    marginBottom: 2,
  },
  ppdsPreviewStorageText: {
    fontSize: 11,
    color: '#000',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  ppdsPreviewCompany: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 8,
  },
  ppdsPreviewCompanyText: {
    fontSize: 11,
    color: '#000',
    marginBottom: 2,
  },
  ppdsPreviewWebsiteText: {
    fontSize: 11,
    color: '#000',
    fontStyle: 'italic',
  },

  // Enhanced Loading and Empty States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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

  // Enhanced Pagination
  paginationContainer: {
    marginTop: 20,
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  paginationButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  paginationButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paginationButtonTextDisabled: {
    color: '#999',
  },
  pageInfo: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  // Enhanced Section Titles
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },

  // Prompt styles removed; using CalendarModal
  // Persistent Footer
  footerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerStorageContainer: {
    marginBottom: 12,
  },
  footerStorageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerStorageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  footerCharacterCount: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    minWidth: 35,
    textAlign: 'right',
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 998, // Below FAB actions but above other content
  },
  footerClearButton: {
    flex: 1,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 4,
    minHeight: 40,
  },
  footerClearText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
  footerPrintButton: {
    flex: 1,
    backgroundColor: '#8A2BE2',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginLeft: 4,
    minHeight: 40,
  },
  footerPrintText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PPDSPage;
