# Mobile Printing Implementation - Current State Answers

## 1. Platforms and Transport

### Q: Are we printing on Android only, or Android + iOS?
**A: Android only**
- React Native 0.73.0
- Custom native module `PrintBridge.kt` (Kotlin) for Android
- No iOS implementation found
- No external React Native Bluetooth libraries in `package.json`

### Q: What connection types do we support today?
**A: Both Bluetooth Classic SPP and BLE (GATT)**
- **Bluetooth Classic SPP**: Uses `BluetoothSocket` with SPP UUID (`00001101-0000-1000-8000-00805F9B34FB`)
- **BLE (GATT)**: Uses `BluetoothGatt` with automatic service discovery
- **Dual mode**: Automatically detects device type and supports both

**Location**: `android/app/src/main/java/com/instalabel/bluetooth/PrintBridge.kt`

### Q: Which RN libraries are we using for printer connectivity?
**A: Custom native module, no external libraries**
- Custom `PrintBridge` native module written in Kotlin
- No `react-native-bluetooth-*` libraries in dependencies
- Direct Android Bluetooth APIs used

### Q: Are we already requesting and handling Android permissions?
**A: Yes, permissions are handled**

**Android 12+ (API 31+)**:
- `BLUETOOTH_SCAN` (with `neverForLocation` flag)
- `BLUETOOTH_CONNECT`
- Requested in `src/pages/SettingsPage.tsx` (lines 176-180)
- Declared in `AndroidManifest.xml` (lines 5-6)

**Android 10-11 (API 29-30)**:
- `ACCESS_FINE_LOCATION` (for BLE scanning)
- Requested in `src/pages/SettingsPage.tsx` (lines 183-184)
- Declared in `AndroidManifest.xml` (line 8)

**Location**: 
- Permissions: `src/pages/SettingsPage.tsx:168-206`
- Manifest: `android/app/src/main/AndroidManifest.xml:1-32`

---

## 2. Printer Connection Details

### Q: When user selects a printer, what fields can we access and store?
**A: Available fields:**
```typescript
{
  id: string;           // Device MAC address
  name: string | null;  // Device name
  address: string;      // MAC address
  paired: boolean;      // Whether device is paired
  technology: 'CLASSIC' | 'BLE' | 'DUAL' | 'UNKNOWN';
}
```

**Location**: `src/PrinterContext.tsx:32-38`

### Q: Can we detect whether the connection is SPP vs BLE at runtime?
**A: Yes, automatically detected**
- `getDeviceTechnology()` method detects device type using `BluetoothDevice.type`
- Cached in `deviceTechnologyCache` for performance
- Connection type stored in `currentConnectionType` enum

**Location**: `PrintBridge.kt:660-674`

---

## 3. Data Streaming Constraints

### Q: Current write method: do we write "write with response" per chunk, or "write without response"?
**A: Write without response (faster)**
- BLE uses `writeCharacteristic()` without waiting for response
- Classic Bluetooth uses `OutputStream.write()` and `flush()`

**Location**: `PrintBridge.kt:405-437` (BLE), `793-802` (Classic)

### Q: What chunk size do we use now?
**A:**
- **BLE**: `180 bytes` per chunk (`BLE_CHUNK_SIZE = 180`)
- **Classic**: No chunking - entire payload written at once
- **BLE Delay**: `50ms` between chunks (`BLE_CHUNK_DELAY = 50L`)

**Location**: `PrintBridge.kt:83-84`

### Q: Do we have any current throttling logic?
**A: Yes, for BLE only**
- `50ms` delay between chunks (`BLE_CHUNK_DELAY`)
- No throttling for Classic Bluetooth (writes entire payload)

**Location**: `PrintBridge.kt:426-428`

---

## 4. Print Job Execution Model

### Q: How does bulk printing work today?
**A: One connection per batch, sequential label printing**
- Single connection maintained for entire batch
- Each label in queue printed sequentially
- For each item, prints `quantity` copies in a loop
- Small delay between copies (`100ms`)

**Location**: `src/PrinterContext.tsx:415-778`

