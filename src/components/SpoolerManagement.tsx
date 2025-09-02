import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import {usePrinter} from '../PrinterContext';

/**
 * Spooler Management Component
 * Demonstrates the new load balancing, security, and memory management features
 */
const SpoolerManagement: React.FC = () => {
  const {
    addToPrintQueue,
    addPrinterInstance,
    removePrinterInstance,
    updatePrinterHealth,
    getSystemInfo,
    performMemoryCleanup,
    queueStatus,
    printQueue,
  } = usePrinter();

  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [newPrinterId, setNewPrinterId] = useState('');
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterAddress, setNewPrinterAddress] = useState('');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(
    null,
  );

  // Refresh system info every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const info = getSystemInfo();
      if (info) {
        setSystemInfo(info);
      }
    }, 5000);

    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [getSystemInfo]);

  // Add a new printer instance
  const handleAddPrinter = () => {
    if (!newPrinterId || !newPrinterName || !newPrinterAddress) {
      Alert.alert('Error', 'Please fill in all printer details');
      return;
    }

    try {
      addPrinterInstance(
        newPrinterId,
        newPrinterName,
        'bluetooth',
        newPrinterAddress,
        5, // Max load of 5 concurrent jobs
      );

      Alert.alert('Success', 'Printer instance added successfully');

      // Clear form
      setNewPrinterId('');
      setNewPrinterName('');
      setNewPrinterAddress('');
    } catch (error) {
      Alert.alert('Error', `Failed to add printer: ${error}`);
    }
  };

  // Remove a printer instance
  const handleRemovePrinter = (printerId: string) => {
    Alert.alert(
      'Confirm Removal',
      `Are you sure you want to remove printer ${printerId}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const removed = removePrinterInstance(printerId);
            if (removed) {
              Alert.alert('Success', 'Printer instance removed');
            } else {
              Alert.alert('Error', 'Failed to remove printer instance');
            }
          },
        },
      ],
    );
  };

  // Update printer health
  const handleUpdatePrinterHealth = (
    printerId: string,
    isHealthy: boolean,
    currentLoad: number,
  ) => {
    try {
      updatePrinterHealth(printerId, isHealthy, currentLoad);
      Alert.alert('Success', 'Printer health updated');
    } catch (error) {
      Alert.alert('Error', `Failed to update printer health: ${error}`);
    }
  };

  // Add a test job with security parameters
  const handleAddTestJob = () => {
    try {
      const testLabelData = {
        header: 'Test Label',
        text: 'This is a test label for security validation',
        type: 'text',
        metadata: {
          labelType: 'test',
          itemId: 'test_001',
          itemName: 'Test Item',
          sessionId: `session_${Date.now()}`,
        },
      };

      const jobId = addToPrintQueue(
        testLabelData,
        1,
        'normal',
        'test_user_001', // userId for rate limiting
        `session_${Date.now()}`, // sessionId for tracking
      );

      Alert.alert('Success', `Test job added with ID: ${jobId}`);
    } catch (error) {
      Alert.alert('Error', `Failed to add test job: ${error}`);
    }
  };

  // Perform memory cleanup
  const handleMemoryCleanup = () => {
    try {
      performMemoryCleanup();
      Alert.alert('Success', 'Memory cleanup initiated');
    } catch (error) {
      Alert.alert('Error', `Failed to perform memory cleanup: ${error}`);
    }
  };

  // Format bytes to human readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🖨️ Spooler Management</Text>

      {/* System Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 System Overview</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Jobs</Text>
            <Text style={styles.statValue}>{queueStatus.totalJobs}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Active Jobs</Text>
            <Text style={styles.statValue}>{queueStatus.activeJobs}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pending Jobs</Text>
            <Text style={styles.statValue}>{queueStatus.pendingJobs}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Failed Jobs</Text>
            <Text style={styles.statValue}>{queueStatus.failedJobs}</Text>
          </View>
        </View>
      </View>

      {/* Load Balancing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚖️ Load Balancing</Text>

        {/* Add New Printer */}
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>Add New Printer Instance</Text>
          <TextInput
            style={styles.input}
            placeholder="Printer ID"
            value={newPrinterId}
            onChangeText={setNewPrinterId}
          />
          <TextInput
            style={styles.input}
            placeholder="Printer Name"
            value={newPrinterName}
            onChangeText={setNewPrinterName}
          />
          <TextInput
            style={styles.input}
            placeholder="Bluetooth Address"
            value={newPrinterAddress}
            onChangeText={setNewPrinterAddress}
          />
          <TouchableOpacity style={styles.button} onPress={handleAddPrinter}>
            <Text style={styles.buttonText}>Add Printer</Text>
          </TouchableOpacity>
        </View>

        {/* Printer Instances */}
        {systemInfo?.printerInstances && (
          <View style={styles.printerList}>
            <Text style={styles.subsectionTitle}>Active Printer Instances</Text>
            {systemInfo.printerInstances.map((printer: any) => (
              <View key={printer.id} style={styles.printerItem}>
                <View style={styles.printerInfo}>
                  <Text style={styles.printerName}>{printer.name}</Text>
                  <Text style={styles.printerDetails}>
                    {printer.connectionType} • {printer.address}
                  </Text>
                  <Text style={styles.printerStatus}>
                    Status: {printer.isHealthy ? '🟢 Healthy' : '🔴 Unhealthy'}
                  </Text>
                  <Text style={styles.printerLoad}>
                    Load: {printer.currentLoad}/{printer.maxLoad}
                  </Text>
                </View>
                <View style={styles.printerActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.healthButton]}
                    onPress={() =>
                      handleUpdatePrinterHealth(printer.id, true, 0)
                    }>
                    <Text style={styles.actionButtonText}>Mark Healthy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemovePrinter(printer.id)}>
                    <Text style={styles.actionButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Security Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Security Features</Text>

        <View style={styles.securityInfo}>
          <Text style={styles.securityText}>
            • Job validation:{' '}
            {systemInfo?.config?.enableJobValidation
              ? '✅ Enabled'
              : '❌ Disabled'}
          </Text>
          <Text style={styles.securityText}>
            • Rate limiting:{' '}
            {systemInfo?.config?.enableRateLimiting
              ? '✅ Enabled'
              : '❌ Disabled'}
          </Text>
          <Text style={styles.securityText}>
            • Checksum validation:{' '}
            {systemInfo?.config?.enableChecksumValidation
              ? '✅ Enabled'
              : '❌ Disabled'}
          </Text>
          <Text style={styles.securityText}>
            • Max job size: {formatBytes(systemInfo?.config?.maxJobSize || 0)}
          </Text>
          <Text style={styles.securityText}>
            • Max image size:{' '}
            {formatBytes(systemInfo?.config?.maxImageSize || 0)}
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleAddTestJob}>
          <Text style={styles.buttonText}>Add Test Job (Security Test)</Text>
        </TouchableOpacity>
      </View>

      {/* Memory Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧠 Memory Management</Text>

        {systemInfo?.memoryUsage && (
          <View style={styles.memoryInfo}>
            <Text style={styles.memoryText}>
              Current Usage:{' '}
              {formatBytes(systemInfo.memoryUsage.estimatedMemoryUsage)}
            </Text>
            <Text style={styles.memoryText}>
              Peak Usage: {formatBytes(systemInfo.memoryUsage.peakMemoryUsage)}
            </Text>
            <Text style={styles.memoryText}>
              Average Usage:{' '}
              {formatBytes(systemInfo.memoryUsage.averageMemoryUsage)}
            </Text>
            <Text style={styles.memoryText}>
              Memory Trend: {systemInfo.memoryUsage.memoryTrend}
            </Text>
            <Text style={styles.memoryText}>
              Last Cleanup:{' '}
              {new Date(systemInfo.memoryUsage.lastCleanup).toLocaleString()}
            </Text>
            <Text style={styles.memoryText}>
              Cleanup Count: {systemInfo.memoryUsage.cleanupCount}
            </Text>
            <Text style={styles.memoryText}>
              Garbage Collected:{' '}
              {formatBytes(systemInfo.memoryUsage.garbageCollected)}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleMemoryCleanup}>
          <Text style={styles.buttonText}>Perform Memory Cleanup</Text>
        </TouchableOpacity>
      </View>

      {/* Queue Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Queue Status</Text>

        <View style={styles.queueInfo}>
          <Text style={styles.queueText}>
            Processing: {queueStatus.isProcessing ? '🟢 Active' : '🔴 Paused'}
          </Text>
          <Text style={styles.queueText}>
            Total Jobs: {queueStatus.totalJobs}
          </Text>
          <Text style={styles.queueText}>
            Active Jobs: {queueStatus.activeJobs}
          </Text>
          <Text style={styles.queueText}>
            Pending Jobs: {queueStatus.pendingJobs}
          </Text>
          <Text style={styles.queueText}>
            Failed Jobs: {queueStatus.failedJobs}
          </Text>
        </View>

        {/* Job List */}
        {printQueue.length > 0 && (
          <View style={styles.jobList}>
            <Text style={styles.subsectionTitle}>Recent Jobs</Text>
            {printQueue.slice(0, 5).map((job: any) => (
              <View key={job.id} style={styles.jobItem}>
                <Text style={styles.jobId}>ID: {job.id}</Text>
                <Text style={styles.jobStatus}>Status: {job.status}</Text>
                <Text style={styles.jobPriority}>Priority: {job.priority}</Text>
                <Text style={styles.jobCreated}>
                  Created: {new Date(job.createdAt).toLocaleString()}
                </Text>
                {job.error && (
                  <Text style={styles.jobError}>Error: {job.error}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* System Configuration */}
      {systemInfo?.config && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ System Configuration</Text>

          <View style={styles.configInfo}>
            <Text style={styles.configText}>
              Max Concurrent Jobs: {systemInfo.config.maxConcurrentJobs}
            </Text>
            <Text style={styles.configText}>
              Max Queue Size: {systemInfo.config.maxQueueSize}
            </Text>
            <Text style={styles.configText}>
              Rate Limit: {systemInfo.config.rateLimitPerMinute} jobs/minute
            </Text>
            <Text style={styles.configText}>
              Cleanup Interval: {systemInfo.config.cleanupInterval / 1000 / 60}{' '}
              minutes
            </Text>
            <Text style={styles.configText}>
              Max Completed Jobs: {systemInfo.config.maxCompletedJobsInMemory}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    minWidth: '22%',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  printerList: {
    marginTop: 16,
  },
  printerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  printerDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  printerStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  printerLoad: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  printerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  healthButton: {
    backgroundColor: '#28a745',
  },
  removeButton: {
    backgroundColor: '#dc3545',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  securityInfo: {
    marginBottom: 16,
  },
  securityText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  memoryInfo: {
    marginBottom: 16,
  },
  memoryText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  queueInfo: {
    marginBottom: 16,
  },
  queueText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  jobList: {
    marginTop: 16,
  },
  jobItem: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
  },
  jobId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  jobStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  jobPriority: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  jobCreated: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  jobError: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 2,
  },
  configInfo: {
    marginBottom: 16,
  },
  configText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
});

export default SpoolerManagement;
