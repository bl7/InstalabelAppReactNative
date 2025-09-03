import React from 'react';
import {SafeAreaView, View, Text, StyleSheet, StatusBar} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {usePrinter} from '../PrinterContext';
import {Printer} from 'lucide-react-native';
import PrintSessions from '../components/PrintSessions';
import PrintQueueStatus from '../components/PrintQueueStatus';

const LogsPage: React.FC = () => {
  const {isAuthenticated} = useAuth();
  const {connectedDevice} = usePrinter();

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Print Logs</Text>
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
        <View style={styles.notAuthenticatedContainer}>
          <Text style={styles.notAuthenticatedText}>
            Please log in to view print logs
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
          <Text style={styles.title}>Print Logs</Text>
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

      {/* Printer Status */}
      <PrintQueueStatus />

      {/* Print Sessions Component */}
      <PrintSessions showDetails={false} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  notAuthenticatedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  notAuthenticatedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default LogsPage;
