import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {usePrinter} from '../PrinterContext';
import {
  Printer,
  Pause,
  Play,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react-native';

interface PrintQueueStatusProps {
  onShowQueue?: () => void;
}

const PrintQueueStatus: React.FC<PrintQueueStatusProps> = ({onShowQueue}) => {
  const {queueStatus, pausePrintQueue, resumePrintQueue, cancelAllPrintJobs} =
    usePrinter();

  const getStatusColor = () => {
    if (queueStatus.failedJobs > 0) return '#f44336';
    if (queueStatus.activeJobs > 0) return '#2196f3';
    if (queueStatus.pendingJobs > 0) return '#ff9800';
    return '#4caf50';
  };

  const getStatusIcon = () => {
    if (queueStatus.failedJobs > 0)
      return <AlertCircle size={16} color="#f44336" />;
    if (queueStatus.activeJobs > 0)
      return <Printer size={16} color="#2196f3" />;
    if (queueStatus.pendingJobs > 0) return <Clock size={16} color="#ff9800" />;
    return <CheckCircle size={16} color="#4caf50" />;
  };

  const getStatusText = () => {
    if (queueStatus.failedJobs > 0) return `${queueStatus.failedJobs} failed`;
    if (queueStatus.activeJobs > 0) return `Printing...`;
    if (queueStatus.pendingJobs > 0) return `${queueStatus.pendingJobs} queued`;
    return 'Ready';
  };

  if (queueStatus.totalJobs === 0 && !queueStatus.isProcessing) {
    return null; // Don't show anything when queue is empty
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.statusInfo}>
          {getStatusIcon()}
          <Text style={[styles.statusText, {color: getStatusColor()}]}>
            {getStatusText()}
          </Text>
          {queueStatus.totalJobs > 0 && (
            <Text style={styles.jobCount}>({queueStatus.totalJobs} total)</Text>
          )}
        </View>

        <View style={styles.actions}>
          {queueStatus.isProcessing ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={pausePrintQueue}
              disabled={queueStatus.activeJobs === 0}>
              <Pause size={16} color="#666" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={resumePrintQueue}
              disabled={queueStatus.pendingJobs === 0}>
              <Play size={16} color="#666" />
            </TouchableOpacity>
          )}

          {queueStatus.totalJobs > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={cancelAllPrintJobs}>
              <X size={16} color="#f44336" />
            </TouchableOpacity>
          )}

          {onShowQueue && queueStatus.totalJobs > 0 && (
            <TouchableOpacity
              style={styles.viewQueueButton}
              onPress={onShowQueue}>
              <Text style={styles.viewQueueText}>View Queue</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress indicator for active jobs */}
      {queueStatus.activeJobs > 0 && (
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, {backgroundColor: getStatusColor()}]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  jobCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  viewQueueButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    borderRadius: 4,
    backgroundColor: '#2196f3',
  },
  viewQueueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  progressContainer: {
    height: 2,
    backgroundColor: '#e0e0e0',
    borderRadius: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    width: '100%',
    borderRadius: 1,
  },
});

export default PrintQueueStatus;
