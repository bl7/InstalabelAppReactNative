import React, {useEffect, useState, useCallback} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  Bluetooth,
  Bug,
  Settings,
  RefreshCw,
  Save,
  Edit3,
  X,
  Plus,
  LogOut,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';
import {usePrinter} from '../PrinterContext';
import {useAuth} from '../contexts/AuthContext';
import {useSubscription} from '../contexts/SubscriptionContext';
import {apiService} from '../services/api';
import {showToast} from '../utils/toastUtils';
import LabelSettingsDisplay from '../components/LabelSettingsDisplay';
import LoadingSpinner from '../components/LoadingSpinner';

// Conditional import for PermissionsAndroid to handle React Native version differences
let PermissionsAndroid: any;
try {
  PermissionsAndroid = require('react-native').PermissionsAndroid;
} catch (error) {
  PermissionsAndroid = {
    request: () => Promise.resolve('granted'),
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
  };
}

const SettingsPage: React.FC = () => {
  const {
    isBluetoothEnabled,
    devices,
    connectedDevice,
    isScanning,
    isConnecting,
    checkBluetoothStatus,
    enableBluetooth,
    listPairedDevices,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    getConnectionStatus,
  } = usePrinter();

  const {isAuthenticated, logout, user} = useAuth();
  const {
    subscriptionInfo,
    canPrint,
    isLoading: isSubscriptionLoading,
    refreshSubscription,
  } = useSubscription();

  // Label settings from InstaLabel.co API
  const [labelSettings, setLabelSettings] = useState<Record<string, number>>(
    {},
  );
  const [isLoadingLabelSettings, setIsLoadingLabelSettings] = useState(false);

  // Label initials settings from InstaLabel.co API
  const [useInitials, setUseInitials] = useState(true);
  const [availableInitials, setAvailableInitials] = useState<string[]>(['NG']);
  const [isLoadingInitials, setIsLoadingInitials] = useState(false);

  // Editing states
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isEditingInitials, setIsEditingInitials] = useState(false);
  const [editingSettings, setEditingSettings] = useState<
    Record<string, number>
  >({});
  const [editingInitials, setEditingInitials] = useState<string[]>([]);
  const [editingUseInitials, setEditingUseInitials] = useState(true);
  const [newInitial, setNewInitial] = useState('');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isUpdatingInitials, setIsUpdatingInitials] = useState(false);

  // Load label settings from InstaLabel.co API
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
    try {
      console.log('🔍 Loading label settings from InstaLabel.co API...');
      const response = await apiService.getLabelSettings();

      if (response.settings && Array.isArray(response.settings)) {
        // Convert array of settings to a map for easy lookup
        const settingsMap: Record<string, number> = {};
        response.settings.forEach(setting => {
          if (setting.label_type && typeof setting.expiry_days === 'number') {
            settingsMap[setting.label_type] = setting.expiry_days;
          }
        });

        setLabelSettings(settingsMap);
        console.log('✅ Label settings loaded:', settingsMap);
      } else {
        console.log('⚠️ No label settings available from API, using defaults');
        setLabelSettings({});
      }
    } catch (error) {
      console.error('❌ Error loading label settings:', error);
      // Keep default settings on error
      setLabelSettings({});
    } finally {
      setIsLoadingLabelSettings(false);
    }
  }, [isAuthenticated]);

  // Load label initials from InstaLabel.co API
  const loadLabelInitials = useCallback(async () => {
    if (!isAuthenticated) return;

    const token = apiService.getAccessToken();
    if (!token) {
      console.log('No access token available, skipping initials API call');
      return;
    }

    setIsLoadingInitials(true);
    try {
      console.log('🔍 Loading label initials from InstaLabel.co API...');
      const response = await apiService.getLabelInitials();

      // Set the use_initials flag from API response
      setUseInitials(response.use_initials || false);

      if (
        response.use_initials &&
        response.initials &&
        Array.isArray(response.initials)
      ) {
        setAvailableInitials(response.initials);
        console.log('✅ Label initials loaded:', response.initials);
      } else {
        console.log('⚠️ No initials available from API, using defaults');
        setAvailableInitials(['NG']);
      }
    } catch (error) {
      console.error('❌ Error loading label initials:', error);
      // Keep default initials on error
      setAvailableInitials(['NG']);
    } finally {
      setIsLoadingInitials(false);
    }
  }, [isAuthenticated]);

  // Update label settings
  const updateLabelSettings = useCallback(async () => {
    if (!isAuthenticated || !editingSettings) return;

    if (!user?.id) {
      showToast.error('Error', 'User ID not found');
      return;
    }

    setIsUpdatingSettings(true);
    try {
      const settingsArray = Object.entries(editingSettings).map(
        ([labelType, expiryDays]) => ({
          label_type: labelType,
          expiry_days: expiryDays,
        }),
      );

      const response = await apiService.updateLabelSettings(
        user.id,
        settingsArray,
      );

      if (response.success) {
        setLabelSettings(editingSettings);
        setIsEditingSettings(false);
        showToast.success('Success', 'Label settings updated successfully');
      } else {
        showToast.error(
          'Error',
          response.message || 'Failed to update label settings',
        );
      }
    } catch (error) {
      console.error('Error updating label settings:', error);
      showToast.error('Error', 'Failed to update label settings');
    } finally {
      setIsUpdatingSettings(false);
    }
  }, [isAuthenticated, editingSettings, user]);

  // Update label initials
  const updateLabelInitials = useCallback(async () => {
    if (!isAuthenticated) return;

    if (!user?.id) {
      showToast.error('Error', 'User ID not found');
      return;
    }

    setIsUpdatingInitials(true);
    try {
      const response = await apiService.updateLabelInitials(
        user.id,
        editingUseInitials,
        editingInitials,
      );

      if (response.success) {
        setUseInitials(editingUseInitials);
        setAvailableInitials(editingInitials);
        setIsEditingInitials(false);
        showToast.success('Success', 'Label initials updated successfully');
      } else {
        showToast.error(
          'Error',
          response.message || 'Failed to update label initials',
        );
      }
    } catch (error) {
      console.error('Error updating label initials:', error);
      showToast.error('Error', 'Failed to update label initials');
    } finally {
      setIsUpdatingInitials(false);
    }
  }, [isAuthenticated, editingUseInitials, editingInitials, user]);

  // Helper functions for editing
  const startEditingSettings = useCallback(() => {
    setEditingSettings({...labelSettings});
    setIsEditingSettings(true);
  }, [labelSettings]);

  const cancelEditingSettings = useCallback(() => {
    setIsEditingSettings(false);
    setEditingSettings({});
  }, []);

  const startEditingInitials = useCallback(() => {
    setEditingInitials([...availableInitials]);
    setEditingUseInitials(useInitials);
    setIsEditingInitials(true);
  }, [availableInitials, useInitials]);

  const cancelEditingInitials = useCallback(() => {
    setIsEditingInitials(false);
    setEditingInitials([]);
    setEditingUseInitials(true);
  }, []);

  const addInitial = useCallback(() => {
    if (
      newInitial.trim() &&
      !editingInitials.includes(newInitial.trim().toUpperCase())
    ) {
      setEditingInitials([...editingInitials, newInitial.trim().toUpperCase()]);
      setNewInitial('');
    }
  }, [newInitial, editingInitials]);

  const removeInitial = useCallback(
    (index: number) => {
      setEditingInitials(editingInitials.filter((_, i) => i !== index));
    },
    [editingInitials],
  );

  const toggleUseInitials = useCallback(() => {
    setEditingUseInitials(!editingUseInitials);
  }, [editingUseInitials]);

  // Request necessary permissions for Android 12+
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED,
        );

        if (!allGranted) {
          showToast.warning(
            'Permissions Required',
            'Bluetooth and location permissions are required for this app to work properly.',
          );
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
      }
    }
  };

  // Initialize Bluetooth and load data on component mount
  useEffect(() => {
    checkBluetoothStatus();
    requestPermissions();

    // Load label settings and initials if authenticated
    if (isAuthenticated) {
      loadLabelSettings();
      loadLabelInitials();
    }
  }, [isAuthenticated, loadLabelSettings, loadLabelInitials]);

  const handleEnableBluetooth = async () => {
    try {
      await enableBluetooth();
      showToast.success('Success', 'Bluetooth enabled successfully');
    } catch (error) {
      showToast.error('Error', 'Failed to enable Bluetooth');
    }
  };

  const handleConnectToDevice = async (device: any) => {
    try {
      await connectToDevice(device);
      showToast.success('Success', `Connected to ${device.name || 'Device'}`);
    } catch (error) {
      console.error('Error connecting to device:', error);
      showToast.error('Error', 'Failed to connect to device');
    }
  };

  const handleDisconnectDevice = async () => {
    try {
      await disconnectDevice();
      showToast.success('Success', 'Device disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting device:', error);
      showToast.error('Error', 'Failed to disconnect device');
    }
  };

  const handleDebugConnection = async () => {
    try {
      const status = await getConnectionStatus();
      if (status) {
        showToast.info(
          'Connection Debug Info',
          `Type: ${status.type}\nConnected: ${status.connected}\nClassic: ${status.classicConnected}\nBLE: ${status.bleConnected}`,
        );
      } else {
        showToast.error('Debug Info', 'Failed to get connection status');
      }
    } catch (error) {
      console.error('Error getting debug info:', error);
      showToast.error('Error', 'Failed to get debug info');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Settings size={32} color="white" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>
              Manage app preferences and devices
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <LogOut size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Bluetooth Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bluetooth Status</Text>
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <Bluetooth
                size={24}
                color={isBluetoothEnabled ? '#4CAF50' : '#F44336'}
              />
              <Text style={styles.statusText}>
                {isBluetoothEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>

            {!isBluetoothEnabled && (
              <TouchableOpacity
                style={styles.button}
                onPress={handleEnableBluetooth}>
                <Text style={styles.buttonText}>Enable Bluetooth</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Device Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Devices</Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={scanForDevices}
              disabled={isScanning}>
              <RefreshCw size={20} color="white" />
              <Text style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan'}
              </Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <Text style={styles.noDevicesText}>No devices found</Text>
          ) : (
            <View>
              {devices.map(device => (
                <View key={device.id} style={styles.deviceItem}>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>
                      {device.name || 'Unknown Device'}
                    </Text>
                    <Text style={styles.deviceAddress}>{device.address}</Text>
                    <View style={styles.deviceStatusRow}>
                      <Text style={styles.deviceStatus}>
                        {device.paired ? 'Paired' : 'Available'}
                      </Text>
                      <View
                        style={[
                          styles.technologyBadge,
                          styles[`technology${device.technology}`],
                        ]}>
                        <Text style={styles.technologyText}>
                          {device.technology}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {connectedDevice?.id === device.id ? (
                    <TouchableOpacity
                      style={[styles.button, styles.disconnectButton]}
                      onPress={handleDisconnectDevice}>
                      <Bluetooth size={20} color="white" />
                      <Text style={styles.buttonText}>Disconnect</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.button, styles.connectButton]}
                      onPress={() => handleConnectToDevice(device)}
                      disabled={isConnecting}>
                      <Bluetooth size={20} color="white" />
                      <Text style={styles.buttonText}>
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Connected Device Info */}
        {connectedDevice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Printer</Text>
            <View style={styles.connectedDeviceInfo}>
              <Text style={styles.connectedDeviceName}>
                {connectedDevice.name || 'Unknown Device'}
              </Text>
              <Text style={styles.connectedDeviceAddress}>
                {connectedDevice.address}
              </Text>
              <View style={styles.connectionDetails}>
                <View
                  style={[
                    styles.technologyBadge,
                    styles[`technology${connectedDevice.technology}`],
                  ]}>
                  <Text style={styles.technologyText}>
                    {connectedDevice.technology}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Bluetooth</Text>
              <Text
                style={[
                  styles.statusValue,
                  {color: isBluetoothEnabled ? '#4CAF50' : '#F44336'},
                ]}>
                {isBluetoothEnabled ? 'ON' : 'OFF'}
              </Text>
            </View>

            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Printer</Text>
              <Text
                style={[
                  styles.statusValue,
                  {color: connectedDevice ? '#4CAF50' : '#F44336'},
                ]}>
                {connectedDevice ? 'CONNECTED' : 'DISCONNECTED'}
              </Text>
            </View>
          </View>

          {/* Debug Button */}
          <TouchableOpacity
            style={[styles.button, styles.debugButton]}
            onPress={handleDebugConnection}>
            <Bug size={20} color="white" />
            <Text style={styles.buttonText}>Debug Connection</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Status Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Subscription Status</Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refreshSubscription}
              disabled={isSubscriptionLoading}>
              <RefreshCw
                size={16}
                color="#8A2BE2"
                style={[
                  styles.refreshIcon,
                  isSubscriptionLoading && styles.rotatingIcon,
                ]}
              />
              <Text style={styles.refreshButtonText}>
                {isSubscriptionLoading ? 'Loading...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>

          {isSubscriptionLoading ? (
            <View style={styles.loadingSettings}>
              <ActivityIndicator size="small" color="#8A2BE2" />
              <Text style={styles.loadingSettingsText}>
                Loading subscription status...
              </Text>
            </View>
          ) : (
            <View style={styles.subscriptionContainer}>
              {/* Status Row */}
              <View style={styles.subscriptionStatusRow}>
                <View style={styles.statusIndicator}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: canPrint ? '#4CAF50' : '#F44336',
                      },
                    ]}
                  />
                  <Text style={styles.subscriptionStatusText}>
                    {canPrint ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.subscriptionPlanText,
                    {color: canPrint ? '#4CAF50' : '#F44336'},
                  ]}>
                  {subscriptionInfo.planName || 'No Plan'}
                </Text>
              </View>

              {/* Details */}
              <View style={styles.subscriptionDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={styles.detailValue}>
                    {subscriptionInfo.status === 'no_subscription'
                      ? 'No Subscription'
                      : subscriptionInfo.status.charAt(0).toUpperCase() +
                        subscriptionInfo.status.slice(1)}
                  </Text>
                </View>

                {subscriptionInfo.isTrialing && subscriptionInfo.trialEnd && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Trial Ends:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(subscriptionInfo.trialEnd).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                {subscriptionInfo.cancelAtPeriodEnd &&
                  subscriptionInfo.cancelAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Cancels:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(
                          subscriptionInfo.cancelAt,
                        ).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Printing:</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {color: canPrint ? '#4CAF50' : '#F44336'},
                    ]}>
                    {canPrint ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Label Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Label Settings</Text>
            {!isEditingSettings && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={startEditingSettings}>
                <Edit3 size={16} color="white" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Show current label settings from API */}
          {!isLoadingLabelSettings && Object.keys(labelSettings).length > 0 && (
            <View style={styles.currentLabelSettings}>
              {Object.entries(labelSettings).map(([labelType, expiryDays]) => (
                <View key={labelType} style={styles.settingRow}>
                  <Text style={styles.settingLabel}>{labelType}:</Text>
                  <Text style={styles.settingValue}>{expiryDays} days</Text>
                </View>
              ))}
            </View>
          )}

          {/* Editing Interface for Label Settings */}
          {isEditingSettings && (
            <View style={styles.editingContainer}>
              <Text style={styles.currentSettingsTitle}>
                Edit Label Settings:
              </Text>
              {Object.entries(editingSettings).map(
                ([labelType, expiryDays]) => (
                  <View key={labelType} style={styles.editingRow}>
                    <Text style={styles.settingLabel}>{labelType}:</Text>
                    <TextInput
                      style={styles.editingInput}
                      value={expiryDays.toString()}
                      onChangeText={(text: string) => {
                        const numValue = parseInt(text) || 0;
                        setEditingSettings({
                          ...editingSettings,
                          [labelType]: numValue,
                        });
                      }}
                      keyboardType="numeric"
                      placeholder="Days"
                    />
                  </View>
                ),
              )}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={updateLabelSettings}
                  disabled={isUpdatingSettings}>
                  <Save size={16} color="white" />
                  <Text style={styles.saveButtonText}>
                    {isUpdatingSettings ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEditingSettings}>
                  <X size={16} color="white" />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isLoadingLabelSettings && (
            <View style={styles.loadingSettings}>
              <ActivityIndicator size="small" color="#8A2BE2" />
              <Text style={styles.loadingSettingsText}>
                Loading label settings...
              </Text>
            </View>
          )}

          {/* Refresh Button */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadLabelSettings}
            disabled={isLoadingLabelSettings}>
            <RefreshCw
              size={16}
              color="#8A2BE2"
              style={[
                styles.refreshIcon,
                isLoadingLabelSettings && styles.rotatingIcon,
              ]}
            />
            <Text style={styles.refreshButtonText}>
              {isLoadingLabelSettings ? 'Loading...' : 'Refresh Settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Label Initials Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Label Initials</Text>
            {!isEditingInitials && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={startEditingInitials}>
                <Edit3 size={16} color="white" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Show current initials status */}
          {!isLoadingInitials && (
            <View style={styles.currentLabelSettings}>
              <View style={styles.initialsStatusRow}>
                <Text style={styles.settingLabel}>Enabled:</Text>
                <Text
                  style={[
                    styles.settingValue,
                    {color: useInitials ? '#4CAF50' : '#F44336'},
                  ]}>
                  {useInitials ? 'Yes' : 'No'}
                </Text>
              </View>
              {useInitials && availableInitials.length > 0 && (
                <View style={styles.initialsStatusRow}>
                  <Text style={styles.settingLabel}>Available:</Text>
                  <Text style={styles.settingValue}>
                    {availableInitials.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Editing Interface for Initials */}
          {isEditingInitials && (
            <View style={styles.editingContainer}>
              <Text style={styles.currentSettingsTitle}>
                Edit Initials Settings:
              </Text>

              {/* Toggle for use initials */}
              <View style={styles.toggleContainer}>
                <Text style={styles.settingLabel}>Use Initials:</Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    !editingUseInitials && styles.toggleButtonInactive,
                  ]}
                  onPress={toggleUseInitials}>
                  <Text
                    style={[
                      styles.toggleButtonText,
                      !editingUseInitials && styles.toggleButtonTextInactive,
                    ]}>
                    {editingUseInitials ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Initials list */}
              {editingUseInitials && (
                <>
                  <Text style={styles.settingLabel}>Available Initials:</Text>
                  <View style={styles.initialsContainer}>
                    {editingInitials.map((initial, index) => (
                      <View key={index} style={styles.initialTag}>
                        <Text style={styles.initialTagText}>{initial}</Text>
                        <TouchableOpacity
                          style={styles.removeInitialButton}
                          onPress={() => removeInitial(index)}>
                          <X size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {/* Add new initial */}
                  <View style={styles.addInitialContainer}>
                    <TextInput
                      style={styles.addInitialInput}
                      value={newInitial}
                      onChangeText={setNewInitial}
                      placeholder="Enter initials (e.g., AB)"
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={styles.addInitialButton}
                      onPress={addInitial}>
                      <Plus size={16} color="white" />
                      <Text style={styles.addInitialButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={updateLabelInitials}
                  disabled={isUpdatingInitials}>
                  <Save size={16} color="white" />
                  <Text style={styles.saveButtonText}>
                    {isUpdatingInitials ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEditingInitials}>
                  <X size={16} color="white" />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isLoadingInitials && (
            <View style={styles.loadingSettings}>
              <ActivityIndicator size="small" color="#8A2BE2" />
              <Text style={styles.loadingSettingsText}>
                Loading initials...
              </Text>
            </View>
          )}

          {/* Refresh Button */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadLabelInitials}
            disabled={isLoadingInitials}>
            <RefreshCw
              size={16}
              color="#8A2BE2"
              style={[
                styles.refreshIcon,
                isLoadingInitials && styles.rotatingIcon,
              ]}
            />
            <Text style={styles.refreshButtonText}>
              {isLoadingInitials ? 'Loading...' : 'Refresh Initials'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
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
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    lineHeight: 18,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 15,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  noDevicesText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    fontStyle: 'italic',
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderRadius: 8,
    marginBottom: 4,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  deviceStatus: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  debugButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
    alignSelf: 'center',
    minHeight: 44,
  },
  connectedDeviceInfo: {
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    marginTop: 8,
  },
  connectedDeviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  connectedDeviceAddress: {
    fontSize: 14,
    color: '#388E3C',
    marginTop: 5,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  deviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  technologyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  technologyCLASSIC: {
    backgroundColor: '#2196F3',
  },
  technologyBLE: {
    backgroundColor: '#4CAF50',
  },
  technologyDUAL: {
    backgroundColor: '#FF9800',
  },
  technologyUNKNOWN: {
    backgroundColor: '#999',
  },
  technologyText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  connectionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  currentLabelSettings: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  currentSettingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  settingLabel: {
    fontSize: 14,
    color: '#666',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingSettings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  loadingSettingsText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  initialsStatus: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  initialsStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  initialsStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  initialsStatusLabel: {
    fontSize: 14,
    color: '#666',
  },
  initialsStatusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  refreshButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  refreshIcon: {
    // No specific styles for rotation, it's handled by the component
  },
  rotatingIcon: {
    // This style is applied when the icon is rotating
    // It's not directly in the styles object, but can be added via a class or inline
  },
  // New styles for editing functionality
  editButton: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  editingContainer: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginTop: 10,
  },
  editingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editingInput: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: 'white',
    minWidth: 80,
  },
  initialsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  initialTag: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  initialTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  removeInitialButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 2,
  },
  addInitialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  addInitialInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: 'white',
  },
  addInitialButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addInitialButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  toggleButton: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  toggleButtonInactive: {
    backgroundColor: '#E0E0E0',
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextInactive: {
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subscription status styles
  subscriptionContainer: {
    marginTop: 10,
  },
  subscriptionStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subscriptionStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subscriptionPlanText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subscriptionDetails: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default SettingsPage;
