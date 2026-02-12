import {
  ENV,
  API_ENDPOINTS,
  HTTP_STATUS,
  INSTALABEL_ENV,
  INSTALABEL_API_ENDPOINTS,
  ERROR_MESSAGES,
} from '../config/env';
import offlineManager from '../utils/offlineManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for API responses
export interface LoginRequest {
  email: string;
  password: string;
}

// Subscription types for InstaLabel.co API
export interface SubscriptionInfo {
  status: string;
  planName: string | null;
  isTrialing: boolean;
  trialEnd: string | null;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface LoginResponse {
  token: string;
  uuid: string;
  email: string;
  name: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// Profile API types
export interface ProfileResponse {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    company_name: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
    phone: string;
    profile_picture: string;
  };
}

// New types for labels system
export interface Allergen {
  uuid: string;
  allergenName: string;
  isCustom: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Ingredient {
  ingredientID: string;
  ingredientName: string;
  allergens: {
    allergenName: string;
    uuid: string;
  }[];
  expiryDays: number;
  printedOn?: string;
}

export interface MenuItem {
  menuItemID: string;
  menuItemName: string;
  expiryDays: number;
  ingredients: {
    uuid: string;
    ingredientName: string;
  }[];
  categoryName?: string;
}

export interface MenuItemsResponse {
  data: {
    categoryName: string;
    items: MenuItem[];
  }[];
}

export interface AllergensResponse {
  data: Allergen[];
}

export interface PrintLabelRequest {
  items: PrintQueueItem[];
  labelHeight: string;
  initials: string;
}

export interface PrintQueueItem {
  uid: string;
  name: string;
  type: 'ingredients' | 'menu';
  quantity: number;
  labelType:
    | 'cooked'
    | 'prep'
    | 'ppds'
    | 'ppd'
    | 'use-first'
    | 'defrost'
    | 'default'
    | 'etc';
  expiryDate: string;
  allergens: string[];
  ingredients: string[]; // Add ingredients field to store ingredient names
  labelHeight: string;
  customExpiry?: string;
  customInitials?: string; // Add custom initials for individual items
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// New types for InstaLabel.co API
export interface LabelSetting {
  label_type: string;
  expiry_days: number;
}

export interface LabelSettingsResponse {
  settings: LabelSetting[];
}

export interface LabelInitialsResponse {
  use_initials: boolean;
  initials: string[];
}

export interface SubscriptionStatus {
  user_id: string;
  plan_id: string;
  plan_name: string;
  status:
    | 'active'
    | 'trialing'
    | 'canceled'
    | 'past_due'
    | 'unpaid'
    | 'incomplete'
    | 'incomplete_expired';
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  trial_end: string | null;
  amount: number;
  billing_interval: 'month' | 'year';
  created_at: string;
  updated_at: string;
}

export interface SubscriptionResponse {
  subscription: SubscriptionStatus | null;
}

export interface ActivityLog {
  user_id: string;
  action: string;
  details: any;
  created_at: string;
}

export interface LogsResponse {
  logs: ActivityLog[];
}

// Print label log interface
export interface PrintLabelLog {
  labelType: string;
  itemId: string;
  itemName: string;
  quantity: number;
  printedAt: string;
  expiryDate: string;
  initial?: string;
  labelHeight: string;
  printerUsed: string;
  sessionId?: string;
  selectedItems?: Array<{
    id: string;
    name: string;
    expiryDays: number;
  }>;
}

export interface LogRequest {
  action: 'print_label' | 'print_label_batch';
  details: PrintLabelLog | PrintLabelLog[];
}

// Print session grouping types
export interface PrintLog {
  id: number;
  user_id: string;
  action: string;
  details: {
    itemId: string;
    itemName: string;
    quantity: number;
    labelType: 'cooked' | 'prep' | 'ppds' | 'defrost' | 'use_first';
    printedAt: string;
    expiryDate: string;
    initial?: string;
    labelHeight?: string;
    printerUsed?: string;
    sessionId?: string;
    selectedItems?: Array<{
      id: string;
      name: string;
      expiryDays: number;
    }>;
  };
  timestamp: string;
}

export interface GroupedPrintSession {
  sessionId: string;
  timestamp: string;
  printedAt: string;
  items: PrintLog[];
  printerUsed?: string;
  initial?: string;
  labelHeight?: string;
}

// Bulk Print API Types
export interface BulkPrintList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
}

export interface BulkPrintItem {
  id: string;
  list_id: string;
  item_id: string;
  item_type: 'ingredient' | 'menu';
  item_name: string;
  quantity: number;
  label_type: string | null;
  created_at: string;
}

export interface BulkPrintListsResponse {
  lists: BulkPrintList[];
}

export interface BulkPrintListResponse {
  list: BulkPrintList;
  items?: BulkPrintItem[];
}

export interface BulkPrintItemsResponse {
  items: BulkPrintItem[];
}

export interface CreateBulkPrintListRequest {
  name: string;
  description?: string;
}

export interface UpdateBulkPrintListRequest {
  name?: string;
  description?: string;
}

export interface AddBulkPrintItemsRequest {
  items: {
    item_id: string;
    item_type: 'ingredient' | 'menu';
    item_name: string;
    quantity?: number;
    label_type?: string;
  }[];
}

export interface UpdateBulkPrintItemRequest {
  quantity?: number;
  label_type?: string;
}

// API Service Class
class ApiService {
  private baseURL: string;
  private accessToken: string | null = null;
  // Handlers to notify the app about authentication/authorization failures (401/403)
  private authErrorHandlers: Array<() => void> = [];

