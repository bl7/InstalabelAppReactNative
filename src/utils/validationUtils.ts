// Validation utilities for data integrity

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Date validation
export const validateDate = (dateString: string): ValidationResult => {
  const errors: string[] = [];

  if (!dateString) {
    errors.push('Date is required');
    return {isValid: false, errors};
  }

  // Check if it's in YYYY-MM-DD format
  const yyyyMMddRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!yyyyMMddRegex.test(dateString)) {
    errors.push('Date must be in YYYY-MM-DD format');
    return {isValid: false, errors};
  }

  // Parse the date
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    errors.push('Invalid date');
    return {isValid: false, errors};
  }

  // Check if date is in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    errors.push('Date cannot be in the past');
    return {isValid: false, errors};
  }

  return {isValid: true, errors: []};
};

// Initials validation
export const validateInitials = (initials: string): ValidationResult => {
  const errors: string[] = [];

  if (!initials) {
    errors.push('Initials are required');
    return {isValid: false, errors};
  }

  if (initials.length < 2 || initials.length > 3) {
    errors.push('Initials must be 2 or 3 characters');
    return {isValid: false, errors};
  }

  if (!/^[A-Za-z]+$/.test(initials)) {
    errors.push('Initials can only contain letters');
    return {isValid: false, errors};
  }

  return {isValid: true, errors: []};
};

// Quantity validation
export const validateQuantity = (quantity: number): ValidationResult => {
  const errors: string[] = [];

  if (!Number.isInteger(quantity)) {
    errors.push('Quantity must be a whole number');
    return {isValid: false, errors};
  }

  if (quantity < 1) {
    errors.push('Quantity must be at least 1');
    return {isValid: false, errors};
  }

  if (quantity > 100) {
    errors.push('Quantity cannot exceed 100');
    return {isValid: false, errors};
  }

  return {isValid: true, errors: []};
};

// Item name validation
export const validateItemName = (name: string): ValidationResult => {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Item name is required');
    return {isValid: false, errors};
  }

  if (name.length > 200) {
    errors.push('Item name cannot exceed 200 characters');
    return {isValid: false, errors};
  }

  // Check for potentially dangerous characters
  if (/[<>\"'&]/.test(name)) {
    errors.push('Item name contains invalid characters');
    return {isValid: false, errors};
  }

  return {isValid: true, errors: []};
};

// Email validation
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];

  if (!email) {
    errors.push('Email is required');
    return {isValid: false, errors};
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
    return {isValid: false, errors};
  }

  return {isValid: true, errors: []};
};

// Print queue item validation
export const validatePrintQueueItem = (item: any): ValidationResult => {
  const errors: string[] = [];

  // Validate name
  const nameValidation = validateItemName(item.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }

  // Validate quantity
  const quantityValidation = validateQuantity(item.quantity);
  if (!quantityValidation.isValid) {
    errors.push(...quantityValidation.errors);
  }

  // Validate expiry date
  if (item.expiryDate) {
    const dateValidation = validateDate(item.expiryDate);
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    }
  }

  // Validate label type
  const validLabelTypes = ['cooked', 'prep', 'ppds', 'use-first', 'defrost'];
  if (!validLabelTypes.includes(item.labelType)) {
    errors.push('Invalid label type');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Custom expiry validation
export const validateCustomExpiry = (
  expiryData: Record<string, string>,
): ValidationResult => {
  const errors: string[] = [];

  for (const [uid, date] of Object.entries(expiryData)) {
    if (!uid || !date) {
      errors.push(`Invalid expiry data for item ${uid}`);
      continue;
    }

    const dateValidation = validateDate(date);
    if (!dateValidation.isValid) {
      errors.push(
        `Invalid date for item ${uid}: ${dateValidation.errors.join(', ')}`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Sanitize input (removed character limit to prevent truncation)
export const sanitizeInput = (input: string): string => {
  if (!input) return '';

  // Remove potentially dangerous characters
  return input.replace(/[<>\"'&]/g, '').trim();
};

// Format validation error messages
export const formatValidationErrors = (errors: string[]): string => {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];

  return errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
};

// Validate all form data at once
export const validateForm = (
  data: Record<string, any>,
  rules: Record<string, (value: any) => ValidationResult>,
): ValidationResult => {
  const errors: string[] = [];

  for (const [field, validator] of Object.entries(rules)) {
    const value = data[field];
    const validation = validator(value);

    if (!validation.isValid) {
      errors.push(`${field}: ${validation.errors.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
