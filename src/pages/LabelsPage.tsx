import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator,
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
import LabelTypeDropdown from '../components/LabelTypeDropdown';

import LabelSettingsDisplay from '../components/LabelSettingsDisplay';

import LoadingSpinner from '../components/LoadingSpinner';
import QueueModal from '../components/QueueModal';
import {
  Search,
  SearchX,
  List,
  Lock,
  Printer,
  CheckCircle,
  AlertTriangle,
  Wheat,
  Fish,
  Egg,
  Nut,
  Bean,
  Milk,
  Carrot,
  Flame,
  Circle,
  Wine,
  Flower,
  Shell,
  Calendar,
  Minus,
  Plus,
  ShoppingCart,
  X,
  Eye,
} from 'lucide-react-native';

import CalendarModal from '../components/CalendarModal';

// Types for the labels system
type TabType = 'ingredients' | 'menu';

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

const LabelsPage: React.FC = () => {
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
  const [activeTab, setActiveTab] = useState<TabType>('ingredients');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingPrint, setIsLoadingPrint] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isSavingQueue, setIsSavingQueue] = useState(false);

  // Print settings
  const [customExpiry, setCustomExpiry] = useState<Record<string, string>>({});
  const [initials, setInitials] = useState('NG');
  const [availableInitials, setAvailableInitials] = useState<string[]>(['NG']);
  const [isLoadingInitials, setIsLoadingInitials] = useState(false);

  // Label settings from InstaLabel.co API
  const [labelSettings, setLabelSettings] = useState<Record<string, number>>(
    {},
  );
  const [isLoadingLabelSettings, setIsLoadingLabelSettings] = useState(false);

  // Company name for PPDS labels (from user profile)
  const companyName = user?.company_name || 'InstaLabel Ltd';

  // Log company name for debugging
  // console.log('🏢 Company name in LabelsPage:', {
  //   company_name: user?.company_name,
  //   fallback_company_name: 'InstaLabel Ltd',
  //   final_company_name: companyName,
  //   user_data: user,
  // });

  // Label initials settings from InstaLabel.co API
  const [useInitials, setUseInitials] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Label capture modal state
  const [captureModalVisible, setCaptureModalVisible] = useState(false);
  const [currentCaptureItem, setCurrentCaptureItem] =
    useState<PrintQueueItem | null>(null);
  const [capturePromiseResolve, setCapturePromiseResolve] = useState<
    ((value: string) => void) | null
  >(null);
  const [capturePromiseReject, setCapturePromiseReject] = useState<
    ((error: Error) => void) | null
  >(null);

  // Initials selection modal state
  const [showInitialsModal, setShowInitialsModal] = useState(false);
  const [editingInitialsUid, setEditingInitialsUid] = useState<string | null>(
    null,
  );

  // ---- Calendar modal state ----
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarInitial, setCalendarInitial] = useState<string>('');
  const [calendarTargetUid, setCalendarTargetUid] = useState<string>('');

  // Queue modal state
  const [queueModalVisible, setQueueModalVisible] = useState(false);

  // Handlers for initials modal
  const handleInitialsSelect = (selectedInitials: string) => {
    if (editingInitialsUid) {
      // Update the initials for this specific item
      setPrintQueue(prev =>
        prev.map(item =>
          item.uid === editingInitialsUid
            ? {...item, customInitials: selectedInitials}
            : item,
        ),
      );
    } else {
      // Set global initials when no specific item is being edited
      setInitials(selectedInitials);
    }
    setShowInitialsModal(false);
    setEditingInitialsUid(null);
  };

  const handleInitialsCancel = () => {
    setShowInitialsModal(false);
    setEditingInitialsUid(null);
  };

  // Load data from API or cache
  const loadData = useCallback(async () => {
    console.log('🚀 loadData function called');
    console.log('🔍 loadData: isAuthenticated =', isAuthenticated);
    console.log(
      '🔍 loadData: token =',
      apiService.getAccessToken() ? 'exists' : 'missing',
    );

    // gate with the current auth state (useCallback depends on isAuthenticated)
    if (!isAuthenticated) {
      console.log('❌ loadData: Not authenticated, returning early');
      return;
    }

    // Check if we have a valid token before making API calls
    const token = apiService.getAccessToken();
    if (!token) {
      console.log('No access token available, skipping API calls');
      return;
    }

    setIsLoading(true);
    try {
      let ingredientsData: any[],
        menuItemsData: any[],
        allergensData: any[] = [];

      // Always try to load from cache first for better offline experience
      console.log('🔄 Attempting to load cached data first...');

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
        console.log('✅ Loaded cached data:', {
          ingredients: cachedIngredients.length,
          menuItems: cachedMenuItems.length,
        });

        ingredientsData = cachedIngredients;
        menuItemsData = cachedMenuItems;
        allergensData = []; // Allergens not cached, use empty array

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
        setAllergens([]);

        console.log('✅ Data loaded from cache successfully');

        // Stop loading immediately after cache loads - this is the key fix!
        setIsLoading(false);
      }

      // Check if we're online and try to refresh from API in background
      const isOnline = offlineManager.isOnline();
      if (isOnline) {
        console.log('🌐 Online mode - refreshing from API in background...');

        // Don't block UI - refresh in background
        Promise.all([
          apiService.getIngredients(),
          apiService.getMenuItems(),
          apiService.getAllergens(),
        ])
          .then(([freshIngredients, freshMenuItems, freshAllergens]) => {
            // Cache the fresh data
            if (freshIngredients && freshMenuItems) {
              Promise.all([
                offlineManager.cacheIngredients(freshIngredients),
                offlineManager.cacheMenuItems(freshMenuItems),
              ]).catch(cacheError =>
                console.warn('⚠️ Cache update failed:', cacheError),
              );
            }

            // Update state with fresh data
            const validIngredients = Array.isArray(freshIngredients)
              ? freshIngredients.filter(
                  item =>
                    item && typeof item === 'object' && item.ingredientName,
                )
              : [];
            const validMenuItems = Array.isArray(freshMenuItems)
              ? freshMenuItems.filter(
                  item => item && typeof item === 'object' && item.menuItemName,
                )
              : [];

            setIngredients(validIngredients);
            setMenuItems(validMenuItems);
            setAllergens(Array.isArray(freshAllergens) ? freshAllergens : []);

            console.log('✅ Data refreshed from API in background');
          })
          .catch(error => {
            console.warn(
              '⚠️ Background API refresh failed, keeping cached data:',
              error,
            );
            // Don't show error toast if we have cached data
            if (!cachedIngredients || !cachedMenuItems) {
              showToast.error(
                'Error',
                'Failed to refresh data. Using cached data.',
              );
            }
          });
      } else {
        console.log('📱 Offline mode - using cached data only');
        if (!cachedIngredients || !cachedMenuItems) {
          showToast.error(
            'Offline',
            'No cached data available. Please connect to internet first.',
          );
          setIsLoading(false);
          return;
        }
      }

      // Data has already been set to state above, no need to set again
      console.log('✅ Data loading process completed');
    } catch (error) {
      console.error('❌ Error loading data:', error);
      showToast.error('Error', 'Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove isAuthenticated dependency to prevent circular dependency

  // Load cached print queue on app start
  const loadCachedPrintQueue = useCallback(async () => {
    try {
      setIsLoadingQueue(true);
      console.log('🔄 Loading cached print queue for labels page...');
      const cachedQueue = await offlineManager.getPrintQueue('labels');
      console.log('🔄 Retrieved cached queue:', cachedQueue);

      if (cachedQueue) {
        setPrintQueue(cachedQueue);
        console.log(
          '✅ Loaded cached print queue:',
          cachedQueue.length,
          'items',
        );
      } else {
        console.log('ℹ️ No cached queue found, starting with empty queue');
        setPrintQueue([]);
      }

      // Mark that we've loaded the cache, so future changes will be saved
      hasLoadedCache.current = true;
    } catch (error) {
      console.error('❌ Error loading cached print queue:', error);
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
        '💾 Saving print queue to cache:',
        printQueue.length,
        'items',
      );
      // Always persist, including empty arrays so clears are respected
      offlineManager.savePrintQueue(printQueue, 'labels').finally(() => {
        setIsSavingQueue(false);
      });
    }
  }, [printQueue]);

  // Load label initials from API or cache
  const loadLabelInitials = useCallback(async () => {
    if (!isAuthenticated) return;

    const token = apiService.getAccessToken();
    if (!token) {
      console.log('No access token available, skipping initials API call');
      return;
    }

    setIsLoadingInitials(true);
    let cachedInitials: any = null;

    try {
      // Try to load from cache first
      cachedInitials = await offlineManager.getCachedLabelInitials();
      if (cachedInitials && Array.isArray(cachedInitials)) {
        console.log('✅ Loaded label initials from cache:', cachedInitials);
        setAvailableInitials(cachedInitials);
        setUseInitials(true);

        // Stop loading immediately after cache loads
        setIsLoadingInitials(false);
      }

      // Check if we're online and try to refresh from API in background
      const isOnline = offlineManager.isOnline();
      if (isOnline) {
        console.log(
          '🔍 Loading label initials from InstaLabel.co API in background...',
        );

        // Don't block UI - refresh in background
        apiService
          .getLabelInitials()
          .then(response => {
            // Set the use_initials flag from API response
            setUseInitials(response.use_initials || false);

            if (
              response.use_initials &&
              response.initials &&
              Array.isArray(response.initials)
            ) {
              setAvailableInitials(response.initials);
              // Set the first available initial as default if current one is not in the list
              if (!response.initials.includes(initials)) {
                setInitials(response.initials[0] || 'NG');
              }
              console.log(
                '✅ Label initials loaded from API in background:',
                response.initials,
              );

              // Cache the data for offline use
              offlineManager
                .cacheLabelInitials(response.initials)
                .catch(cacheError =>
                  console.warn('⚠️ Cache update failed:', cacheError),
                );
            } else {
              console.log('⚠️ No initials available from API, using defaults');
              if (!cachedInitials) {
                setAvailableInitials(['NG']);
              }
            }
          })
          .catch(error => {
            console.warn(
              '⚠️ Background API refresh failed, keeping cached data:',
              error,
            );
            if (!cachedInitials) {
              setAvailableInitials(['NG']);
            }
          });
      } else {
        console.log('📱 Offline mode - using cached label initials');
        if (!cachedInitials) {
          setAvailableInitials(['NG']);
        }
      }
    } catch (error) {
      console.error('❌ Error loading label initials:', error);
      // Keep default initials on error
      if (!cachedInitials) {
        setAvailableInitials(['NG']);
      }
    } finally {
      setIsLoadingInitials(false);
    }
  }, []); // Remove isAuthenticated dependency to prevent circular dependency

  // Load label settings from API or cache
  const loadLabelSettings = useCallback(async () => {
    if (!isAuthenticated) return;

    const token = apiService.getAccessToken();
    if (!token) {
      console.log(
        'No access token available, skipping label settings API call',
      );
      return;
    }

    setIsLoadingLabelSettings(true);
    let cachedSettings: any = null;

    try {
      // Try to load from cache first
      cachedSettings = await offlineManager.getCachedLabelSettings();
      if (cachedSettings && typeof cachedSettings === 'object') {
        console.log('✅ Loaded label settings from cache:', cachedSettings);
        setLabelSettings(cachedSettings);

        // Stop loading immediately after cache loads
        setIsLoadingLabelSettings(false);
      }

      // Check if we're online and try to refresh from API in background
      const isOnline = offlineManager.isOnline();
      if (isOnline) {
        console.log(
          '🔍 Loading label settings from InstaLabel.co API in background...',
        );

        // Don't block UI - refresh in background
        apiService
          .getLabelSettings()
          .then(response => {
            if (response.settings && Array.isArray(response.settings)) {
              // Convert array of settings to a map for easy lookup
              const settingsMap: Record<string, number> = {};
              response.settings.forEach(setting => {
                if (
                  setting.label_type &&
                  typeof setting.expiry_days === 'number'
                ) {
                  settingsMap[setting.label_type] = setting.expiry_days;
                }
              });

              setLabelSettings(settingsMap);
              console.log(
                '✅ Label settings loaded from API in background:',
                settingsMap,
              );

              // Cache the data for offline use
              offlineManager
                .cacheLabelSettings(settingsMap)
                .catch(cacheError =>
                  console.warn('⚠️ Cache update failed:', cacheError),
                );
            } else {
              console.log('⚠️ No label settings available from API');
              if (!cachedSettings) {
                setLabelSettings({});
              }
            }
          })
          .catch(error => {
            console.warn(
              '⚠️ Background API refresh failed, keeping cached data:',
              error,
            );
            if (!cachedSettings) {
              setLabelSettings({});
            }
          });
      } else {
        console.log('📱 Offline mode - using cached label settings');
        if (!cachedSettings) {
          setLabelSettings({});
        }
      }
    } catch (error) {
      console.error('❌ Error loading label settings:', error);
      if (!cachedSettings) {
        setLabelSettings({});
      }
    } finally {
      setIsLoadingLabelSettings(false);
    }
  }, []); // Remove isAuthenticated dependency to prevent circular dependency

  // Get expiry days for a specific label type, using API settings if available
  const getExpiryDaysForLabelType = useCallback(
    (labelType: string): number => {
      // First try to get from API settings
      if (labelSettings[labelType] !== undefined) {
        console.log(
          `📅 Using API expiry days for ${labelType}: ${labelSettings[labelType]} days`,
        );
        return labelSettings[labelType];
      }

      // Fall back to default values from labelManagement utility
      const defaultDays = getDefaultExpiryDays(labelType as LabelType);
      console.log(
        `📅 Using default expiry days for ${labelType}: ${defaultDays} days`,
      );
      return defaultDays;
    },
    [labelSettings],
  );

  // Refresh data
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData();
      await loadLabelInitials();
      await loadLabelSettings();
      await loadCachedPrintQueue();
    } catch (error) {
      console.error('❌ Error during refresh:', error);
      showToast.error(
        'Refresh Failed',
        'Failed to refresh data. Please try again.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, loadLabelInitials, loadLabelSettings, loadCachedPrintQueue]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Reset to first page when active tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Load data when authentication changes
  useEffect(() => {
    console.log('🔍 LabelsPage useEffect triggered:', {isAuthenticated});
    if (isAuthenticated) {
      console.log('✅ Authentication confirmed, loading data...');

      // Batch all data loading calls for better performance
      const loadAllData = async () => {
        try {
          console.log('🚀 Starting data loading sequence...');

          // Load data first (this sets the main ingredients and menu items)
          console.log('🚀 Calling loadData...');
          await loadData();

          // Then load supporting data
          console.log('🚀 Calling loadLabelInitials...');
          await loadLabelInitials();
          console.log('🚀 Calling loadLabelSettings...');
          await loadLabelSettings();
          console.log('🚀 Calling loadCachedPrintQueue...');
          await loadCachedPrintQueue();

          console.log('✅ All data loading completed successfully');
        } catch (error) {
          console.error('❌ Error in data loading sequence:', error);
        }
      };

      // Use a small delay to ensure authentication state is fully established
      const timer = setTimeout(() => {
        loadAllData();
      }, 100);

      return () => clearTimeout(timer);
    } else {
      console.log('❌ Not authenticated, skipping data load');
    }
  }, [isAuthenticated]); // Only depend on isAuthenticated, not the individual functions

  // Debug effect to monitor authentication state changes
  useEffect(() => {
    console.log('🔍 LabelsPage auth state changed:', {isAuthenticated});
  }, [isAuthenticated]);

  // Fallback data loading - if no data after initial load, try again
  useEffect(() => {
    if (
      isAuthenticated &&
      !isLoading &&
      ingredients.length === 0 &&
      menuItems.length === 0
    ) {
      console.log(
        '⚠️ No data loaded after initial load, attempting fallback...',
      );

      // Wait a bit longer and try again
      const fallbackTimer = setTimeout(() => {
        if (ingredients.length === 0 && menuItems.length === 0) {
          console.log('🔄 Fallback: Attempting to load data again...');
          loadData();
        }
      }, 2000);

      return () => clearTimeout(fallbackTimer);
    }
  }, [
    isAuthenticated,
    isLoading,
    ingredients.length,
    menuItems.length,
    loadData,
  ]);

  // Queue management functions
  const addItemToPrintQueue = useCallback(
    (item: Ingredient | MenuItem, type: TabType) => {
      // Debug: Log what we're receiving
      console.log('🔍 addToPrintQueue called with:');
      console.log('🔍 type parameter:', type);
      console.log('🔍 item:', item);

      // Get the name first and validate it
      const name =
        type === 'ingredients'
          ? (item as Ingredient).ingredientName
          : (item as MenuItem).menuItemName;

      console.log('🔍 extracted name:', name);

      if (!name) {
        console.error('Cannot add item with undefined name to queue:', item);
        return;
      }

      // Detect allergens
      let detectedAllergens: string[] = [];
      let ingredientNames: string[] = [];
      let expiryDays: number;

      if (type === 'ingredients') {
        const ingredient = item as Ingredient;
        // Safety check for allergens array
        if (!ingredient.allergens || !Array.isArray(ingredient.allergens)) {
          console.warn('Ingredient has invalid allergens:', ingredient);
          detectedAllergens = [];
        } else {
          detectedAllergens = ingredient.allergens.map(a => a.allergenName);
        }
        ingredientNames = [ingredient.ingredientName];
        // Use expiryDays from ingredient data
        expiryDays = ingredient.expiryDays || 3;
        console.log(`📅 Using ingredient expiry days: ${expiryDays} days`);
      } else {
        const menuItem = item as MenuItem;
        // Safety check for ingredients array
        if (!menuItem.ingredients || !Array.isArray(menuItem.ingredients)) {
          console.warn('MenuItem has invalid ingredients:', menuItem);
          detectedAllergens = [];
          ingredientNames = [];
        } else {
          // Map menu item ingredients to actual ingredient objects and extract names
          const ingredientObjects = menuItem.ingredients
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
            `🔍 Menu item ${(item as MenuItem).menuItemName}: mapped ${
              ingredientNames.length
            } ingredients with ${detectedAllergens.length} allergens`,
          );
        }
        // For menu items, use label settings with 'default' as default
        const defaultLabelType = 'default';
        expiryDays = getExpiryDaysForLabelType(defaultLabelType);
        console.log(
          `📅 Using menu item expiry days for ${defaultLabelType}: ${expiryDays} days`,
        );
      }

      // Generate a truly unique ID
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substr(2, 9);
      const uid = `${type}-${timestamp}-${randomSuffix}`;

      const newItem: PrintQueueItem = {
        uid,
        name, // Use the validated name
        type,
        quantity: 1,
        labelType: type === 'ingredients' ? 'prep' : 'default',
        expiryDate: calculateExpiryDate(
          type === 'ingredients' ? 'prep' : 'default',
          undefined, // no custom expiry
          expiryDays,
        ),
        allergens: detectedAllergens,
        ingredients: ingredientNames, // Store the ingredient names
        labelHeight: '31mm', // Fixed height
      };

      setPrintQueue(prev => [...prev, newItem]);
      // Removed alert to improve UX flow - no need to confirm every addition
    },
    [ingredients, getExpiryDaysForLabelType],
  );

  const removeFromQueue = useCallback((uid: string) => {
    if (!uid) {
      console.warn('Cannot remove item with undefined uid');
      return;
    }
    setPrintQueue(prev => prev.filter(item => item.uid !== uid));
  }, []);

  const updateQuantity = useCallback((uid: string, quantity: number) => {
    if (!uid) {
      console.warn('Cannot update item with undefined uid');
      return;
    }
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      console.warn('Invalid quantity:', quantity);
      return;
    }
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid ? {...item, quantity: Math.max(1, quantity)} : item,
      ),
    );
  }, []);

  const incrementQuantity = useCallback((uid: string) => {
    if (!uid) {
      console.warn('Cannot increment item with undefined uid');
      return;
    }
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid ? {...item, quantity: item.quantity + 1} : item,
      ),
    );
  }, []);

  const decrementQuantity = useCallback((uid: string) => {
    if (!uid) {
      console.warn('Cannot decrement item with undefined uid');
      return;
    }
    setPrintQueue(prev => {
      const found = prev.find(item => item.uid === uid);
      if (!found) return prev;
      if (found.quantity <= 1) {
        // remove when reaching zero
        return prev.filter(item => item.uid !== uid);
      }
      return prev.map(item =>
        item.uid === uid ? {...item, quantity: item.quantity - 1} : item,
      );
    });
  }, []);

  const updateLabelType = useCallback(
    (uid: string, labelType: LabelType) => {
      if (!uid) {
        console.warn('Cannot update item with undefined uid');
        return;
      }
      if (!labelType) {
        console.warn('Cannot update item with undefined labelType');
        return;
      }
      setPrintQueue(prev =>
        prev.map(item => {
          if (item.uid === uid) {
            let expiryDays: number;

            if (item.type === 'ingredients') {
              // For ingredients, use their original expiryDays from data
              const ingredient = ingredients.find(
                i => i.ingredientName === item.name,
              );
              expiryDays = ingredient?.expiryDays || 3;
              console.log(
                `📅 Ingredient ${item.name}: using original expiry days ${expiryDays}`,
              );
            } else {
              // For menu items, use label settings for the new label type
              expiryDays = getExpiryDaysForLabelType(labelType);
              console.log(
                `📅 Menu item ${item.name}: using ${labelType} expiry days ${expiryDays}`,
              );
            }

            // Recalculate expiry date based on new label type
            const newExpiryDate = calculateExpiryDate(
              labelType,
              customExpiry[uid],
              expiryDays,
            );
            return {...item, labelType, expiryDate: newExpiryDate};
          }
          return item;
        }),
      );
    },
    [ingredients, getExpiryDaysForLabelType, customExpiry],
  );

  // Queue management functions for modal
  const handleUpdateQuantity = (uid: string, quantity: number) => {
    updateQuantity(uid, quantity);
  };

  const handleUpdateLabelType = (uid: string, labelType: LabelType) => {
    updateLabelType(uid, labelType);
  };

  const updateCustomExpiry = useCallback((uid: string, expiry: string) => {
    if (!uid) {
      console.warn('Cannot update item with undefined uid');
      return;
    }
    if (!expiry) {
      console.warn('Cannot update item with undefined expiry');
      return;
    }

    // Update the custom expiry
    setCustomExpiry(prev => ({...prev, [uid]: expiry}));

    // Also update the print queue item's expiry date
    setPrintQueue(prev =>
      prev.map(item =>
        item.uid === uid ? {...item, expiryDate: expiry} : item,
      ),
    );

    console.log(`📅 Updated custom expiry for ${uid}: ${expiry}`);
  }, []);

  // Helper functions for date format conversion
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

  // openDatePicker now uses CalendarModal
  const openDatePicker = (uid: string, currentDate: string) => {
    const yyyyMMddDate = convertToYYYYMMDD(currentDate);
    setCalendarTargetUid(uid);
    setCalendarInitial(yyyyMMddDate);
    setCalendarVisible(true);
  };

  const clearPrintQueue = useCallback(() => {
    if (!printQueue || printQueue.length === 0) {
      showToast.info('Empty Queue', 'The print queue is already empty');
      return;
    }

    // For now, we'll just clear the queue directly since toast doesn't support confirmations
    // In a real app, you might want to use a custom modal for confirmations
    setPrintQueue([]);
    setCustomExpiry({});
    clearSpoolerQueue(); // Also clear the spooler queue
    showToast.success('Queue Cleared', 'Print queue has been cleared');
  }, [printQueue, clearSpoolerQueue]);

  const printLabels = async () => {
    if (!printQueue || printQueue.length === 0) {
      showToast.error(
        'Empty Queue',
        'Please add items to the print queue first',
      );
      return;
    }

    if (!connectedDevice) {
      showToast.error(
        'No Printer Connected',
        'Please connect a printer first from the Connection page.',
      );
      return;
    }

    try {
      setIsLoadingPrint(true);

      // Use TSPL direct printing instead of image capture
      await printTSPLLabels(
        printQueue,
        ingredients,
        menuItems,
        customExpiry,
        useInitials ? initials : '',
        companyName,
      );

      showToast.success(
        'Print Jobs Queued',
        `${printQueue.length} labels have been sent to the printer using TSPL protocol.`,
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

  // Memoized expensive calculations
  const filteredIngredients = useMemo(() => {
    if (!searchTerm.trim()) return ingredients;
    return ingredients.filter(ingredient =>
      ingredient.ingredientName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    );
  }, [ingredients, searchTerm]);

  const filteredMenuItems = useMemo(() => {
    if (!searchTerm.trim()) return menuItems;
    return menuItems.filter(item =>
      item.menuItemName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [menuItems, searchTerm]);

  const paginatedIngredients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredIngredients.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredIngredients, currentPage, itemsPerPage]);

  const paginatedMenuItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMenuItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMenuItems, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    const totalItems =
      activeTab === 'ingredients'
        ? filteredIngredients.length
        : filteredMenuItems.length;
    return Math.ceil(totalItems / itemsPerPage);
  }, [
    activeTab,
    filteredIngredients.length,
    filteredMenuItems.length,
    itemsPerPage,
  ]);

  const renderTabContent = () => {
    const items =
      (activeTab === 'ingredients' ? filteredIngredients : filteredMenuItems) ||
      [];

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>
            Loading {activeTab || 'items'}...
          </Text>
        </View>
      );
    }

    // Helpers for inline controls
    const getDefaultExpiryForRow = (item: Ingredient | MenuItem): string => {
      if (activeTab === 'ingredients') {
        const ing = item as Ingredient;
        const days = ing.expiryDays || 3;
        return calculateExpiryDate('prep', undefined, days);
      } else {
        const days = getExpiryDaysForLabelType('prep');
        return calculateExpiryDate('prep', undefined, days);
      }
    };

    const handleIncrement = (item: Ingredient | MenuItem) => {
      const name =
        activeTab === 'ingredients'
          ? (item as Ingredient).ingredientName
          : (item as MenuItem).menuItemName;
      const q = printQueue.find(it => it.name === name);
      if (q) {
        incrementQuantity(q.uid);
      } else {
        addItemToPrintQueue(item, activeTab);
      }
    };

    const handleDecrement = (item: Ingredient | MenuItem) => {
      const name =
        activeTab === 'ingredients'
          ? (item as Ingredient).ingredientName
          : (item as MenuItem).menuItemName;
      const q = printQueue.find(it => it.name === name);
      if (q) {
        decrementQuantity(q.uid);
      }
    };

    const handleOpenDatePicker = (
      item: Ingredient | MenuItem,
      current: string,
    ) => {
      const name =
        activeTab === 'ingredients'
          ? (item as Ingredient).ingredientName
          : (item as MenuItem).menuItemName;
      const q = printQueue.find(it => it.name === name);
      if (q) {
        openDatePicker(q.uid, current);
      } else {
        addItemToPrintQueue(item, activeTab);
        setTimeout(() => {
          const created = printQueue.find(it => it.name === name);
          if (created) openDatePicker(created.uid, current);
        }, 0);
      }
    };

    const handleUpdateLabelTypeInline = (
      item: Ingredient | MenuItem,
      newType: LabelType,
    ) => {
      const name =
        activeTab === 'ingredients'
          ? (item as Ingredient).ingredientName
          : (item as MenuItem).menuItemName;
      const q = printQueue.find(it => it.name === name);
      if (q) {
        updateLabelType(q.uid, newType);
      } else {
        showToast.info(
          'Add to Queue',
          'Add the item before changing label type',
        );
      }
    };

    return (
      <View style={styles.tabContent}>
        {/* Enhanced Search and Filter Bar */}
        <View style={styles.searchFilterContainer}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${activeTab || 'items'}...`}
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
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <SearchX size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>
                No {activeTab || 'items'} found
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchTerm && searchTerm.trim()
                  ? 'Try adjusting your search terms'
                  : 'Pull to refresh to load data'}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={onRefresh}
                disabled={isRefreshing}>
                <Text style={styles.retryButtonText}>
                  {isRefreshing ? 'Loading...' : 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {(activeTab === 'ingredients'
                ? paginatedIngredients
                : paginatedMenuItems
              )
                .map(item => {
                  const name =
                    activeTab === 'ingredients'
                      ? (item as Ingredient).ingredientName
                      : (item as MenuItem).menuItemName;
                  if (!name) return null;

                  const queueItem = printQueue.find(q => q.name === name);
                  const currentQty = queueItem?.quantity ?? 0;
                  const currentExpiry = queueItem
                    ? customExpiry[queueItem.uid] || queueItem.expiryDate
                    : getDefaultExpiryForRow(item);

                  return (
                    <View key={`${activeTab}-${name}`} style={styles.itemCard}>
                      <View style={styles.itemTopRow}>
                        <View style={styles.itemMainInfo}>
                          <Text style={styles.itemName}>{name}</Text>
                          <TouchableOpacity
                            style={[
                              styles.expiryRow,
                              styles.expiryRowPressable,
                            ]}
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
                              handleOpenDatePicker(item, currentExpiry)
                            }>
                            <Text style={styles.queueItemExpiry}>
                              Expires: {currentExpiry}
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
                          <Text style={styles.quantityDisplay}>
                            {currentQty}
                          </Text>
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

                      {activeTab === 'menu' && (
                        <View style={styles.labelTypeRow}>
                          <View
                            style={[styles.labelTypeContainer, {marginTop: 6}]}>
                            <LabelTypeDropdown
                              value={
                                queueItem
                                  ? queueItem.labelType === 'ppds'
                                    ? 'default'
                                    : (queueItem.labelType as any)
                                  : 'default'
                              }
                              onValueChange={newType =>
                                handleUpdateLabelTypeInline(item, newType)
                              }
                              availableTypes={['default', 'cooked', 'prep']}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
                .filter(Boolean)}

              {totalPages > 1 && (
                <View style={styles.paginationContainer}>
                  <View style={styles.paginationControls}>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
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
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
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

  // Removed label preview renderer

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Lock size={64} color="#ccc" />
          <Text style={styles.authRequiredText}>Authentication Required</Text>
          <Text style={styles.authRequiredSubtext}>
            Please log in to access the labels system.
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
          // convert YYYY-MM-DD to DD.MM.YYYY then save
          const ddMMyyyyDate = convertToDDMMYYYY(selectedYmd);
          if (calendarTargetUid) {
            updateCustomExpiry(calendarTargetUid, ddMMyyyyDate);
          }
          setCalendarVisible(false);
        }}
        onClear={() => {
          if (calendarTargetUid) {
            // Remove custom override; reset to computed expiry
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
        onUpdateLabelType={handleUpdateLabelType}
        customExpiry={customExpiry}
        onUpdateCustomExpiry={updateCustomExpiry}
        onOpenDatePicker={(uid, currentDate) => {
          setQueueModalVisible(false);
          setTimeout(() => {
            openDatePicker(uid, currentDate);
          }, 300);
        }}
        showLabelType={true}
      />

      {/* Initials Selection Modal */}
      <Modal
        visible={showInitialsModal}
        transparent
        animationType="fade"
        onRequestClose={handleInitialsCancel}>
        <View style={styles.initialsModalOverlay}>
          <View style={styles.initialsModalContainer}>
            <View style={styles.initialsModalHeader}>
              <Text style={styles.initialsModalTitle}>
                Select Label Initials
              </Text>
              <Text style={styles.initialsModalSubtitle}>
                Choose initials for all labels in the print queue
              </Text>
            </View>

            <ScrollView
              style={styles.initialsModalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.initialsGrid}>
                {availableInitials.map(init => (
                  <TouchableOpacity
                    key={init}
                    style={[
                      styles.initialsModalOption,
                      initials === init && styles.initialsModalOptionSelected,
                    ]}
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    onPress={() => handleInitialsSelect(init)}>
                    <Text
                      style={[
                        styles.initialsModalOptionText,
                        initials === init &&
                          styles.initialsModalOptionTextSelected,
                      ]}>
                      {init}
                    </Text>
                    {initials === init && (
                      <Text style={styles.initialsModalCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.initialsModalActions}>
              <TouchableOpacity
                style={styles.initialsModalCancelButton}
                onPress={handleInitialsCancel}>
                <Text style={styles.initialsModalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.initialsModalConfirmButton}
                onPress={() => {
                  // Apply the selected initials
                  handleInitialsSelect(initials);
                }}>
                <Text style={styles.initialsModalConfirmButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Labels Header */}
      <View style={styles.labelsHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            {/* Compact header stats (no white/gray background) */}
            <View style={styles.headerStatsRow}>
              {/* Initials selector moved from queue to header */}
              {useInitials ? (
                <TouchableOpacity
                  style={styles.headerInitialsButton}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  accessibilityRole="button"
                  accessibilityLabel="Change initials"
                  onPress={() => {
                    setEditingInitialsUid(null);
                    setShowInitialsModal(true);
                  }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                    <Text style={styles.headerStatNumber}>{initials}</Text>
                    <Text style={styles.headerInitialsArrow}>▼</Text>
                  </View>
                  <Text style={styles.headerStatLabel}>Initials</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.headerStatItem}>
                  <Text style={styles.headerStatNumber}>--</Text>
                  <Text style={styles.headerStatLabel}>Initials</Text>
                </View>
              )}

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

      {/* Fixed Tabs below header */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'ingredients' ? styles.activeTab : styles.inactiveTab,
          ]}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="tab"
          accessibilityLabel="Ingredients tab"
          onPress={() => setActiveTab('ingredients')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'ingredients' && styles.activeTabText,
            ]}>
            Ingredients ({ingredients.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'menu' ? styles.activeTab : styles.inactiveTab,
          ]}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="tab"
          accessibilityLabel="Menu items tab"
          onPress={() => setActiveTab('menu')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'menu' && styles.activeTabText,
            ]}>
            Menu Items ({menuItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content - Using ScrollView with proper patterns */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }>
        {/* Items Section (tabs now fixed above) */}
        <View style={styles.itemsSection}>{renderTabContent()}</View>

        {/* Initials Section */}
        {/* Print Queue Section */}
        {/* Print queue UI removed; functionality handled inline and in footer */}

        {/* Label Preview Section removed as per product decision */}
      </ScrollView>

      {/* Persistent Footer with Clear, Print All, and FAB */}
      <View style={styles.footerContainer}>
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
  mainScrollView: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // Labels Header
  labelsHeader: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 12,
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
  labelsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  labelsSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    lineHeight: 18,
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
  headerInitialsButton: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
  },
  headerInitialsArrow: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
  },
  settingsSection: {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 15,
  },

  queueItemInitials: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  initialsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  initialsLoadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },

  itemsSection: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 0,
    shadowColor: 'transparent',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 0,
    minHeight: 44,
  },
  activeTab: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginBottom: -12,
    zIndex: 2,
    shadowColor: 'transparent',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  inactiveTab: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  activeTabText: {
    color: '#4B4FAE',
  },
  tabContent: {
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
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
    marginTop: 10,
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  searchFilterContainer: {
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    paddingLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  itemsList: {
    width: '100%',
    // Remove maxHeight to allow proper expansion
    // maxHeight: 400,
  },

  addButton: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 80,
    minHeight: 44,
  },
  addButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#4CAF50',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minHeight: 56,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 12,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueSection: {
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
  printButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  printLabelsButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  printLabelsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  printTSPLButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  printTSPLButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  clearQueueButton: {
    backgroundColor: '#fff5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7d7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
  },
  clearQueueText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyQueue: {
    alignItems: 'center',
    padding: 40,
  },
  emptyQueueText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyQueueSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  queueList: {
    // Remove maxHeight to allow expansion
    // maxHeight: 400,
  },
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
  expiryRowPressable: {
    paddingVertical: 6,
    paddingRight: 6,
    minHeight: 44,
  },
  calendarButton: {
    padding: 12,
    marginLeft: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    marginLeft: 0,
    alignSelf: 'flex-start',
  },
  labelTypeLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 5,
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
  expiryDaysInfo: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  expiryDaysText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
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

  previewSection: {
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
  previewPlaceholder: {
    alignItems: 'center',
    padding: 40,
  },
  previewText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  previewSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 15,
  },
  previewList: {
    paddingHorizontal: 10,
  },
  previewContainer: {
    marginBottom: 15,
  },
  authRequired: {
    alignItems: 'center',
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
  paginationContainer: {
    marginTop: 20,
    width: '100%',
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    width: '100%',
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

  /* Prompt modal styles */
  promptOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  promptContainer: {
    width: '88%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  promptMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  promptInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  promptButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  promptButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  promptCancel: {
    backgroundColor: '#f0f0f0',
  },
  promptSubmit: {
    backgroundColor: '#8A2BE2',
  },
  promptButtonText: {
    fontSize: 14,
    color: '#333',
  },

  initialsSelectorContainer: {
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
  initialsSelectorHeader: {
    marginBottom: 15,
  },
  initialsSelectorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  initialsSelectorSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  initialsSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  initialsSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  initialsSelectorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 5,
  },
  initialsSelectorArrow: {
    fontSize: 12,
    color: '#666',
  },
  initialsDisplayRow: {
    marginTop: 10,
    marginBottom: 10,
  },

  /* New Initials Modal Styles */
  initialsModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  initialsModalContainer: {
    width: '85%',
    maxWidth: 350,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  initialsModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  initialsModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  initialsModalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  initialsModalList: {
    maxHeight: 300,
    marginBottom: 24,
  },
  initialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  initialsModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '48%',
  },
  initialsModalOptionSelected: {
    backgroundColor: '#fff',
    borderColor: '#8A2BE2',
  },
  initialsModalOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  initialsModalOptionTextSelected: {
    color: '#8A2BE2',
  },
  initialsModalCheckmark: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8A2BE2',
    marginLeft: 12,
  },
  initialsModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  initialsModalCancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  initialsModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  initialsModalConfirmButton: {
    flex: 1,
    backgroundColor: '#8A2BE2',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  initialsModalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

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
    backgroundColor: '#ffd6d6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 4,
    minHeight: 40,
  },
  footerClearText: {
    color: '#d64545',
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
  labelTypeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4,
  },
  retryButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    minWidth: 100,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  retryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LabelsPage;