  constructor() {
    this.baseURL = ENV.API_BASE_URL;
  }

  // Set access token for authenticated requests
  setAccessToken(token: string) {
    this.accessToken = token;
    if (ENV.ENABLE_LOGGING) {
      console.log(
        '🔑 Token set in API service:',
        token.substring(0, 20) + '...',
      );
    }
  }

  // Get access token
  getAccessToken(): string | null {
    if (ENV.ENABLE_LOGGING) {
      console.log(
        '🔍 Getting access token:',
        this.accessToken ? this.accessToken.substring(0, 20) + '...' : 'null',
      );
    }
    return this.accessToken;
  }

  // Validate if current token is still valid
  async validateToken(): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    try {
      await this.request<{valid: boolean}>(API_ENDPOINTS.AUTH.VALIDATE_TOKEN, {
        method: 'GET',
      });
      return true;
    } catch (error) {
      console.warn('Token validation failed:', error);
      return false;
    }
  }

  // Validate a specific token
  async validateSpecificToken(token: string): Promise<TokenValidationResponse> {
    try {
      const response = await this.request<TokenValidationResponse>(
        API_ENDPOINTS.AUTH.VALIDATE_TOKEN,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return response;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }
  }

  // Clear access token
  clearAccessToken() {
    this.accessToken = null;
  }

  // Register a handler to be called on 401/403 responses
  onAuthError(handler: () => void) {
    this.authErrorHandlers.push(handler);
  }

  // Unregister a previously registered handler
  offAuthError(handler: () => void) {
    this.authErrorHandlers = this.authErrorHandlers.filter(h => h !== handler);
  }

  private notifyAuthError() {
    try {
      this.authErrorHandlers.forEach(h => {
        try {
          h();
        } catch {}
      });
    } catch {}
  }

  // Generic HTTP request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customBaseURL?: string,
  ): Promise<T> {
    const baseURL = customBaseURL || this.baseURL;
    const url = `${baseURL}${endpoint}`;

    // Debug: Log request details
    if (ENV.ENABLE_LOGGING) {
      console.log('🔍 request method - Debug info:');
      console.log('🔍 Endpoint:', endpoint);
      console.log('🔍 Custom base URL:', customBaseURL);
      console.log('🔍 Final base URL:', baseURL);
      console.log('🔍 Final URL:', url);
      console.log('🔍 Current token exists:', !!this.accessToken);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Merge custom headers if provided
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Add authorization header if token exists
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
      if (ENV.ENABLE_LOGGING) {
        console.log(
          '🔐 Adding Authorization header with token:',
          this.accessToken.substring(0, 20) + '...',
        );
        console.log('🔐 Full Authorization header:', headers.Authorization);
        console.log('🔐 Base URL being used:', baseURL);
        console.log('🔐 Full URL:', url);
      }
    } else {
      if (ENV.ENABLE_LOGGING) {
        console.log('⚠️ No access token available for request');
        console.log('⚠️ Base URL being used:', baseURL);
        console.log('⚠️ Full URL:', url);
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      if (ENV.ENABLE_LOGGING) {
        console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
        console.log('🌐 Headers being sent:', JSON.stringify(headers, null, 2));
        console.log('🌐 Full request config:', JSON.stringify(config, null, 2));
      }

      const response = await fetch(url, config);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        if (ENV.ENABLE_LOGGING) {
          console.log(`📡 Non-JSON Response:`, textResponse.substring(0, 200));
        }
        throw {
          message: `Server returned non-JSON response: ${contentType}`,
          status: response.status,
          code: 'INVALID_RESPONSE',
        } as ApiError;
      }

      const responseData = await response.json();

      if (ENV.ENABLE_LOGGING) {
        // console.log(`📡 API Response:`, responseData);
      }

      // Handle HTTP errors
      if (!response.ok) {
        const error: ApiError = {
          message: responseData.message || 'An error occurred',
          status: response.status,
          code: responseData.code,
        };

        // Handle specific status codes
        switch (response.status) {
          case HTTP_STATUS.UNAUTHORIZED:
            error.message = 'Invalid credentials or session expired';
            // Proactively notify listeners to handle logout
            this.notifyAuthError();
            break;
          case HTTP_STATUS.FORBIDDEN:
            error.message = 'Access denied';
            // Notify as well; callers may choose to keep offline or logout
            this.notifyAuthError();
            break;
          case HTTP_STATUS.NOT_FOUND:
            error.message = 'Resource not found';
            break;
          case HTTP_STATUS.INTERNAL_SERVER_ERROR:
            error.message = 'Server error, please try again later';
            break;
        }

        throw error;
      }

      return responseData;
    } catch (error: unknown) {
      if (ENV.ENABLE_LOGGING) {
        console.error('❌ API Error:', error);
        if (error && typeof error === 'object' && 'message' in error) {
          console.error('❌ Error details:', {
            message: (error as any).message,
            status: (error as any).status,
            code: (error as any).code,
            stack: (error as any).stack,
          });
        }
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw {
          message: 'Network error. Please check your internet connection.',
          status: 0,
          code: 'NETWORK_ERROR',
        } as ApiError;
      }

      // Re-throw API errors
      throw error;
    }
  }

