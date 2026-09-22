package com.instalabel.rongta

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.rt.printerlibrary.bean.BluetoothEdrConfigBean
import com.rt.printerlibrary.bean.LableSizeBean
import com.rt.printerlibrary.bean.Position
import com.rt.printerlibrary.cmd.Cmd
import com.rt.printerlibrary.cmd.ZplFactory
import com.rt.printerlibrary.connect.PrinterInterface
import com.rt.printerlibrary.enumerate.CommonEnum
import com.rt.printerlibrary.enumerate.ConnectStateEnum
import com.rt.printerlibrary.enumerate.PrintDirection
import com.rt.printerlibrary.exception.SdkException
import com.rt.printerlibrary.factory.connect.BluetoothFactory
import com.rt.printerlibrary.factory.printer.LabelPrinterFactory
import com.rt.printerlibrary.observer.PrinterObserver
import com.rt.printerlibrary.observer.PrinterObserverManager
import com.rt.printerlibrary.printer.RTPrinter
import com.rt.printerlibrary.setting.BitmapSetting
import com.rt.printerlibrary.setting.CommonSetting
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.roundToInt

/**
 * Official Rongta RTPrinterSDK bridge.
 *
 * Uses LabelPrinterFactory + BluetoothFactory + ZplFactory.getBitmapCmd,
 * matching PrinterExample ImagePrintActivity.zplPrint().
 */
class RongtaPrintBridge(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), PrinterObserver {

    companion object {
        private const val TAG = "RongtaPrintBridge"
        private const val MODULE_NAME = "RongtaPrintBridge"
        private const val DPI = 203
        private const val DOTS_PER_MM = DPI / 25.4

        fun isRongtaDeviceName(name: String?): Boolean {
            if (name.isNullOrBlank()) return false
            val n = name.uppercase()
            return n.contains("RONGTA") ||
                n.contains("RP425") ||
                n.contains("RP420") ||
                n.contains("RP421") ||
                n.contains("RP422") ||
                n.contains("RP410") ||
                n.contains("RP411") ||
                n.contains("RP415") ||
                n.startsWith("RP4")
        }
    }

    @Suppress("UNCHECKED_CAST")
    private var rtPrinter: RTPrinter<Any>? = null
    private val connected = AtomicBoolean(false)
    private val connectedAddress = AtomicReference<String?>(null)

    override fun getName(): String = MODULE_NAME

    init {
        PrinterObserverManager.getInstance().add(this)
    }

    override fun printerObserverCallback(printerInterface: PrinterInterface<*>?, state: Int) {
        when (state) {
            CommonEnum.CONNECT_STATE_SUCCESS -> {
                connected.set(true)
                Log.d(TAG, "CONNECT_STATE_SUCCESS")
            }
            CommonEnum.CONNECT_STATE_INTERRUPTED -> {
                connected.set(false)
                connectedAddress.set(null)
                Log.d(TAG, "CONNECT_STATE_INTERRUPTED")
            }
        }
    }

    override fun printerReadMsgCallback(printerInterface: PrinterInterface<*>?, bytes: ByteArray?) {
        // no-op
    }

    @ReactMethod
    fun isRongtaPrinter(name: String?, promise: Promise) {
        promise.resolve(isRongtaDeviceName(name))
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        val map: WritableMap = Arguments.createMap()
        map.putBoolean("connected", connected.get() || rtPrinter?.connectState == ConnectStateEnum.Connected)
        map.putString("address", connectedAddress.get())
        promise.resolve(map)
    }

