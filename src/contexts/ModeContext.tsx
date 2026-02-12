import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LabelMode = '40mm' | '80mm' | 'round';

interface ModeContextType {
  selectedMode: LabelMode | null;
  setSelectedMode: (mode: LabelMode) => Promise<void>;
  isLoading: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

const STORAGE_KEY = 'selected_label_mode';

interface ModeProviderProps {
  children: ReactNode;
}

export const ModeProvider: React.FC<ModeProviderProps> = ({children}) => {
  const [selectedMode, setSelectedModeState] = useState<LabelMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load mode from storage on mount
  useEffect(() => {
    const loadMode = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedMode && (storedMode === '40mm' || storedMode === '80mm' || storedMode === 'round')) {
          setSelectedModeState(storedMode as LabelMode);
        }
      } catch (error) {
        console.error('Error loading mode from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMode();
  }, []);

  const setSelectedMode = useCallback(async (mode: LabelMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      setSelectedModeState(mode);
    } catch (error) {
      console.error('Error saving mode to storage:', error);
      throw error;
    }
  }, []);

  const value: ModeContextType = {
    selectedMode,
    setSelectedMode,
    isLoading,
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};

// Hook to use mode context
export const useMode = (): ModeContextType => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export default ModeContext;

