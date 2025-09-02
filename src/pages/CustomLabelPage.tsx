import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import {usePrinter} from '../PrinterContext';
import {Printer, Plus, Trash2} from 'lucide-react-native';
import {showToast} from '../utils/toastUtils';
import CalendarModal from '../components/CalendarModal';
import {generateSimpleCustomLabel} from '../../tsplUtils';

const CustomLabelPage: React.FC = () => {
  const {connectedDevice, isPrinting, printTSPLLabels} = usePrinter();

  // Form state
  const [itemName, setItemName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [contains, setContains] = useState('');
  const [labelType, setLabelType] = useState('default');

  // Form state for simple custom label (Notes tab)
  const [heading, setHeading] = useState('');
  const [subheading, setSubheading] = useState('');

  // Date picker state
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarInitial, setCalendarInitial] = useState<string>('');

  // Label type options
  const labelTypes = [
    {value: 'default', label: 'Default'},
    {value: 'prep', label: 'Prep'},
    {value: 'cooked', label: 'Cooked'},
  ];

  // Tab state
  const [activeTab, setActiveTab] = useState('custom');

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

  const handlePrint = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    if (!connectedDevice) {
      Alert.alert('Error', 'No printer connected');
      return;
    }

    try {
      // Create a mock menu item object that matches what generateMenuItemLabel expects
      const customMenuItem = {
        menuItemName: itemName.trim(),
        name: itemName.trim(),
        labelType: labelType,
        ingredients: contains.trim()
          ? contains
              .trim()
              .split(',')
              .map(i => i.trim())
          : [],
        allergens: [],
        fullIngredients: [],
      };

      // Create a print queue item
      const printQueueItem = {
        uid: `custom_${Date.now()}`,
        name: itemName.trim(),
        type: 'menu',
        quantity: 1,
        labelType: labelType,
        expiryDate: expiryDate.trim() || undefined,
        allergens: [],
        ingredients: contains.trim()
          ? contains
              .trim()
              .split(',')
              .map(i => i.trim())
          : [],
        labelHeight: '40mm',
      };

      // Use the same printing logic as other labels
      await printTSPLLabels(
        [printQueueItem],
        [], // ingredients array (empty for custom)
        [customMenuItem], // menuItems array
        {[printQueueItem.uid]: expiryDate.trim() || ''}, // customExpiry
        'BL', // initials
        undefined, // storageInstructions
        undefined, // companyName
      );

      showToast.success(
        'Custom Label Printed',
        'Your custom label has been sent to the printer',
      );

      // Clear form
      setItemName('');
      setExpiryDate('');
      setContains('');
      setLabelType('default');
    } catch (error) {
      console.error('Print error:', error);
      showToast.error(
        'Print Failed',
        error instanceof Error
          ? error.message
          : 'An error occurred while printing',
      );
    }
  };

  const openDatePicker = () => {
    const yyyyMMddDate = convertToYYYYMMDD(expiryDate);
    setCalendarInitial(yyyyMMddDate);
    setCalendarVisible(true);
  };

  const clearForm = () => {
    setItemName('');
    setExpiryDate('');
    setContains('');
    setLabelType('default');
  };

  const handleSimplePrint = async () => {
    if (!heading.trim() || !subheading.trim()) {
      Alert.alert('Error', 'Please enter both heading and subheading');
      return;
    }

    if (!connectedDevice) {
      Alert.alert('Error', 'No printer connected');
      return;
    }

    try {
      // Generate TSPL commands for the simple custom label
      const tsplCommands = generateSimpleCustomLabel(
        heading.trim(),
        subheading.trim(),
        {
          dpi: 203,
          gap: 3,
          direction: 0,
          density: 8,
        },
      );

      // Send to printer using PrintBridge
      const {PrintBridge} = require('react-native').NativeModules;
      const result = await PrintBridge.printTSPL(tsplCommands);

      if (result.success) {
        showToast.success(
          'Simple Label Printed',
          'Your simple label has been sent to the printer',
        );

        // Clear form
        setHeading('');
        setSubheading('');
      } else {
        throw new Error(result.error || 'Unknown print error');
      }
    } catch (error) {
      console.error('Print error:', error);
      showToast.error(
        'Print Failed',
        error instanceof Error
          ? error.message
          : 'An error occurred while printing',
      );
    }
  };

  const clearSimpleForm = () => {
    setHeading('');
    setSubheading('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />

      {/* Calendar Modal */}
      <CalendarModal
        visible={calendarVisible}
        initialDate={calendarInitial}
        onClose={() => setCalendarVisible(false)}
        onSelect={selectedYmd => {
          const ddMMyyyyDate = convertToDDMMYYYY(selectedYmd);
          setExpiryDate(ddMMyyyyDate);
          setCalendarVisible(false);
        }}
        onClear={() => {
          setExpiryDate('');
          setCalendarVisible(false);
        }}
        title="Select Expiry Date"
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Ad-Hoc Labels</Text>
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

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'custom' ? styles.activeTab : styles.inactiveTab,
            ]}
            onPress={() => setActiveTab('custom')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'custom' && styles.activeTabText,
              ]}>
              Prep
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'simple' ? styles.activeTab : styles.inactiveTab,
            ]}
            onPress={() => setActiveTab('simple')}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'simple' && styles.activeTabText,
              ]}>
              Notes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'custom' ? (
          <View style={styles.form}>
            {/* Item Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Item Name *</Text>
              <TextInput
                style={styles.textInput}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Enter item name"
                placeholderTextColor="#999"
                maxLength={60} // 2 lines × 30 chars (larger fonts = fewer chars per line)
              />
              <Text style={styles.charCount}>
                {itemName.length}/60 characters
              </Text>
            </View>

            {/* Expiry Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Expiry Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openDatePicker}>
                <Text
                  style={
                    expiryDate
                      ? styles.dateButtonText
                      : styles.dateButtonPlaceholder
                  }>
                  {expiryDate || 'Tap to select date'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Label Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Label Type</Text>
              <View style={styles.labelTypeContainer}>
                {labelTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.labelTypeButton,
                      labelType === type.value && styles.labelTypeButtonActive,
                    ]}
                    onPress={() => setLabelType(type.value)}>
                    <Text
                      style={[
                        styles.labelTypeButtonText,
                        labelType === type.value &&
                          styles.labelTypeButtonTextActive,
                      ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Contains */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contains</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={contains}
                onChangeText={setContains}
                placeholder="Enter ingredients separated by commas"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                maxLength={135} // 3 lines × 45 chars (smaller fonts = more chars per line)
              />
              <Text style={styles.charCount}>
                {contains.length}/135 characters
              </Text>
            </View>

            {/* Print Button */}
            <TouchableOpacity
              style={[
                styles.printButton,
                !itemName.trim() && styles.printButtonDisabled,
              ]}
              onPress={handlePrint}
              disabled={!itemName.trim() || isPrinting}>
              <Printer size={20} color="#fff" />
              <Text style={styles.printButtonText}>
                {isPrinting ? 'Printing...' : 'Print Custom Label'}
              </Text>
            </TouchableOpacity>

            {/* Clear Button */}
            <TouchableOpacity style={styles.clearButton} onPress={clearForm}>
              <Trash2 size={16} color="#666" />
              <Text style={styles.clearButtonText}>Clear Form</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Heading */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Heading *</Text>
              <TextInput
                style={styles.textInput}
                value={heading}
                onChangeText={setHeading}
                placeholder="Enter heading text"
                placeholderTextColor="#999"
                maxLength={25} // 25 character limit to prevent overflow
              />
              <Text style={styles.charCount}>
                {heading.length}/25 characters
              </Text>
            </View>

            {/* Subheading */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Subheading *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={subheading}
                onChangeText={setSubheading}
                placeholder="Enter subheading text"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                maxLength={160} // 160 character limit to prevent overflow
              />
              <Text style={styles.charCount}>
                {subheading.length}/160 characters
              </Text>
            </View>

            {/* Print Button */}
            <TouchableOpacity
              style={[
                styles.printButton,
                (!heading.trim() || !subheading.trim()) &&
                  styles.printButtonDisabled,
              ]}
              onPress={handleSimplePrint}
              disabled={!heading.trim() || !subheading.trim() || isPrinting}>
              <Printer size={20} color="#fff" />
              <Text style={styles.printButtonText}>
                {isPrinting ? 'Printing...' : 'Print Simple Label'}
              </Text>
            </TouchableOpacity>

            {/* Clear Button */}
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearSimpleForm}>
              <Trash2 size={16} color="#666" />
              <Text style={styles.clearButtonText}>Clear Form</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
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
    color: '#fff',
    marginBottom: 0,
  },
  headerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerStatItem: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: 20,
  },
  headerStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dateButtonPlaceholder: {
    fontSize: 16,
    color: '#999',
  },

  labelTypeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  labelTypeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  labelTypeButtonActive: {
    borderColor: '#8A2BE2',
    backgroundColor: '#8A2BE2',
  },
  labelTypeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  labelTypeButtonTextActive: {
    color: '#fff',
  },
  printButton: {
    backgroundColor: '#8A2BE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 15,
  },
  printButtonDisabled: {
    backgroundColor: '#ccc',
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
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
});

export default CustomLabelPage;
