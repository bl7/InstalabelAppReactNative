import {Platform} from 'react-native';

/**
 * Security utilities for the print spooler
 * Provides input validation, sanitization, and security checks
 */

export interface SecurityConfig {
  maxJobSize: number;
  maxImageSize: number;
  maxQueueSize: number;
  rateLimitPerMinute: number;
  enableContentScanning: boolean;
  blockedPatterns: RegExp[];
  allowedFileTypes: string[];
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxJobSize: 5 * 1024 * 1024, // 5MB
  maxImageSize: 2 * 1024 * 1024, // 2MB
  maxQueueSize: 100,
  rateLimitPerMinute: 30,
  enableContentScanning: true,
  blockedPatterns: [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i, // Event handlers
    /eval\s*\(/i,
    /document\./i,
    /window\./i,
    /localStorage/i,
    /sessionStorage/i,
    /cookie/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /fetch\s*\(/i,
    /import\s*\(/i,
    /require\s*\(/i,
  ],
  allowedFileTypes: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'],
};

/**
 * Validate job data for security
 */
export function validateJobData(
  labelData: any,
  config: Partial<SecurityConfig> = {},
): {isValid: boolean; error?: string; warnings?: string[]} {
  const securityConfig = {...DEFAULT_SECURITY_CONFIG, ...config};
  const warnings: string[] = [];

  try {
    // Check job size
    const jobSize = JSON.stringify(labelData).length;
    if (jobSize > securityConfig.maxJobSize) {
      return {
        isValid: false,
        error: `Job size ${jobSize} bytes exceeds maximum allowed ${securityConfig.maxJobSize} bytes`,
      };
    }

    // Check for malicious content patterns
    if (securityConfig.enableContentScanning) {
      const dataString = JSON.stringify(labelData);
      for (const pattern of securityConfig.blockedPatterns) {
        if (pattern.test(dataString)) {
          return {
            isValid: false,
            error: 'Job contains potentially malicious content',
          };
        }
      }
    }

    // Validate image data if present
    if (labelData.base64Image) {
      const imageValidation = validateImageData(
        labelData.base64Image,
        securityConfig,
      );
      if (!imageValidation.isValid) {
        return imageValidation;
      }
      if (imageValidation.warnings) {
        warnings.push(...imageValidation.warnings);
      }
    }

    // Validate file paths if present
    if (labelData.imagePath) {
      const pathValidation = validateFilePath(
        labelData.imagePath,
        securityConfig,
      );
      if (!pathValidation.isValid) {
        return pathValidation;
      }
    }

    // Check for suspicious data structures
    if (labelData.function || labelData.constructor || labelData.prototype) {
      warnings.push('Job contains potentially dangerous object properties');
    }

    // Validate metadata if present
    if (labelData.metadata) {
      const metadataValidation = validateMetadata(labelData.metadata);
      if (!metadataValidation.isValid) {
        return metadataValidation;
      }
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Validate image data for security
 */
export function validateImageData(
  base64Data: string,
  config: Partial<SecurityConfig> = {},
): {isValid: boolean; error?: string; warnings?: string[]} {
  const securityConfig = {...DEFAULT_SECURITY_CONFIG, ...config};
  const warnings: string[] = [];

  try {
    // Check if it's valid base64
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      return {
        isValid: false,
        error: 'Invalid base64 image data',
      };
    }

    // Check image size
    const imageSize = Math.ceil((base64Data.length * 3) / 4);
    if (imageSize > securityConfig.maxImageSize) {
      return {
        isValid: false,
        error: `Image size ${imageSize} bytes exceeds maximum allowed ${securityConfig.maxImageSize} bytes`,
      };
    }

    // Check for suspicious patterns in base64 data
    if (
      base64Data.includes('data:text/html') ||
      base64Data.includes('data:application/')
    ) {
      return {
        isValid: false,
        error: 'Image contains potentially malicious data URI',
      };
    }

    // Check for extremely large images that might cause memory issues
    if (imageSize > 1024 * 1024) {
      // 1MB
      warnings.push('Large image detected, may impact performance');
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Image validation error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Validate file paths for security
 */
export function validateFilePath(
  filePath: string,
  config: Partial<SecurityConfig> = {},
): {isValid: boolean; error?: string} {
  try {
    // Check for path traversal attempts
    if (
      filePath.includes('..') ||
      filePath.includes('\\') ||
      filePath.includes('//')
    ) {
      return {
        isValid: false,
        error: 'Invalid file path detected',
      };
    }

    // Check file extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension && !config.allowedFileTypes?.includes(extension)) {
      return {
        isValid: false,
        error: `File type .${extension} is not allowed`,
      };
    }

    // Check for suspicious characters
    if (/[<>:"|?*]/.test(filePath)) {
      return {
        isValid: false,
        error: 'File path contains invalid characters',
      };
    }

    return {isValid: true};
  } catch (error) {
    return {
      isValid: false,
      error: `Path validation error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Validate metadata for security
 */
export function validateMetadata(metadata: any): {
  isValid: boolean;
  error?: string;
} {
  try {
    // Check for suspicious metadata properties
    const suspiciousProps = [
      'eval',
      'function',
      'constructor',
      'prototype',
      '__proto__',
    ];
    for (const prop of suspiciousProps) {
      if (prop in metadata) {
        return {
          isValid: false,
          error: `Metadata contains suspicious property: ${prop}`,
        };
      }
    }

    // Check metadata size
    const metadataSize = JSON.stringify(metadata).length;
    if (metadataSize > 1024 * 1024) {
      // 1MB limit for metadata
      return {
        isValid: false,
        error: 'Metadata size exceeds limit',
      };
    }

    return {isValid: true};
  } catch (error) {
    return {
      isValid: false,
      error: `Metadata validation error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Sanitize job data by removing potentially dangerous properties
 */
export function sanitizeJobData(labelData: any): any {
  try {
    const sanitized = {...labelData};

    // Remove potentially dangerous properties
    const dangerousProps = [
      'function',
      'constructor',
      'prototype',
      '__proto__',
      'eval',
      'Function',
      'Object',
      'Array',
      'String',
      'Number',
      'Boolean',
      'Date',
      'RegExp',
      'Error',
      'Promise',
      'Symbol',
      'Map',
      'Set',
      'WeakMap',
      'WeakSet',
      'Proxy',
      'Reflect',
    ];

    dangerousProps.forEach(prop => {
      if (prop in sanitized) {
        delete sanitized[prop];
      }
    });

    // Sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeJobData(sanitized[key]);
      }
    });

    return sanitized;
  } catch (error) {
    console.error('Error sanitizing job data:', error);
    // Return a safe fallback
    return {
      header: 'Sanitized Label',
      error: 'Data sanitization failed',
    };
  }
}

/**
 * Generate a secure checksum for data integrity
 */
export function generateSecureChecksum(data: string): string {
  try {
    let hash = 0;
    if (data.length === 0) return hash.toString();

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Add timestamp for additional security
    const timestamp = Date.now().toString();
    const combined = hash.toString() + timestamp;

    // Simple hash of combined string
    let finalHash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      finalHash = (finalHash << 5) - finalHash + char;
      finalHash = finalHash & finalHash;
    }

    return finalHash.toString(16); // Convert to hex
  } catch (error) {
    console.error('Error generating checksum:', error);
    return Date.now().toString(); // Fallback
  }
}

/**
 * Rate limiting utility
 */
export class RateLimiter {
  private requests: Map<string, {count: number; resetTime: Date}> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 30, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = new Date();
    const requestInfo = this.requests.get(identifier);

    if (!requestInfo || now >= requestInfo.resetTime) {
      // Reset or create new window
      this.requests.set(identifier, {
        count: 1,
        resetTime: new Date(now.getTime() + this.windowMs),
      });
      return true;
    }

    if (requestInfo.count >= this.maxRequests) {
      return false;
    }

    requestInfo.count++;
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const requestInfo = this.requests.get(identifier);
    if (!requestInfo) return this.maxRequests;
    return Math.max(0, this.maxRequests - requestInfo.count);
  }

  getResetTime(identifier: string): Date | null {
    const requestInfo = this.requests.get(identifier);
    return requestInfo?.resetTime || null;
  }

  clear(): void {
    this.requests.clear();
  }
}

/**
 * Memory usage monitoring utility
 */
export class MemoryMonitor {
  private snapshots: Array<{timestamp: Date; usage: number}> = [];
  private maxSnapshots: number;

  constructor(maxSnapshots: number = 100) {
    this.maxSnapshots = maxSnapshots;
  }

  recordUsage(usageBytes: number): void {
    const snapshot = {
      timestamp: new Date(),
      usage: usageBytes,
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  getAverageUsage(): number {
    if (this.snapshots.length === 0) return 0;

    const total = this.snapshots.reduce(
      (sum, snapshot) => sum + snapshot.usage,
      0,
    );
    return total / this.snapshots.length;
  }

  getPeakUsage(): number {
    if (this.snapshots.length === 0) return 0;
    return Math.max(...this.snapshots.map(s => s.usage));
  }

  getUsageTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.snapshots.length < 2) return 'stable';

    const recent = this.snapshots.slice(-10);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, s) => sum + s.usage, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, s) => sum + s.usage, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    const threshold = firstAvg * 0.1; // 10% threshold

    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  }

  clear(): void {
    this.snapshots = [];
  }
}

export default {
  validateJobData,
  validateImageData,
  validateFilePath,
  validateMetadata,
  sanitizeJobData,
  generateSecureChecksum,
  RateLimiter,
  MemoryMonitor,
  DEFAULT_SECURITY_CONFIG,
};