  // User authentication
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<void> {
    return this.request<void>(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
    });
  }

  // New methods for labels system
  async getIngredients(): Promise<Ingredient[]> {
    try {
      // Check if online
      if (offlineManager.isOnline()) {
        const response = await this.request<{
          message: string;
          data: Ingredient[];
        }>(API_ENDPOINTS.INGREDIENTS.GET_ALL, {
          method: 'GET',
        });

        // Cache the fresh data
        await offlineManager.cacheIngredients(response.data);
        return response.data;
      } else {
        // Offline: return cached data
        const cachedData = await offlineManager.getCachedIngredients();
        if (cachedData) {
          console.log('Using cached ingredients data (offline mode)');
          return cachedData;
        } else {
          throw new Error('No cached ingredients data available');
        }
      }
    } catch (error) {
      // If online request fails, try cached data
      if (offlineManager.isOnline()) {
        console.log('Online request failed, trying cached data...');
        const cachedData = await offlineManager.getCachedIngredients();
        if (cachedData) {
          return cachedData;
        }
      }
      throw error;
    }
  }

  async getMenuItems(): Promise<MenuItem[]> {
    try {
      // Check if online
      if (offlineManager.isOnline()) {
        const response = await this.request<MenuItemsResponse>(
          API_ENDPOINTS.MENU_ITEMS.GET_ALL,
          {
            method: 'GET',
          },
        );

        if (response && response.data) {
          const menuItems: MenuItem[] = [];

          // Extract items from all categories
          response.data.forEach(category => {
            if (category.items && Array.isArray(category.items)) {
              category.items.forEach(item => {
                menuItems.push({
                  menuItemID: item.menuItemID,
                  menuItemName: item.menuItemName,
                  expiryDays: item.expiryDays || 7,
                  ingredients: item.ingredients || [],
                  categoryName: category.categoryName,
                });
              });
            }
          });

          // Cache the fresh data
          await offlineManager.cacheMenuItems(menuItems);
          return menuItems;
        }

        return [];
      } else {
        // Offline: return cached data
        const cachedData = await offlineManager.getCachedMenuItems();
        if (cachedData) {
          console.log('Using cached menu items data (offline mode)');
          return cachedData;
        } else {
          throw new Error('No cached menu items data available');
        }
      }
    } catch (error) {
      // If online request fails, try cached data
      if (offlineManager.isOnline()) {
        console.log('Online request failed, trying cached data...');
        const cachedData = await offlineManager.getCachedMenuItems();
        if (cachedData) {
          return cachedData;
        }
      }
      throw error;
    }
  }

