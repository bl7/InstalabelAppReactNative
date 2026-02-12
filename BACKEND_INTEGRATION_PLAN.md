# Backend Integration Plan: TSPL Printing

## Quick Answers to Top 5 Questions

1. **Android only or iOS too?** → **Android only**
2. **Current Bluetooth method: SPP or BLE?** → **Both supported, auto-detected**
3. **Library used and how they stream chunks today** → **Custom native module; BLE: 180-byte chunks with 50ms delay; Classic: full payload**
4. **Whether they can store per-printer profile** → **Not currently, but can be added easily**
5. **Typical batch size (10, 50, 200 labels)** → **No hard limit, but processes sequentially**

---

## Implementation Plan

### Phase 1: Backend API Design

#### Endpoint: `POST /api/print/generate-tspl`

**Request:**
```json
{
  "labels": [
    {
      "labelId": "unique-id-1",
      "labelType": "prep" | "ppd" | "ppds" | "etc",
      "itemName": "Chicken Salad",
      "expiryDate": "2024-12-31",
      "ingredients": ["chicken", "lettuce"],
      "allergens": ["eggs"],
      "printedDate": "2024-12-15",
      "initials": "JD",
      "companyName": "InstaLabel Ltd",
      "storageInstructions": "Keep refrigerated",
      "quantity": 1
    }
  ],
  "printerConfig": {
    "dpi": 203,  // or 300
    "labelSize": {
      "width": 60,  // mm
      "height": 40  // mm
    },
    "gap": 3  // mm
  }
}
```

**Response:**
```json
{
  "payloads": [
    {
      "labelId": "unique-id-1",
      "tsplBase64": "U0laRSA2MG1tLDQwbW0K...",  // Base64-encoded TSPL bytes
      "size": 1024  // bytes
    }
  ],
  "totalSize": 10240
}
```

**Alternative (simpler):**
```json
{
  "payloads": [
    {
      "labelId": "unique-id-1",
      "tsplString": "SIZE 60mm,40mm\nGAP 3mm,0mm\n..."  // Plain ASCII TSPL
    }
  ]
}
```

---

### Phase 2: Mobile App Changes

#### 2.1 Add Backend TSPL Fetching

**New function in `src/PrinterContext.tsx`:**
```typescript
const fetchTSPLFromBackend = async (
  labels: Array<LabelData>,
  printerConfig?: PrinterConfig
): Promise<Array<{labelId: string; tspl: string}>> => {
  const response = await apiService.post('/api/print/generate-tspl', {
    labels,
    printerConfig,
  });
  
  // Decode base64 if needed
  return response.payloads.map(p => ({
    labelId: p.labelId,
    tspl: p.tsplBase64 
      ? atob(p.tsplBase64)  // Decode base64
      : p.tsplString         // Use plain string
  }));
};
```

#### 2.2 Update Print Flow

**Modify `printTSPLLabels()` in `src/PrinterContext.tsx`:**

```typescript
const printTSPLLabels = async (
  printQueue: any[],
  // ... other params
) => {
  // ... existing validation ...
  
  try {
    setIsPrinting(true);
    
    // NEW: Fetch TSPL from backend instead of generating client-side
    const tsplPayloads = await fetchTSPLFromBackend(
      printQueue.map(item => ({
        labelId: item.uid || item.id,
        labelType: item.labelType || 'prep',
        itemName: item.name,
        expiryDate: customExpiry[item.uid] || item.expiryDate,
        // ... map other fields
      })),
      {
        dpi: getPrinterDPI(connectedDevice), // From stored profile
        labelSize: getLabelSize(item.labelType),
        gap: 3,
      }
    );
    
    // Print each payload
    for (const payload of tsplPayloads) {
      const item = printQueue.find(q => (q.uid || q.id) === payload.labelId);
      const quantity = item?.quantity || 1;
      
      for (let i = 0; i < quantity; i++) {
        await PrintBridge.printTSPL(payload.tspl);
        if (i < quantity - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  } catch (error) {
    // ... error handling
  }
};
```

