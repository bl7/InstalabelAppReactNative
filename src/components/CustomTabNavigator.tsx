import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  Cog,
  Printer,
  History,
  Settings,
  FileText,
  Edit3,
} from 'lucide-react-native';
import FloatingActionButtons from './FloatingActionButtons';

// Import pages
import SettingsPage from '../pages/SettingsPage';
import PPDsPage from '../pages/PPDsPage';
import HistoryPage from '../pages/HistoryPage';
import LabelsPage from '../pages/LabelsPage';
import CustomLabelPage from '../pages/CustomLabelPage';

import PrintQueueStatus from './PrintQueueStatus';

type TabType = 'Settings' | 'Logs' | 'PPDS' | 'Labels' | 'Custom';

const CustomTabNavigator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('Labels');
  const [fabActionsVisible, setFabActionsVisible] = useState(false);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Settings':
        return <SettingsPage />;
      case 'Logs':
        return <HistoryPage />;
      case 'PPDS':
        return <PPDsPage />;
      case 'Labels':
        return <LabelsPage />;
      case 'Custom':
        return <CustomLabelPage />;
      default:
        return <LabelsPage />;
    }
  };

  const renderTab = (
    tabName: TabType,
    IconComponent: React.ComponentType<any>,
    title: string,
  ) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tabName && styles.activeTab]}
      onPress={() => setActiveTab(tabName)}>
      <IconComponent
        size={20}
        color={activeTab === tabName ? '#8A2BE2' : '#666'}
      />
      <Text
        style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderTabContent()}</View>

      <PrintQueueStatus />

      <View style={styles.tabBar}>
        {renderTab('Labels', FileText, 'Labels')}
        {renderTab('PPDS', Printer, 'PPDS')}

        {/* Center FAB with arch design */}
        <View style={styles.fabContainer}>
          <FloatingActionButtons onActionsToggle={setFabActionsVisible} />
        </View>

        {renderTab('Custom', Edit3, 'ETC.')}
        {renderTab('Settings', Cog, 'Settings')}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 8,
    paddingTop: 8,
    height: 80, // Increased height to accommodate the arch
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'visible', // Allow the FAB to extend beyond the tab bar
  },
  fabContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    marginTop: -35, // Increased to create more prominent arch effect
    zIndex: 1000,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  activeTab: {
    // Active tab styling
  },
  tabText: {
    fontSize: 10,
    color: '#666',
    marginTop: 3,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#8A2BE2',
    fontWeight: '600',
  },
});

export default CustomTabNavigator;
