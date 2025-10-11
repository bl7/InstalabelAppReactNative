import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import {
  Printer,
  Calendar,
  Package,
  Hash,
  RefreshCw,
  Clock,
} from 'lucide-react-native';
import {useAuth} from '../contexts/AuthContext';
import {apiService, PrintLog} from '../services/api';
import {usePrinter} from '../PrinterContext';

interface PrintSessionsProps {
  showDetails?: boolean;
}

const PrintSessions: React.FC<PrintSessionsProps> = ({showDetails = false}) => {
  const {isAuthenticated, accessToken} = useAuth();
  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprintingLogId, setReprintingLogId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showPPDSSizeModal, setShowPPDSSizeModal] = useState(false);
  const [pendingReprintLog, setPendingReprintLog] = useState<PrintLog | null>(
    null,
  );
  const {printTSPLLabels, connectedDevice} = usePrinter();

  const fetchPrintLogs = async (isRefresh = false, page = 1) => {
    console.log('🔍 fetchPrintLogs called:', {
      isAuthenticated,
      hasToken: !!accessToken,
      isRefresh,
      page,
    });

    if (!isAuthenticated || !accessToken) {
      console.log('🔍 Not authenticated or no token, setting empty logs');
      setLogs([]);
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
      setCurrentPage(1);
    } else if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      console.log('🔍 Setting access token and fetching logs...');
      // Set token in API service
      apiService.setAccessToken(accessToken);

      // Calculate date range (last 30 days for better performance)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFrom = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Fetch activity logs with pagination and date filtering
      const response = await apiService.getActivityLogs({
        page,
        limit: 20, // Limit to 20 logs per page
        dateFrom,
        action: 'print_label', // Filter only print_label actions on server side
      });
      console.log('🔍 API response received:', response);

      // Map to PrintLog format (server already filtered for print_label actions)
      const printLogs: PrintLog[] = response.logs.map((log: any) => {
        const rawPrinter = log.details?.printerUsed;
        const printerUsed =
          typeof rawPrinter === 'string'
            ? rawPrinter
            : rawPrinter?.name || 'Unknown Printer';

        return {
          id: log.id || 0,
          user_id: log.user_id || '',
          action: log.action,
          details: {
            itemId: log.details?.itemId || '',
            itemName: log.details?.itemName || '',
            quantity: log.details?.quantity || 1,
            labelType: log.details?.labelType || 'use_first',
            printedAt: log.details?.printedAt || log.created_at,
            expiryDate: log.details?.expiryDate || '',
            initial: log.details?.initial,
            labelHeight: log.details?.labelHeight,
            printerUsed,
            sessionId: log.details?.sessionId,
          },
          timestamp:
            log.details?.printedAt ||
            log.created_at ||
            new Date().toISOString(),
        } as PrintLog;
      });

      // Debug: Simple timestamp check (only log once)
      if (page === 1 && printLogs.length > 0) {
        console.log(
          '🔍 Loaded',
          printLogs.length,
          'logs, first timestamp:',
          printLogs[0]?.timestamp,
        );
      }

      // Handle pagination
      if (page === 1 || isRefresh) {
        setLogs(printLogs);
      } else {
        setLogs(prevLogs => [...prevLogs, ...printLogs]);
      }

      // Check if there are more logs to load
      setHasMore(printLogs.length === 20); // If we got less than 20, we've reached the end
      setCurrentPage(page);

      console.log(
        '🔍 Setting logs:',
        printLogs.length,
        'logs found, hasMore:',
        printLogs.length === 20,
      );
    } catch (error: any) {
      console.error('🔍 Error fetching print sessions:', error);
      setError('Failed to load print sessions');
      if (page === 1) {
        setLogs([]);
      }
    } finally {
      console.log('🔍 Setting loading states to false');
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPrintLogs();
  }, [isAuthenticated, accessToken]);

  const onRefresh = () => {
    fetchPrintLogs(true, 1);
  };

  const loadMore = () => {
    if (hasMore && !isLoadingMore && !isLoading) {
      fetchPrintLogs(false, currentPage + 1);
    }
  };

  const calculateExpiryDate = (
    labelType: string,
    settings: {label_type: string; expiry_days: number}[],
  ): string => {
    const today = new Date();

    if (labelType === 'defrost') {
      today.setDate(today.getDate() + 1);
      return today.toISOString().split('T')[0];
    }

    const setting = settings.find(s => s.label_type === labelType);
    const expiryDays = setting
      ? parseInt(String(setting.expiry_days))
      : labelType === 'cooked'
      ? 1
      : labelType === 'prep'
      ? 3
      : labelType === 'ppds'
      ? 5
      : 3;

    today.setDate(today.getDate() + expiryDays);
    return today.toISOString().split('T')[0];
  };

  const handleReprintLog = async (log: PrintLog) => {
    if (!isAuthenticated || !accessToken) {
      Alert.alert('Not Authenticated', 'Please log in to print.');
      return;
    }

    // Check if this is a PPDS label type and show size selection popup
    if (log.details.labelType === 'ppds') {
      setPendingReprintLog(log);
      setShowPPDSSizeModal(true);
      return;
    }

    // For non-PPDS labels, proceed with normal reprint
    await performReprint(log, 'ppd'); // Default to small size for non-PPDS
  };

  const performReprint = async (
    log: PrintLog,
    selectedSize: 'ppd' | 'ppds',
  ) => {
    try {
      setReprintingLogId(log.id.toString());
      apiService.setAccessToken(accessToken);

      // Fetch resources needed for accurate printing
      const [ingredients, menuItems, labelSettings, initialsRes] =
        await Promise.all([
          apiService.getIngredients().catch(() => []),
          apiService.getMenuItems().catch(() => []),
          apiService.getLabelSettings().catch(() => ({settings: []} as any)),
          apiService
            .getLabelInitials()
            .catch(() => ({use_initials: false, initials: []})),
        ]);

      const useInitials = initialsRes.use_initials;
      const initials =
        useInitials && initialsRes.initials?.length > 0
          ? initialsRes.initials[0]
          : '';

      // Build print queue from single log item
      let lt =
        log.details.labelType === 'use_first'
          ? 'use-first'
          : log.details.labelType;

      // For PPDS labels, use the selected size from popup
      if (log.details.labelType === 'ppds') {
        lt = selectedSize; // Use the user-selected size (ppd or ppds)
        console.log(
          `🔄 PPDS reprint: User selected ${selectedSize} (${
            selectedSize === 'ppd' ? '60×40mm' : '56×80mm'
          })`,
        );
      }
      const expiryDate = calculateExpiryDate(
        log.details.labelType,
        labelSettings.settings || [],
      );

      // Find the menu item to get proper ingredients and allergens
      let allergens: string[] = [];
      let ingredientNames: string[] = [];

      if (log.details.labelType !== 'defrost') {
        // Find the menu item from the fetched menuItems
        const menuItem = menuItems.find(
          menu =>
            menu.menuItemName === log.details.itemName ||
            menu.name === log.details.itemName,
        );

        if (menuItem) {
          console.log('🔍 Found menu item for reprint:', menuItem);

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

          console.log('🔍 Extracted for reprint:', {
            allergens,
            ingredientNames,
            menuItemIngredients: menuItem.ingredients,
          });
        } else {
          console.warn(
            '⚠️ Menu item not found for reprint:',
            log.details.itemName,
          );
        }
      }

      const printQueue = [
        {
          uid: `${log.details.itemId}-${Date.now()}`,
          name: log.details.itemName,
          type: log.details.labelType === 'defrost' ? 'ingredients' : 'menu',
          quantity: log.details.quantity,
          labelType: lt,
          expiryDate,
          allergens,
          ingredients: ingredientNames,
          labelHeight: log.details.labelHeight || '40mm',
          customInitials: initials,
        },
      ];

      // Print using PrinterContext helper (this already logs to backend)
      // For PPDS labels, use the correct format based on selected size
      const useFullPPDSFormat = selectedSize === 'ppds';
      await printTSPLLabels(
        printQueue,
        ingredients,
        menuItems,
        {},
        initials,
        undefined, // storageInstructions
        undefined, // companyName
        undefined, // sessionId - will generate new one
        useFullPPDSFormat, // Use full PPDS format (56mm×80mm) if selectedSize is 'ppds'
      );

      Alert.alert('Reprint Started', 'The label is being reprinted.');
    } catch (err) {
      console.error('Error reprinting log:', err);
      Alert.alert('Error', 'Failed to reprint the label.');
    } finally {
      setReprintingLogId(null);
    }
  };

  const handlePPDSSizeSelection = (size: 'ppd' | 'ppds') => {
    setShowPPDSSizeModal(false);
    if (pendingReprintLog) {
      performReprint(pendingReprintLog, size);
    }
    setPendingReprintLog(null);
  };

  const handleCancelPPDSSize = () => {
    setShowPPDSSizeModal(false);
    setPendingReprintLog(null);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string for formatDate:', dateString);
        return 'Invalid date';
      }
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', error, 'for date:', dateString);
      return 'Invalid date';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const now = new Date();
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Unknown time';
      }

      const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60),
      );

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;

      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;

      return formatDate(dateString);
    } catch (error) {
      console.error(
        'Error formatting time ago:',
        error,
        'for date:',
        dateString,
      );
      return 'Unknown time';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Loading print logs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchPrintLogs()}>
          <RefreshCw size={16} color="#8A2BE2" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (logs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Printer size={48} color="#ccc" />
        <Text style={styles.emptyText}>No print logs found</Text>
        <Text style={styles.emptySubtext}>
          Print some labels to see your logs here
        </Text>
      </View>
    );
  }

  const renderLogItem = ({item: log}: {item: PrintLog}) => (
    <View style={styles.sessionCard}>
      {/* Log Header - Removed ID and time display */}

      {/* Log Details */}
      <View style={styles.sessionDetails}>
        <View style={styles.detailRow}>
          <Package size={16} color="#8A2BE2" />
          <Text style={styles.detailLabel}>Item:</Text>
          <Text style={styles.detailValue} numberOfLines={2}>
            {typeof log.details.itemName === 'string'
              ? log.details.itemName
              : String(log.details.itemName || 'Unknown Item')}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Quantity:</Text>
          <Text style={styles.detailValue}>
            {typeof log.details.quantity === 'number'
              ? log.details.quantity
              : String(log.details.quantity || '0')}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>
            {typeof log.details.labelType === 'string'
              ? log.details.labelType
              : String(log.details.labelType || 'Unknown')}
          </Text>
        </View>

        {log.details.initial && (
          <View style={styles.detailRow}>
            <Hash size={16} color="#9C27B0" />
            <Text style={styles.detailLabel}>Initials:</Text>
            <Text style={styles.detailValue}>
              {typeof log.details.initial === 'string'
                ? log.details.initial
                : String(log.details.initial || 'N/A')}
            </Text>
          </View>
        )}

        {log.details.printerUsed && (
          <View style={styles.detailRow}>
            <Printer size={16} color="#4CAF50" />
            <Text style={styles.detailLabel}>Printer:</Text>
            <Text style={styles.detailValue}>
              {typeof log.details.printerUsed === 'string'
                ? log.details.printerUsed
                : (log.details.printerUsed as any)?.name || 'Unknown Printer'}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Calendar size={16} color="#FF9800" />
          <Text style={styles.detailLabel}>Printed:</Text>
          <Text style={styles.detailValue}>
            {formatDate(
              log.details.printedAt || log.created_at || log.timestamp,
            )}
          </Text>
        </View>

        {/* Reprint Button */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.reprintButton,
              reprintingLogId === log.id.toString() &&
                styles.reprintButtonDisabled,
            ]}
            disabled={reprintingLogId === log.id.toString()}
            onPress={() => handleReprintLog(log)}>
            {reprintingLogId === log.id.toString() ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Printer size={16} color="#fff" />
                <Text style={styles.reprintButtonText}>Reprint</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#8A2BE2" />
        <Text style={styles.loadingFooterText}>Loading more logs...</Text>
      </View>
    );
  };

  return (
    <>
      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={item => item.id.toString()}
        style={styles.container}
        contentContainerStyle={styles.listContentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={5}
        showsVerticalScrollIndicator={false}
        getItemLayout={undefined}
        keyExtractor={(item: PrintLog) => item.id.toString()}
      />

      {/* PPDS Size Selection Modal */}
      <Modal
        visible={showPPDSSizeModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelPPDSSize}>
        <View style={styles.modalOverlay}>
          <View style={styles.sizeSelectionModal}>
            <Text style={styles.sizeSelectionTitle}>
              Select PPDS Label Size
            </Text>
            <Text style={styles.sizeSelectionSubtitle}>
              Choose the size for your PPDS label reprint
            </Text>

            <View style={styles.sizeOptionsContainer}>
              <TouchableOpacity
                style={styles.sizeOption}
                onPress={() => handlePPDSSizeSelection('ppd')}>
                <View style={styles.sizeOptionHeader}>
                  <Text style={styles.sizeOptionTitle}>Small (40mm)</Text>
                  <Text style={styles.sizeOptionDimensions}>60mm × 40mm</Text>
                </View>
                <Text style={styles.sizeOptionDescription}>
                  Standard size for labels page
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sizeOption}
                onPress={() => handlePPDSSizeSelection('ppds')}>
                <View style={styles.sizeOptionHeader}>
                  <Text style={styles.sizeOptionTitle}>Large (80mm)</Text>
                  <Text style={styles.sizeOptionDimensions}>56mm × 80mm</Text>
                </View>
                <Text style={styles.sizeOptionDescription}>
                  Full UK-compliant PPDS format
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelPPDSSize}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContentContainer: {
    paddingBottom: 80, // Reduced padding for better performance
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8A2BE2',
    gap: 8,
  },
  retryButtonText: {
    color: '#8A2BE2',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  sessionCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  sessionDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    minWidth: 60,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  itemsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  reprintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reprintButtonDisabled: {
    opacity: 0.6,
  },
  reprintButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginHorizontal: 8,
  },
  itemType: {
    fontSize: 10,
    color: '#8A2BE2',
    fontWeight: '600',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  loadingFooterText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  // PPDS Size Selection Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sizeSelectionModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  sizeSelectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  sizeSelectionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  sizeOptionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  sizeOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  sizeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sizeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sizeOptionDimensions: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '500',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeOptionDescription: {
    fontSize: 12,
    color: '#666',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default PrintSessions;
