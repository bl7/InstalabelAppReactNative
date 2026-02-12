# Print Logging Coverage - InstaLabel App

## Overview

This document outlines the comprehensive print logging system implemented in the InstaLabel app to track **every single label printed**.

## ✅ **All Print Activities Now Logged**

### 1. **Regular Label Printing (LabelsPage & PPDsPage)**

- **Location**: `PrinterContext.tsx` - `printTSPLLabels()` function
- **Triggered**: Every individual label print from main pages
- **Label Types**: All types (cooked, prep, ppds, ppd, use-first, defrost, default, etc)
- **Data Logged**:
  ```typescript
  {
    labelType: item.labelType || 'prep',
    itemId: item.uid || item.id || '',
    itemName: item.name,
    quantity: quantity,
    expiryDate: customExpiry[item.uid] || item.expiryDate,
    initial: item.customInitials || initials,
    labelHeight: item.labelType === 'ppds' ? '80mm' : '40mm',
    printerUsed: connectedDevice.name || 'Bluetooth Printer',
    sessionId: logSessionId,
    selectedItems: item.type === 'complex' ? item.selectedItems : undefined,
  }
  ```

### 2. **Custom Labels (CustomLabelPage)**

- **Location**: `CustomLabelPage.tsx` - `handlePrint()` function
- **Triggered**: Custom label creation and printing
- **Label Types**: 'etc' (custom labels)
- **Data Logged**: Same structure as regular labels with custom item data

### 3. **Simple Custom Labels (PrinterContext)**

- **Location**: `PrinterContext.tsx` - `printSimpleCustomLabel()` function
- **Triggered**: Simple text-only custom labels
- **Label Types**: 'custom'
- **Data Logged**:
  ```typescript
  {
    labelType: 'custom',
    itemId: text,
    itemName: text,
    quantity: 1,
    expiryDate: expiryDate,
    initial: initials,
    labelHeight: '40mm',
    printerUsed: connectedDevice.name || 'Bluetooth Printer',
    sessionId: apiService.generateSessionId(),
    selectedItems: undefined,
  }
  ```

### 4. **Print Spooler Jobs (Background Printing)**

- **Location**: `printSpooler.ts` - `processJob()` function
- **Triggered**: Each individual print in a batch job
- **Label Types**: All types (inherited from job metadata)
- **Data Logged**: Same structure as regular labels, quantity = 1 per individual print

### 5. **Optimized Printing (Native Image Processing)**

- **Location**: `printSpooler.ts` - `printOptimized()` function
- **Triggered**: Native image-based printing
- **Label Types**: All types (inherited from labelData.metadata)
- **Data Logged**: Same structure as regular labels

### 6. **Special Actions (Defrost, Use-First)**

- **Location**: `FloatingActionButtons.tsx` - `handleDefrostConfirm()` function
- **Triggered**: Defrost and use-first actions
- **Label Types**: 'defrost', 'use-first'
- **Data Logged**: Session-based logging with selected items details

### 7. **Reprint Operations**

- **Location**: `PrintSessions.tsx` - `performReprint()` function
- **Triggered**: Reprinting from print history
- **Label Types**: All types (inherited from original log)
- **Data Logged**: Same structure as original print

## 📊 **Label Types Covered**

All label types from `labelManagement.ts` are now logged:

1. **cooked** - Hot food items served immediately
2. **prep** - Prepared items stored in advance
3. **ppds** - Pre-Packaged for Direct Sale (UK compliance)
4. **ppd** - Pre-Packaged for Direct Sale (simplified)
5. **use-first** - Items that need immediate use
6. **defrost** - Frozen items that have been defrosted
7. **default** - Standard label without type indicator
8. **etc** - Custom label with user-defined contains text
9. **custom** - Simple custom labels

## 🔄 **Print Paths Covered**

1. **Direct TSPL Printing** - Main print function
2. **Print Spooler** - Background/queued printing
3. **Native Image Processing** - Optimized printing
4. **Custom Label Creation** - User-created labels
5. **Simple Custom Labels** - Text-only custom labels
6. **Special Actions** - Defrost, use-first operations
7. **Reprint Operations** - Historical print reprinting

## 🛡️ **Error Handling**

- **Logging failures do NOT stop printing** - All print functions continue even if logging fails
- **Graceful degradation** - Print operations complete successfully regardless of logging status
- **Error logging** - All logging errors are captured and logged to console
- **Fallback mechanisms** - Multiple print paths ensure logging coverage

## 📝 **Log Data Structure**

Every print log includes:

- **labelType**: Type of label printed
- **itemId**: Unique identifier for the item
- **itemName**: Name of the item being printed
- **quantity**: Number of labels printed
- **printedAt**: ISO timestamp of when printed
- **expiryDate**: Expiry date on the label
- **initial**: Initials used (if any)
- **labelHeight**: Label size (40mm, 80mm)
- **printerUsed**: Name of the printer used
- **sessionId**: Session ID for grouping related prints
- **selectedItems**: For complex items (like defrost sessions)

## 🎯 **Summary**

**100% Print Coverage Achieved**:

- ✅ All label types logged
- ✅ All print paths covered
- ✅ Custom labels now logged
- ✅ Background printing logged
- ✅ Special actions logged
- ✅ Reprint operations logged
- ✅ Error handling implemented
- ✅ No print activity goes unlogged

The system now provides complete audit trails for all print activities while maintaining robust error handling and performance.
