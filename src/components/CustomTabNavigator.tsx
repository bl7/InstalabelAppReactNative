import React, {useState, useEffect, useMemo} from 'react';
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
  Package,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react-native';
import FloatingActionButtons from './FloatingActionButtons';
import {useSubscription} from '../contexts/SubscriptionContext';
import {useMode} from '../contexts/ModeContext';

// Import pages
import SettingsPage from '../pages/SettingsPage';
import PPDsPage from '../pages/PPDsPage';
import LogsPage from '../pages/LogsPage';
import LabelsPage from '../pages/LabelsPage';
import CustomLabelPage from '../pages/CustomLabelPage';
import BulkPage from '../pages/BulkPage';
import AllergenStickerPage from '../pages/AllergenStickerPage';

import PrintQueueStatus from './PrintQueueStatus';

type TabType = 'Settings' | 'Logs' | 'PPDS' | 'Labels' | 'Bulk' | 'Custom' | 'AllergenSticker';

const CustomTabNavigator: React.FC = () => {
  const {canPrint, subscriptionInfo} = useSubscription();
  const {selectedMode} = useMode();

  // Define available tabs for each mode
  const getAvailableTabs = (): TabType[] => {
    if (!selectedMode) return [];
    
    const allTabs: TabType[] = ['Labels', 'PPDS', 'Bulk', 'AllergenSticker', 'Logs', 'Settings'];
    
    switch (selectedMode) {
      case '40mm':
        // Labels, Bulk, Logs, Settings (no PPDS, no Stickers)
        return allTabs.filter(tab => tab !== 'PPDS' && tab !== 'AllergenSticker');
      case '80mm':
        // Full label workflow on 80mm from Labels/Bulk pages.
        // PPDS is handled via Labels page label type, so hide dedicated PPDS tab for now.
        return allTabs.filter(tab => tab !== 'AllergenSticker' && tab !== 'PPDS');
      case 'round':
        // Stickers, Logs, Settings (no Labels, no Bulk, no PPDS)
        return allTabs.filter(tab => tab !== 'Labels' && tab !== 'Bulk' && tab !== 'PPDS');
      default:
        return allTabs;
    }
  };

  const availableTabs = useMemo(() => getAvailableTabs(), [selectedMode]);

  // Initialize activeTab - will be set properly when mode is selected
  const [activeTab, setActiveTab] = useState<TabType>('Settings');
  const [fabActionsVisible, setFabActionsVisible] = useState(false);

  // Reset active tab when mode changes or if current tab is not available
  useEffect(() => {
    if (selectedMode && availableTabs.length > 0) {
      if (!availableTabs.includes(activeTab)) {
        // Prefer Labels if available, otherwise first available tab
        const newTab = availableTabs.includes('Labels') 
          ? 'Labels' 
          : availableTabs[0] || 'Settings';
        setActiveTab(newTab);
      }
    }
  }, [selectedMode, availableTabs]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Settings':
        return <SettingsPage />;
      case 'Logs':
        return <LogsPage />;
      case 'PPDS':
        return <PPDsPage />;
      case 'Labels':
        return <LabelsPage />;

      case 'Bulk':
        return <BulkPage />;
      case 'Custom':
        return <CustomLabelPage />;
      case 'AllergenSticker':
        return <AllergenStickerPage />;
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
        color={activeTab === tabName ? 'white' : 'rgba(255,255,255,0.7)'}
      />
      <Text
        style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Subscription Status Banner */}
      {!canPrint && (
        <View style={styles.subscriptionBanner}>
          <AlertTriangle size={16} color="#FF6B35" />
          <Text style={styles.subscriptionBannerText}>
            {subscriptionInfo.planName
              ? `${subscriptionInfo.planName} Plan`
              : 'No Subscription'}
          </Text>
        </View>
      )}

      <View style={styles.content}>{renderTabContent()}</View>

      <PrintQueueStatus />

      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          {availableTabs.includes('Labels') && renderTab('Labels', FileText, 'Labels')}
          {availableTabs.includes('PPDS') && renderTab('PPDS', Printer, 'PPDS')}
          {availableTabs.includes('Bulk') && renderTab('Bulk', Package, 'Bulk')}
          {availableTabs.includes('AllergenSticker') && renderTab('AllergenSticker', ShieldAlert, 'Stickers')}
          {availableTabs.includes('Logs') && renderTab('Logs', History, 'Logs')}
          {availableTabs.includes('Settings') && renderTab('Settings', Cog, 'Settings')}
        </View>

        {/* Simple floating FAB */}
        <View style={styles.fabContainer}>
          <FloatingActionButtons
            onActionsToggle={setFabActionsVisible}
            onNavigateToCustom={() => setActiveTab('Custom')}
          />
        </View>
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
  tabBarContainer: {
    position: 'relative',
    backgroundColor: '#8A2BE2', // Purple background
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    height: 80,
    overflow: 'visible',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'transparent', // Make transparent to show purple background
    paddingBottom: 8,
    paddingTop: 8,
    paddingRight: 90, // Add right padding to make space for FAB
    height: 80,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    top: -8, // Moved up 5% more (was -5, now -8)
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
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
    color: 'white', // White text for better contrast on purple
    marginTop: 3,
    textAlign: 'center',
  },
  activeTabText: {
    color: 'white', // White text for active tabs
    fontWeight: '600',
  },

  // Subscription banner styles
  subscriptionBanner: {
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  subscriptionBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
});

export default CustomTabNavigator;