    @ReactMethod
    fun connect(macAddress: String, promise: Promise) {
        Thread {
            try {
                val adapter = BluetoothAdapter.getDefaultAdapter()
                    ?: throw Exception("Bluetooth adapter not available")
                if (!adapter.isEnabled) {
                    throw Exception("Bluetooth is not enabled")
                }

                val device: BluetoothDevice = adapter.getRemoteDevice(macAddress)

                try {
                    rtPrinter?.disConnect()
                } catch (_: Exception) {
                }

                @Suppress("UNCHECKED_CAST")
                rtPrinter = LabelPrinterFactory().create() as RTPrinter<Any>

                val config = BluetoothEdrConfigBean(device)
                val printerInterface = BluetoothFactory().create()
                printerInterface.setConfigObject(config)
                rtPrinter?.setPrinterInterface(printerInterface)

                val latch = CountDownLatch(1)
                val ok = AtomicBoolean(false)

                val oneShot = object : PrinterObserver {
                    override fun printerObserverCallback(
                        printerInterface: PrinterInterface<*>?,
                        state: Int,
                    ) {
                        if (state == CommonEnum.CONNECT_STATE_SUCCESS) {
                            ok.set(true)
                            latch.countDown()
                        } else if (state == CommonEnum.CONNECT_STATE_INTERRUPTED) {
                            latch.countDown()
                        }
                    }

                    override fun printerReadMsgCallback(
                        printerInterface: PrinterInterface<*>?,
                        bytes: ByteArray?,
                    ) {
                    }
                }
                PrinterObserverManager.getInstance().add(oneShot)

                try {
                    rtPrinter?.connect(config)
                    latch.await(12, TimeUnit.SECONDS)

                    val state = rtPrinter?.connectState
                    if (ok.get() || state == ConnectStateEnum.Connected) {
                        connected.set(true)
                        connectedAddress.set(macAddress)
                        promise.resolve(true)
                    } else {
                        throw Exception("Rongta connect failed or timed out")
                    }
                } finally {
                    PrinterObserverManager.getInstance().remove(oneShot)
                }
            } catch (e: Exception) {
                Log.e(TAG, "connect failed", e)
                connected.set(false)
                connectedAddress.set(null)
                promise.reject("RONGTA_CONNECT_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        Thread {
            try {
                rtPrinter?.disConnect()
            } catch (e: Exception) {
                Log.w(TAG, "disconnect warning", e)
            } finally {
                connected.set(false)
                connectedAddress.set(null)
                rtPrinter = null
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
                printBitmapInternal(bitmap, widthMm, heightMm, copies.coerceAtLeast(1))
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "printBitmapBase64 failed", e)
                promise.reject("RONGTA_PRINT_ERROR", e.message, e)
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
                printBitmapInternal(bitmap, widthMm, heightMm, copies.coerceAtLeast(1))
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "printBitmapFile failed", e)
                promise.reject("RONGTA_PRINT_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Pixel-perfect path for InstaLabel: rasterize the same TSPL layout used by
     * non-Rongta printers, then print via official ZplFactory.getBitmapCmd.
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
                promise.reject("RONGTA_PRINT_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Fallback content printer: draw lines → monochrome bitmap → official getBitmapCmd.
     */
    @ReactMethod
    fun printLabelContent(payload: ReadableMap, promise: Promise) {
        Thread {
            try {
                val widthMm = if (payload.hasKey("widthMm")) payload.getInt("widthMm") else 60
                val heightMm = if (payload.hasKey("heightMm")) payload.getInt("heightMm") else 40
                val copies = if (payload.hasKey("copies")) payload.getInt("copies") else 1
                val lines = mutableListOf<String>()
                payload.getArray("lines")?.let { arr ->
                    for (i in 0 until arr.size()) {
                        arr.getString(i)?.takeIf { it.isNotBlank() }?.let { lines.add(it) }
                    }
                }
                val bitmap = renderLabelBitmap(lines, widthMm, heightMm)
                printBitmapInternal(bitmap, widthMm, heightMm, copies.coerceAtLeast(1))
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "printLabelContent failed", e)
                promise.reject("RONGTA_PRINT_ERROR", e.message, e)
            }
        }.start()
    }

    /**
     * Mirrors Rongta demo ImagePrintActivity.zplPrint().
     * @param alreadySized when true, bitmap is already at label DPI size (from TSPL raster).
     */
    private fun printBitmapInternal(
        source: Bitmap,
        widthMm: Int,
        heightMm: Int,
        copies: Int,
        alreadySized: Boolean = false,
    ) {
        val printer = rtPrinter ?: throw Exception("Rongta printer not connected")

        val targetW = (widthMm * DOTS_PER_MM).roundToInt().coerceAtLeast(8)
        val targetH = (heightMm * DOTS_PER_MM).roundToInt().coerceAtLeast(8)
        val scaled =
            if (alreadySized && source.width == targetW && source.height == targetH) {
                source
            } else if (alreadySized) {
                source
            } else {
                Bitmap.createScaledBitmap(source, targetW, targetH, true)
            }
        val mono = toMonochrome(scaled)

        val zplCmd: Cmd = ZplFactory().create()
        zplCmd.append(zplCmd.getHeaderCmd())

        val commonSetting = CommonSetting()
        commonSetting.setLableSizeBean(LableSizeBean(widthMm, heightMm))
        commonSetting.setPrintDirection(PrintDirection.NORMAL)
        zplCmd.append(zplCmd.getHeaderCmd())
        zplCmd.append(zplCmd.getCommonSettingCmd(commonSetting))

        val bitmapSetting = BitmapSetting()
        bitmapSetting.setPrintPostion(Position(0, 0))
        // Demo uses widthMm * 8 as limit width (bytes-related limit in SDK)
        bitmapSetting.setBimtapLimitWidth(widthMm * 8)

        try {
            zplCmd.append(zplCmd.getBitmapCmd(bitmapSetting, mono))
            zplCmd.append(zplCmd.getPrintCopies(copies))
        } catch (e: SdkException) {
            throw Exception("Rongta getBitmapCmd failed: ${e.message}", e)
        }

        zplCmd.append(zplCmd.getEndCmd())
        printer.writeMsg(zplCmd.getAppendCmds())
        Log.d(TAG, "ZPL bitmap sent ${widthMm}x${heightMm}mm copies=$copies")
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

    private fun renderLabelBitmap(lines: List<String>, widthMm: Int, heightMm: Int): Bitmap {
        val w = (widthMm * DOTS_PER_MM).roundToInt().coerceAtLeast(100)
        val h = (heightMm * DOTS_PER_MM).roundToInt().coerceAtLeast(80)
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textSize = (h * 0.12f).coerceIn(22f, 48f)
        }
        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = (h * 0.08f).coerceIn(16f, 32f)
        }

        var y = titlePaint.textSize + 12f
        val x = 12f
        val maxWidth = w - 24f
        lines.forEachIndexed { index, raw ->
            val paint = if (index == 0) titlePaint else bodyPaint
            for (part in wrapText(raw, paint, maxWidth)) {
                if (y > h - 8) return bitmap
                canvas.drawText(part, x, y, paint)
                y += paint.textSize + 6f
            }
            y += 4f
        }
        return bitmap
    }

    private fun wrapText(text: String, paint: Paint, maxWidth: Float): List<String> {
        if (paint.measureText(text) <= maxWidth) return listOf(text)
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var current = StringBuilder()
        for (word in words) {
            val trial = if (current.isEmpty()) word else "$current $word"
            if (paint.measureText(trial) <= maxWidth) {
                current = StringBuilder(trial)
            } else {
                if (current.isNotEmpty()) lines.add(current.toString())
                current = StringBuilder(word)
            }
        }
        if (current.isNotEmpty()) lines.add(current.toString())
        return if (lines.isEmpty()) listOf(text) else lines
    }
}
