import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  generateDirectTSPLLabel,
  generatePPDSLabel,
  generateIngredientLabel,
  generateIngredientLabel80mm,
  generateMenuItemLabel,
  generateMenuItemLabel80mm,
  generatePPDLabel,
  generatePPDLabel80mm,
  generateETCLabel,
  generateETCLabel80mm,
  generateCircularAllergenSticker,
  PPDSLabelExtras,
} from '../tsplUtils';
import {generateTSCLabelContent} from './utils/labelManagement';
import PrintSpooler, {PrintJob} from './services/printSpooler';
import {apiService} from './services/api';

// Conditional import for NativeModules to handle React Native version differences
let NativeModules: any;
try {
  NativeModules = require('react-native').NativeModules;
} catch (error) {
  NativeModules = {};
}

// Types
interface BluetoothDevice {
  id: string;
  name: string | null;
  address: string;
  paired: boolean;
  technology: 'CLASSIC' | 'BLE' | 'DUAL' | 'UNKNOWN';
}

interface PrinterContextType {
  // State
  isBluetoothEnabled: boolean;
  devices: BluetoothDevice[];
  connectedDevice: BluetoothDevice | null;
  isScanning: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  printQueue: PrintJob[];
  queueStatus: {
    totalJobs: number;
    activeJobs: number;
    pendingJobs: number;
    failedJobs: number;
    isProcessing: boolean;
  };