**Current flow**:
```typescript
for (const item of printQueue) {
  const quantity = item.quantity;
  // Generate TSPL for this label
  for (let i = 0; i < quantity; i++) {
    // Print label
    await PrintBridge.printTSPL(tsplCommands);
    if (i < quantity - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

### Q: Do we have a queue already?
**A: Yes, PrintSpooler exists**
- `PrintSpooler` class manages print queue
- Supports job priorities (high, normal, low)
- Queue management: add, remove, clear, cancel, pause, resume
- Currently used for spooler management but TSPL printing bypasses it

**Location**: `src/services/printSpooler.ts`

### Q: Do we need cancel, pause, resume?
**A: Already implemented**
- `cancelPrintJob(jobId)`
- `cancelAllPrintJobs()`
- `pausePrintQueue()`
- `resumePrintQueue()`

**Location**: `src/PrinterContext.tsx:905-937`

---

## 5. Printer Settings and Calibration

### Q: Does the app currently set TSPL config commands before printing?
**A: Yes, but hardcoded**
- `SIZE` - Label dimensions (60mm×40mm or 56mm×80mm)
- `GAP` - Hardcoded to `3mm,0mm`
- `DIRECTION` - Hardcoded to `0` or `1` depending on label type
- `DENSITY` - Hardcoded to `8`
- `CLS` - Clear screen command

**Location**: `tsplUtils.ts` (various label generation functions)

### Q: Do we allow the user to choose label size and gap, or is it fixed?
**A: Fixed based on label type**
- **PPD labels**: 60mm × 40mm
- **PPDS labels**: 56mm × 80mm (full format) or 60mm × 40mm (compact)
- Gap: Fixed at 3mm
- No user-configurable settings

### Q: Do we support both gap and black mark media?
**A: Gap sensor only**
- Uses `GAPSENSOR` command
- No black mark detection found in code

---

## 6. DPI and Model Handling

### Q: Do we know the DPI of the connected printers today?
**A: Hardcoded to 203 DPI**
- `PRINTER_DPI = 203` constant in `PrintBridge.kt:87`
- Used in all TSPL generation functions
- No per-printer DPI detection or storage

**Location**: `PrintBridge.kt:86-88`

### Q: Can we add a one-time user selection per printer: 203 vs 300?
**A: Not currently, but infrastructure exists**
- Device info stored in `connectedDevice` state
- Could extend `BluetoothDevice` interface to include DPI preference
- Would need to persist to AsyncStorage or similar

### Q: Can we store a "printer profile" per device (name/address) locally?
**A: Not currently implemented**
- Device info only stored in memory during session
- No persistent storage of printer profiles
- Could use `@react-native-async-storage/async-storage` (already in dependencies)

---

## 7. Reliability and Acknowledgements

### Q: Do we have any way to confirm printer received the data?
**A: No explicit acknowledgements**
- BLE: Uses write without response (no ACK)
- Classic: Uses `flush()` but no confirmation
- Relies on stable streaming and connection state

**Location**: `PrintBridge.kt:405-437` (BLE), `793-802` (Classic)

### Q: What is our retry strategy if the stream fails mid-job?
**A: No retry logic currently**
- Errors are caught and rejected via Promise
- No automatic retry on failure
- Connection retry exists (3 attempts) but not print retry

**Location**: `src/PrinterContext.tsx:332-376` (connection retry)

### Q: Do we show "printed successfully" today, or just "sent to printer"?
**A: Shows "sent to printer"**
- Success message: "Print Jobs Queued" / "labels have been sent to the printer"
- No confirmation that printer actually printed
- Logs to backend after sending (not after confirmation)

**Location**: `src/pages/LabelsPage.tsx:1066-1069`

---

## 8. Output Format from Backend

### Q: Can the app easily handle receiving:
**A: Currently generates TSPL client-side, but can handle backend format**

**Current state**:
- TSPL generated in `tsplUtils.ts` (client-side)
- Sent as plain string to `PrintBridge.printTSPL()`
- No backend TSPL generation currently

**Can handle**:
- ✅ Plain TSPL string (ASCII) - already doing this
- ✅ TSPL with binary payload - would need base64 decode
- ✅ Base64 encoded bytes - can decode with `Base64.decode()` (already used in code)

**Location**: `PrintBridge.kt:131-166` (base64 decoding example)

### Q: Max payload size we can safely download per request on mobile?
**A: Not explicitly limited, but considerations:**
- BLE chunking: 180 bytes/chunk, so large payloads are automatically chunked
- Classic: No chunking, but Android socket buffers typically handle 4-8KB easily
- Memory: React Native bridge can handle several MB, but recommend < 1MB per call
- **Recommendation**: Keep per-label payloads < 100KB, batch arrays < 5MB total**

### Q: Should the backend return one TSPL payload for entire batch or an array of per-label payloads?
**A: Array of per-label payloads recommended**
- Better for retries (can retry individual labels)
- Better for progress tracking
- Matches current client-side model (one label at a time)
- Can handle failures gracefully

---

## Summary: Top 5 Answers for Backend Team

1. **Platform**: Android only (no iOS)
2. **Bluetooth Method**: Both SPP (Classic) and BLE supported, auto-detected
3. **Library**: Custom native module (`PrintBridge.kt`), no external RN libraries
4. **Chunking**: BLE uses 180-byte chunks with 50ms delay; Classic writes entire payload
5. **Printer Profiles**: Not currently stored, but can be added using AsyncStorage

---

## Recommendations for Backend Integration

### 1. Output Format
- Return **Base64-encoded TSPL bytes** (recommended for transport)
- Or plain TSPL string (ASCII) - simpler but less efficient
- Return **array of per-label payloads** (better for retries and progress)

### 2. API Endpoint Structure
```typescript
POST /api/print/generate-tspl
Body: {
  labels: Array<{
    labelType: 'prep' | 'ppd' | 'ppds' | 'etc';
    itemName: string;
    expiryDate: string;
    // ... other label data
  }>;
  printerConfig?: {
    dpi?: 203 | 300;
    labelSize?: { width: number; height: number };
    gap?: number;
  };
}

Response: {
  payloads: Array<{
    labelId: string;
    tsplBase64: string; // Base64-encoded TSPL bytes
    // OR
    tsplString: string; // Plain TSPL ASCII
  }>;
}
```

### 3. Mobile App Changes Needed
1. **Add method to receive backend TSPL**:
   - New function in `PrintBridge.kt` to handle base64 decoding
   - Or extend existing `printTSPL()` to accept base64

2. **Add printer profile storage**:
   - Store DPI preference per device (address)
   - Store label size/gap preferences
   - Use AsyncStorage for persistence

3. **Update print flow**:
   - Call backend API instead of generating TSPL client-side
   - Handle array of payloads
   - Add retry logic for failed labels

4. **Add progress tracking**:
   - Show progress for batch printing
   - Allow cancel/pause during batch

---

## Current Code Locations Reference

- **Bluetooth Module**: `android/app/src/main/java/com/instalabel/bluetooth/PrintBridge.kt`
- **Printer Context**: `src/PrinterContext.tsx`
- **TSPL Generation**: `tsplUtils.ts`
- **Print Spooler**: `src/services/printSpooler.ts`
- **Permissions**: `src/pages/SettingsPage.tsx:168-206`
- **Manifest**: `android/app/src/main/AndroidManifest.xml`


