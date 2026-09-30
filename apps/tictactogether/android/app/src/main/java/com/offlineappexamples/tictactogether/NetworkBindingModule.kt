package com.offlineappexamples.tictactogether

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

/** Prefer VALIDATED Wi‑Fi, else cellular; avoid unvalidated Wi‑Fi. */
class NetworkBindingModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var pendingCallback: ConnectivityManager.NetworkCallback? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun preferWifi(promise: Promise) {
    preferUplink(promise)
  }

  @ReactMethod
  fun preferUplink(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
      promise.resolve(false)
      return
    }

    val cm =
      reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    if (cm == null) {
      promise.resolve(false)
      return
    }

    val existing = findValidatedUplink(cm)
    if (existing != null && bindTo(cm, existing)) {
      promise.resolve(true)
      return
    }

    requestValidatedInternet(cm, promise)
  }

  @ReactMethod
  fun clearBinding(promise: Promise) {
    val cm =
      reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    if (cm == null) {
      promise.resolve(false)
      return
    }
    unregisterPending(cm)
    val cleared =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        cm.bindProcessToNetwork(null)
      } else {
        @Suppress("DEPRECATION")
        ConnectivityManager.setProcessDefaultNetwork(null)
      }
    promise.resolve(cleared)
  }

  private fun isValidated(caps: NetworkCapabilities): Boolean {
    if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
      return false
    }
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    } else {
      true
    }
  }

  private fun findValidatedUplink(cm: ConnectivityManager): Network? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return null

    var validatedWifi: Network? = null
    var validatedOther: Network? = null

    for (network in cm.allNetworks) {
      val caps = cm.getNetworkCapabilities(network) ?: continue
      if (!isValidated(caps)) continue
      if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
        validatedWifi = network
      } else {
        validatedOther = network
      }
    }

    return validatedWifi ?: validatedOther
  }

  private fun requestValidatedInternet(cm: ConnectivityManager, promise: Promise) {
    val settled = AtomicBoolean(false)
    fun settle(ok: Boolean) {
      if (settled.compareAndSet(false, true)) {
        promise.resolve(ok)
      }
    }

    val builder =
      NetworkRequest.Builder()
        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      builder.addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
    val request = builder.build()

    val callback =
      object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          tryBindValidated(cm, network, settled, promise)
        }

        override fun onCapabilitiesChanged(
          network: Network,
          networkCapabilities: NetworkCapabilities,
        ) {
          if (isValidated(networkCapabilities)) {
            tryBindValidated(cm, network, settled, promise)
          }
        }

        override fun onUnavailable() {
          mainHandler.post {
            unregisterPending(cm)
            settle(false)
          }
        }
      }

    pendingCallback = callback
    try {
      cm.requestNetwork(request, callback)
    } catch (_: SecurityException) {
      pendingCallback = null
      settle(false)
      return
    } catch (_: RuntimeException) {
      pendingCallback = null
      settle(false)
      return
    }

    mainHandler.postDelayed(
      {
        if (settled.get()) return@postDelayed
        unregisterPending(cm)
        val network = findValidatedUplink(cm)
        settle(network != null && bindTo(cm, network))
      },
      REQUEST_TIMEOUT_MS,
    )
  }

  private fun tryBindValidated(
    cm: ConnectivityManager,
    network: Network,
    settled: AtomicBoolean,
    promise: Promise,
  ) {
    mainHandler.post {
      if (settled.get()) return@post
      val caps = cm.getNetworkCapabilities(network)
      if (caps == null || !isValidated(caps)) return@post
      val ok = bindTo(cm, network)
      unregisterPending(cm)
      if (settled.compareAndSet(false, true)) {
        promise.resolve(ok)
      }
    }
  }

  private fun bindTo(cm: ConnectivityManager, network: Network): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      cm.bindProcessToNetwork(network)
    } else {
      @Suppress("DEPRECATION")
      ConnectivityManager.setProcessDefaultNetwork(network)
    }
  }

  private fun unregisterPending(cm: ConnectivityManager) {
    val callback = pendingCallback ?: return
    pendingCallback = null
    try {
      cm.unregisterNetworkCallback(callback)
    } catch (_: IllegalArgumentException) {
      // Already unregistered.
    }
  }

  companion object {
    const val NAME = "NetworkBinding"
    private const val REQUEST_TIMEOUT_MS = 6_000L
  }
}