  async getAllergens(): Promise<Allergen[]> {
    const response = await this.request<AllergensResponse>(
      API_ENDPOINTS.ALLERGENS.GET_ALL,
      {
        method: 'GET',
      },
    );

    if (response && response.data) {
      return response.data;
    }

    return [];
  }

  // NEW: Label Settings methods using InstaLabel.co API
  async getLabelSettings(): Promise<LabelSettingsResponse> {
    const response = await this.request<LabelSettingsResponse>(
      INSTALABEL_API_ENDPOINTS.LABEL_SETTINGS.GET,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL, // Use different base URL
    );
    return response;
  }

  async getLabelInitials(): Promise<LabelInitialsResponse> {
    const response = await this.request<LabelInitialsResponse>(
      INSTALABEL_API_ENDPOINTS.LABEL_INITIALS.GET,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL,
    );

    if (response && response.use_initials !== undefined) {
      return response;
    }

    return {use_initials: false, initials: []};
  }

  // Update label settings
  async updateLabelSettings(
    userId: string,
    settings: LabelSetting[],
  ): Promise<{success: boolean; message: string}> {
    const response = await this.request<{success: boolean; message: string}>(
      INSTALABEL_API_ENDPOINTS.LABEL_SETTINGS.PUT,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          settings: settings,
        }),
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  // Update label initials
  async updateLabelInitials(
    userId: string,
    useInitials: boolean,
    initials: string[],
  ): Promise<{success: boolean; message: string}> {
    const response = await this.request<{success: boolean; message: string}>(
      INSTALABEL_API_ENDPOINTS.LABEL_INITIALS.PUT,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          use_initials: useInitials,
          initials: initials,
        }),
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  // Get user profile including company name
  async getProfile(userId: string): Promise<ProfileResponse> {
    try {
      console.log('🌐 getProfile called with userId:', userId);
      console.log(
        '🌐 Profile API URL:',
        `${INSTALABEL_API_ENDPOINTS.PROFILE.GET}?user_id=${userId}`,
      );
      console.log('🌐 Using base URL:', INSTALABEL_ENV.API_BASE_URL);
      console.log('🔑 Access token available:', !!this.accessToken);

      const response = await this.request<ProfileResponse>(
        `${INSTALABEL_API_ENDPOINTS.PROFILE.GET}?user_id=${userId}`,
        {
          method: 'GET',
        },
        INSTALABEL_ENV.API_BASE_URL,
      );

      // Log the completely raw, unmapped response
      console.log(
        '🔥 RAW FETCH RESPONSE (unmapped):',
        JSON.stringify(response, null, 2),
      );
      console.log('🔥 Raw response type:', typeof response);
      console.log('🔥 Raw response constructor:', response?.constructor?.name);
      console.log(
        '🔥 Raw response is null/undefined:',
        response === null || response === undefined,
      );
      console.log(
        '🔥 Raw response keys (if object):',
        response && typeof response === 'object'
          ? Object.keys(response)
          : 'Not an object',
      );

      console.log('📡 getProfile raw response:', response);
      console.log('📡 Response type:', typeof response);
      console.log(
        '📡 Response keys:',
        response ? Object.keys(response) : 'No response',
      );

      if (response && response.profile) {
        console.log('✅ Profile data found in response');
        console.log('👤 Profile object:', response.profile);
        return response;
      } else {
        console.warn('⚠️ Profile response missing or invalid structure');
        console.warn('⚠️ Expected: { profile: { company_name: "...", ... } }');
        console.warn('⚠️ Got:', response);
        throw new Error(
          'Failed to fetch profile data - invalid response structure',
        );
      }
    } catch (error) {
      console.error('❌ getProfile error:', error);
      throw error;
    }
  }

