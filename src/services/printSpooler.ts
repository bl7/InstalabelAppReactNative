import AsyncStorage from '@react-native-async-storage/async-storage';
import {showToast} from '../utils/toastUtils';
import {Platform} from 'react-native';

export interface PrintJob {
  id: string;
  labelData: any;
  quantity: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  status: 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  // New fields for optimized printing
  imagePath?: string; // File path instead of base64
  labelWidth?: number;
  labelHeight?: number;
  printerDPI?: number;
  // Security fields
  userId?: string;
  sessionId?: string;
  jobSize?: number; // Size in bytes
  checksum?: string; // Data integrity check
}

export interface PrintSpoolerConfig {
  maxConcurrentJobs: number;
  retryDelay: number;
  maxRetries: number;
  jobTimeout: number;
  enablePersistentStorage: boolean;
  storageKey: string;
  // Load balancing config
  maxJobSize: number; // Max job size in bytes (5MB default)
  maxQueueSize: number; // Max jobs in queue (100 default)
  rateLimitPerMinute: number; // Max jobs per minute per user (30 default)
  // Security config
  enableJobValidation: boolean;
  enableRateLimiting: boolean;
  enableChecksumValidation: boolean;
  // Memory management
  maxCompletedJobsInMemory: number; // Keep only last 50 completed jobs
  cleanupInterval: number; // Cleanup every 5 minutes
  maxImageSize: number; // Max image size in bytes (2MB default)
}

// Load balancer for multiple printer instances
interface PrinterInstance {
  id: string;
  name: string;
  isHealthy: boolean;
  currentLoad: number;
  maxLoad: number;
  lastHealthCheck: Date;
  connectionType: 'bluetooth' | 'network' | 'usb';
  address: string;
}

// Rate limiting per user
interface RateLimitInfo {
  userId: string;
  jobCount: number;
  resetTime: Date;
}

// Memory usage tracking
interface MemoryUsage {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  estimatedMemoryUsage: number; // in bytes
  lastCleanup: Date;
}

class PrintSpooler {
  private queue: PrintJob[] = [];
  private activeJobs: Set<string> = new Set();
  private isProcessing = false;
  private config: PrintSpoolerConfig;
  private printFunction: (labelData: any) => Promise<void>;
  private isInitialized = false;

  // Load balancing
  private printerInstances: Map<string, PrinterInstance> = new Map();
  private currentPrinterIndex = 0;

  // Security and rate limiting
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();
  private jobValidationCache: Set<string> = new Set(); // Prevent duplicate jobs

  // Memory management
  private memoryUsage: MemoryUsage = {
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    estimatedMemoryUsage: 0,
    lastCleanup: new Date(),
  };

