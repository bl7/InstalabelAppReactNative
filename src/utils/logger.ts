import { ENV } from '../config/env';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private isEnabled: boolean;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor() {
    this.isEnabled = ENV.ENABLE_LOGGING;
    this.logLevel = ENV.ENABLE_DEBUG ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled) return false;
    
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data,
      // In production, you would get these from your auth context
      // userId: getCurrentUserId(),
      // sessionId: getCurrentSessionId(),
    };
  }

  private addToLogs(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const context = entry.context ? `[${entry.context}]` : '';
    const data = entry.data ? ` | Data: ${JSON.stringify(entry.data)}` : '';
    
    return `${timestamp} ${entry.level.toUpperCase()} ${context} ${entry.message}${data}`;
  }

  debug(message: string, context?: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, context, data);
      this.addToLogs(entry);
      
      if (__DEV__) {
        console.log(`🐛 ${this.formatMessage(entry)}`);
      }
    }
  }

  info(message: string, context?: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, message, context, data);
      this.addToLogs(entry);
      
      if (__DEV__) {
        console.info(`ℹ️ ${this.formatMessage(entry)}`);
      }
    }
  }

  warn(message: string, context?: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, message, context, data);
      this.addToLogs(entry);
      
      if (__DEV__) {
        console.warn(`⚠️ ${this.formatMessage(entry)}`);
      }
    }
  }

  error(message: string, context?: string, data?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, message, context, data);
      this.addToLogs(entry);
      
      if (__DEV__) {
        console.error(`❌ ${this.formatMessage(entry)}`);
      }
    }
  }

  // Method to get logs for debugging or sending to external services
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    
    return filteredLogs;
  }

  // Method to clear logs
  clearLogs() {
    this.logs = [];
  }

  // Method to export logs (useful for debugging)
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Method to send logs to external service (implement as needed)
  async sendLogsToService(): Promise<void> {
    if (!ENV.ENABLE_ANALYTICS) return;
    
    try {
      // In production, implement sending logs to your logging service
      // Example: Sentry, LogRocket, or your own API
      const logs = this.getLogs();
      if (logs.length > 0) {
        // await sendLogsToAPI(logs);
        this.info('Logs sent to external service', 'Logger');
      }
    } catch (error) {
      this.error('Failed to send logs to external service', 'Logger', error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience functions
export const logDebug = (message: string, context?: string, data?: any) => 
  logger.debug(message, context, data);

export const logInfo = (message: string, context?: string, data?: any) => 
  logger.info(message, context, data);

export const logWarn = (message: string, context?: string, data?: any) => 
  logger.warn(message, context, data);

export const logError = (message: string, context?: string, data?: any) => 
  logger.error(message, context, data);

export default logger;