  // NEW: Subscription status using InstaLabel.co API
  async getSubscriptionStatus(): Promise<SubscriptionResponse> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await this.request<SubscriptionResponse>(
      INSTALABEL_API_ENDPOINTS.SUBSCRIPTION.STATUS,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL, // Use different base URL
    );
    return response;
  }

  // NEW: Activity logs using InstaLabel.co API
  async getActivityLogs(params?: {
    page?: number;
    limit?: number;
    dateFrom?: string;
    action?: string;
  }): Promise<LogsResponse> {
    // Debug: Log the current token state
    if (ENV.ENABLE_LOGGING) {
      console.log('🔍 getActivityLogs - Current token state:');
      console.log('🔍 Token exists:', !!this.accessToken);
      console.log(
        '🔍 Token length:',
        this.accessToken ? this.accessToken.length : 0,
      );
      console.log(
        '🔍 Token preview:',
        this.accessToken ? this.accessToken.substring(0, 50) + '...' : 'null',
      );
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params?.action) queryParams.append('action', params.action);

    const endpoint =
      INSTALABEL_API_ENDPOINTS.LOGS.GET +
      (queryParams.toString() ? `?${queryParams.toString()}` : '');

    const response = await this.request<LogsResponse>(
      endpoint,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL, // Use different base URL
    );
    return response;
  }

  async postActivityLog(
    logRequest: LogRequest,
  ): Promise<{success: boolean; message: string}> {
    try {
      const response = await this.request<{success: boolean; message: string}>(
        INSTALABEL_API_ENDPOINTS.LOGS.POST,
        {
          method: 'POST',
          body: JSON.stringify(logRequest),
        },
        INSTALABEL_ENV.API_BASE_URL,
      );

      if (response && response.success) {
        return {success: true, message: 'Log posted successfully'};
      } else {
        return {success: false, message: 'Failed to post log'};
      }
    } catch (error) {
      console.error('Error posting activity log:', error);
      return {success: false, message: 'Error posting log'};
    }
  }

  // Log print action with session ID
  async logPrintAction(labelData: {
    labelType: string;
    itemId: string;
    itemName: string;
    quantity: number;
    expiryDate: string;
    initial?: string;
    labelHeight: string;
    printerUsed: string;
    sessionId?: string;
    selectedItems?: Array<{
      id: string;
      name: string;
      expiryDays: number;
    }>;
  }): Promise<void> {
    try {
      const logData: PrintLabelLog = {
        labelType: labelData.labelType,
        itemId: labelData.itemId,
        itemName: labelData.itemName,
        quantity: labelData.quantity,
        printedAt: new Date().toISOString(),
        expiryDate: labelData.expiryDate,
        initial: labelData.initial,
        labelHeight: labelData.labelHeight,
        printerUsed: labelData.printerUsed,
        sessionId: labelData.sessionId,
        selectedItems: labelData.selectedItems,
      };

      const logRequest: LogRequest = {
        action: 'print_label',
        details: logData,
      };

      // Check if online
      if (offlineManager.isOnline()) {
        await this.postActivityLog(logRequest);
        console.log(
          'Print action logged successfully with sessionId:',
          labelData.sessionId,
        );
      } else {
        // Queue for offline sync
        await offlineManager.queueOfflineLog(logRequest);
        console.log(
          'Print action queued for offline sync with sessionId:',
          labelData.sessionId,
        );
      }
    } catch (error) {
      console.error('Failed to log print action:', error);

      // If online request fails, queue for offline sync
      if (offlineManager.isOnline()) {
        try {
          const logData: PrintLabelLog = {
            labelType: labelData.labelType,
            itemId: labelData.itemId,
            itemName: labelData.itemName,
            quantity: labelData.quantity,
            printedAt: new Date().toISOString(),
            expiryDate: labelData.expiryDate,
            initial: labelData.initial,
            labelHeight: labelData.labelHeight,
            printerUsed: labelData.printerUsed,
            sessionId: labelData.sessionId,
            selectedItems: labelData.selectedItems,
          };

          const logRequest: LogRequest = {
            action: 'print_label',
            details: logData,
          };

          await offlineManager.queueOfflineLog(logRequest);
          console.log(
            'Print action queued for offline sync after online failure',
          );
        } catch (queueError) {
          console.error('Failed to queue offline log:', queueError);
        }
      }

      // Don't throw error - logging failure shouldn't stop printing
    }
  }

  // Generate session ID for print sessions
  generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // Sync pending offline logs when network is restored
  async syncPendingLogs(): Promise<void> {
    try {
      const pendingLogs = await offlineManager.getPendingLogs();

      if (pendingLogs.length === 0) {
        console.log('📝 No pending logs to sync');
        return;
      }

      console.log(`📝 Syncing ${pendingLogs.length} pending logs...`);

      const successfulLogs: string[] = [];
      const failedLogs: any[] = [];

      for (const log of pendingLogs) {
        try {
          await this.postActivityLog(log);
          successfulLogs.push(log.id);
          console.log(`✅ Synced offline log: ${log.id}`);
        } catch (error) {
          console.error(`❌ Failed to sync offline log ${log.id}:`, error);
          failedLogs.push(log);
        }
      }

      // Remove successfully synced logs
      if (successfulLogs.length > 0) {
        const remainingLogs = pendingLogs.filter(
          log => !successfulLogs.includes(log.id),
        );
        await AsyncStorage.setItem(
          'offline_pending_logs',
          JSON.stringify(remainingLogs),
        );
        console.log(`✅ Successfully synced ${successfulLogs.length} logs`);
      }

      if (failedLogs.length > 0) {
        console.warn(
          `⚠️ ${failedLogs.length} logs failed to sync and will be retried later`,
        );
      }
    } catch (error) {
      console.error('Failed to sync pending logs:', error);
    }
  }

  // Bulk Print API Methods
  async getBulkPrintLists(): Promise<BulkPrintListsResponse> {
    const response = await this.request<BulkPrintListsResponse>(
      INSTALABEL_API_ENDPOINTS.BULK_PRINT.LISTS.GET_ALL,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async createBulkPrintList(
    request: CreateBulkPrintListRequest,
  ): Promise<BulkPrintListResponse> {
    const response = await this.request<BulkPrintListResponse>(
      INSTALABEL_API_ENDPOINTS.BULK_PRINT.LISTS.CREATE,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async getBulkPrintList(listId: string): Promise<BulkPrintListResponse> {
    const response = await this.request<BulkPrintListResponse>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.LISTS.GET_BY_ID}/${listId}`,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async updateBulkPrintList(
    listId: string,
    request: UpdateBulkPrintListRequest,
  ): Promise<BulkPrintListResponse> {
    const response = await this.request<BulkPrintListResponse>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.LISTS.UPDATE}/${listId}`,
      {
        method: 'PUT',
        body: JSON.stringify(request),
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async deleteBulkPrintList(listId: string): Promise<{message: string}> {
    const response = await this.request<{message: string}>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.LISTS.DELETE}/${listId}`,
      {
        method: 'DELETE',
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async getBulkPrintListItems(listId: string): Promise<BulkPrintItemsResponse> {
    const response = await this.request<BulkPrintItemsResponse>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.ITEMS.GET_BY_LIST}/${listId}/items`,
      {
        method: 'GET',
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async addBulkPrintItems(
    listId: string,
    request: AddBulkPrintItemsRequest,
  ): Promise<BulkPrintItemsResponse> {
    const response = await this.request<BulkPrintItemsResponse>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.ITEMS.ADD_TO_LIST}/${listId}/items`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async updateBulkPrintItem(
    listId: string,
    itemId: string,
    request: UpdateBulkPrintItemRequest,
  ): Promise<{item: BulkPrintItem}> {
    const response = await this.request<{item: BulkPrintItem}>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.ITEMS.UPDATE_ITEM}/${listId}/items/${itemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(request),
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }

  async deleteBulkPrintItem(
    listId: string,
    itemId: string,
  ): Promise<{message: string}> {
    const response = await this.request<{message: string}>(
      `${INSTALABEL_API_ENDPOINTS.BULK_PRINT.ITEMS.DELETE_ITEM}/${listId}/items/${itemId}`,
      {
        method: 'DELETE',
      },
      INSTALABEL_ENV.API_BASE_URL,
    );
    return response;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Subscription utility functions
export const canUserPrint = (
  subscription: SubscriptionStatus | null,
): boolean => {
  // No subscription = no printing
  if (!subscription) {
    return false;
  }

  // Only active and trialing subscriptions can print
  return subscription.status === 'active' || subscription.status === 'trialing';
};

export const getBlockedMessage = (
  subscription: SubscriptionStatus | null,
): string => {
  if (!subscription) {
    return 'Printing is disabled. Please subscribe to a plan to enable printing.';
  }

  switch (subscription.status) {
    case 'canceled':
      return 'Printing is disabled. Your subscription has been canceled.';
    case 'past_due':
    case 'unpaid':
      return 'Printing is disabled. Please update your payment method to continue printing.';
    case 'incomplete':
    case 'incomplete_expired':
      return 'Printing is disabled. Please complete your subscription setup.';
    default:
      return 'Printing is disabled due to your subscription status.';
  }
};

export const getSubscriptionInfo = (
  subscription: SubscriptionStatus | null,
): SubscriptionInfo => {
  if (!subscription) {
    return {
      status: 'no_subscription',
      planName: null,
      isTrialing: false,
      trialEnd: null,
      cancelAt: null,
      cancelAtPeriodEnd: false,
    };
  }

  return {
    status: subscription.status,
    planName: subscription.plan_name,
    isTrialing: subscription.status === 'trialing',
    trialEnd: subscription.trial_end,
    cancelAt: subscription.cancel_at,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
};

// Print session grouping utilities
export const groupPrintSessions = (
  printLogs: PrintLog[],
): GroupedPrintSession[] => {
  if (printLogs.length === 0) return [];

  const grouped: {[key: string]: PrintLog[]} = {};

  // Group logs by sessionId
  printLogs.forEach(log => {
    const sessionKey =
      log.details.sessionId ||
      `${new Date(log.timestamp).getTime()}-${
        log.details.printerUsed || 'unknown'
      }`;

    if (!grouped[sessionKey]) {
      grouped[sessionKey] = [];
    }
    grouped[sessionKey].push(log);
  });

  // Convert to GroupedPrintSession array
  const sessions: GroupedPrintSession[] = Object.entries(grouped).map(
    ([sessionId, logs]) => {
      const firstLog = logs[0];
      return {
        sessionId,
        timestamp: firstLog.timestamp,
        printedAt: firstLog.details.printedAt,
        items: logs,
        printerUsed:
          typeof firstLog.details.printerUsed === 'string'
            ? firstLog.details.printerUsed
            : (firstLog.details.printerUsed as any)?.name || 'Unknown Printer',
        initial: firstLog.details.initial,
        labelHeight: firstLog.details.labelHeight,
      };
    },
  );

  // Sort by printedAt (newest first)
  sessions.sort(
    (a, b) => new Date(b.printedAt).getTime() - new Date(a.printedAt).getTime(),
  );

  return sessions;
};

export const getItemNames = (session: GroupedPrintSession): string => {
  // If we have selectedItems in the first log, use those for more detailed info
  const firstLog = session.items[0];
  if (
    firstLog.details.selectedItems &&
    firstLog.details.selectedItems.length > 0
  ) {
    return firstLog.details.selectedItems.map(item => item.name).join(', ');
  }

  // Fallback to the original method
  return session.items.map(item => item.details.itemName).join(', ');
};

export const getTotalQuantity = (session: GroupedPrintSession): number => {
  return session.items.reduce(
    (total, item) => total + item.details.quantity,
    0,
  );
};

export const getLabelTypes = (session: GroupedPrintSession): string => {
  const types = Array.from(
    new Set(session.items.map(item => item.details.labelType)),
  );
  return types.map(type => type.toUpperCase()).join(', ');
};
