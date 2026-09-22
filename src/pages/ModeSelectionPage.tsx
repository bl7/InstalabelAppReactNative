import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
} from 'react-native';
import {FileText, Printer} from 'lucide-react-native';
import {useMode} from '../contexts/ModeContext';
import {LabelMode} from '../contexts/ModeContext';

const ModeSelectionPage: React.FC = () => {
  const {setSelectedMode} = useMode();

  const handleModeSelect = async (mode: LabelMode) => {
    try {
      await setSelectedMode(mode);
    } catch (error) {
      console.error('Error selecting mode:', error);
    }
  };

  const modes = [
    {
      id: '40mm' as LabelMode,
      title: '40mm Labels',
      description: 'Access to Labels, Bulk, Logs, Settings, and Custom tabs',
      icon: FileText,
      color: '#8A2BE2',
    },
    {
      id: '80mm' as LabelMode,
      title: '80mm Labels',
      description: 'Access to PPDS, Logs, Settings, and Custom tabs',
      icon: Printer,
      color: '#4CAF50',
    },
    // {
    //   id: 'round' as LabelMode,
    //   title: 'Round Labels',
    //   description: 'Access to Stickers, Logs, Settings, and Custom tabs',
    //   icon: ShieldAlert,
    //   color: '#FF9800',
    // },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8A2BE2" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Image
              source={require('../../assets/logowhite.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="InstaLabel Logo"
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>InstaLabel</Text>
            <Text style={styles.headerSubtitle}>Select Label Mode</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Choose Your Label Mode</Text>
          <Text style={styles.subtitle}>
            Select the label type you want to work with. You can switch modes anytime from Settings.
          </Text>

          <View style={styles.modesContainer}>
            {modes.map(mode => {
              const IconComponent = mode.icon;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.modeCard, {borderColor: mode.color}]}
                  onPress={() => handleModeSelect(mode.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${mode.title} mode`}>
                  <View style={[styles.modeIconContainer, {backgroundColor: `${mode.color}20`}]}>
                    <IconComponent size={32} color={mode.color} />
                  </View>
                  <Text style={[styles.modeTitle, {color: mode.color}]}>
                    {mode.title}
                  </Text>
                  <Text style={styles.modeDescription}>{mode.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8A2BE2',
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
  logoImage: {
    width: 56,
    height: 56,
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
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#8A2BE2',
  },
  formContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8A2BE2',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  modesContainer: {
    gap: 20,
  },
  modeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 120,
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ModeSelectionPage;