  // Actions
  setIsBluetoothEnabled: (enabled: boolean) => void;
  setDevices: (devices: BluetoothDevice[]) => void;
  setConnectedDevice: (device: BluetoothDevice | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setIsConnecting: (connecting: boolean) => void;
  setIsPrinting: (printing: boolean) => void;

  // Functions
  checkBluetoothStatus: () => Promise<void>;
  enableBluetooth: () => Promise<void>;
  listPairedDevices: () => Promise<void>;
  scanForDevices: () => Promise<void>;
  connectToDevice: (device: BluetoothDevice) => Promise<void>;
  disconnectDevice: () => Promise<void>;
  getConnectionStatus: () => Promise<any>;
  refreshConnectionStatus: () => Promise<void>;

  // TSPL direct printing function
  printTSPLLabels: (
    printQueue: any[],
    ingredients: any[],
    menuItems: any[],
    customExpiry: Record<string, string>,
    initials: string,
    storageInstructions?: string,
    companyName?: string,
    sessionId?: string,
    useFullPPDSFormat?: boolean,
    ppdsExtras?: PPDSLabelExtras,
  ) => Promise<void>;

  // Spooler functions
  addToPrintQueue: (
    labelData: any,
    quantity?: number,
    priority?: 'high' | 'normal' | 'low',
    userId?: string,
    sessionId?: string,
  ) => string;
  removeFromPrintQueue: (jobId: string) => boolean;
  clearPrintQueue: () => void;
  cancelPrintJob: (jobId: string) => boolean;
  cancelAllPrintJobs: () => void;
  pausePrintQueue: () => void;
  resumePrintQueue: () => void;

  // Load balancing and security functions
  addPrinterInstance: (
    id: string,
    name: string,
    connectionType: 'bluetooth' | 'network' | 'usb',
    address: string,
    maxLoad?: number,
  ) => void;
  removePrinterInstance: (id: string) => boolean;
  updatePrinterHealth: (
    id: string,
    isHealthy: boolean,
    currentLoad: number,
  ) => void;
  getSystemInfo: () => any;
  performMemoryCleanup: () => void;

  // Simple custom label printing function
  printSimpleCustomLabel: (
    text: string,
    expiryDate: string,
    initials: string,
    ingredients?: string[],
    allergens?: string[],
    storageInstructions?: string,
    companyName?: string,
  ) => Promise<void>;

  // Circular allergen sticker printing function
  printCircularAllergenSticker: (
    printQueue: any[],
    customExpiry: Record<string, string>,
  ) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export const usePrinter = () => {
  // console.log('🔧 usePrinter: Called');
  const context = useContext(PrinterContext);
  // console.log('🔧 usePrinter: Context value:', context);

  // Add a small delay to allow context to initialize
  if (!context) {
    console.warn('🔧 usePrinter: Context not ready yet, waiting...');
    // Return a default context object instead of throwing an error
    return {
      // State
      isBluetoothEnabled: false,
      devices: [],
      connectedDevice: null,
      isScanning: false,
      isConnecting: false,
      isPrinting: false,
      printQueue: [],
      queueStatus: {
        totalJobs: 0,
        activeJobs: 0,
        pendingJobs: 0,
        failedJobs: 0,
        isProcessing: false,
        isInitialized: false,
      },

      // Actions
      setIsBluetoothEnabled: () => {},
      setDevices: () => {},
      setConnectedDevice: () => {},
      setIsScanning: () => {},
      setIsConnecting: () => {},
      setIsPrinting: () => {},

      // Functions
      checkBluetoothStatus: async () => {},
      enableBluetooth: async () => {},
      listPairedDevices: async () => {},
      scanForDevices: async () => {},
      connectToDevice: async () => {},
      disconnectDevice: async () => {},
      getConnectionStatus: async () => ({connected: false, device: null}),
      refreshConnectionStatus: async () => {},
      printTSPLLabels: async () => {},
      printSimpleCustomLabel: async () => {},

      // Spooler functions
      addToPrintQueue: () => '',
      removeFromPrintQueue: () => false,
      clearPrintQueue: () => {},
      cancelPrintJob: () => false,
      cancelAllPrintJobs: () => {},
      pausePrintQueue: () => {},
      resumePrintQueue: () => {},

      // Load balancing and security functions
      addPrinterInstance: () => {},
      removePrinterInstance: () => false,
      updatePrinterHealth: () => {},
      getSystemInfo: () => null,
      performMemoryCleanup: () => {},
    };
  }

  // console.log('🔧 usePrinter: Returning context successfully');
  return context;
};

interface PrinterProviderProps {
  children: ReactNode;
}

export const PrinterProvider: React.FC<PrinterProviderProps> = ({children}) => {
  // console.log('🔧 PrinterProvider: Initializing...');

  try {
    // Check if PrintBridge is available
    const {PrintBridge} = NativeModules;
    if (!PrintBridge) {
      console.error('🔧 PrinterProvider: PrintBridge native module not found');
      throw new Error('PrintBridge native module not found');
    }
    // console.log('🔧 PrinterProvider: PrintBridge module found');
  } catch (error) {
    console.error('🔧 PrinterProvider: Error checking PrintBridge:', error);
    // Don't throw here, let the provider continue but log the error
  }

  // State
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [queueStatus, setQueueStatus] = useState({
    totalJobs: 0,
    activeJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    isProcessing: false,
  });

  // Print spooler reference
  const spoolerRef = useRef<PrintSpooler | null>(null);

  // Check Bluetooth status
  const checkBluetoothStatus = async () => {
    try {
      console.log('Checking Bluetooth status...');
      const {PrintBridge} = NativeModules;
      if (!PrintBridge) {
        throw new Error('PrintBridge native module not found');
      }

      const enabled = await PrintBridge.isBluetoothEnabled();
      console.log('Bluetooth enabled:', enabled);
      setIsBluetoothEnabled(enabled);

      if (enabled) {
        await listPairedDevices();
        // Also check current connection status
        await refreshConnectionStatus();
      }
    } catch (error) {
      console.error('Error checking Bluetooth status:', error);
      setIsBluetoothEnabled(false);
    }
  };

  // Refresh connection status
  const refreshConnectionStatus = async () => {
    try {
      const status = await getConnectionStatus();
      if (status && !status.connected) {
        // If native module says we're not connected, reset our state
        setConnectedDevice(null);
      }
    } catch (error) {
      console.error('Error refreshing connection status:', error);
      // On error, assume disconnected
      setConnectedDevice(null);
    }
  };

  // Enable Bluetooth
  const enableBluetooth = async () => {
    try {
      const {PrintBridge} = NativeModules;
      const enabled = await PrintBridge.isBluetoothEnabled();
      if (enabled) {
        setIsBluetoothEnabled(true);
        await listPairedDevices();
      } else {
        throw new Error('Failed to enable Bluetooth');
      }
    } catch (error) {
      console.error('Error enabling Bluetooth:', error);
      throw error;
    }
  };

  // List paired devices
  const listPairedDevices = async () => {
    try {
      const {PrintBridge} = NativeModules;
      const pairedDevices = await PrintBridge.getPairedDevices();
      setDevices(pairedDevices);
    } catch (error) {
      console.error('Error listing paired devices:', error);
      setDevices([]);
    }
  };

  // Scan for devices
  const scanForDevices = async () => {
    try {
      setIsScanning(true);
      const {PrintBridge} = NativeModules;
      const scannedDevices = await PrintBridge.scanForDevices();
      setDevices(scannedDevices);
    } catch (error) {
      console.error('Error scanning for devices:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // Connect to device
  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      setIsConnecting(true);
      console.log('Attempting to connect to device:', device.address);

      const {PrintBridge} = NativeModules;
      if (!PrintBridge) {
        throw new Error('PrintBridge native module not found');
      }

      // Try to connect with retry logic
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Connection attempt ${attempt}/3`);
          await PrintBridge.connectDual(device.address);
          console.log('Successfully connected to device:', device.address);
          setConnectedDevice(device);
          return; // Success, exit the function
        } catch (error) {
          console.error(`Connection attempt ${attempt} failed:`, error);
          lastError = error;

          // Wait before retry (except on last attempt)
          if (attempt < 3) {
            await new Promise<void>(resolve =>
              setTimeout(() => resolve(), 1000),
            );
          }
        }
      }

      // All attempts failed
      console.error('All connection attempts failed');
      setConnectedDevice(null);
      throw lastError || new Error('Failed to connect after 3 attempts');
    } catch (error) {
      console.error('Error connecting to device:', error);
      // Reset connection state on failure
      setConnectedDevice(null);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect device
  const disconnectDevice = async () => {
    try {
      console.log('Attempting to disconnect device');
      const {PrintBridge} = NativeModules;
      if (!PrintBridge) {
        throw new Error('PrintBridge native module not found');
      }

      await PrintBridge.disconnect();
      console.log('Successfully disconnected device');
      setConnectedDevice(null);
    } catch (error) {
      console.error('Error disconnecting device:', error);
      // Force reset connection state even if disconnect fails
      setConnectedDevice(null);
    }
  };

  // Get connection status
  const getConnectionStatus = async () => {
    try {
      const {PrintBridge} = NativeModules;
      if (!PrintBridge) {
        throw new Error('PrintBridge native module not found');
      }

      const status = await PrintBridge.getConnectionStatus();
      console.log('Connection status:', status);
      return status;
    } catch (error) {
      console.error('Error getting connection status:', error);
      return null;
    }
  };

  // Print labels using TSPL protocol directly
  const printTSPLLabels = async (
    printQueue: any[],
    ingredients: any[],
    menuItems: any[],
    customExpiry: Record<string, string>,
    initials: string,
    storageInstructions?: string,
    companyName?: string,
    sessionId?: string, // Optional session ID for logging
    useFullPPDSFormat?: boolean, // If true, use 56mm×80mm PPDS format; if false, use 60mm×40mm PPD format
    ppdsExtras?: PPDSLabelExtras,
  ) => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }

    if (!printQueue || printQueue.length === 0) {
      throw new Error('No items in print queue');
    }

    try {
      setIsPrinting(true);
      console.log('🖨️ Starting TSPL direct printing...');

      const {PrintBridge} = NativeModules;

      // Process each item in the queue
      for (const item of printQueue) {
        const quantity = item.quantity;

        console.log(`🖨️ Printing ${quantity} labels for: ${item.name}`);

        // Generate label data for TSPL printing using the same function as label preview
        const finalExpiryDate = customExpiry[item.uid] || item.expiryDate;
        console.log(
          `🖨️ Using expiry date for ${item.name}: ${finalExpiryDate} (custom: ${
            customExpiry[item.uid] ? 'yes' : 'no'
          })`,
        );

        const labelContent = generateTSCLabelContent(
          item.name,
          item.labelType || 'prep',
          finalExpiryDate,
          item.ingredients || [],
          item.allergens || [],
          new Date().toISOString().split('T')[0],
          initials,
          companyName, // Pass the company name from the function parameter
        );

        const labelData = {
          header: labelContent.header,
          expiryLine: labelContent.expiryLine,
          printedLine: labelContent.printedLine,
          ingredientsLine: labelContent.ingredientsLine,
          initialsLine: labelContent.initialsLine,
          // Add PPDS-specific fields
          allergenWarningLine: (labelContent as any).allergenWarningLine,
          storageInstructions: (labelContent as any).storageInstructions,
        };

        // Generate TSPL commands for this label using appropriate function based on type
        let tsplCommands: string;

        if (item.labelType === 'ppds') {
          if (useFullPPDSFormat) {
            // Use full PPDS label function for 56mm × 80mm format (PPDS page)
            console.log(
              '🔍 Using generatePPDSLabel for PPDS label (PPDS page):',
              item.name,
            );

            // For PPDS labels, we need to pass the full ingredient objects for proper allergen display
            const ppdsLabelData = {
              ...labelData,
              // Use the expiry date from the print queue item (prioritize custom expiry)
              expiryLine: `Use by: ${
                customExpiry[item.uid] || item.expiryDate
              }`,
              allergenWarningLine: item.allergens
                ? item.allergens.join(', ')
                : undefined,
              // Pass storage instructions from the function parameter
              storageInstructions:
                storageInstructions ||
                'Keep refrigerated below 5°C. Consume within 2 days of opening.',
              // Set initials line to include company name for "Prepared by" line
              initialsLine: companyName
                ? `Prepared by: ${companyName}`
                : 'Prepared by: InstaLabel Ltd',
              fullIngredients:
                item.type === 'menu' && item.ingredients
                  ? ingredients.filter((ing: any) =>
                      item.ingredients.includes(ing.ingredientName),
                    )
                  : undefined,
              ppdsExtras,
            };
            console.log('🔍 PPDS Label Data:', ppdsLabelData);
            tsplCommands = generatePPDSLabel(ppdsLabelData);
          } else {
            // Use PPD label function for 60mm × 40mm format (labels page)
            console.log(
              '🔍 Using generatePPDLabel for PPDS label (labels page):',
              item.name,
            );

            // Find the menu item object from the menuItems array
            const menuItem = menuItems.find(
              menu =>
                menu.menuItemName === item.name || menu.name === item.name,
            );
            if (menuItem) {
              console.log('✅ Found menu item object for PPDS->PPD:', menuItem);

              // Add the full ingredients array for allergen lookup (same as regular menu items)
              const menuItemIngredients = ingredients.filter((ing: any) =>
                item.ingredients.includes(ing.ingredientName),
              );
              menuItem.fullIngredients = menuItemIngredients;
              console.log('🔍 Added fullIngredients for PPDS->PPD:', {
                count: menuItemIngredients?.length,
                sample: menuItemIngredients?.slice(0, 3),
                menuItemIngredients: item.ingredients,
              });

              // Pass the expiry date from the print queue item (prioritize custom expiry)
              const finalExpiryDate = customExpiry[item.uid] || item.expiryDate;
              console.log('🔍 Calling generatePPDLabel for PPDS->PPD with:', {
                menuItem: menuItem,
                expiryDate: finalExpiryDate,
                config: {dpi: 203},
              });

              tsplCommands = generatePPDLabel(menuItem, finalExpiryDate, {
                dpi: 203,
              }, ppdsExtras);
            } else {
              // Fallback to standard label if menu item not found
              console.warn(
                `⚠️ Menu item not found for PPDS->PPD label ${item.name}, using fallback`,
              );
              tsplCommands = generateDirectTSPLLabel(labelData);
            }
          }
        } else if (item.labelType === 'ppd') {
          // Use specialized PPD label function for custom format
          console.log('🔍 Using generatePPDLabel for PPD label:', item.name);

          // Find the menu item object from the menuItems array
          const menuItem = menuItems.find(
            menu => menu.menuItemName === item.name || menu.name === item.name,
          );
          if (menuItem) {
            console.log('✅ Found menu item object for PPD:', menuItem);

            // Pass the expiry date from the print queue item (prioritize custom expiry)
            const finalExpiryDate = customExpiry[item.uid] || item.expiryDate;
            console.log('🔍 Calling generatePPDLabel with:', {
              menuItem: menuItem,
              expiryDate: finalExpiryDate,
              config: {dpi: 203},
            });

            tsplCommands = useFullPPDSFormat
              ? generatePPDLabel80mm(menuItem, finalExpiryDate, {
                  dpi: 203,
                })
              : generatePPDLabel(menuItem, finalExpiryDate, {
                  dpi: 203,
                });
          } else {
            // Fallback to standard label if menu item not found
            console.warn(
              `⚠️ Menu item not found for PPD label ${item.name}, using fallback`,
            );
            tsplCommands = useFullPPDSFormat
              ? generatePPDSLabel({
                  ...labelData,
                  expiryLine: `Use by: ${
                    customExpiry[item.uid] || item.expiryDate
                  }`,
                  storageInstructions:
                    storageInstructions ||
                    'Keep refrigerated below 5°C. Consume within 2 days of opening.',
                  initialsLine: companyName
                    ? `Prepared by: ${companyName}`
                    : 'Prepared by: InstaLabel Ltd',
                  ppdsExtras,
                })
              : generateDirectTSPLLabel(labelData);
          }
        } else if (item.labelType === 'etc') {
          // Use specialized ETC label function for custom contains text
          console.log('🔍 Using generateETCLabel for ETC label:', item.name);

          // Find the menu item object from the menuItems array
          const menuItem = menuItems.find(
            menu => menu.menuItemName === item.name || menu.name === item.name,
          );
          if (menuItem) {
            console.log('✅ Found menu item object for ETC:', menuItem);

            // Pass the expiry date from the print queue item (prioritize custom expiry)
            const finalExpiryDate = customExpiry[item.uid] || item.expiryDate;
            console.log('🔍 Calling generateETCLabel with:', {
              menuItem: menuItem,
              expiryDate: finalExpiryDate,
              config: {dpi: 203},
              initials: item.customInitials || initials,
              customContains: item.ingredients?.join(', '),
            });

            tsplCommands = useFullPPDSFormat
              ? generateETCLabel80mm(
                  menuItem,
                  finalExpiryDate,
                  {
                    dpi: 203,
                  },
                  item.customInitials || initials,
                  item.ingredients?.join(', '),
                )
              : generateETCLabel(
                  menuItem,
                  finalExpiryDate,
                  {
                    dpi: 203,
                  },
                  item.customInitials || initials,
                  item.ingredients?.join(', '),
                );
          } else {
            // Fallback to standard label if menu item not found
            console.warn(
              `⚠️ Menu item not found for ETC label ${item.name}, using fallback`,
            );
            tsplCommands = useFullPPDSFormat
              ? generatePPDSLabel({
                  ...labelData,
                  expiryLine: `Use by: ${
                    customExpiry[item.uid] || item.expiryDate
                  }`,
                  storageInstructions:
                    storageInstructions ||
                    'Keep refrigerated below 5°C. Consume within 2 days of opening.',
                  initialsLine: companyName
                    ? `Prepared by: ${companyName}`
                    : 'Prepared by: InstaLabel Ltd',
                  ppdsExtras,
                })
              : generateDirectTSPLLabel(labelData);
          }
        } else if (item.type === 'ingredients') {
          // Use generateIngredientLabel for ingredient labels (our improved function)
          console.log(
            '🥬 Using generateIngredientLabel for ingredient:',
            item.name,
          );

          // Find the ingredient object from the ingredients array
          const ingredient = ingredients.find(
            ing => ing.ingredientName === item.name,
          );
          if (ingredient) {
            console.log('✅ Found ingredient object:', ingredient);
            // Pass the expiry date from the print queue item (prioritize custom expiry)
            tsplCommands = useFullPPDSFormat
              ? generateIngredientLabel80mm(
                  ingredient,
                  customExpiry[item.uid] || item.expiryDate,
                  {dpi: 203},
                  item.customInitials || initials,
                )
              : generateIngredientLabel(
                  ingredient,
                  customExpiry[item.uid] || item.expiryDate,
                  {dpi: 203},
                  item.customInitials || initials,
                );
          } else {
            // Fallback to standard label if ingredient not found
            console.warn(
              `⚠️ Ingredient not found for ${item.name}, using fallback`,
            );
            tsplCommands = useFullPPDSFormat
              ? generatePPDSLabel({
                  ...labelData,
                  expiryLine: `Use by: ${
                    customExpiry[item.uid] || item.expiryDate
                  }`,
                  storageInstructions:
                    storageInstructions ||
                    'Keep refrigerated below 5°C. Consume within 2 days of opening.',
                  initialsLine: companyName
                    ? `Prepared by: ${companyName}`
                    : 'Prepared by: InstaLabel Ltd',
                  ppdsExtras,
                })
              : generateDirectTSPLLabel(labelData);
          }
        } else if (item.type === 'menu') {
          // Use generateMenuItemLabel for regular menu item labels (our improved function)
          console.log(
            '🍽️ Using generateMenuItemLabel for menu item:',
            item.name,
          );
          console.log('🔍 Item details:', {
            name: item.name,
            type: item.type,
            labelType: item.labelType,
            expiryDate: item.expiryDate,
            ingredients: item.ingredients,
            allergens: item.allergens,
          });

          // Find the menu item object from the menuItems array
          const menuItem = menuItems.find(
            menu => menu.menuItemName === item.name || menu.name === item.name,
          );
          if (menuItem) {
            console.log('✅ Found menu item object:', menuItem);
            console.log('🔍 Menu item details:', {
              menuItemName: menuItem.menuItemName,
              name: menuItem.name,
              allergens: menuItem.allergens,
              ingredients: menuItem.ingredients,
            });

            // Add the label type from the item
            menuItem.labelType = item.labelType || 'PREP';
            // Add the full ingredients array for allergen lookup
            // Filter ingredients to only include those used in this menu item
            const menuItemIngredients = ingredients.filter((ing: any) =>
              item.ingredients.includes(ing.ingredientName),
            );
            menuItem.fullIngredients = menuItemIngredients;
            console.log('🔍 Added fullIngredients:', {
              count: menuItemIngredients?.length,
              sample: menuItemIngredients?.slice(0, 3),
              allIngredients: ingredients?.length,
              menuItemIngredients: item.ingredients,
            });

            // Pass the expiry date from the print queue item (prioritize custom expiry)
            const finalExpiryDate = customExpiry[item.uid] || item.expiryDate;
            console.log('🔍 Calling generateMenuItemLabel with:', {
              menuItem: menuItem,
              expiryDate: finalExpiryDate,
              config: {dpi: 203},
            });

            tsplCommands = useFullPPDSFormat
              ? generateMenuItemLabel80mm(
                  menuItem,
                  finalExpiryDate,
                  {
                    dpi: 203,
                  },
                  item.customInitials || initials,
                )
              : generateMenuItemLabel(
                  menuItem,
                  finalExpiryDate,
                  {
                    dpi: 203,
                  },
                  item.customInitials || initials,
                );
          } else {
            // Fallback to standard label if menu item not found
            console.warn(
              `⚠️ Menu item not found for ${item.name}, using fallback`,
            );
            tsplCommands = useFullPPDSFormat
              ? generatePPDSLabel({
                  ...labelData,
                  expiryLine: `Use by: ${
                    customExpiry[item.uid] || item.expiryDate
                  }`,
                  storageInstructions:
                    storageInstructions ||
                    'Keep refrigerated below 5°C. Consume within 2 days of opening.',
                  initialsLine: companyName
                    ? `Prepared by: ${companyName}`
                    : 'Prepared by: InstaLabel Ltd',
                  ppdsExtras,
                })
              : generateDirectTSPLLabel(labelData);
          }
        } else {
          // Use standard label function for other label types
          tsplCommands = useFullPPDSFormat
            ? generatePPDSLabel({
                ...labelData,
                expiryLine: `Use by: ${customExpiry[item.uid] || item.expiryDate}`,
                storageInstructions:
                  storageInstructions ||
                  'Keep refrigerated below 5°C. Consume within 2 days of opening.',
                initialsLine: companyName
                  ? `Prepared by: ${companyName}`
                  : 'Prepared by: InstaLabel Ltd',
                ppdsExtras,
              })
            : generateDirectTSPLLabel(labelData);
        }

        // Print the label quantity times
        for (let i = 0; i < quantity; i++) {
          console.log(
            `🖨️ Printing label ${i + 1}/${quantity} for ${item.name}`,
          );

          await PrintBridge.printTSPL(tsplCommands);

          // Small delay between prints to prevent buffer overflow
          if (i < quantity - 1) {
            await new Promise<void>(resolve =>
              setTimeout(() => resolve(), 500),
            );
          }
        }

        // Log the print action to backend for tracking/auditing
        try {
          const logSessionId = sessionId || apiService.generateSessionId();
          await apiService.logPrintAction({
            labelType: item.labelType || 'prep',
            itemId: item.uid || item.id || '',
            itemName: item.name,
            quantity: quantity,
            expiryDate: customExpiry[item.uid] || item.expiryDate,
            initial: item.customInitials || initials,
            labelHeight:
              useFullPPDSFormat || item.labelType === 'ppds' ? '80mm' : '40mm',
            printerUsed: connectedDevice.name || 'Bluetooth Printer',
            sessionId: logSessionId,
            selectedItems:
              item.type === 'complex' ? item.selectedItems : undefined,
          });
          console.log(
            `✅ Print action logged to backend for ${item.name} with sessionId: ${logSessionId}`,
          );
        } catch (logError) {
          console.warn(
            `⚠️ Failed to log print action for ${item.name}:`,
            logError,
          );
          // Continue even if logging fails - don't stop the print process
        }

        console.log(
          `✅ Completed printing ${quantity} labels for ${item.name}`,
        );
      }

      console.log('✅ TSPL direct printing completed successfully');
    } catch (error) {
      console.error('❌ Error in TSPL direct printing:', error);
      throw error;
    } finally {
      setIsPrinting(false);
    }
  };

  // Initialize print spooler
  useEffect(() => {
    if (!spoolerRef.current) {
      // Create the actual print function that the spooler will use
      const actualPrintFunction = async (labelData: any) => {
        if (!connectedDevice) {
          throw new Error('No device connected');
        }

        const {PrintBridge} = NativeModules;

        // Determine the type of label and generate appropriate commands
        let tsplCommands: string;

        try {
          if (labelData.type === 'complex') {
            tsplCommands = generateDirectTSPLLabel(labelData);
          } else {
            // Default to a simple label if type is not specified or unknown
            const simpleLabelData = {
              header: labelData.text || 'Label',
              expiryLine: labelData.expiryDate || '',
              printedLine: `Printed: ${new Date().toISOString().split('T')[0]}`,
              initialsLine: labelData.initials || '',
              ingredientsLine: labelData.ingredients || [],
              allergenWarningLine: undefined,
              storageInstructions: undefined,
            };
            tsplCommands = generateDirectTSPLLabel(simpleLabelData);
          }

          console.log('📝 Generated TSPL commands:', tsplCommands);
          console.log('📏 TSPL commands length:', tsplCommands.length);

          await PrintBridge.printTSPL(tsplCommands);
          console.log('✅ PrintBridge.printTSPL completed successfully');
        } catch (error) {
          console.error('❌ Error in actualPrintFunction:', error);
          console.error('❌ Label data:', JSON.stringify(labelData, null, 2));
          throw error;
        }
      };

      spoolerRef.current = new PrintSpooler(actualPrintFunction, {
        maxConcurrentJobs: 3, // Increased for load balancing
        retryDelay: 2000,
        maxRetries: 3,
        jobTimeout: 30000,
        // Load balancing config
        maxJobSize: 5 * 1024 * 1024, // 5MB
        maxQueueSize: 100,
        rateLimitPerMinute: 30,
        // Security config
        enableJobValidation: true,
        enableRateLimiting: true,
        enableChecksumValidation: true,
        // Memory management
        maxCompletedJobsInMemory: 50,
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        maxImageSize: 2 * 1024 * 1024, // 2MB
      });

      console.log(
        '🖨️ Print spooler initialized with load balancing and security features',
      );
    }
  }, [connectedDevice]);

  // Add printer instance to spooler when device connects
  useEffect(() => {
    if (spoolerRef.current && connectedDevice) {
      // Add the connected device as a printer instance for load balancing
      spoolerRef.current.addPrinterInstance(
        connectedDevice.id,
        connectedDevice.name || 'Bluetooth Printer',
        'bluetooth',
        connectedDevice.address,
        5, // Max load of 5 concurrent jobs
      );
      console.log('🖨️ Added connected device to spooler load balancer');
    }
  }, [connectedDevice]);

  // Update queue status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (spoolerRef.current) {
        const status = spoolerRef.current.getQueueStatus();
        setQueueStatus(status);
        setPrintQueue(spoolerRef.current.getAllJobs());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (spoolerRef.current) {
        spoolerRef.current.destroy();
      }
    };
  }, []);

  // Spooler functions
  const addToPrintQueue = (
    labelData: any,
    quantity: number = 1,
    priority: 'high' | 'normal' | 'low' = 'normal',
    userId?: string,
    sessionId?: string,
  ): string => {
    if (!spoolerRef.current) {
      throw new Error('Print spooler not initialized');
    }
    return spoolerRef.current.addJob(
      labelData,
      quantity,
      priority,
      userId,
      sessionId,
    );
  };

  const removeFromPrintQueue = (jobId: string): boolean => {
    if (!spoolerRef.current) {
      return false;
    }
    return spoolerRef.current.removeJob(jobId);
  };

  const clearPrintQueue = (): void => {
    if (spoolerRef.current) {
      spoolerRef.current.clearQueue();
    }
  };

  const cancelPrintJob = (jobId: string): boolean => {
    if (!spoolerRef.current) {
      return false;
    }
    return spoolerRef.current.cancelJob(jobId);
  };

  const cancelAllPrintJobs = (): void => {
    if (spoolerRef.current) {
      spoolerRef.current.cancelAllJobs();
    }
  };

  const pausePrintQueue = (): void => {
    if (spoolerRef.current) {
      spoolerRef.current.pause();
    }
  };

  const resumePrintQueue = (): void => {
    if (spoolerRef.current) {
      spoolerRef.current.resume();
    }
  };

  // Load balancing and security functions
  const addPrinterInstance = (
    id: string,
    name: string,
    connectionType: 'bluetooth' | 'network' | 'usb',
    address: string,
    maxLoad: number = 5,
  ): void => {
    if (spoolerRef.current) {
      spoolerRef.current.addPrinterInstance(
        id,
        name,
        connectionType,
        address,
        maxLoad,
      );
    }
  };

  const removePrinterInstance = (id: string): boolean => {
    if (spoolerRef.current) {
      return spoolerRef.current.removePrinterInstance(id);
    }
    return false;
  };

  const updatePrinterHealth = (
    id: string,
    isHealthy: boolean,
    currentLoad: number,
  ): void => {
    if (spoolerRef.current) {
      spoolerRef.current.updatePrinterHealth(id, isHealthy, currentLoad);
    }
  };

  const getSystemInfo = (): any => {
    if (spoolerRef.current) {
      return spoolerRef.current.getSystemInfo();
    }
    return null;
  };

  const performMemoryCleanup = (): void => {
    if (spoolerRef.current) {
      spoolerRef.current.cleanupOldJobs(24); // Clean up jobs older than 24 hours
    }
  };

  // Simple custom label printing function
  const printSimpleCustomLabel = async (
    text: string,
    expiryDate: string,
    initials: string,
    ingredients?: string[],
    allergens?: string[],
    storageInstructions?: string,
    companyName?: string,
  ) => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      setIsPrinting(true);
      console.log('🖨️ Starting simple custom label printing...');

      const {PrintBridge} = NativeModules;

      const labelContent = generateTSCLabelContent(
        text,
        'default',
        expiryDate,
        ingredients || [],
        allergens || [],
        new Date().toISOString().split('T')[0],
        initials,
        companyName,
      );

      const labelData = {
        header: labelContent.header,
        expiryLine: labelContent.expiryLine,
        printedLine: labelContent.printedLine,
        ingredientsLine: labelContent.ingredientsLine,
        initialsLine: labelContent.initialsLine,
        allergenWarningLine: undefined,
        storageInstructions: storageInstructions,
      };

      const tsplCommands = generateDirectTSPLLabel(labelData);

      console.log(
        '📝 Generated TSPL commands for simple custom label:',
        tsplCommands,
      );
      console.log('📏 TSPL commands length:', tsplCommands.length);

      await PrintBridge.printTSPL(tsplCommands);
      console.log('✅ Simple custom label printed successfully');

      // Log the print action to backend for tracking/auditing
      try {
        await apiService.logPrintAction({
          labelType: 'custom',
          itemId: text,
          itemName: text,
          quantity: 1,
          expiryDate: expiryDate,
          initial: initials,
          labelHeight: '40mm', // Assuming a standard label height
          printerUsed: connectedDevice.name || 'Bluetooth Printer',
          sessionId: apiService.generateSessionId(),
          selectedItems: undefined,
        });
        console.log(
          `✅ Simple custom label print action logged to backend for ${text}`,
        );
      } catch (logError) {
        console.warn(
          `⚠️ Failed to log simple custom label print action for ${text}:`,
          logError,
        );
        // Continue even if logging fails - don't stop the print process
      }
    } catch (error) {
      console.error('❌ Error in simple custom label printing:', error);
      throw error;
    } finally {
      setIsPrinting(false);
    }
  };

  // Print circular allergen stickers
  const printCircularAllergenSticker = async (
    printQueue: any[],
    customExpiry: Record<string, string>,
  ) => {
    if (!connectedDevice) {
      throw new Error('No device connected');
    }

    if (!printQueue || printQueue.length === 0) {
      throw new Error('No items in print queue');
    }

    try {
      setIsPrinting(true);
      console.log('🖨️ Starting circular allergen sticker printing...');

      const {PrintBridge} = NativeModules;

      // Process each item in the queue
      for (const item of printQueue) {
        const quantity = item.quantity;
        const finalExpiryDate = customExpiry[item.uid] || item.expiryDate;

        console.log(`🖨️ Printing ${quantity} circular stickers for: ${item.name}`);

        // Generate TSPL commands for circular allergen sticker
        const labelData = {
          itemName: item.name,
          allergens: item.allergens || [],
          expiryDate: finalExpiryDate,
        };

        const tsplCommands = generateCircularAllergenSticker(labelData, {
          dpi: 203,
        });

        // Print the label quantity times
        for (let i = 0; i < quantity; i++) {
          console.log(
            `🖨️ Printing circular sticker ${i + 1}/${quantity} for ${item.name}`,
          );

          await PrintBridge.printTSPL(tsplCommands);

          // Small delay between prints
          if (i < quantity - 1) {
            await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
          }
        }

        // Log the print action
        try {
          const sessionId = apiService.generateSessionId();
          await apiService.logPrintAction({
            labelType: 'allergen-sticker',
            itemId: item.uid || item.id || '',
            itemName: item.name,
            quantity: quantity,
            expiryDate: finalExpiryDate,
            initial: '',
            labelHeight: '37mm',
            printerUsed: connectedDevice.name || 'Bluetooth Printer',
            sessionId: sessionId,
            selectedItems: undefined,
          });
          console.log(
            `✅ Circular allergen sticker print action logged for ${item.name}`,
          );
        } catch (logError) {
          console.warn(
            `⚠️ Failed to log circular allergen sticker print action for ${item.name}:`,
            logError,
          );
        }

        console.log(
          `✅ Completed printing ${quantity} circular stickers for ${item.name}`,
        );
      }

      console.log('✅ Circular allergen sticker printing completed successfully');
    } catch (error) {
      console.error('❌ Error in circular allergen sticker printing:', error);
      throw error;
    } finally {
      setIsPrinting(false);
    }
  };

  const value: PrinterContextType = {
    // State
    isBluetoothEnabled,
    devices,
    connectedDevice,
    isScanning,
    isConnecting,
    isPrinting,
    printQueue,
    queueStatus,

    // Actions
    setIsBluetoothEnabled,
    setDevices,
    setConnectedDevice,
    setIsScanning,
    setIsConnecting,
    setIsPrinting,

    // Functions
    checkBluetoothStatus,
    enableBluetooth,
    listPairedDevices,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    getConnectionStatus,
    refreshConnectionStatus,
    printTSPLLabels,
    printSimpleCustomLabel,
    printCircularAllergenSticker,

    // Spooler functions
    addToPrintQueue,
    removeFromPrintQueue,
    clearPrintQueue,
    cancelPrintJob,
    cancelAllPrintJobs,
    pausePrintQueue,
    resumePrintQueue,

    // Load balancing and security functions
    addPrinterInstance,
    removePrinterInstance,
    updatePrinterHealth,
    getSystemInfo,
    performMemoryCleanup,
  };

  // console.log('🔧 PrinterProvider: Providing context with value:', value);

  return (
    <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>
  );
};
