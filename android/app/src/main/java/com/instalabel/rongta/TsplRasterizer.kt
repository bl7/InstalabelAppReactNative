package com.instalabel.rongta

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.util.Log
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Rasterizes InstaLabel TSPL command strings (from tsplUtils) into a monochrome
 * bitmap at 203 DPI so Rongta ZPL bitmap printing matches existing label layouts.
 *
 * Supports the commands used by this app: SIZE, CLS, TEXT, LINE, BOX, SETMAG.
 */
object TsplRasterizer {
    private const val TAG = "TsplRasterizer"
    private const val DPI = 203f

    // Must match tsplUtils centerText / getFontHeight approximations so
    // rasterized TEXT width equals the layout math (avoids right-edge clip).
    private val FONT_CELLS = mapOf(
        "1" to Pair(6, 8),
        "2" to Pair(8, 12),
        "3" to Pair(10, 16),
        "4" to Pair(12, 20),
        "5" to Pair(14, 24),
        "6" to Pair(14, 19),
        "7" to Pair(21, 27),
        "8" to Pair(14, 25),
    )

    data class Result(
        val bitmap: Bitmap,
        val widthMm: Int,
        val heightMm: Int,
    )

    fun rasterize(tspl: String): Result {
        var widthMm = 60
        var heightMm = 40
        var setMagX = 1
        var setMagY = 1

        // First pass: SIZE
        for (raw in tspl.lineSequence()) {
            val line = raw.trim()
            if (line.uppercase().startsWith("SIZE")) {
                parseSize(line)?.let {
                    widthMm = it.first
                    heightMm = it.second
                }
            }
        }

        val widthDots = mmToDots(widthMm)
        val heightDots = mmToDots(heightMm)
        val bitmap = Bitmap.createBitmap(widthDots, heightDots, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            style = Paint.Style.FILL
            typeface = Typeface.MONOSPACE
            isFakeBoldText = false
            isAntiAlias = false // crisp thermal-like edges (AA + threshold looks too bold)
        }
        val stroke = Paint().apply {
            color = Color.BLACK
            style = Paint.Style.STROKE
            isAntiAlias = false
        }

        for (raw in tspl.lineSequence()) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            val upper = line.uppercase()

            when {
                upper.startsWith("CLS") -> {
                    canvas.drawColor(Color.WHITE)
                }
                upper.startsWith("SETMAG") -> {
                    parseSetMag(line)?.let {
                        setMagX = it.first
                        setMagY = it.second
                    }
                }
                upper.startsWith("TEXT") -> {
                    parseText(line)?.let { cmd ->
                        // Prefer explicit TEXT multipliers; fall back to SETMAG
                        val mx = if (cmd.xMul > 0) cmd.xMul else setMagX
                        val my = if (cmd.yMul > 0) cmd.yMul else setMagY
                        drawText(canvas, paint, cmd.x, cmd.y, cmd.font, mx, my, cmd.text)
                    }
                }
                upper.startsWith("LINE") -> {
                    parseLine(line)?.let { (x1, y1, x2, y2, thickness) ->
                        stroke.strokeWidth = max(1f, thickness.toFloat())
                        canvas.drawLine(x1.toFloat(), y1.toFloat(), x2.toFloat(), y2.toFloat(), stroke)
                    }
                }
                upper.startsWith("BOX") -> {
                    parseBox(line)?.let { (x1, y1, x2, y2, thickness) ->
                        stroke.strokeWidth = max(1f, thickness.toFloat())
                        canvas.drawRect(
                            x1.toFloat(),
                            y1.toFloat(),
                            x2.toFloat(),
                            y2.toFloat(),
                            stroke,
                        )
                    }
                }
            }
        }

