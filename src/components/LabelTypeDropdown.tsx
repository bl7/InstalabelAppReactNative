import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Modal from 'react-native-modal';
import {ChevronDown} from 'lucide-react-native';

type LabelType =
  | 'cooked'
  | 'prep'
  | 'ppds'
  | 'use-first'
  | 'defrost'
  | 'default';

interface LabelTypeDropdownProps {
  value: LabelType;
  onValueChange: (value: LabelType) => void;
  availableTypes?: LabelType[];
  disabled?: boolean;
}

const LabelTypeDropdown: React.FC<LabelTypeDropdownProps> = ({
  value,
  onValueChange,
  availableTypes = ['cooked', 'prep'],
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handlePress = () => {
    if (!disabled) {
      setIsVisible(true);
    }
  };

  const handleSelect = (selectedType: LabelType) => {
    onValueChange(selectedType);
    setIsVisible(false);
  };

  const formatLabelType = (type: LabelType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownButton, disabled && styles.disabled]}
        onPress={handlePress}
        disabled={disabled}>
        <Text style={styles.dropdownButtonText}>{formatLabelType(value)}</Text>
        <ChevronDown size={16} color="#666" />
      </TouchableOpacity>

      <Modal
        isVisible={isVisible}
        onBackdropPress={() => setIsVisible(false)}
        onSwipeComplete={() => setIsVisible(false)}
        swipeDirection="down"
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        animationInTiming={300}
        animationOutTiming={300}
        avoidKeyboard={false}
        coverScreen={true}
        hasBackdrop={true}
        backdropTransitionInTiming={300}
        backdropTransitionOutTiming={300}
        backdropPressToClose={true}
        deviceHeight={1000}
        deviceWidth={1000}
        hideModalContentWhileAnimating={false}
        isModalVisible={isVisible}
        onModalHide={() => {}}
        onModalShow={() => {}}
        onModalWillHide={() => {}}
        onModalWillShow={() => {}}
        propagateSwipe={false}
        scrollHorizontal={false}
        scrollOffset={0}
        scrollOffsetMax={0}
        scrollTo={() => {}}
        scrollToPosition={undefined}
        statusBarTranslucent={false}
        supportedOrientations={['portrait']}
        swipeThreshold={100}
        useNativeDriver={true}
        useNativeDriverForBackdrop={true}
        backdropColor="rgba(0,0,0,0.5)"
        panResponderThreshold={0.5}
        onBackButtonPress={() => setIsVisible(false)}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Label Type</Text>
            <View style={styles.modalHandle} />
          </View>

          <View style={styles.optionsContainer}>
            {availableTypes.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.option, value === type && styles.selectedOption]}
                onPress={() => handleSelect(type as LabelType)}>
                <Text
                  style={[
                    styles.optionText,
                    value === type && styles.selectedOptionText,
                  ]}>
                  {formatLabelType(type as LabelType)}
                </Text>
                {value === type && <View style={styles.checkmark} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.5,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  optionsContainer: {
    paddingHorizontal: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f8f9fa',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    fontWeight: '600',
    color: '#8A2BE2',
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8A2BE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LabelTypeDropdown;
