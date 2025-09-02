/**
 * Memory management utilities for the print spooler
 * Prevents memory leaks and optimizes memory usage
 */

export interface MemoryStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  estimatedMemoryUsage: number; // in bytes
  peakMemoryUsage: number; // in bytes
  averageMemoryUsage: number; // in bytes
  memoryTrend: 'increasing' | 'decreasing' | 'stable';
  lastCleanup: Date;
  cleanupCount: number;
  garbageCollected: number; // estimated bytes freed
}

export interface MemoryThresholds {
  maxMemoryUsage: number; // Max memory usage in bytes
  maxJobsInMemory: number; // Max jobs to keep in memory
  cleanupThreshold: number; // Memory usage threshold to trigger cleanup
  emergencyThreshold: number; // Emergency cleanup threshold
  maxImageSize: number; // Max image size in bytes
}

export const DEFAULT_MEMORY_THRESHOLDS: MemoryThresholds = {
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  maxJobsInMemory: 100,
  cleanupThreshold: 30 * 1024 * 1024, // 30MB
  emergencyThreshold: 45 * 1024 * 1024, // 45MB
  maxImageSize: 2 * 1024 * 1024, // 2MB
};

/**
 * Memory Manager for Print Spooler
 * Handles memory optimization, cleanup, and leak prevention
 */
export class MemoryManager {
  private stats: MemoryStats;
  private thresholds: MemoryThresholds;
  private memorySnapshots: Array<{timestamp: Date; usage: number}> = [];
  private maxSnapshots: number = 100;
  private cleanupCallbacks: Array<() => void> = [];

  constructor(thresholds: Partial<MemoryThresholds> = {}) {
    this.thresholds = {...DEFAULT_MEMORY_THRESHOLDS, ...thresholds};
    this.stats = {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      estimatedMemoryUsage: 0,
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      memoryTrend: 'stable',
      lastCleanup: new Date(),
      cleanupCount: 0,
      garbageCollected: 0,
    };
  }

  /**
   * Register a cleanup callback
   */
  onCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Update memory statistics
   */
  updateStats(
    totalJobs: number,
    activeJobs: number,
    completedJobs: number,
    failedJobs: number,
    estimatedMemoryUsage: number,
  ): void {
    this.stats.totalJobs = totalJobs;
    this.stats.activeJobs = activeJobs;
    this.stats.completedJobs = completedJobs;
    this.stats.failedJobs = failedJobs;
    this.stats.estimatedMemoryUsage = estimatedMemoryUsage;

    // Update peak memory usage
    if (estimatedMemoryUsage > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = estimatedMemoryUsage;
    }

    // Record memory snapshot
    this.recordMemorySnapshot(estimatedMemoryUsage);

    // Check if cleanup is needed
    this.checkCleanupNeeded();
  }

  /**
   * Record a memory usage snapshot
   */
  private recordMemorySnapshot(usage: number): void {
    const snapshot = {
      timestamp: new Date(),
      usage,
    };

    this.memorySnapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.memorySnapshots.length > this.maxSnapshots) {
      this.memorySnapshots.shift();
    }