        Log.d(TAG, "Rasterized ${widthMm}x${heightMm}mm → ${widthDots}x${heightDots}px")
        return Result(toMonochrome(bitmap), widthMm, heightMm)
    }

    private fun mmToDots(mm: Int): Int = ((mm * DPI) / 25.4f).roundToInt().coerceAtLeast(8)

    private fun parseSize(line: String): Pair<Int, Int>? {
        // SIZE 60 mm,40 mm | SIZE 60mm,40mm | SIZE 56 mm,80 mm
        val re = Regex(
            """SIZE\s+(\d+(?:\.\d+)?)\s*mm?\s*,\s*(\d+(?:\.\d+)?)\s*mm?""",
            RegexOption.IGNORE_CASE,
        )
        val m = re.find(line) ?: return null
        return m.groupValues[1].toFloat().roundToInt() to m.groupValues[2].toFloat().roundToInt()
    }

    private fun parseSetMag(line: String): Pair<Int, Int>? {
        val re = Regex("""SETMAG\s+(\d+)\s*,\s*(\d+)""", RegexOption.IGNORE_CASE)
        val m = re.find(line) ?: return null
        return m.groupValues[1].toInt() to m.groupValues[2].toInt()
    }

    private data class TextCmd(
        val x: Int,
        val y: Int,
        val font: String,
        val xMul: Int,
        val yMul: Int,
        val text: String,
    )

    private fun parseText(line: String): TextCmd? {
        // TEXT x,y,"font",rotation,xmul,ymul,"content"
        val re = Regex(
            """TEXT\s+(\d+)\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"(.*)"\s*$""",
            RegexOption.IGNORE_CASE,
        )
        val m = re.find(line) ?: return null
        return TextCmd(
            x = m.groupValues[1].toInt(),
            y = m.groupValues[2].toInt(),
            font = m.groupValues[3],
            xMul = m.groupValues[5].toInt(),
            yMul = m.groupValues[6].toInt(),
            text = m.groupValues[7]
                .replace("\\\"", "\"")
                .replace("\\n", "\n"),
        )
    }

    private fun parseLine(line: String): Quint? {
        val re = Regex(
            """LINE\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)""",
            RegexOption.IGNORE_CASE,
        )
        val m = re.find(line) ?: return null
        return Quint(
            m.groupValues[1].toInt(),
            m.groupValues[2].toInt(),
            m.groupValues[3].toInt(),
            m.groupValues[4].toInt(),
            m.groupValues[5].toInt(),
        )
    }

    private fun parseBox(line: String): Quint? {
        val re = Regex(
            """BOX\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)""",
            RegexOption.IGNORE_CASE,
        )
        val m = re.find(line) ?: return null
        return Quint(
            m.groupValues[1].toInt(),
            m.groupValues[2].toInt(),
            m.groupValues[3].toInt(),
            m.groupValues[4].toInt(),
            m.groupValues[5].toInt(),
        )
    }

    private data class Quint(
        val a: Int,
        val b: Int,
        val c: Int,
        val d: Int,
        val e: Int,
    )

    private fun drawText(
        canvas: Canvas,
        paint: Paint,
        x: Int,
        y: Int,
        font: String,
        xMul: Int,
        yMul: Int,
        text: String,
    ) {
        val cell = FONT_CELLS[font] ?: FONT_CELLS["3"]!!
        val charW = cell.first * xMul.coerceAtLeast(1)
        val charH = cell.second * yMul.coerceAtLeast(1)

        // Match TSC monospace cell metrics used by tsplUtils centering math
        paint.textSize = charH * 0.92f + 4f
        paint.typeface = Typeface.MONOSPACE
        paint.isFakeBoldText = true
        paint.isAntiAlias = false
        paint.strokeWidth = 0f
        paint.style = Paint.Style.FILL

        val fm = paint.fontMetrics
        // TSPL Y is top of character cell; Android drawText uses baseline
        val baseline = y - fm.ascent

        // Draw character-by-character with fixed cell width to match TSPL layout math
        var cursorX = x.toFloat()
        for (ch in text) {
            if (ch == '\n') continue
            val str = ch.toString()
            val bounds = Rect()
            paint.getTextBounds(str, 0, 1, bounds)
            // Center glyph in the monospace cell
            val glyphWidth = paint.measureText(str)
            val offset = ((charW - glyphWidth) / 2f).coerceAtLeast(0f)
            canvas.drawText(str, cursorX + offset, baseline, paint)
            cursorX += charW
        }
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
            pixels[i] = if (gray < 200) Color.BLACK else Color.WHITE
        }
        out.setPixels(pixels, 0, w, 0, 0, w, h)
        return out
    }
}
