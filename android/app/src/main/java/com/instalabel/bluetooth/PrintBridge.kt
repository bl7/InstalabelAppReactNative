package com.instalabel.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStream
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.roundToInt

class PrintBridge(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        private const val TAG = "PrintBridge"
        private const val MODULE_NAME = "PrintBridge"
        
        // Classic Bluetooth SPP UUID
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        
        // BLE Service UUIDs for common printer protocols
        private val PRINTER_SERVICE_UUIDS = listOf(
            UUID.fromString("0000FF00-0000-1000-8000-00805F9B34FB"), // Generic printer service
            UUID.fromString("0000FFE0-0000-1000-8000-00805F9B34FB"), // ESC/POS service
            UUID.fromString("0000FFE1-0000-1000-8000-00805F9B34FB"), // ESC/POS data
            UUID.fromString("0000FFE2-0000-1000-8000-00805F9B34FB"), // ESC/POS status
            UUID.fromString("0000FFE3-0000-1000-8000-00805F9B34FB"), // ESC/POS control
            UUID.fromString("0000FFE4-0000-1000-8000-00805F9B34FB"), // ESC/POS response
            UUID.fromString("0000FFE5-0000-1000-8000-00805F9B34FB"), // ESC/POS notification
            UUID.fromString("0000FFE6-0000-1000-8000-00805F9B34FB"), // ESC/POS command
            UUID.fromString("0000FFE7-0000-1000-8000-00805F9B34FB"), // ESC/POS data
            UUID.fromString("0000FFE8-0000-1000-8000-00805F9B34FB"), // ESC/POS status
            UUID.fromString("0000FFE9-0000-1000-8000-00805F9B34FB"), // ESC/POS control
            UUID.fromString("0000FFEA-0000-1000-8000-00805F9B34FB"), // ESC/POS response
            UUID.fromString("0000FFEB-0000-1000-8000-00805F9B34FB"), // ESC/POS notification
            UUID.fromString("0000FFEC-0000-1000-8000-00805F9B34FB"), // ESC/POS command
            UUID.fromString("0000FFED-0000-1000-8000-00805F9B34FB"), // ESC/POS data
            UUID.fromString("0000FFEE-0000-1000-8000-00805F9B34FB"), // ESC/POS status
            UUID.fromString("0000FFEF-0000-1000-8000-00805F9B34FB"), // ESC/POS control
            UUID.fromString("0000FFF0-0000-1000-8000-00805F9B34FB"), // ESC/POS response
            UUID.fromString("0000FFF1-0000-1000-8000-00805F9B34FB"), // ESC/POS notification
            UUID.fromString("0000FFF2-0000-1000-8000-00805F9B34FB"), // ESC/POS command
            UUID.fromString("0000FFF3-0000-1000-8000-00805F9B34FB"), // ESC/POS data
            UUID.fromString("0000FFF4-0000-1000-8000-00805F9B34FB"), // ESC/POS status
            UUID.fromString("0000FFF5-0000-1000-8000-00805F9B34FB"), // ESC/POS control
            UUID.fromString("0000FFF6-0000-1000-8000-00805F9B34FB"), // ESC/POS response
            UUID.fromString("0000FFF7-0000-1000-8000-00805F9B34FB"), // ESC/POS notification
            UUID.fromString("0000FFF8-0000-1000-8000-00805F9B34FB"), // ESC/POS command
            UUID.fromString("0000FFF9-0000-1000-8000-00805F9B34FB"), // ESC/POS data
            UUID.fromString("0000FFFA-0000-1000-8000-00805F9B34FB"), // ESC/POS status
            UUID.fromString("0000FFFB-0000-1000-8000-00805F9B34FB"), // ESC/POS control
            UUID.fromString("0000FFFC-0000-1000-8000-00805F9B34FB"), // ESC/POS response
            UUID.fromString("0000FFFD-0000-1000-8000-00805F9B34FB"), // ESC/POS notification
            UUID.fromString("0000FFFE-0000-1000-8000-00805F9B34FB"), // ESC/POS command
            UUID.fromString("0000FFFF-0000-1000-8000-00805F9B34FB")  // ESC/POS data
        )
        
        // BLE chunking constants
        private const val BLE_CHUNK_SIZE = 180 // Safe BLE packet size
        private const val BLE_CHUNK_DELAY = 50L // 50ms delay between chunks
        
        // Printer DPI constants
        private const val PRINTER_DPI = 203 // Standard thermal printer DPI
        private const val MM_TO_DOTS_FACTOR = PRINTER_DPI / 25.4f
    }

    // Connection types
    enum class ConnectionType {
        CLASSIC, BLE, DUAL, UNKNOWN
    }

    // Current connection state
    private var currentConnectionType: ConnectionType = ConnectionType.UNKNOWN
    private var classicSocket: BluetoothSocket? = null
    private var classicOutputStream: OutputStream? = null
    private var bleGatt: android.bluetooth.BluetoothGatt? = null
    private var bleWriteCharacteristic: android.bluetooth.BluetoothGattCharacteristic? = null
    private var bleConnectionState: Int = android.bluetooth.BluetoothProfile.STATE_DISCONNECTED

    // Bluetooth managers
    private val bluetoothManager: BluetoothManager by lazy {
        reactApplicationContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    }
    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        bluetoothManager.adapter
    }
    private val bleScanner: BluetoothLeScanner? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            bluetoothAdapter?.bluetoothLeScanner
        } else null
    }

    // Device cache for technology detection
    private val deviceTechnologyCache = ConcurrentHashMap<String, ConnectionType>()

    override fun getName(): String = MODULE_NAME

    // ===============================================================================
    // NEW OPTIMIZED METHODS FOR IMAGE PROCESSING AND PRINTING
    // ===============================================================================

    /**
     * Save captured label image to native storage and return file path
     * This eliminates large base64 transfers between JS and native
     */
    @ReactMethod
    fun saveLabelImage(base64Image: String, filename: String, promise: Promise) {
        try {
            Log.d(TAG, "Saving label image to native storage: $filename")
            
            // Remove data URL prefix if present
            val cleanBase64 = if (base64Image.startsWith("data:image/")) {
                base64Image.substring(base64Image.indexOf(",") + 1)
            } else {
                base64Image
            }
            
            // Decode base64 to bitmap
            val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            
            if (bitmap == null) {
                promise.reject("IMAGE_DECODE_ERROR", "Failed to decode image data")
                return
            }
            
            // Save to cache directory
            val cacheDir = reactApplicationContext.cacheDir
            val imageFile = File(cacheDir, filename)
            
            val outputStream = FileOutputStream(imageFile)
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            outputStream.close()
            
            Log.d(TAG, "Image saved successfully: ${imageFile.absolutePath}")
            promise.resolve(imageFile.absolutePath)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error saving label image", e)
            promise.reject("SAVE_IMAGE_ERROR", "Failed to save image", e)
        }
    }

    /**
     * Process image for TSPL printing with DPI scaling and monochrome conversion
     * This moves heavy image processing to native side
     */
    @ReactMethod
    fun processImageForPrinting(
        imagePath: String,
        labelWidthMm: Int,
        labelHeightMm: Int,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "Processing image for printing: $imagePath")
            
            // Load image from file
            val bitmap = BitmapFactory.decodeFile(imagePath)
            if (bitmap == null) {
                promise.reject("IMAGE_LOAD_ERROR", "Failed to load image from path")
                return
            }
            
            // Scale to printer DPI
            val scaledBitmap = scaleBitmapToPrinterDPI(bitmap, labelWidthMm, labelHeightMm)
            
            // Convert to monochrome
            val monochromeBitmap = convertToMonochrome(scaledBitmap)
            
            // Save processed image
            val processedPath = saveProcessedImage(monochromeBitmap, imagePath)
            
            // Generate TSPL commands
            val tsplCommands = generateTSPLCommands(processedPath, labelWidthMm, labelHeightMm, monochromeBitmap)
            
            val result = Arguments.createMap().apply {
                putString("processedImagePath", processedPath)
                putString("tsplCommands", tsplCommands)
                putInt("imageWidth", monochromeBitmap.width)
                putInt("imageHeight", monochromeBitmap.height)
            }
            
            Log.d(TAG, "Image processing completed successfully")
            promise.resolve(result)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error processing image for printing", e)
            promise.reject("PROCESS_IMAGE_ERROR", "Failed to process image", e)
        }
    }

    /**
     * Synchronous version of processImageForPrinting for internal use
     */
    private fun processImageForPrintingSync(
        imagePath: String,
        labelWidthMm: Int,
        labelHeightMm: Int
    ): ReadableMap {
        Log.d(TAG, "Processing image for printing (sync): $imagePath")
        
        // Load image from file
        val bitmap = BitmapFactory.decodeFile(imagePath)
        if (bitmap == null) {
            throw RuntimeException("Failed to load image from path")
        }
        
        // Scale to printer DPI
        val scaledBitmap = scaleBitmapToPrinterDPI(bitmap, labelWidthMm, labelHeightMm)
        
        // Convert to monochrome
        val monochromeBitmap = convertToMonochrome(scaledBitmap)
        
        // Save processed image
        val processedPath = saveProcessedImage(monochromeBitmap, imagePath)
        
        // Generate TSPL commands
        val tsplCommands = generateTSPLCommands(processedPath, labelWidthMm, labelHeightMm, monochromeBitmap)
        
        val result = Arguments.createMap().apply {
            putString("processedImagePath", processedPath)
            putString("tsplCommands", tsplCommands)
            putInt("imageWidth", monochromeBitmap.width)
            putInt("imageHeight", monochromeBitmap.height)
        }
        
        Log.d(TAG, "Image processing completed successfully (sync)")
        return result
    }

    /**
     * Print TSPL commands with automatic chunking for BLE
     * This prevents BLE packet overflow
     */
    @ReactMethod
    fun printTSPLChunked(tsplCommands: String, promise: Promise) {
        when (currentConnectionType) {
            ConnectionType.CLASSIC -> printClassic(tsplCommands, promise)
            ConnectionType.BLE -> printBLEChunked(tsplCommands, promise)
            ConnectionType.DUAL -> printDualChunked(tsplCommands, promise)
            ConnectionType.UNKNOWN -> promise.reject("PRINT_ERROR", "No active connection")
        }
    }

    /**
     * NEW: Print TSPL data provided as Base64-encoded bytes
     * This is the safest way to handle binary TSPL (commands + bitmap data)
     */
    @ReactMethod
    fun printTSPLBase64(base64Data: String, promise: Promise) {
        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)

            when (currentConnectionType) {
                ConnectionType.CLASSIC -> printClassicBytes(bytes, promise)
                ConnectionType.BLE -> printBLEChunkedBytes(bytes, promise)
                ConnectionType.DUAL -> printDualChunkedBytes(bytes, promise)
                ConnectionType.UNKNOWN -> promise.reject("PRINT_ERROR", "No active connection")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in printTSPLBase64", e)
            promise.reject("PRINT_ERROR", "Failed to print TSPL Base64 data", e)
        }
    }

    /**
     * Print image directly from file path with native processing
     * This is the main optimized printing method
     */
    @ReactMethod
    fun printImageFromFile(
        imagePath: String,
        labelWidthMm: Int,
        labelHeightMm: Int,
        promise: Promise
    ) {
        try {
            Log.d(TAG, "Printing image from file: $imagePath")
            
            // Process the image and print directly
            try {
                val result = processImageForPrintingSync(imagePath, labelWidthMm, labelHeightMm)
                val tsplCommands = result.getString("tsplCommands")
                
                // Print with chunking
                printTSPLChunked(tsplCommands!!, promise)
            } catch (e: Exception) {
                Log.e(TAG, "Error processing image for printing", e)
                promise.reject("PROCESS_ERROR", "Failed to process image", e)
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error printing image from file", e)
            promise.reject("PRINT_IMAGE_ERROR", "Failed to print image", e)
        }
    }

    // ===============================================================================
    // PRIVATE HELPER METHODS FOR IMAGE PROCESSING
    // ===============================================================================

    /**
     * Scale bitmap to match printer DPI
     */
    private fun scaleBitmapToPrinterDPI(bitmap: Bitmap, labelWidthMm: Int, labelHeightMm: Int): Bitmap {
        // Convert mm to dots at printer DPI
        val targetWidth = (labelWidthMm * MM_TO_DOTS_FACTOR).roundToInt()
        val targetHeight = (labelHeightMm * MM_TO_DOTS_FACTOR).roundToInt()
        
        Log.d(TAG, "Scaling bitmap from ${bitmap.width}x${bitmap.height} to ${targetWidth}x${targetHeight}")
        
        return Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
    }

    /**
     * Convert bitmap to monochrome (black and white)
     */
    private fun convertToMonochrome(bitmap: Bitmap): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        
        // Create monochrome bitmap
        val monochromeBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(monochromeBitmap)
        
        // Create paint for monochrome conversion
        val paint = Paint().apply {
            colorFilter = android.graphics.ColorMatrixColorFilter(
                floatArrayOf(
                    0.299f, 0.587f, 0.114f, 0f, 0f,
                    0.299f, 0.587f, 0.114f, 0f, 0f,
                    0.299f, 0.587f, 0.114f, 0f, 0f,
                    0f, 0f, 0f, 1f, 0f
                )
            )
        }
        
        // Draw with grayscale filter
        canvas.drawBitmap(bitmap, 0f, 0f, paint)
        
        // Apply threshold for black/white conversion
        val pixels = IntArray(width * height)
        monochromeBitmap.getPixels(pixels, 0, width, 0, 0, width, height)
        
        for (i in pixels.indices) {
            val pixel = pixels[i]
            val gray = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3
            val threshold = 128
            pixels[i] = if (gray > threshold) Color.WHITE else Color.BLACK
        }
        
        monochromeBitmap.setPixels(pixels, 0, width, 0, 0, width, height)
        
        Log.d(TAG, "Converted to monochrome: ${width}x${height}")
        return monochromeBitmap
    }

    /**
     * Save processed image to file
     */
    private fun saveProcessedImage(bitmap: Bitmap, originalPath: String): String {
        val cacheDir = reactApplicationContext.cacheDir
        val filename = "processed_${File(originalPath).name}"
        val processedFile = File(cacheDir, filename)
        
        val outputStream = FileOutputStream(processedFile)
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
        outputStream.close()
        
        Log.d(TAG, "Processed image saved: ${processedFile.absolutePath}")
        return processedFile.absolutePath
    }

    /**
     * Generate TSPL commands for image printing
     */
    private fun generateTSPLCommands(imagePath: String, labelWidthMm: Int, labelHeightMm: Int, bitmap: Bitmap): String {
        val tspl = StringBuilder()
        
        // Initialize label
        tspl.append("SIZE ${labelWidthMm}mm,${labelHeightMm}mm\n")
        tspl.append("GAPSENSOR\n")
        tspl.append("GAP 3mm,0mm\n")
        tspl.append("DIRECTION 0\n")
        tspl.append("DENSITY 8\n")
        tspl.append("CLS\n")
        
        // Add image command (PUTBMP for TSPL)
        tspl.append("PUTBMP 0,0,\"$imagePath\",0\n")
        
        // Print command
        tspl.append("PRINT 1\n")
        
        Log.d(TAG, "Generated TSPL commands for ${bitmap.width}x${bitmap.height} image")
        return tspl.toString()
    }

    /**
     * Print BLE data with automatic chunking from String
     */
    private fun printBLEChunked(data: String, promise: Promise) {
        if (bleWriteCharacteristic == null) {
            promise.reject("BLE_PRINT_ERROR", "No write characteristic found")
            return
        }

        Thread {
            try {
                val bytes = data.toByteArray(Charsets.UTF_8)
                val chunks = bytes.toList().chunked(BLE_CHUNK_SIZE)
                
                Log.d(TAG, "Sending ${chunks.size} chunks of ${bytes.size} bytes")
                
                for ((index, chunk) in chunks.withIndex()) {
                    val chunkArray = chunk.toByteArray()
                    bleWriteCharacteristic?.value = chunkArray
                    bleGatt?.writeCharacteristic(bleWriteCharacteristic)
                    
                    Log.d(TAG, "Sent chunk ${index + 1}/${chunks.size} (${chunkArray.size} bytes)")
                    
                    // Add delay between chunks to prevent overflow
                    if (index < chunks.size - 1) {
                        Thread.sleep(BLE_CHUNK_DELAY)
                    }
                }
                
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Error in BLE chunked printing", e)
                promise.reject("BLE_PRINT_ERROR", "Failed to print via BLE", e)
            }
        }.start()
    }

    /**
     * Print BLE data with automatic chunking from raw bytes
     */
    private fun printBLEChunkedBytes(bytes: ByteArray, promise: Promise) {
        if (bleWriteCharacteristic == null) {
            promise.reject("BLE_PRINT_ERROR", "No write characteristic found")
            return
        }

        Thread {
            try {
                val chunks = bytes.toList().chunked(BLE_CHUNK_SIZE)
                
                Log.d(TAG, "Sending ${chunks.size} chunks of ${bytes.size} bytes")
                
                for ((index, chunk) in chunks.withIndex()) {
                    val chunkArray = chunk.toByteArray()
                    bleWriteCharacteristic?.value = chunkArray
                    bleGatt?.writeCharacteristic(bleWriteCharacteristic)
                    
                    Log.d(TAG, "Sent chunk ${index + 1}/${chunks.size} (${chunkArray.size} bytes)")
                    
                    // Add delay between chunks to prevent overflow
                    if (index < chunks.size - 1) {
                        Thread.sleep(BLE_CHUNK_DELAY)
                    }
                }
                
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Error in BLE chunked bytes printing", e)
                promise.reject("BLE_PRINT_ERROR", "Failed to print via BLE", e)
            }
        }.start()
    }

    /**
     * Print dual mode with chunking
     */
    private fun printDualChunked(data: String, promise: Promise) {
        when (currentConnectionType) {
            ConnectionType.BLE -> printBLEChunked(data, promise)
            ConnectionType.CLASSIC -> printClassic(data, promise)
            else -> promise.reject("PRINT_ERROR", "Invalid connection type")
        }
    }

    /**
     * Print dual mode with chunking (bytes)
     */
    private fun printDualChunkedBytes(bytes: ByteArray, promise: Promise) {
        when (currentConnectionType) {
            ConnectionType.BLE -> printBLEChunkedBytes(bytes, promise)
            ConnectionType.CLASSIC -> printClassicBytes(bytes, promise)
            else -> promise.reject("PRINT_ERROR", "Invalid connection type")
        }
    }

    // ===============================================================================
    // EXISTING METHODS (KEPT FOR BACKWARD COMPATIBILITY)
    // ===============================================================================

    @ReactMethod
    fun isBluetoothEnabled(promise: Promise) {
        try {
            val enabled = bluetoothAdapter?.isEnabled == true
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("BLUETOOTH_ERROR", "Failed to check Bluetooth status", e)
        }
    }

    @ReactMethod
    fun scanForDevices(promise: Promise) {
        val adapter = bluetoothAdapter
        if (adapter == null) {
            promise.reject("BLUETOOTH_ERROR", "Bluetooth not supported")
            return
        }

        try {
            val deviceList = Arguments.createArray()
            
            // Get paired devices
            val pairedDevices = adapter.bondedDevices
            pairedDevices.forEach { device ->
                val deviceMap = Arguments.createMap().apply {
                    putString("id", device.address)
                    putString("name", device.name ?: "Unknown Device")
                    putString("address", device.address)
                    putBoolean("paired", true)
                    putString("technology", getDeviceTechnology(device).name)
                }
                deviceList.pushMap(deviceMap)
            }

            // Start BLE scan for nearby devices
            val scanner = bleScanner
            if (scanner != null && hasBlePermissions()) {
                startBleScan()
            }

            promise.resolve(deviceList)
        } catch (e: Exception) {
            promise.reject("SCAN_ERROR", "Failed to scan for devices", e)
        }
    }

    @ReactMethod
    fun getPairedDevices(promise: Promise) {
        val adapter = bluetoothAdapter
        if (adapter == null) {
            promise.reject("BLUETOOTH_ERROR", "Bluetooth not supported")
            return
        }

        try {
            val deviceList = Arguments.createArray()
            
            // Get paired devices
            val pairedDevices = adapter.bondedDevices
            pairedDevices.forEach { device ->
                val deviceMap = Arguments.createMap().apply {
                    putString("id", device.address)
                    putString("name", device.name ?: "Unknown Device")
                    putString("address", device.address)
                    putBoolean("paired", true)
                    putString("technology", getDeviceTechnology(device).name)
                }
                deviceList.pushMap(deviceMap)
            }

            promise.resolve(deviceList)
        } catch (e: Exception) {
            promise.reject("SCAN_ERROR", "Failed to get paired devices", e)
        }
    }

    @ReactMethod
    fun connectToDevice(deviceAddress: String, promise: Promise) {
        try {
            Log.d(TAG, "Attempting to connect to device: $deviceAddress")
            val device = bluetoothAdapter?.getRemoteDevice(deviceAddress)
            if (device == null) {
                Log.e(TAG, "Device not found: $deviceAddress")
                promise.reject("CONNECTION_ERROR", "Device not found")
                return
            }

            val technology = getDeviceTechnology(device)
            Log.d(TAG, "Device technology detected: $technology")
            currentConnectionType = technology

            when (technology) {
                ConnectionType.CLASSIC -> {
                    Log.d(TAG, "Connecting via Classic Bluetooth")
                    connectClassic(device, promise)
                }
                ConnectionType.BLE -> {
                    Log.d(TAG, "Connecting via BLE")
                    connectBLE(device, promise)
                }
                ConnectionType.DUAL -> {
                    Log.d(TAG, "Connecting via Dual mode")
                    connectDual(device, promise)
                }
                ConnectionType.UNKNOWN -> {
                    Log.e(TAG, "Unknown device type")
                    promise.reject("CONNECTION_ERROR", "Unknown device type")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting to device: $deviceAddress", e)
            promise.reject("CONNECTION_ERROR", "Failed to connect to device", e)
        }
    }

    @ReactMethod
    fun connectDual(deviceAddress: String, promise: Promise) {
        try {
            val device = bluetoothAdapter?.getRemoteDevice(deviceAddress)
            if (device == null) {
                promise.reject("CONNECTION_ERROR", "Device not found")
                return
            }

            val technology = getDeviceTechnology(device)
            currentConnectionType = technology

            when (technology) {
                ConnectionType.CLASSIC -> connectClassic(device, promise)
                ConnectionType.BLE -> connectBLE(device, promise)
                ConnectionType.DUAL -> {
                    // For dual devices, try BLE first, then fallback to classic
                    try {
                        connectBLE(device, promise)
                    } catch (e: Exception) {
                        // Fallback to classic if BLE fails
                        connectClassic(device, promise)
                    }
                }
                ConnectionType.UNKNOWN -> promise.reject("CONNECTION_ERROR", "Unknown device type")
            }
        } catch (e: Exception) {
            promise.reject("CONNECTION_ERROR", "Failed to connect to device", e)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            // Close classic connection
            classicOutputStream?.close()
            classicSocket?.close()
            classicOutputStream = null
            classicSocket = null

            // Close BLE connection
            bleGatt?.close()
            bleGatt = null
            bleWriteCharacteristic = null

            currentConnectionType = ConnectionType.UNKNOWN
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect", e)
        }
    }

    @ReactMethod
    fun printTSPL(tsplCommands: String, promise: Promise) {
        // Use the new chunked printing method
        printTSPLChunked(tsplCommands, promise)
    }

    @ReactMethod
    fun printESC(escCommands: String, promise: Promise) {
        when (currentConnectionType) {
            ConnectionType.CLASSIC -> printClassic(escCommands, promise)
            ConnectionType.BLE -> printBLEChunked(escCommands, promise)
            ConnectionType.DUAL -> printDualChunked(escCommands, promise)
            ConnectionType.UNKNOWN -> promise.reject("PRINT_ERROR", "No active connection")
        }
    }

    @ReactMethod
    fun printZPL(zplCommands: String, promise: Promise) {
        when (currentConnectionType) {
            ConnectionType.CLASSIC -> printClassic(zplCommands, promise)
            ConnectionType.BLE -> printBLEChunked(zplCommands, promise)
            ConnectionType.DUAL -> printDualChunked(zplCommands, promise)
            ConnectionType.UNKNOWN -> promise.reject("PRINT_ERROR", "No active connection")
        }
    }

    @ReactMethod
    fun getConnectionStatus(promise: Promise) {
        val status = Arguments.createMap().apply {
            putString("type", currentConnectionType.name)
            putBoolean("connected", currentConnectionType != ConnectionType.UNKNOWN)
            putBoolean("classicConnected", classicSocket?.isConnected == true)
            putBoolean("bleConnected", bleConnectionState == android.bluetooth.BluetoothProfile.STATE_CONNECTED)
        }
        promise.resolve(status)
    }

    // Private helper methods

    private fun getDeviceTechnology(device: BluetoothDevice): ConnectionType {
        // Check cache first
        deviceTechnologyCache[device.address]?.let { return it }

        val technology = when (device.type) {
            BluetoothDevice.DEVICE_TYPE_CLASSIC -> ConnectionType.CLASSIC
            BluetoothDevice.DEVICE_TYPE_LE -> ConnectionType.BLE
            BluetoothDevice.DEVICE_TYPE_DUAL -> ConnectionType.DUAL
            else -> ConnectionType.UNKNOWN
        }

        // Cache the result
        deviceTechnologyCache[device.address] = technology
        return technology
    }

    private fun hasBlePermissions(): Boolean {
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
                // Android 12+ requires BLUETOOTH_SCAN permission
                ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                // Android 10-11 requires ACCESS_FINE_LOCATION for BLE scanning
                ActivityCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            }
            else -> {
                // Android 9 and below don't need runtime permissions for BLE
                true
            }
        }
    }

    private fun startBleScan() {
        val scanner = bleScanner
        if (scanner == null) return

        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val scanFilter = ScanFilter.Builder()
            .build()

        scanner.startScan(listOf(scanFilter), scanSettings, bleScanCallback)
    }

    private val bleScanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            super.onScanResult(callbackType, result)
            
            // Send discovered device to React Native
            val deviceMap = Arguments.createMap().apply {
                putString("id", result.device.address)
                putString("name", result.device.name ?: "Unknown Device")
                putString("address", result.device.address)
                putBoolean("paired", false)
                putString("technology", "BLE")
            }
            
            sendEvent("deviceDiscovered", deviceMap)
        }
    }

    private fun connectClassic(device: BluetoothDevice, promise: Promise) {
        Thread {
            try {
                Log.d(TAG, "Creating classic Bluetooth socket for device: ${device.address}")
                val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                Log.d(TAG, "Attempting to connect classic socket...")
                socket.connect()
                Log.d(TAG, "Classic Bluetooth connected successfully")
                
                classicSocket = socket
                classicOutputStream = socket.outputStream
                
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to connect via classic Bluetooth", e)
                promise.reject("CLASSIC_CONNECTION_ERROR", "Failed to connect via classic Bluetooth", e)
            }
        }.start()
    }

    private fun connectBLE(device: BluetoothDevice, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.JELLY_BEAN_MR2) {
            promise.reject("BLE_ERROR", "BLE not supported on this device")
            return
        }

        bleGatt = device.connectGatt(reactApplicationContext, false, bleGattCallback)
        promise.resolve(true)
    }

    private fun connectDual(device: BluetoothDevice, promise: Promise) {
        // Try BLE first (faster, more reliable)
        try {
            connectBLE(device, promise)
        } catch (e: Exception) {
            // Fallback to classic
            connectClassic(device, promise)
        }
    }

    private val bleGattCallback = object : android.bluetooth.BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: android.bluetooth.BluetoothGatt, status: Int, newState: Int) {
            bleConnectionState = newState
            when (newState) {
                android.bluetooth.BluetoothProfile.STATE_CONNECTED -> {
                    gatt.discoverServices()
                }
                android.bluetooth.BluetoothProfile.STATE_DISCONNECTED -> {
                    currentConnectionType = ConnectionType.UNKNOWN
                }
            }
        }

        override fun onServicesDiscovered(gatt: android.bluetooth.BluetoothGatt, status: Int) {
            if (status == android.bluetooth.BluetoothGatt.GATT_SUCCESS) {
                // Find write characteristic
                for (service in gatt.services) {
                    for (characteristic in service.characteristics) {
                        if (characteristic.properties and android.bluetooth.BluetoothGattCharacteristic.PROPERTY_WRITE != 0) {
                            bleWriteCharacteristic = characteristic
                            break
                        }
                    }
                    if (bleWriteCharacteristic != null) break
                }
            }
        }
    }

    private fun printClassic(data: String, promise: Promise) {
        Thread {
            try {
                classicOutputStream?.write(data.toByteArray())
                classicOutputStream?.flush()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLASSIC_PRINT_ERROR", "Failed to print via classic Bluetooth", e)
            }
        }.start()
    }

    private fun printClassicBytes(bytes: ByteArray, promise: Promise) {
        Thread {
            try {
                classicOutputStream?.write(bytes)
                classicOutputStream?.flush()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLASSIC_PRINT_ERROR", "Failed to print via classic Bluetooth", e)
            }
        }.start()
    }

    private fun printBLE(data: String, promise: Promise) {
        // Use chunked printing for BLE
        printBLEChunked(data, promise)
    }

    private fun printDual(data: String, promise: Promise) {
        // Try current connection type first
        when (currentConnectionType) {
            ConnectionType.BLE -> printBLEChunked(data, promise)
            ConnectionType.CLASSIC -> printClassic(data, promise)
            else -> promise.reject("PRINT_ERROR", "Invalid connection type")
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
