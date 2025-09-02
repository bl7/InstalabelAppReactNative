declare module 'react-native' {
  import {ComponentType, ReactElement, ReactNode} from 'react';

  export interface ViewProps {
    children?: ReactNode;
    style?: any;
    [key: string]: any;
  }

  export interface TextProps {
    children?: ReactNode;
    style?: any;
    [key: string]: any;
  }

  export interface TextInputProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    keyboardType?: string;
    autoCapitalize?: string;
    autoCorrect?: boolean;
    editable?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    autoComplete?: string;
    style?: any;
    [key: string]: any;
  }

  export interface TouchableOpacityProps {
    onPress?: () => void;
    disabled?: boolean;
    style?: any;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: any;
    [key: string]: any;
  }

  export interface ImageProps {
    source: any;
    style?: any;
    resizeMode?: string;
    accessibilityLabel?: string;
    [key: string]: any;
  }

  export interface SafeAreaViewProps {
    children?: ReactNode;
    style?: any;
    [key: string]: any;
  }

  export interface StatusBarProps {
    barStyle?: string;
    backgroundColor?: string;
    [key: string]: any;
  }

  export interface AlertStatic {
    alert: (title: string, message?: string, buttons?: any[]) => void;
  }

  export interface LinkingStatic {
    openURL: (url: string) => Promise<void>;
  }

  export interface StyleSheetStatic {
    create: (styles: any) => any;
  }

  export interface PlatformStatic {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    Version: number;
    select: (config: any) => any;
  }

  export interface KeyboardEventSubscription {
    remove: () => void;
  }

  export interface KeyboardStatic {
    addListener: (
      event: 'keyboardDidShow' | 'keyboardDidHide' | string,
      listener: (...args: any[]) => void,
    ) => KeyboardEventSubscription;
  }

  export interface ScrollViewProps {
    children?: ReactNode;
    style?: any;
    refreshControl?: any;
    onScroll?: (event: any) => void;
    scrollEventThrottle?: number;
    [key: string]: any;
  }

  export interface RefreshControlProps {
    refreshing?: boolean;
    onRefresh?: () => void;
    [key: string]: any;
  }

  export interface ActivityIndicatorProps {
    size?: 'small' | 'large' | number;
    color?: string;
    style?: any;
    [key: string]: any;
  }

  export interface ModalProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    onRequestClose?: () => void;
    children?: ReactNode;
    [key: string]: any;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const TouchableOpacity: ComponentType<TouchableOpacityProps>;
  export const Image: ComponentType<ImageProps>;
  export const SafeAreaView: ComponentType<SafeAreaViewProps>;
  export const StatusBar: ComponentType<StatusBarProps>;
  export const Alert: AlertStatic;
  export const Linking: LinkingStatic;
  export const StyleSheet: StyleSheetStatic;
  export const Platform: PlatformStatic;
  export const Keyboard: KeyboardStatic;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const RefreshControl: ComponentType<RefreshControlProps>;
  export const ActivityIndicator: ComponentType<ActivityIndicatorProps>;
  export const Modal: ComponentType<ModalProps>;
}
