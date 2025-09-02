import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
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
import {
  apiService,
  groupPrintSessions,
  getItemNames,
  getTotalQuantity,
  getLabelTypes,
  GroupedPrintSession,
  PrintLog,
} from '../services/api';
import {usePrinter} from '../PrinterContext';

interface PrintSessionsProps {
  showDetails?: boolean;
}

const PrintSessions: React.FC<PrintSessionsProps> = ({showDetails = false}) => {
  const {isAuthenticated, accessToken} = useAuth();
  const [sessions, setSessions] = useState<GroupedPrintSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprintingSessionId, setReprintingSessionId] = useState<string | null>(
    null,
  );
  const {printTSPLLabels, connectedDevice} = usePrinter();

  const fetchPrintSessions = async (isRefresh = false) => {
    if (!isAuthenticated || !accessToken) {
      setSessions([]);
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Set token in API service
      apiService.setAccessToken(accessToken);

      // Fetch all activity logs
      const response = await apiService.getActivityLogs();

      // Filter only print_label actions and map to PrintLog format
      const printLogs: PrintLog[] = response.logs
        .filter((log: any) => log.action === 'print_label')
        .map((log: any) => {
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
            timestamp: log.created_at || new Date().toISOString(),
          } as PrintLog;
        });

      // Group the print logs into sessions
      const groupedSessions = groupPrintSessions(printLogs);
      setSessions(groupedSessions);
    } catch (error: any) {
      console.error('Error fetching print sessions:', error);
      setError('Failed to load print sessions');
      setSessions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrintSessions();
  }, [isAuthenticated, accessToken]);

  const onRefresh = () => {
    fetchPrintSessions(true);
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

  const handleReprintSession = async (session: GroupedPrintSession) => {
    if (!isAuthenticated || !accessToken) {
      Alert.alert('Not Authenticated', 'Please log in to print.');
      return;
    }

    try {
      setReprintingSessionId(session.sessionId);
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

      // Build print queue from session items
      const printQueue = session.items.map(item => {
        const lt =
          item.details.labelType === 'use_first'
            ? 'use-first'
            : item.details.labelType;
        const expiryDate = calculateExpiryDate(
          item.details.labelType,
          labelSettings.settings || [],
        );
        return {
          uid: `${item.details.itemId}-${Date.now()}`,
          name: item.details.itemName,
          type: item.details.labelType === 'defrost' ? 'ingredients' : 'menu',
          quantity: item.details.quantity,
          labelType: lt,
          expiryDate,
          allergens: [],
          ingredients: [],
          labelHeight: session.labelHeight || '40mm',
          customInitials: initials,
        };
      });

      // Print using PrinterContext helper
      await printTSPLLabels(printQueue, ingredients, menuItems, {}, initials);

      // Log reprint actions
      const reprintSessionId = apiService.generateSessionId();
      for (const item of session.items) {
        const expiryDate = calculateExpiryDate(
          item.details.labelType,
          (labelSettings as any).settings || [],
        );
        await apiService.logPrintAction({
          labelType: item.details.labelType,
          itemId: item.details.itemId,
          itemName: item.details.itemName,
          quantity: item.details.quantity,
          expiryDate: new Date(expiryDate).toISOString(),
          labelHeight: session.labelHeight || '40mm',
          printerUsed:
            (connectedDevice && connectedDevice.name) || 'Unknown Printer',
          sessionId: reprintSessionId,
        });
      }

      Alert.alert('Reprint Started', 'The session is being reprinted.');
    } catch (err) {
      console.error('Error reprinting session:', err);
      Alert.alert('Error', 'Failed to reprint the session.');
    } finally {
      setReprintingSessionId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
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
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Loading print sessions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchPrintSessions()}>
          <RefreshCw size={16} color="#8A2BE2" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Printer size={48} color="#ccc" />
        <Text style={styles.emptyText}>No print sessions found</Text>
        <Text style={styles.emptySubtext}>
          Print some labels to see your sessions here
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }>
      {sessions.map(session => (
        <View key={session.sessionId} style={styles.sessionCard}>
          {/* Session Header */}
          <View style={styles.sessionHeader}>
            <View style={styles.sessionInfo}>
              <Hash size={16} color="#666" />
              <Text style={styles.sessionId}>
                {session.sessionId.substring(0, 20)}...
              </Text>
            </View>
            <View style={styles.timeInfo}>
              <Clock size={14} color="#666" />
              <Text style={styles.timeText}>
                {formatTimeAgo(session.printedAt)}
              </Text>
            </View>
          </View>

          {/* Session Details */}
          <View style={styles.sessionDetails}>
            <View style={styles.detailRow}>
              <Package size={16} color="#8A2BE2" />
              <Text style={styles.detailLabel}>Items:</Text>
              <Text style={styles.detailValue} numberOfLines={2}>
                {getItemNames(session)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Quantity:</Text>
              <Text style={styles.detailValue}>
                {getTotalQuantity(session)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Types:</Text>
              <Text style={styles.detailValue}>{getLabelTypes(session)}</Text>
            </View>

            {session.printerUsed && (
              <View style={styles.detailRow}>
                <Printer size={16} color="#4CAF50" />
                <Text style={styles.detailLabel}>Printer:</Text>
                <Text style={styles.detailValue}>
                  {typeof session.printerUsed === 'string'
                    ? session.printerUsed
                    : (session.printerUsed as any)?.name || 'Unknown Printer'}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Calendar size={16} color="#FF9800" />
              <Text style={styles.detailLabel}>Printed:</Text>
              <Text style={styles.detailValue}>
                {formatDate(session.printedAt)}
              </Text>
            </View>

            {/* Reprint Button */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[
                  styles.reprintButton,
                  reprintingSessionId === session.sessionId &&
                    styles.reprintButtonDisabled,
                ]}
                disabled={reprintingSessionId === session.sessionId}
                onPress={() => handleReprintSession(session)}>
                {reprintingSessionId === session.sessionId ? (
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

          {/* Show individual items if details are requested */}
          {showDetails && session.items.length > 0 && (
            <View style={styles.itemsContainer}>
              <Text style={styles.itemsTitle}>Items in this session:</Text>
              {/* Show selected items if available, otherwise show individual prints */}
              {session.items[0].details.selectedItems
                ? session.items[0].details.selectedItems.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQuantity}>x1</Text>
                      <Text style={styles.itemType}>
                        {session.items[0].details.labelType.toUpperCase()}
                      </Text>
                    </View>
                  ))
                : session.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Text style={styles.itemName}>
                        {item.details.itemName}
                      </Text>
                      <Text style={styles.itemQuantity}>
                        x{item.details.quantity}
                      </Text>
                      <Text style={styles.itemType}>
                        {item.details.labelType.toUpperCase()}
                      </Text>
                    </View>
                  ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
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
});

export default PrintSessions;
