package com.offlineappexamples.stocksync

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Barcode scans from Zebra DataWedge, delivered to JavaScript as `StockSyncScan` events.
 *
 * DataWedge reads the scanner and broadcasts each scan as an intent. [start] registers a receiver
 * for that intent and, when DataWedge is installed, creates or updates a DataWedge profile for this
 * app with the SET_CONFIG API: barcode input on, intent output by broadcast, keystroke output off.
 * On phones without DataWedge the receiver is still registered, so `adb shell am broadcast` can
 * stand in for the scanner (see zebra/simulate-scan.sh).
 *
 * DataWedge intent API: https://techdocs.zebra.com/datawedge/latest/guide/api/setconfig/
 * Intent output and its extras: https://techdocs.zebra.com/datawedge/latest/guide/output/intent/
 */
class DataWedgeModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  /** com.offlineappexamples.stocksync.SCAN for the stock applicationId. */
  private val scanAction = "${context.packageName}.SCAN"
  private var receiver: BroadcastReceiver? = null

  override fun getName(): String = NAME

  /** Starts listening for scans and configures DataWedge if present. Resolves `{ dataWedge }`. */
  @ReactMethod
  fun start(promise: Promise) {
    register()
    val hasDataWedge = isInstalled(DATAWEDGE_PACKAGE)
    if (hasDataWedge) configureProfile()
    promise.resolve(Arguments.createMap().apply { putBoolean("dataWedge", hasDataWedge) })
  }

  @ReactMethod
  fun stop() = unregister()

  override fun invalidate() {
    unregister()
    super.invalidate()
  }

  @SuppressLint("UnspecifiedRegisterReceiverFlag") // the flag only exists from API 33
  private fun register() {
    if (receiver != null) return
    val r =
        object : BroadcastReceiver() {
          override fun onReceive(context: Context, intent: Intent) = onIntent(intent)
        }
    val filter =
        IntentFilter().apply {
          addAction(scanAction)
          addAction(RESULT_ACTION)
          // Matches DataWedge's DEFAULT category and intents with no category (adb).
          addCategory(Intent.CATEGORY_DEFAULT)
        }
    // Exported because DataWedge is another app. Any app could send this action too; the JS
    // side only acts on barcodes that belong to a product, and only ever as a +1.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.registerReceiver(r, filter, Context.RECEIVER_EXPORTED)
    } else {
      reactApplicationContext.registerReceiver(r, filter)
    }
    receiver = r
  }

  private fun unregister() {
    val r = receiver ?: return
    receiver = null
    try {
      reactApplicationContext.unregisterReceiver(r)
    } catch (e: IllegalArgumentException) {
      // Already unregistered.
    }
  }

  private fun onIntent(intent: Intent) {
    when (intent.action) {
      scanAction -> {
        val data = intent.getStringExtra(EXTRA_DATA_STRING) ?: return
        val scan =
            Arguments.createMap().apply {
              putString("data", data)
              putString("labelType", intent.getStringExtra(EXTRA_LABEL_TYPE))
            }
        reactApplicationContext.emitDeviceEvent(SCAN_EVENT, scan)
      }
      RESULT_ACTION ->
          if (intent.getStringExtra("COMMAND_IDENTIFIER") == PROFILE_NAME) {
            Log.i(TAG, "DataWedge SET_CONFIG: ${intent.getStringExtra("RESULT")}")
          }
    }
  }

  /**
   * SET_CONFIG with CREATE_IF_NOT_EXIST creates the profile once and updates the given plugins on
   * every later start, so the profile stays correct even if someone edits it on the device.
   */
  private fun configureProfile() {
    val barcode =
        plugin("BARCODE") {
          putString("scanner_selection", "auto")
          putString("scanner_input_enabled", "true")
        }
    val intentOutput =
        plugin("INTENT") {
          putString("intent_output_enabled", "true")
          putString("intent_action", scanAction)
          putString("intent_category", Intent.CATEGORY_DEFAULT)
          putInt("intent_delivery", 2) // 0 start activity, 1 start service, 2 broadcast
        }
    val keystroke = plugin("KEYSTROKE") { putString("keystroke_output_enabled", "false") }
    val app =
        Bundle().apply {
          putString("PACKAGE_NAME", reactApplicationContext.packageName)
          putStringArray("ACTIVITY_LIST", arrayOf("*"))
        }
    val profile =
        Bundle().apply {
          putString("PROFILE_NAME", PROFILE_NAME)
          putString("PROFILE_ENABLED", "true")
          putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
          // Several plugins in one call needs DataWedge 6.5 or later.
          putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(barcode, intentOutput, keystroke))
          putParcelableArray("APP_LIST", arrayOf(app))
        }
    val intent =
        Intent(API_ACTION).apply {
          putExtra(EXTRA_SET_CONFIG, profile)
          putExtra("SEND_RESULT", "COMPLETE_RESULT")
          putExtra("COMMAND_IDENTIFIER", PROFILE_NAME)
        }
    reactApplicationContext.sendBroadcast(intent)
  }

  private fun plugin(name: String, params: Bundle.() -> Unit): Bundle =
      Bundle().apply {
        putString("PLUGIN_NAME", name)
        putString("RESET_CONFIG", "true")
        putBundle("PARAM_LIST", Bundle().apply(params))
      }

  @Suppress("DEPRECATION") // getPackageInfo(String, PackageInfoFlags) needs API 33
  private fun isInstalled(packageName: String): Boolean =
      try {
        reactApplicationContext.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }

  companion object {
    const val NAME = "DataWedge"
    const val SCAN_EVENT = "StockSyncScan" // src/scanner.ts
    private const val TAG = "StockSyncDataWedge"
    private const val PROFILE_NAME = "StockSync"

    // Visible to this app through <queries> in AndroidManifest.xml.
    private const val DATAWEDGE_PACKAGE = "com.symbol.datawedge"
    private const val API_ACTION = "com.symbol.datawedge.api.ACTION"
    private const val RESULT_ACTION = "com.symbol.datawedge.api.RESULT_ACTION"
    private const val EXTRA_SET_CONFIG = "com.symbol.datawedge.api.SET_CONFIG"
    private const val EXTRA_DATA_STRING = "com.symbol.datawedge.data_string"
    private const val EXTRA_LABEL_TYPE = "com.symbol.datawedge.label_type"
  }
}