#### 2.3 Add Printer Profile Storage

**New file: `src/services/printerProfiles.ts`:**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrinterProfile {
  address: string;
  name: string;
  dpi: 203 | 300;
  labelSize?: { width: number; height: number };
  gap?: number;
  connectionType: 'CLASSIC' | 'BLE' | 'DUAL';
}

const STORAGE_KEY = 'printer_profiles';

export const savePrinterProfile = async (
  profile: PrinterProfile
): Promise<void> => {
  const profiles = await getPrinterProfiles();
  const existing = profiles.findIndex(p => p.address === profile.address);
  
  if (existing >= 0) {
    profiles[existing] = profile;
  } else {
    profiles.push(profile);
  }
  
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
};

export const getPrinterProfile = async (
  address: string
): Promise<PrinterProfile | null> => {
  const profiles = await getPrinterProfiles();
  return profiles.find(p => p.address === address) || null;
};

export const getPrinterProfiles = async (): Promise<PrinterProfile[]> => {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};
```

#### 2.4 Update PrintBridge to Handle Base64 (Optional)

**Add to `PrintBridge.kt`:**

```kotlin
@ReactMethod
fun printTSPLBase64(tsplBase64: String, promise: Promise) {
    try {
        val tsplBytes = Base64.decode(tsplBase64, Base64.DEFAULT)
        val tsplString = String(tsplBytes, Charsets.UTF_8)
        printTSPLChunked(tsplString, promise)
    } catch (e: Exception) {
        promise.reject("DECODE_ERROR", "Failed to decode base64 TSPL", e)
    }
}
```

---

### Phase 3: Enhanced Features

#### 3.1 Progress Tracking

```typescript
interface PrintProgress {
  total: number;
  completed: number;
  failed: number;
  currentLabel?: string;
}

const [printProgress, setPrintProgress] = useState<PrintProgress>({
  total: 0,
  completed: 0,
  failed: 0,
});

// Update during printing
for (const payload of tsplPayloads) {
  setPrintProgress(prev => ({
    ...prev,
    currentLabel: item.name,
  }));
  
  try {
    await PrintBridge.printTSPL(payload.tspl);
    setPrintProgress(prev => ({
      ...prev,
      completed: prev.completed + 1,
    }));
  } catch (error) {
    setPrintProgress(prev => ({
      ...prev,
      failed: prev.failed + 1,
    }));
  }
}
```

#### 3.2 Retry Logic

```typescript
const printWithRetry = async (
  tspl: string,
  maxRetries: number = 3
): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await PrintBridge.printTSPL(tspl);
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

#### 3.3 Cancel/Pause Support

```typescript
const [isPrintingPaused, setIsPrintingPaused] = useState(false);
const [shouldCancelPrint, setShouldCancelPrint] = useState(false);

// In print loop
for (const payload of tsplPayloads) {
  if (shouldCancelPrint) break;
  
  while (isPrintingPaused) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  await PrintBridge.printTSPL(payload.tspl);
}
```

---

## Testing Checklist

- [ ] Backend returns valid TSPL for all label types (prep, ppd, ppds, etc)
- [ ] Base64 encoding/decoding works correctly
- [ ] BLE chunking handles large payloads (>180 bytes)
- [ ] Classic Bluetooth handles full payloads
- [ ] Printer profiles persist across app restarts
- [ ] Progress tracking updates correctly
- [ ] Retry logic works on connection failures
- [ ] Cancel/pause works during batch printing
- [ ] Error handling shows user-friendly messages

---

## Migration Path

1. **Week 1**: Implement backend API endpoint
2. **Week 2**: Add mobile app backend integration (feature flag)
3. **Week 3**: Add printer profile storage UI
4. **Week 4**: Test with real printers, enable feature flag
5. **Week 5**: Remove client-side TSPL generation (optional)

---

## Notes

- **Keep client-side TSPL generation as fallback** during migration
- **Feature flag** to switch between client/server TSPL generation
- **Monitor payload sizes** - keep < 100KB per label
- **Batch API calls** if needed (e.g., max 50 labels per request)