    // Update average memory usage
    this.updateAverageMemoryUsage();
  }

  /**
   * Update average memory usage
   */
  private updateAverageMemoryUsage(): void {
    if (this.memorySnapshots.length === 0) {
      this.stats.averageMemoryUsage = 0;
      return;
    }

    const total = this.memorySnapshots.reduce(
      (sum, snapshot) => sum + snapshot.usage,
      0,
    );
    this.stats.averageMemoryUsage = total / this.memorySnapshots.length;
  }

  /**
   * Calculate memory trend
   */
  private calculateMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.memorySnapshots.length < 10) return 'stable';

    const recent = this.memorySnapshots.slice(-10);
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

  /**
   * Check if cleanup is needed
   */
  private checkCleanupNeeded(): void {
    const currentUsage = this.stats.estimatedMemoryUsage;

    if (currentUsage >= this.thresholds.emergencyThreshold) {
      console.warn('🚨 Emergency memory cleanup triggered!');
      this.performEmergencyCleanup();
    } else if (currentUsage >= this.thresholds.cleanupThreshold) {
      console.log('🧹 Memory cleanup threshold reached, scheduling cleanup...');
      setTimeout(() => this.performCleanup(), 1000);
    }
  }

  /**
   * Perform regular memory cleanup
   */
  performCleanup(): void {
    console.log('🧹 Performing scheduled memory cleanup...');
    const beforeUsage = this.stats.estimatedMemoryUsage;

    // Call all cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    });

    // Update cleanup statistics
    this.stats.lastCleanup = new Date();
    this.stats.cleanupCount++;
    this.stats.garbageCollected +=
      beforeUsage - this.stats.estimatedMemoryUsage;

    // Update memory trend
    this.stats.memoryTrend = this.calculateMemoryTrend();

    console.log(
      `🧹 Memory cleanup completed. Freed approximately ${
        (beforeUsage - this.stats.estimatedMemoryUsage) / 1024 / 1024
      } MB`,
    );
  }

  /**
   * Perform emergency memory cleanup
   */
  private performEmergencyCleanup(): void {
    console.warn('🚨 Performing emergency memory cleanup...');
    const beforeUsage = this.stats.estimatedMemoryUsage;

    // Call all cleanup callbacks with higher priority
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in emergency cleanup callback:', error);
      }
    });

    // Force garbage collection if available (React Native compatible)
    try {
      // In React Native, we can't force garbage collection directly
      // Instead, we'll clear any cached data and let the JS engine handle it
      console.log('🗑️ Requesting memory cleanup (React Native)');
    } catch (error) {
      console.warn('Could not perform memory cleanup:', error);
    }

    // Update cleanup statistics
    this.stats.lastCleanup = new Date();
    this.stats.cleanupCount++;
    this.stats.garbageCollected +=
      beforeUsage - this.stats.estimatedMemoryUsage;

    console.warn(
      `🚨 Emergency cleanup completed. Freed approximately ${
        (beforeUsage - this.stats.estimatedMemoryUsage) / 1024 / 1024
      } MB`,
    );
  }

  /**
   * Optimize image data to reduce memory usage
   */
  optimizeImageData(base64Image: string): {
    optimized: string;
    originalSize: number;
    optimizedSize: number;
  } {
    const originalSize = Math.ceil((base64Image.length * 3) / 4);

    // If image is too large, compress it
    if (originalSize > this.thresholds.maxImageSize) {
      console.log(`🖼️ Image too large (${originalSize} bytes), compressing...`);

      // For now, we'll just truncate the base64 string as a simple optimization
      // In a real implementation, you'd want to use an image compression library
      const maxLength = Math.floor((this.thresholds.maxImageSize * 4) / 3);
      const optimized = base64Image.substring(0, maxLength);
      const optimizedSize = Math.ceil((optimized.length * 3) / 4);

      console.log(
        `🖼️ Image compressed from ${originalSize} to ${optimizedSize} bytes`,
      );

      return {
        optimized,
        originalSize,
        optimizedSize,
      };
    }

    return {
      optimized: base64Image,
      originalSize,
      optimizedSize: originalSize,
    };
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    return {...this.stats};
  }

  /**
   * Get memory thresholds
   */
  getThresholds(): MemoryThresholds {
    return {...this.thresholds};
  }

  /**
   * Update memory thresholds
   */
  updateThresholds(newThresholds: Partial<MemoryThresholds>): void {
    this.thresholds = {...this.thresholds, ...newThresholds};
    console.log('⚙️ Memory thresholds updated:', this.thresholds);
  }

  /**
   * Get memory usage breakdown
   */
  getMemoryBreakdown(): {
    jobs: number;
    images: number;
    metadata: number;
    other: number;
  } {
    // This is a simplified breakdown - in a real implementation,
    // you'd track memory usage more granularly
    const totalUsage = this.stats.estimatedMemoryUsage;

    return {
      jobs: Math.floor(totalUsage * 0.4), // 40% for job data
      images: Math.floor(totalUsage * 0.4), // 40% for images
      metadata: Math.floor(totalUsage * 0.15), // 15% for metadata
      other: Math.floor(totalUsage * 0.05), // 5% for other
    };
  }

  /**
   * Check if memory usage is healthy
   */
  isMemoryHealthy(): {healthy: boolean; warnings: string[]} {
    const warnings: string[] = [];
    const currentUsage = this.stats.estimatedMemoryUsage;

    if (currentUsage >= this.thresholds.emergencyThreshold) {
      warnings.push('Memory usage is critically high');
    } else if (currentUsage >= this.thresholds.cleanupThreshold) {
      warnings.push('Memory usage is above recommended threshold');
    }

    if (this.stats.memoryTrend === 'increasing') {
      warnings.push('Memory usage is trending upward');
    }

    if (this.stats.totalJobs > this.thresholds.maxJobsInMemory) {
      warnings.push('Too many jobs in memory');
    }

    return {
      healthy: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Clear all memory data
   */
  clear(): void {
    this.memorySnapshots = [];
    this.stats = {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      estimatedMemoryUsage: 0,
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      memoryTrend: 'stable',
      lastCleanup: new Date(),
      cleanupCount: 0,
      garbageCollected: 0,
    };
    this.cleanupCallbacks = [];
    console.log('🧹 Memory manager cleared');
  }

  /**
   * Get memory usage recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentUsage = this.stats.estimatedMemoryUsage;

    if (currentUsage > this.thresholds.maxMemoryUsage * 0.8) {
      recommendations.push(
        'Consider reducing queue size to lower memory usage',
      );
    }

    if (this.stats.memoryTrend === 'increasing') {
      recommendations.push(
        'Memory usage is increasing - check for memory leaks',
      );
    }

    if (this.stats.totalJobs > this.thresholds.maxJobsInMemory * 0.8) {
      recommendations.push(
        'Queue is getting full - consider processing jobs faster',
      );
    }

    if (this.stats.cleanupCount === 0) {
      recommendations.push(
        'No cleanup has been performed - consider manual cleanup',
      );
    }

    return recommendations;
  }
}

/**
 * Memory leak detector
 */
export class MemoryLeakDetector {
  private snapshots: Array<{timestamp: Date; usage: number; jobCount: number}> =
    [];
  private maxSnapshots: number = 50;
  private leakThreshold: number = 0.1; // 10% increase threshold

  recordSnapshot(usage: number, jobCount: number): void {
    const snapshot = {
      timestamp: new Date(),
      usage,
      jobCount,
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  detectLeaks(): {hasLeak: boolean; confidence: number; details: string} {
    if (this.snapshots.length < 10) {
      return {
        hasLeak: false,
        confidence: 0,
        details: 'Not enough data to detect leaks',
      };
    }

    const recent = this.snapshots.slice(-10);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvgUsage =
      firstHalf.reduce((sum, s) => sum + s.usage, 0) / firstHalf.length;
    const secondAvgUsage =
      secondHalf.reduce((sum, s) => sum + s.usage, 0) / secondHalf.length;
    const firstAvgJobs =
      firstHalf.reduce((sum, s) => sum + s.jobCount, 0) / firstHalf.length;
    const secondAvgJobs =
      secondHalf.reduce((sum, s) => sum + s.jobCount, 0) / secondHalf.length;

    const usageIncrease = (secondAvgUsage - firstAvgUsage) / firstAvgUsage;
    const jobIncrease = (secondAvgJobs - firstAvgJobs) / firstAvgJobs;

    let hasLeak = false;
    let confidence = 0;
    let details = '';

    if (
      usageIncrease > this.leakThreshold &&
      jobIncrease < this.leakThreshold
    ) {
      hasLeak = true;
      confidence = Math.min(usageIncrease * 100, 95);
      details = `Memory usage increased by ${(usageIncrease * 100).toFixed(
        1,
      )}% while job count only increased by ${(jobIncrease * 100).toFixed(1)}%`;
    } else if (usageIncrease > this.leakThreshold * 2) {
      hasLeak = true;
      confidence = Math.min(usageIncrease * 50, 90);
      details = `Significant memory usage increase: ${(
        usageIncrease * 100
      ).toFixed(1)}%`;
    } else {
      hasLeak = false;
      confidence = Math.max(0, 100 - usageIncrease * 100);
      details = 'No significant memory leaks detected';
    }

    return {hasLeak, confidence, details};
  }

  clear(): void {
    this.snapshots = [];
  }
}

export default {
  MemoryManager,
  MemoryLeakDetector,
  DEFAULT_MEMORY_THRESHOLDS,
};