  // Cleanup timers
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    printFunction: (labelData: any) => Promise<void>,
    config: Partial<PrintSpoolerConfig> = {},
  ) {
    this.printFunction = printFunction;
    this.config = {
      maxConcurrentJobs: 3, // Increased for load balancing
      retryDelay: 2000, // 2 seconds
      maxRetries: 3,
      jobTimeout: 30000, // 30 seconds
      enablePersistentStorage: true,
      storageKey: 'print_queue',
      // Load balancing defaults
      maxJobSize: 5 * 1024 * 1024, // 5MB
      maxQueueSize: 100,
      rateLimitPerMinute: 30,
      // Security defaults
      enableJobValidation: true,
      enableRateLimiting: true,
      enableChecksumValidation: true,
      // Memory management defaults
      maxCompletedJobsInMemory: 50,
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      maxImageSize: 2 * 1024 * 1024, // 2MB
      ...config,
    };

    // Initialize persistent storage
    this.initializePersistentStorage();

    // Start cleanup and health check timers
    this.startMaintenanceTimers();
  }

  /**
   * Start maintenance timers for cleanup and health checks
   */
  private startMaintenanceTimers(): void {
    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, this.config.cleanupInterval);

    // Health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, 60000); // Every minute
  }

  /**
   * Stop maintenance timers
   */
  private stopMaintenanceTimers(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Add a printer instance for load balancing
   */
  addPrinterInstance(
    id: string,
    name: string,
    connectionType: 'bluetooth' | 'network' | 'usb',
    address: string,
    maxLoad: number = 5,
  ): void {
    this.printerInstances.set(id, {
      id,
      name,
      isHealthy: true,
      currentLoad: 0,
      maxLoad,
      lastHealthCheck: new Date(),
      connectionType,
      address,
    });
    console.log(`🖨️ Added printer instance: ${name} (${connectionType})`);
  }

  /**
   * Remove a printer instance
   */
  removePrinterInstance(id: string): boolean {
    return this.printerInstances.delete(id);
  }

  /**
   * Get the next available printer for load balancing
   */
  private getNextAvailablePrinter(): PrinterInstance | null {
    if (this.printerInstances.size === 0) {
      return null;
    }

    const availablePrinters = Array.from(this.printerInstances.values())
      .filter(
        printer => printer.isHealthy && printer.currentLoad < printer.maxLoad,
      )
      .sort((a, b) => a.currentLoad - b.currentLoad);

    if (availablePrinters.length === 0) {
      return null;
    }

    return availablePrinters[0];
  }

  /**
   * Update printer health status
   */
  updatePrinterHealth(
    id: string,
    isHealthy: boolean,
    currentLoad: number,
  ): void {
    const printer = this.printerInstances.get(id);
    if (printer) {
      printer.isHealthy = isHealthy;
      printer.currentLoad = currentLoad;
      printer.lastHealthCheck = new Date();
    }
  }

  /**
   * Perform health checks on all printer instances
   */
  private performHealthChecks(): void {
    const now = new Date();
    const unhealthyThreshold = 5 * 60 * 1000; // 5 minutes

    this.printerInstances.forEach((printer, id) => {
      const timeSinceLastCheck =
        now.getTime() - printer.lastHealthCheck.getTime();
      if (timeSinceLastCheck > unhealthyThreshold) {
        printer.isHealthy = false;
        console.warn(
          `⚠️ Printer ${printer.name} marked as unhealthy due to no health check`,
        );
      }
    });
  }

  /**
   * Validate job data for security
   */
  private validateJobData(
    labelData: any,
    userId?: string,
  ): {isValid: boolean; error?: string} {
    // Check job size
    const jobSize = JSON.stringify(labelData).length;
    if (jobSize > this.config.maxJobSize) {
      return {
        isValid: false,
        error: `Job size ${jobSize} bytes exceeds maximum allowed ${this.config.maxJobSize} bytes`,
      };
    }

    // Check image size if present
    if (labelData.base64Image) {
      const imageSize = Math.ceil((labelData.base64Image.length * 3) / 4);
      if (imageSize > this.config.maxImageSize) {
        return {
          isValid: false,
          error: `Image size ${imageSize} bytes exceeds maximum allowed ${this.config.maxImageSize} bytes`,
        };
      }
    }

    // Check for malicious content patterns
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
    ];

    const dataString = JSON.stringify(labelData);
    for (const pattern of maliciousPatterns) {
      if (pattern.test(dataString)) {
        return {
          isValid: false,
          error: 'Job contains potentially malicious content',
        };
      }
    }

    // Check rate limiting
    if (this.config.enableRateLimiting && userId) {
      const rateLimitInfo = this.rateLimitMap.get(userId);
      const now = new Date();

      if (rateLimitInfo && now < rateLimitInfo.resetTime) {
        if (rateLimitInfo.jobCount >= this.config.rateLimitPerMinute) {
          return {
            isValid: false,
            error:
              'Rate limit exceeded. Please wait before submitting more jobs.',
          };
        }
      }
    }

    return {isValid: true};
  }

  /**
   * Update rate limiting for a user
   */
  private updateRateLimit(userId: string): void {
    if (!this.config.enableRateLimiting) return;

    const now = new Date();
    const resetTime = new Date(now.getTime() + 60000); // 1 minute from now

    const currentInfo = this.rateLimitMap.get(userId);
    if (currentInfo && now < currentInfo.resetTime) {
      currentInfo.jobCount++;
    } else {
      this.rateLimitMap.set(userId, {
        userId,
        jobCount: 1,
        resetTime,
      });
    }
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: string): string {
    let hash = 0;
    if (data.length === 0) return hash.toString();

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString();
  }

  /**
   * Initialize persistent storage and load existing jobs
   */
  private async initializePersistentStorage(): Promise<void> {
    if (!this.config.enablePersistentStorage) {
      this.isInitialized = true;
      return;
    }

    try {
      console.log('🔄 Initializing persistent print queue storage...');

      const storedQueue = await AsyncStorage.getItem(this.config.storageKey);
      if (storedQueue) {
        const parsedQueue = JSON.parse(storedQueue);

        // Convert stored jobs back to PrintJob objects
        this.queue = parsedQueue.map((jobData: any) => ({
          ...jobData,
          createdAt: new Date(jobData.createdAt),
          status: jobData.status === 'printing' ? 'pending' : jobData.status, // Reset printing jobs
        }));

        console.log(
          `📋 Loaded ${this.queue.length} jobs from persistent storage`,
        );

        // Resume processing if there are pending jobs
        if (this.queue.length > 0) {
          console.log('🔄 Resuming print queue processing...');
          setTimeout(() => this.processQueue(), 1000);
        }
      }

      this.isInitialized = true;
      console.log('✅ Persistent storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize persistent storage:', error);
      this.isInitialized = true; // Continue without persistence
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueueToStorage(): Promise<void> {
    if (!this.config.enablePersistentStorage || !this.isInitialized) {
      return;
    }

    try {
      const queueData = JSON.stringify(this.queue);
      await AsyncStorage.setItem(this.config.storageKey, queueData);
    } catch (error) {
      console.error('❌ Failed to save queue to storage:', error);
    }
  }

  /**
   * Add a job to the queue with enhanced security and validation
   */
  addJob(
    labelData: any,
    quantity: number = 1,
    priority: 'high' | 'normal' | 'low' = 'normal',
    userId?: string,
    sessionId?: string,
  ): string {
    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error(
        `Queue is full. Maximum ${this.config.maxQueueSize} jobs allowed.`,
      );
    }

    // Validate job data
    if (this.config.enableJobValidation) {
      const validation = this.validateJobData(labelData, userId);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    // Update rate limiting
    if (userId) {
      this.updateRateLimit(userId);
    }

    const jobId = `print_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Generate checksum for data integrity
    const dataString = JSON.stringify(labelData);
    const checksum = this.generateChecksum(dataString);

    // Optimize label data for native processing
    const optimizedLabelData = this.optimizeLabelData(labelData);

    const job: PrintJob = {
      id: jobId,
      labelData: optimizedLabelData,
      quantity,
      priority,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
      status: 'pending',
      // Add optimized fields
      imagePath: optimizedLabelData.imagePath,
      labelWidth: optimizedLabelData.labelWidth,
      labelHeight: optimizedLabelData.labelHeight,
      printerDPI: 203, // Standard thermal printer DPI
      // Security fields
      userId,
      sessionId,
      jobSize: dataString.length,
      checksum,
    };

    // Insert based on priority
    if (priority === 'high') {
      this.queue.unshift(job);
    } else if (priority === 'low') {
      this.queue.push(job);
    } else {
      // Insert normal priority jobs after high priority jobs
      const highPriorityCount = this.queue.filter(
        j => j.priority === 'high',
      ).length;
      this.queue.splice(highPriorityCount, 0, job);
    }

    // Update memory usage tracking
    this.updateMemoryUsage();

    console.log(
      `📋 Added print job ${jobId} to queue. Queue length: ${this.queue.length}`,
    );

    // Save to persistent storage
    this.saveQueueToStorage();

    // Start processing if not already running
    this.processQueue();

    return jobId;
  }

  /**
   * Update memory usage tracking
   */
  private updateMemoryUsage(): void {
    this.memoryUsage.totalJobs = this.queue.length;
    this.memoryUsage.activeJobs = this.activeJobs.size;
    this.memoryUsage.completedJobs = this.queue.filter(
      job => job.status === 'completed',
    ).length;
    this.memoryUsage.failedJobs = this.queue.filter(
      job => job.status === 'failed',
    ).length;

    // Estimate memory usage (rough calculation)
    let estimatedBytes = 0;
    this.queue.forEach(job => {
      estimatedBytes += job.jobSize || 0;
      if (job.labelData.base64Image) {
        estimatedBytes += (job.labelData.base64Image.length * 3) / 4; // Base64 to binary
      }
    });

    this.memoryUsage.estimatedMemoryUsage = estimatedBytes;
  }

  /**
   * Optimize label data for native processing with memory management
   */
  private optimizeLabelData(labelData: any): any {
    const optimized = {...labelData};

    // If we have base64 image data, save it to native storage
    if (optimized.base64Image && optimized.type === 'image') {
      try {
        // Generate filename
        const filename = `label_${Date.now()}.png`;

        // Save image to native storage (this will be handled by the native module)
        optimized.imagePath = filename;
        optimized.nativeImageData = optimized.base64Image; // Keep for native processing

        // Remove base64 from JS memory to reduce memory usage
        delete optimized.base64Image;

        console.log('🖼️ Optimized image data for native processing');
      } catch (error) {
        console.error('❌ Failed to optimize image data:', error);
      }
    }

    return optimized;
  }

  /**
   * Remove a job from the queue
   */
  removeJob(jobId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(job => job.id !== jobId);
    const removed = initialLength !== this.queue.length;

    if (removed) {
      console.log(`🗑️ Removed print job ${jobId} from queue`);
      this.updateMemoryUsage();
      this.saveQueueToStorage();
    }

    return removed;
  }

  /**
   * Get queue status with enhanced information
   */
  getQueueStatus() {
    return {
      totalJobs: this.queue.length,
      activeJobs: this.activeJobs.size,
      pendingJobs: this.queue.filter(job => job.status === 'pending').length,
      failedJobs: this.queue.filter(job => job.status === 'failed').length,
      isProcessing: this.isProcessing,
      isInitialized: this.isInitialized,
      // Load balancing info
      availablePrinters: Array.from(this.printerInstances.values()).filter(
        p => p.isHealthy,
      ).length,
      totalPrinters: this.printerInstances.size,
      // Memory usage
      memoryUsage: this.memoryUsage,
      // Security info
      rateLimitEnabled: this.config.enableRateLimiting,
      jobValidationEnabled: this.config.enableJobValidation,
    };
  }

  /**
   * Get all jobs
   */
  getAllJobs(): PrintJob[] {
    return [...this.queue];
  }

  /**
   * Clear all jobs
   */
  clearQueue(): void {
    this.queue = [];
    console.log('🧹 Print queue cleared');
    this.updateMemoryUsage();
    this.saveQueueToStorage();
  }

  /**
   * Process the queue with load balancing
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log('🔄 Starting print queue processing with load balancing');

    while (
      this.queue.length > 0 &&
      this.activeJobs.size < this.config.maxConcurrentJobs
    ) {
      const job = this.queue.shift();
      if (!job) continue;

      if (job.status === 'cancelled') {
        console.log(`❌ Skipping cancelled job ${job.id}`);
        continue;
      }

      // Check if we have available printers
      const availablePrinter = this.getNextAvailablePrinter();
      if (!availablePrinter) {
        console.log('⚠️ No available printers, pausing queue processing');
        this.queue.unshift(job); // Put job back at front
        break;
      }

      this.activeJobs.add(job.id);
      this.processJob(job, availablePrinter);
    }

    this.isProcessing = false;
    console.log('⏹️ Print queue processing stopped');
  }

  /**
   * Process a single job with load balancing
   */
  private async processJob(
    job: PrintJob,
    printer: PrinterInstance,
  ): Promise<void> {
    console.log(
      `🖨️ Processing print job ${job.id} (quantity: ${job.quantity}) on printer ${printer.name}`,
    );

    // Update printer load
    printer.currentLoad++;

    job.status = 'printing';
    this.saveQueueToStorage();

    try {
      // Process each label in the quantity
      for (let i = 0; i < job.quantity; i++) {
        // Check if job should be stopped
        if (job.status !== 'printing') {
          console.log(
            `❌ Job ${job.id} was stopped during processing (status: ${job.status})`,
          );
          break;
        }

        console.log(
          `🖨️ Printing label ${i + 1}/${job.quantity} for job ${job.id} on ${
            printer.name
          }`,
        );

        // Set a timeout for the print operation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('Print timeout')),
            this.config.jobTimeout,
          );
        });

        // Execute the print with timeout using optimized method
        try {
          await Promise.race([
            this.printOptimized(job.labelData, printer),
            timeoutPromise,
          ]);
          console.log(
            `✅ Print function completed successfully for label ${i + 1}`,
          );
        } catch (printError) {
          console.error(
            `❌ Print function failed for label ${i + 1}:`,
            printError,
          );
          throw printError; // Re-throw to trigger retry logic
        }

        // Log the print action if metadata is available
        if (job.labelData.metadata) {
          try {
            const {apiService} = require('../services/api');
            await apiService.logPrintAction({
              labelType: job.labelData.metadata.labelType,
              itemId: job.labelData.metadata.itemId,
              itemName: job.labelData.metadata.itemName,
              quantity: 1, // Log each individual print
              expiryDate: job.labelData.metadata.expiryDate,
              initial: job.labelData.metadata.initial,
              labelHeight: job.labelData.metadata.labelHeight,
              printerUsed: printer.name,
              sessionId: job.sessionId,
            });
          } catch (logError) {
            console.warn('Failed to log print action:', logError);
            // Continue printing even if logging fails
          }
        }

        // Small delay between prints to prevent buffer overflow
        if (i < job.quantity - 1) {
          await new Promise(resolve =>
            setTimeout(() => resolve(undefined), 500),
          );
        }
      }

      job.status = 'completed';
      console.log(
        `✅ Print job ${job.id} completed successfully on ${printer.name}`,
      );
      this.saveQueueToStorage();
    } catch (error) {
      console.error(`❌ Print job ${job.id} failed:`, error);

      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.retryCount++;

      if (job.retryCount < job.maxRetries) {
        console.log(
          `🔄 Retrying job ${job.id} (attempt ${job.retryCount + 1}/${
            job.maxRetries
          })`,
        );

        // Re-add to queue with delay
        setTimeout(() => {
          job.status = 'pending';
          this.queue.unshift(job); // Add to front for retry
          this.saveQueueToStorage();
          this.processQueue();
        }, this.config.retryDelay);
      } else {
        job.status = 'failed';
        console.error(
          `💥 Print job ${job.id} failed after ${job.maxRetries} attempts`,
        );
        this.saveQueueToStorage();

        // Show error to user
        showToast.error(
          'Print Error',
          `Failed to print "${job.labelData.header || 'label'}" after ${
            job.maxRetries
          } attempts. Please check your printer connection.`,
        );
      }
    } finally {
      // Update printer load
      printer.currentLoad = Math.max(0, printer.currentLoad - 1);

      this.activeJobs.delete(job.id);
      this.updateMemoryUsage();

      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Optimized printing method that uses native image processing with load balancing
   */
  private async printOptimized(
    labelData: any,
    printer: PrinterInstance,
  ): Promise<void> {
    try {
      // Import PrintBridge for native methods
      const {PrintBridge} = require('react-native').NativeModules;

      if (labelData.type === 'image' && labelData.nativeImageData) {
        // Use native image processing
        console.log(
          `🖼️ Using native image processing for printing on ${printer.name}`,
        );

        try {
          // Save image to native storage
          const filename = labelData.imagePath || `label_${Date.now()}.png`;
          const imagePath = await new Promise<string>((resolve, reject) => {
            PrintBridge.saveLabelImage(labelData.nativeImageData, filename, {
              resolve,
              reject,
            });
          });

          // Print using native image processing
          await new Promise<void>((resolve, reject) => {
            PrintBridge.printImageFromFile(
              imagePath,
              labelData.labelWidth || 60,
              labelData.labelHeight || 40,
              {
                resolve,
                reject,
              },
            );
          });

          console.log(`✅ Native image printing completed on ${printer.name}`);
        } catch (nativeError) {
          console.error(
            `❌ Native image processing failed on ${printer.name}:`,
            nativeError,
          );
          throw nativeError; // Re-throw to trigger fallback
        }
      } else {
        // Fallback to original print function for text-based labels
        console.log(`📝 Using text-based printing on ${printer.name}`);
        await this.printFunction(labelData);
      }
    } catch (error) {
      console.error(`❌ Optimized printing failed on ${printer.name}:`, error);

      // Fallback to original print function
      console.log(
        `🔄 Falling back to original print function on ${printer.name}`,
      );
      await this.printFunction(labelData);
    }
  }

  /**
   * Perform memory cleanup to prevent memory leaks
   */
  private performMemoryCleanup(): void {
    console.log('🧹 Performing memory cleanup...');

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Remove old completed and failed jobs
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(job => {
      const shouldKeep =
        job.status === 'pending' ||
        job.status === 'printing' ||
        job.createdAt > cutoffTime;
      return shouldKeep;
    });

    const removed = initialLength - this.queue.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old jobs`);
    }

    // Clean up rate limiting data older than 1 hour
    const rateLimitCutoff = new Date(now.getTime() - 60 * 60 * 1000);
    for (const [userId, info] of this.rateLimitMap.entries()) {
      if (info.resetTime < rateLimitCutoff) {
        this.rateLimitMap.delete(userId);
      }
    }

    // Clean up validation cache
    this.jobValidationCache.clear();

    // Update memory usage
    this.updateMemoryUsage();
    this.memoryUsage.lastCleanup = now;

    // Save to storage
    this.saveQueueToStorage();

    console.log(
      `🧹 Memory cleanup completed. Current memory usage: ${(
        this.memoryUsage.estimatedMemoryUsage /
        1024 /
        1024
      ).toFixed(2)} MB`,
    );
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isProcessing = false;
    console.log('⏸️ Print queue processing paused');
  }

  /**
   * Resume processing
   */
  resume(): void {
    console.log('▶️ Resuming print queue processing');
    this.processQueue();
  }

  /**
   * Cancel a specific job
   */
  cancelJob(jobId: string): boolean {
    const job = this.queue.find(j => j.id);
    if (job) {
      job.status = 'cancelled';
      console.log(`❌ Cancelled print job ${jobId}`);
      this.updateMemoryUsage();
      this.saveQueueToStorage();
      return true;
    }
    return false;
  }

  /**
   * Cancel all jobs
   */
  cancelAllJobs(): void {
    this.queue.forEach(job => {
      job.status = 'cancelled';
    });
    console.log('❌ Cancelled all print jobs');
    this.updateMemoryUsage();
    this.saveQueueToStorage();
  }

  /**
   * Clean up completed and failed jobs
   */
  cleanupOldJobs(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const initialLength = this.queue.length;

    this.queue = this.queue.filter(job => {
      const shouldKeep =
        job.status === 'pending' ||
        job.status === 'printing' ||
        job.createdAt > cutoffTime;
      return shouldKeep;
    });

    const removed = initialLength - this.queue.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old jobs`);
      this.updateMemoryUsage();
      this.saveQueueToStorage();
    }
  }

  /**
   * Get detailed system information
   */
  getSystemInfo() {
    return {
      config: this.config,
      printerInstances: Array.from(this.printerInstances.values()),
      memoryUsage: this.memoryUsage,
      rateLimits: Array.from(this.rateLimitMap.values()),
      queueStats: {
        total: this.queue.length,
        byPriority: {
          high: this.queue.filter(j => j.priority === 'high').length,
          normal: this.queue.filter(j => j.priority === 'normal').length,
          low: this.queue.filter(j => j.priority === 'low').length,
        },
        byStatus: {
          pending: this.queue.filter(j => j.status === 'pending').length,
          printing: this.queue.filter(j => j.status === 'printing').length,
          completed: this.queue.filter(j => j.status === 'completed').length,
          failed: this.queue.filter(j => j.status === 'failed').length,
          cancelled: this.queue.filter(j => j.status === 'cancelled').length,
        },
      },
    };
  }

  /**
   * Cleanup method to prevent memory leaks
   */
  destroy(): void {
    console.log('🗑️ Destroying print spooler...');

    // Stop timers
    this.stopMaintenanceTimers();

    // Clear queues and data
    this.queue = [];
    this.activeJobs.clear();
    this.printerInstances.clear();
    this.rateLimitMap.clear();
    this.jobValidationCache.clear();

    // Clear persistent storage
    if (this.config.enablePersistentStorage) {
      AsyncStorage.removeItem(this.config.storageKey).catch(console.error);
    }

    console.log('✅ Print spooler destroyed');
  }
}

export default PrintSpooler;
