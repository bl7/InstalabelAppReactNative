package com.instalabel.xprinter

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.instalabel.rongta.TsplRasterizer
import net.posprinter.IDeviceConnection
import net.posprinter.POSConnect
import net.posprinter.TSPLConst
import net.posprinter.TSPLPrinter
import net.posprinter.model.AlgorithmType
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.roundToInt

/**
 * Official Xprinter POSConnect / TSPLPrinter bridge.
 *
 * Connect via SDK; labels are rasterized with tsplUtils-matched font metrics
 * then printed via TSPLPrinter.bitmap (Born4ship DB403 / XP-*).
 */
class XprinterPrintBridge(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "XprinterPrintBridge"
        private const val MODULE_NAME = "XprinterPrintBridge"
        private const val DPI = 203
        private const val DOTS_PER_MM = DPI / 25.4
        private const val DEFAULT_GAP_MM = 3.0

        fun isXprinterDeviceName(name: String?): Boolean {
            if (name.isNullOrBlank()) return false
            val n = name.uppercase().replace("\\s+".toRegex(), "")
            return n.contains("XPRINTER") ||
                n.contains("BORN4SHIP") ||
                n.contains("BORN4") ||
                n.contains("DB403") ||
                n.contains("DB-403") ||
                n.contains("XP-420") ||
                n.contains("XP-421") ||
                n.contains("XP-423") ||
                n.contains("XP-450") ||
                n.contains("XP-460") ||
                n.contains("XP-470") ||
                n.contains("XP-480") ||
                n.contains("XP-490") ||
                n.contains("XP420") ||
                n.contains("XP460") ||
                n.contains("XP480") ||
                n.startsWith("XP-") ||
                n.startsWith("XP4") ||
                n.contains("POSPRINTER") ||
                n.matches(Regex("^XP[0-9].*"))
        }
    }

    private var connection: IDeviceConnection? = null
    private var printer: TSPLPrinter? = null
    private val connected = AtomicBoolean(false)
    private val connectedAddress = AtomicReference<String?>(null)
    private val sdkReady = AtomicBoolean(false)

    override fun getName(): String = MODULE_NAME

    private fun ensureSdkInit() {
        if (sdkReady.get()) return
        synchronized(this) {
            if (sdkReady.get()) return
            POSConnect.init(reactApplicationContext.applicationContext)
            sdkReady.set(true)
        }
    }

    @ReactMethod
    fun isXprinterPrinter(name: String?, promise: Promise) {
        promise.resolve(isXprinterDeviceName(name))
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        val map: WritableMap = Arguments.createMap()
        val live = connected.get() || (connection?.isConnect == true)
        map.putBoolean("connected", live)
        map.putString("address", connectedAddress.get())
        promise.resolve(map)
    }

    @ReactMethod
    fun connect(macAddress: String, promise: Promise) {
        Thread {
            try {
                ensureSdkInit()

                try {
                    connection?.close()
                } catch (_: Exception) {
                }
                connection = null
                printer = null
                connected.set(false)

                val device = POSConnect.createDevice(POSConnect.DEVICE_TYPE_BLUETOOTH)
                connection = device

                val latch = CountDownLatch(1)
                val ok = AtomicBoolean(false)
                val errMsg = AtomicReference<String?>(null)

                device.connect(macAddress) { code, _, msg ->
                    when (code) {
                        POSConnect.CONNECT_SUCCESS -> {
                            ok.set(true)
                            latch.countDown()
                        }
                        else -> {
                            errMsg.set(msg ?: "code=$code")
                            latch.countDown()
                        }
                    }
                }

                if (!latch.await(12, TimeUnit.SECONDS)) {
                    throw Exception("Xprinter connect timed out")
                }

                if (!ok.get()) {
                    throw Exception("Xprinter connect failed: ${errMsg.get()}")
                }

                printer = TSPLPrinter(device)
                connected.set(true)
                connectedAddress.set(macAddress)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "connect failed", e)
                connected.set(false)
                connectedAddress.set(null)
                printer = null
                connection = null
                promise.reject("XPRINTER_CONNECT_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        Thread {
            try {
                connection?.close()
            } catch (e: Exception) {
                Log.w(TAG, "disconnect warning", e)
            } finally {
                connected.set(false)
                connectedAddress.set(null)
                printer = null
                connection = null
                promise.resolve(true)
            }
        }.start()
    }

    @ReactMethod
    fun printBitmapBase64(
        base64: String,
        widthMm: Int,
        heightMm: Int,
        copies: Int,
        promise: Promise,
    ) {
        Thread {
            try {
                val pure = base64.substringAfter("base64,", base64)
                val bytes = Base64.decode(pure, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    ?: throw Exception("Failed to decode bitmap")
                printBitmapInternal(bitmap, widthMm, heightMm, copies.coerceAtLeast(1), alreadySized = false)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "printBitmapBase64 failed", e)
                promise.reject("XPRINTER_PRINT_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun printBitmapFile(
        imagePath: String,
        widthMm: Int,
        heightMm: Int,
        copies: Int,
        promise: Promise,
    ) {
        Thread {
            try {
                if (!File(imagePath).exists()) {
                    throw Exception("Image file not found: $imagePath")
                }
                val bitmap = BitmapFactory.decodeFile(imagePath)
                    ?: throw Exception("Failed to decode image file")
                printBitmapInternal(bitmap, widthMm, heightMm, copies.coerceAtLeast(1), alreadySized = false)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "printBitmapFile failed", e)
                promise.reject("XPRINTER_PRINT_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Rasterize with layout-matched font metrics, then TSPLPrinter.bitmap.
     * DB403 built-in fonts are wider than Munbyn — raw TSPL still clips;
     * bitmap locks glyph width to tsplUtils math.
     */
    @ReactMethod
    fun printTsplAsBitmap(tsplCommands: String, copies: Int, promise: Promise) {
        Thread {
            try {
                val result = TsplRasterizer.rasterize(tsplCommands)
                printBitmapInternal(
                    result.bitmap,
                    result.widthMm,
                    result.heightMm,
                    copies.coerceAtLeast(1),
                    alreadySized = true,
                )
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "printTsplAsBitmap failed", e)
                promise.reject("XPRINTER_PRINT_ERROR", e.message, e)
            }
        }.start()
    }

    private fun printBitmapInternal(
        source: Bitmap,
        widthMm: Int,
        heightMm: Int,
        copies: Int,
        alreadySized: Boolean,
    ) {
        val tsp = printer ?: throw Exception("Xprinter printer not connected")
        if (connection?.isConnect != true) {
            throw Exception("Xprinter not connected")
        }

        val targetW = (widthMm * DOTS_PER_MM).roundToInt().coerceAtLeast(8)
        val targetH = (heightMm * DOTS_PER_MM).roundToInt().coerceAtLeast(8)
        val scaled =
            if (alreadySized) {
                source
            } else {
                Bitmap.createScaledBitmap(source, targetW, targetH, true)
            }
        val mono = toMonochrome(scaled)
        val limitWidth = mono.width.coerceAtLeast(8)

        tsp.sizeMm(widthMm.toDouble(), heightMm.toDouble())
            .gapMm(DEFAULT_GAP_MM, 0.0)
            .cls()
            .bitmap(
                0,
                0,
                TSPLConst.BMP_MODE_OVERWRITE,
                limitWidth,
                mono,
                AlgorithmType.Threshold,
            )
        // Explicit single PRINT command — avoid SDK print(n) quirks that can duplex
        val printCmd = "PRINT ${copies.coerceAtLeast(1)}\r\n"
        tsp.sendData(printCmd.toByteArray(Charsets.US_ASCII))

        Log.d(TAG, "TSPL bitmap sent ${widthMm}x${heightMm}mm copies=$copies w=$limitWidth")
    }

    private fun toMonochrome(bitmap: Bitmap): Bitmap {
        val w = bitmap.width
        val h = bitmap.height
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        for (i in pixels.indices) {
            val c = pixels[i]
            val r = (c shr 16) and 0xFF
            val g = (c shr 8) and 0xFF
            val b = c and 0xFF
            val gray = (0.299 * r + 0.587 * g + 0.114 * b).toInt()
            pixels[i] = if (gray < 160) Color.BLACK else Color.WHITE
        }
        out.setPixels(pixels, 0, w, 0, 0, w, h)
        return out
    }
}
