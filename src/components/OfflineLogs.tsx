import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {Clock, Wifi, WifiOff, Trash2} from 'lucide-react-native';
import offlineManager from '../utils/offlineManager';
import {useAuth} from '../contexts/AuthContext';
import {apiService} from '../services/api';

interface OfflineLog {
  id: string;
  action: string;
  details: {
    labelType: string;
    itemName: string;
    quantity: number;
    printedAt: string;
    printerUsed: string;
    sessionId?: string;
  };
  queuedAt: number;
}

const OfflineLogs: React.FC = () => {
  const {isAuthenticated} = useAuth();
  const [offlineLogs, setOfflineLogs] = useState<OfflineLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadOfflineLogs = useCallback(async () => {
    if (!isAuthenticated) {
      setOfflineLogs([]);
      return;
    }

    try {
      setIsLoading(true);
      const pendingLogs = await offlineManager.getPendingLogs();
      setOfflineLogs(pendingLogs);
      console.log(`📝 Loaded ${pendingLogs.length} offline logs`);
    } catch (error) {
      console.error('Error loading offline logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOfflineLogs();
    setIsRefreshing(false);
  }, [loadOfflineLogs]);

  const handleAutoSync = useCallback(async () => {
    if (offlineLogs.length === 0) return;

    try {
      setIsSyncing(true);
      console.log('🔄 Auto sync triggered...');
      await apiService.syncPendingLogs();
      await loadOfflineLogs(); // Reload to show updated list
      console.log('✅ Auto sync completed');
    } catch (error) {
      console.error('❌ Auto sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [offlineLogs.length, loadOfflineLogs]);

  const handleClearAll = useCallback(async () => {
    try {
      await offlineManager.clearPendingLogs();
      setOfflineLogs([]);
      console.log('🧹 All offline logs cleared');
    } catch (error) {
      console.error('Error clearing offline logs:', error);
    }
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getLabelTypeColor = (labelType: string) => {
    const colors: {[key: string]: string} = {
      cooked: '#FF6B6B',
      prep: '#4ECDC4',
      ppds: '#45B7D1',
      ppd: '#96CEB4',
      'use-first': '#FFEAA7',
      defrost: '#DDA0DD',
      default: '#95A5A6',
      etc: '#F39C12',
      custom: '#9B59B6',
    };
    return colors[labelType] || '#95A5A6';
  };

  useEffect(() => {
    loadOfflineLogs();
  }, [loadOfflineLogs]);

  // Auto-sync and refresh logs when component becomes visible
  useEffect(() => {
    const interval = setInterval(async () => {
      await loadOfflineLogs();
      // Auto-sync if we have pending logs and we're online
      if (offlineLogs.length > 0) {
        await handleAutoSync();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [loadOfflineLogs, handleAutoSync, offlineLogs.length]);

  const renderLogItem = ({item}: {item: OfflineLog}) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <View style={styles.logTitleRow}>
          <View
            style={[
              styles.labelTypeBadge,
              {backgroundColor: getLabelTypeColor(item.details.labelType)},
            ]}>
            <Text style={styles.labelTypeText}>
              {item.details.labelType.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.details.itemName}
          </Text>
        </View>
        <View style={styles.logMetaRow}>
          <Text style={styles.quantityText}>Qty: {item.details.quantity}</Text>
          <Text style={styles.printerText}>{item.details.printerUsed}</Text>
        </View>
      </View>

      <View style={styles.logFooter}>
        <View style={styles.timeRow}>
          <Clock size={12} color="#666" />
          <Text style={styles.timeText}>
            Queued: {formatDate(item.queuedAt)}
          </Text>
        </View>
        {item.details.sessionId && (
          <Text style={styles.sessionText}>
            Session: {item.details.sessionId.slice(-8)}
          </Text>
        )}
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <WifiOff size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>Authentication Required</Text>
          <Text style={styles.emptyText}>
            Please log in to view offline logs
          </Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Loading offline logs...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with sync button */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <WifiOff size={20} color="#8A2BE2" />
          <Text style={styles.headerTitle}>
            Offline Logs ({offlineLogs.length})
          </Text>
        </View>
        <View style={styles.headerActions}>
          {offlineLogs.length > 0 && (
            <View style={styles.statusContainer}>
              {isSyncing ? (
                <Text style={styles.syncingText}>Syncing...</Text>
              ) : (
                <Text style={styles.autoSyncText}>Auto-sync enabled</Text>
              )}
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearAll}>
                <Trash2 size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Logs list */}
      {offlineLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Wifi size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No Offline Logs</Text>
          <Text style={styles.emptyText}>
            All logs have been synced to the server
          </Text>
        </View>
      ) : (
        <FlatList
          data={offlineLogs}
          keyExtractor={item => item.id}
          renderItem={renderLogItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#8A2BE2']}
            />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncingText: {
    fontSize: 12,
    color: '#8A2BE2',
    fontWeight: '500',
  },
  autoSyncText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  clearButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  listContainer: {
    padding: 16,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logHeader: {
    marginBottom: 12,
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  labelTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  printerText: {
    fontSize: 12,
    color: '#999',
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  sessionText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default OfflineLogs;
