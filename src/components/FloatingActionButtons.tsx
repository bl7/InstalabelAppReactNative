import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import {
  Snowflake,
  Clock,
  Plus,
  Search,
  SearchX,
  Check,
  AlertTriangle,
  Edit3,
} from 'lucide-react-native';
import {usePrinter} from '../PrinterContext';
import {useSubscription} from '../contexts/SubscriptionContext';
import {generateUseFirstLabel, generateDefrostLabel} from '../../tsplUtils';
import {apiService, Ingredient} from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface FloatingActionButtonsProps {
  onDefrostPress?: () => void;
  onActionsToggle?: (showActions: boolean) => void;
  onNavigateToCustom?: () => void;
}

const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  onDefrostPress,
  onActionsToggle,
  onNavigateToCustom,
}) => {
  const [useFirstModalVisible, setUseFirstModalVisible] = useState(false);
  const [defrostModalVisible, setDefrostModalVisible] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const {connectedDevice, printTSPLLabels} = usePrinter();
  const {canPrint, blockedMessage, subscriptionInfo} = useSubscription();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Defrost modal state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);
  const [isPrintingUseFirst, setIsPrintingUseFirst] = useState(false);
  const [isPrintingDefrost, setIsPrintingDefrost] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load ingredients when defrost modal opens
  useEffect(() => {
    if (
      defrostModalVisible &&
      ingredients.length === 0 &&
      !isLoadingIngredients
    ) {
      loadIngredients();
    }
  }, [defrostModalVisible]);

  // Filter ingredients based on search term
  const filteredIngredients = useMemo(() => {
    if (searchTerm.trim()) {
      return ingredients.filter(ingredient =>
        ingredient.ingredientName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      );
    }
    return ingredients;
  }, [searchTerm, ingredients]);

  // Reset to first page when searching
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadIngredients = async () => {
    // Prevent multiple simultaneous requests
    if (isLoadingIngredients) {
      return;
    }

    try {
      setIsLoadingIngredients(true);
      const ingredientsData = await apiService.getIngredients();

      setIngredients(ingredientsData);

      // Debug: Check for duplicate ingredient IDs
      if (__DEV__) {
        const ingredientIds = ingredientsData.map(i => i.ingredientID);
        const uniqueIds = new Set(ingredientIds);
        console.log('🔍 Defrost - Ingredient data loaded:', {
          totalIngredients: ingredientsData.length,
          uniqueIds: uniqueIds.size,
          hasDuplicates: ingredientIds.length !== uniqueIds.size,
          sampleIds: ingredientIds.slice(0, 5),
        });
      }
    } catch (error) {
      console.error('Error loading ingredients:', error);
      Alert.alert('Error', 'Failed to load ingredients. Please try again.');
    } finally {
      setIsLoadingIngredients(false);
    }
  };

  const handleUseFirstPress = () => {
    if (!canPrint) {
      Alert.alert(
        'Printing Disabled',
        blockedMessage ||
          'Printing is not available with your current subscription.',
        [
          {text: 'OK', style: 'default'},
          {
            text: 'Manage Subscription',
            onPress: () => {
              // TODO: Navigate to subscription management
              Alert.alert(
                'Subscription Management',
                'Please visit the web dashboard to manage your subscription.',
              );
            },
          },
        ],
      );
      return;
    }
    setUseFirstModalVisible(true);
  };

  const handleDefrostPress = () => {
    if (!canPrint) {
      Alert.alert(
        'Printing Disabled',
        blockedMessage ||
          'Printing is not available with your current subscription.',
        [
          {text: 'OK', style: 'default'},
          {
            text: 'Manage Subscription',
            onPress: () => {
              // TODO: Navigate to subscription management
              Alert.alert(
                'Subscription Management',
                'Please visit the web dashboard to manage your subscription.',
              );
            },
          },
        ],
      );
      return;
    }
    setDefrostModalVisible(true);
  };

  const handleDefrostCancel = () => {
    setDefrostModalVisible(false);
    setSearchTerm('');
    setSelectedIngredients(new Set());
    setCurrentPage(1);
    // Don't reset ingredients to prevent continuous fetching
  };

  const handleIngredientToggle = useCallback(
    (ingredientId: string) => {
      // Create a completely new Set to avoid reference issues
      const newSelected = new Set<string>();

      // Copy existing selections
      selectedIngredients.forEach(id => {
        if (id) newSelected.add(String(id));
      });

      if (newSelected.has(ingredientId)) {
        newSelected.delete(ingredientId);
        console.log('🔍 Defrost - Removed ingredient:', ingredientId);
      } else {
        newSelected.add(ingredientId);
        console.log('🔍 Defrost - Added ingredient:', ingredientId);
      }

      console.log('🔍 Defrost - Updated selection:', Array.from(newSelected));
      setSelectedIngredients(newSelected);
    },
    [selectedIngredients],
  );

  const handleDefrostConfirm = async () => {
    console.log('🔍 Defrost - Starting print process');
    console.log('🔍 Defrost - Selected count:', selectedIngredients.size);

    if (selectedIngredients.size === 0) {
      Alert.alert(
        'No Selection',
        'Please select at least one ingredient to defrost.',
      );
      return;
    }

    if (!connectedDevice) {
      Alert.alert('No Printer', 'Please connect a printer first.');
      return;
    }

    try {
      setIsPrintingDefrost(true);

      // Generate session ID for this print session
      const sessionId = apiService.generateSessionId();

      // Get selected ingredients data with explicit validation
      const selectedIngredientsData = [];

      for (const ingredient of ingredients) {
        const originalIndex = ingredients.indexOf(ingredient);
        const ingredientId = ingredient.ingredientID
          ? String(ingredient.ingredientID)
          : `ingredient-${originalIndex}`;

        if (selectedIngredients.has(ingredientId)) {
          selectedIngredientsData.push(ingredient);
        }
      }

      // Debug logging to verify what's being selected
      console.log('🔍 Defrost - Print Summary:', {
        selectedCount: selectedIngredients.size,
        ingredientsToPrint: selectedIngredientsData.map(i => i.ingredientName),
      });

      // Generate and print defrost labels
      const {PrintBridge} = require('react-native').NativeModules;

      // Print each selected ingredient
      for (const ingredient of selectedIngredientsData) {
        // Generate TSPL commands for defrost label
        const tsplCommands = generateDefrostLabel(ingredient);

        // Print the label
        await PrintBridge.printTSPL(tsplCommands);

        // Small delay between prints
        await new Promise<void>(resolve => setTimeout(resolve, 500));
      }

      // Log the print session - what was actually selected and printed
      await apiService.logPrintAction({
        labelType: 'defrost',
        itemId: `defrost-session-${Date.now()}`,
        itemName: `Defrost Labels (${selectedIngredientsData.length} items)`,
        quantity: selectedIngredientsData.length,
        expiryDate: new Date(
          Date.now() +
            Math.max(...selectedIngredientsData.map(i => i.expiryDays)) *
              24 *
              60 *
              60 *
              1000,
        ).toISOString(),
        labelHeight: '40mm',
        printerUsed: connectedDevice.name || 'Unknown Printer',
        sessionId: sessionId,
        selectedItems: selectedIngredientsData.map(ingredient => {
          const originalIndex = ingredients.findIndex(
            orig => orig.ingredientID === ingredient.ingredientID,
          );
          return {
            id:
              ingredient.ingredientID ||
              `ingredient-${
                originalIndex >= 0
                  ? originalIndex
                  : ingredients.indexOf(ingredient)
              }`,
            name: ingredient.ingredientName,
            expiryDays: ingredient.expiryDays,
          };
        }),
      });

      Alert.alert(
        'Success',
        `${selectedIngredientsData.length} defrost label(s) printed successfully!`,
      );

      // Close modal and reset state
      handleDefrostCancel();
    } catch (error) {
      Alert.alert('Error', 'Failed to print defrost labels. Please try again.');
      console.error('Defrost print error:', error);
    } finally {
      setIsPrintingDefrost(false);
    }
  };

  const handleUseFirstPrint = async () => {
    if (!connectedDevice) {
      Alert.alert('No Printer', 'Please connect a printer first.');
      return;
    }

    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }

    try {
      setIsPrintingUseFirst(true);

      // Generate session ID for this print session
      const sessionId = apiService.generateSessionId();

      // Generate TSPL commands for USE FIRST labels
      const tsplCommands = generateUseFirstLabel(numQuantity);

      // Print the labels using PrintBridge directly
      const {PrintBridge} = require('react-native').NativeModules;

      // Print the label quantity times
      for (let i = 0; i < numQuantity; i++) {
        await PrintBridge.printTSPL(tsplCommands);

        // Small delay between prints to prevent buffer overflow
        if (i < numQuantity - 1) {
          await new Promise<void>(resolve => setTimeout(resolve, 500));
        }
      }

      // Use First labels are utility labels - no need to log them

      Alert.alert(
        'Success',
        `${numQuantity} USE FIRST label(s) printed successfully!`,
      );
      setUseFirstModalVisible(false);
      setQuantity('1');
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to print USE FIRST labels. Please try again.',
      );
      console.error('Print error:', error);
    } finally {
      setIsPrintingUseFirst(false);
    }
  };

  const handleCancelUseFirst = () => {
    setUseFirstModalVisible(false);
    setQuantity('1');
  };

  // Limit quantity input to max 3 digits, numeric only
  const handleQuantityChange = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    setQuantity(digitsOnly.slice(0, 3));
  };

  return (
    <>
      {/* Backdrop overlay when actions are shown */}
      {showActions && !keyboardVisible && (
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => {
            setShowActions(false);
            onActionsToggle?.(false);
          }}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close quick actions menu"
          accessibilityHint="Tapping outside the menu will close it"
        />
      )}

      {/* Floating Action Buttons */}
      {!keyboardVisible && (
        <View pointerEvents="box-none" style={[styles.container]}>
          {/* Actions stack (shown above main button) */}
          {showActions && (
            <View
              style={[styles.actionsStack, styles.actionsStackVisible]}
              pointerEvents="box-none">
              <TouchableOpacity
                style={[
                  styles.fab,
                  styles.actionFab,
                  styles.useFirstFab,
                  !canPrint && styles.fabDisabled,
                ]}
                onPress={() => {
                  setShowActions(false);
                  handleUseFirstPress();
                }}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                disabled={!canPrint}
                accessibilityRole="button"
                accessibilityLabel="Print Use First labels"
                accessibilityHint="Prints labels for items that need immediate use"
                accessibilityState={{disabled: !canPrint}}
                activeOpacity={canPrint ? 0.8 : 1}>
                <View style={styles.fabContent}>
                  <Clock size={20} color={canPrint ? '#fff' : '#ccc'} />
                  <Text
                    style={[
                      styles.fabText,
                      !canPrint && styles.fabTextDisabled,
                    ]}>
                    USE FIRST
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.fab,
                  styles.actionFab,
                  styles.defrostFab,
                  !canPrint && styles.fabDisabled,
                ]}
                onPress={() => {
                  setShowActions(false);
                  handleDefrostPress();
                }}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                disabled={!canPrint}
                accessibilityRole="button"
                accessibilityLabel="Open Defrost ingredients"
                accessibilityHint="Opens menu to select ingredients for defrost labels"
                accessibilityState={{disabled: !canPrint}}
                activeOpacity={canPrint ? 0.8 : 1}>
                <View style={styles.fabContent}>
                  <Snowflake size={20} color={canPrint ? '#fff' : '#ccc'} />
                  <Text
                    style={[
                      styles.fabText,
                      !canPrint && styles.fabTextDisabled,
                    ]}>
                    DEFROST
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.fab,
                  styles.actionFab,
                  styles.etcFab,
                  !canPrint && styles.fabDisabled,
                ]}
                onPress={() => {
                  setShowActions(false);
                  onNavigateToCustom?.();
                }}
                hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                disabled={!canPrint}
                accessibilityRole="button"
                accessibilityLabel="Open Custom Label"
                accessibilityHint="Opens custom label creation page"
                accessibilityState={{disabled: !canPrint}}
                activeOpacity={canPrint ? 0.8 : 1}>
                <View style={styles.fabContent}>
                  <Edit3 size={20} color={canPrint ? '#fff' : '#ccc'} />
                  <Text
                    style={[
                      styles.fabText,
                      !canPrint && styles.fabTextDisabled,
                    ]}>
                    ETC
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Main Quick Actions FAB */}
          <TouchableOpacity
            style={[styles.mainFab]}
            onPress={() => {
              const newShowActions = !showActions;
              setShowActions(newShowActions);
              onActionsToggle?.(newShowActions);
            }}
            hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
            accessibilityRole="button"
            accessibilityLabel="Quick Actions Menu"
            accessibilityHint="Opens menu for Use First and Defrost label printing"
            activeOpacity={0.8}>
            <View
              style={[styles.plusIcon, showActions && styles.plusIconRotated]}>
              <Plus size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Use First Modal */}
      <Modal
        visible={useFirstModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelUseFirst}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Print USE FIRST Labels</Text>
            <Text style={styles.modalSubtitle}>
              Enter the quantity of labels you want to print
            </Text>

            <View style={styles.quantityContainer}>
              <Text style={styles.quantityLabel}>Quantity:</Text>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={handleQuantityChange}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#999"
                maxLength={3}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelUseFirst}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.printButton]}
                onPress={handleUseFirstPrint}
                disabled={isPrintingUseFirst}>
                {isPrintingUseFirst ? (
                  <LoadingSpinner
                    variant="button"
                    message="Printing..."
                    size="small"
                    color="#fff"
                  />
                ) : (
                  <Text style={styles.printButtonText}>Print</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Defrost Modal */}
      <Modal
        visible={defrostModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleDefrostCancel}>
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScrollContainer}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive">
            <View style={[styles.modalContainer, styles.defrostModalContainer]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Defrost</Text>
                {selectedIngredients.size > 0 && (
                  <Text style={styles.selectedCount}>
                    {selectedIngredients.size} selected
                  </Text>
                )}
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Search size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search ingredients..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholderTextColor="#999"
                />
                {searchTerm ? (
                  <TouchableOpacity
                    hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setSearchTerm('')}>
                    <SearchX size={20} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Ingredients List */}
              <View style={styles.ingredientsContainer}>
                {isLoadingIngredients ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.loadingText}>
                      Loading ingredients...
                    </Text>
                  </View>
                ) : filteredIngredients.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {searchTerm
                        ? 'No ingredients found matching your search'
                        : 'No ingredients available'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.ingredientsList}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.ingredientsListContent}>
                    {filteredIngredients
                      .slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage,
                      )
                      .map((ingredient, filteredIndex) => {
                        // Use the actual index in the original ingredients array for unique identification
                        const originalIndex = ingredients.indexOf(ingredient);

                        // Use ingredientID if available, otherwise use the original index
                        const uniqueKey = ingredient.ingredientID
                          ? `ingredient-${ingredient.ingredientID}`
                          : `ingredient-${originalIndex}-${
                              ingredient.ingredientName?.replace(/\s+/g, '-') ||
                              'unknown'
                            }`;

                        // Handle ingredient ID safely using original array index
                        // Use the same logic as in handleDefrostConfirm for consistency
                        const ingredientId = ingredient.ingredientID
                          ? String(ingredient.ingredientID)
                          : `ingredient-${originalIndex}`;
                        const isSelected =
                          selectedIngredients.has(ingredientId);

                        // Debug logging for ingredient rendering (only when selection changes)
                        if (__DEV__ && isSelected) {
                          console.log('🔍 Defrost - Selected ingredient:', {
                            name: ingredient.ingredientName,
                            id: ingredientId,
                          });
                        }

                        return (
                          <TouchableOpacity
                            key={uniqueKey}
                            style={[
                              styles.ingredientItem,
                              isSelected && styles.selectedIngredientItem,
                            ]}
                            onPress={() =>
                              handleIngredientToggle(ingredientId)
                            }>
                            <View style={styles.ingredientInfo}>
                              <Text style={styles.ingredientName}>
                                {ingredient.ingredientName}
                              </Text>
                              {ingredient.allergens &&
                                ingredient.allergens.length > 0 && (
                                  <Text style={styles.allergenInfo}>
                                    Allergens:{' '}
                                    {ingredient.allergens
                                      .map(a => a.allergenName)
                                      .join(', ')}
                                  </Text>
                                )}
                            </View>
                            <View style={styles.ingredientCheckbox}>
                              {isSelected ? (
                                <Check size={20} color="#8A2BE2" />
                              ) : (
                                <View style={styles.checkboxPlaceholder} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                )}
              </View>

              {/* Pagination */}
              {!isLoadingIngredients &&
                filteredIngredients.length > 0 &&
                Math.ceil(filteredIngredients.length / itemsPerPage) > 1 && (
                  <View style={styles.paginationContainer}>
                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage === 1 && styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}>
                      <Text
                        style={[
                          styles.paginationButtonText,
                          currentPage === 1 &&
                            styles.paginationButtonTextDisabled,
                        ]}>
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.pageIndicator}>
                      {currentPage}/
                      {Math.ceil(filteredIngredients.length / itemsPerPage)}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.paginationButton,
                        currentPage ===
                          Math.ceil(
                            filteredIngredients.length / itemsPerPage,
                          ) && styles.paginationButtonDisabled,
                      ]}
                      onPress={() =>
                        setCurrentPage(prev =>
                          Math.min(
                            Math.ceil(
                              filteredIngredients.length / itemsPerPage,
                            ),
                            prev + 1,
                          ),
                        )
                      }
                      disabled={
                        currentPage ===
                        Math.ceil(filteredIngredients.length / itemsPerPage)
                      }>
                      <Text
                        style={[
                          styles.paginationButtonText,
                          currentPage ===
                            Math.ceil(
                              filteredIngredients.length / itemsPerPage,
                            ) && styles.paginationButtonTextDisabled,
                        ]}>
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* Modal Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={handleDefrostCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleDefrostConfirm}
                  disabled={
                    selectedIngredients.size === 0 || isPrintingDefrost
                  }>
                  {isPrintingDefrost ? (
                    <LoadingSpinner
                      variant="button"
                      message="Printing..."
                      size="small"
                      color="#fff"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.confirmButtonText,
                        selectedIngredients.size === 0 &&
                          styles.confirmButtonTextDisabled,
                      ]}>
                      Confirm ({selectedIngredients.size})
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: -1000, // Extend far above to cover entire screen
    left: -1000, // Extend far left to cover entire screen
    right: -1000, // Extend far right to cover entire screen
    bottom: -1000, // Extend far below to cover entire screen
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 998, // Below FAB actions but above other content
  },
  container: {
    position: 'relative',
    gap: 16,
    zIndex: 1000, // Ensure FAB stays above backdrop
  },
  actionsStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70, // Stack above main FAB
    gap: 12,
    alignItems: 'center',
    zIndex: 1001, // Ensure actions stay above backdrop and main FAB
    opacity: 0,
    transform: [{translateY: 20}, {scale: 0.8}],
  },
  actionsStackVisible: {
    opacity: 1,
    transform: [{translateY: 0}, {scale: 1}],
  },
  plusIcon: {
    transform: [{rotate: '0deg'}],
  },
  plusIconRotated: {
    transform: [{rotate: '45deg'}],
  },
  fab: {
    width: 120,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16, // Enhanced Material Design elevation for floating effect
  },
  actionFab: {
    width: 56,
    height: 56,
    borderRadius: 28, // Make it perfectly round
    paddingHorizontal: 0, // Remove horizontal padding for round button
    // Additional floating effect
    transform: [{scale: 1.02}], // Slightly larger for floating effect
  },
  useFirstFab: {
    backgroundColor: '#10B981', // Emerald green - complements purple theme
  },
  defrostFab: {
    backgroundColor: '#00BCD4', // Teal/cyan - complements purple theme
  },
  etcFab: {
    backgroundColor: '#FF9800', // Orange - complements purple theme
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8A2BE2',
    borderWidth: 3,
    borderColor: 'white', // White border around the FAB
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16, // Enhanced elevation for floating effect
    transform: [{translateY: -4}], // More prominent upward offset for floating effect
  },
  mainFabText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  fabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  fabText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 1,
    textAlign: 'center',
    lineHeight: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContainer: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 5,
    minHeight: '100%',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    width: '85%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'left',
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A2BE2',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8A2BE2',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  quantityContainer: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A2BE2',
    marginRight: 12,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    textAlign: 'center',
    width: 110,
    minWidth: 80,
    maxWidth: 140,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  printButton: {
    backgroundColor: '#8A2BE2',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  printButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Defrost Modal Styles
  defrostModalContainer: {
    maxHeight: Platform.OS === 'ios' ? '95%' : '98%',
    width: '85%',
    maxWidth: 380,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },

  ingredientsContainer: {
    width: '100%',
    height: 350,
    marginBottom: 16,
    overflow: 'hidden',
  },

  ingredientsList: {
    flex: 1,
  },
  ingredientsListContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },

  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },

  selectedIngredientItem: {
    backgroundColor: '#f8f9fa',
  },

  ingredientInfo: {
    flex: 1,
  },

  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    flex: 1,
    flexShrink: 1,
  },

  allergenInfo: {
    fontSize: 12,
    color: '#666',
  },

  ingredientCheckbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },

  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  paginationButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  paginationButtonDisabled: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
  },

  paginationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },

  paginationButtonTextDisabled: {
    color: '#999',
  },

  pageIndicator: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  selectionSummary: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  selectionSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A2BE2',
  },

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  confirmButton: {
    backgroundColor: '#8A2BE2',
  },

  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  confirmButtonTextDisabled: {
    color: '#ccc',
  },

  // Disabled button styles
  fabDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },

  fabTextDisabled: {
    color: '#ccc',
  },
});

export default FloatingActionButtons;
