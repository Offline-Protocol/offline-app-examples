package com.offlineappexamples.cowrite

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    // Registered as families so fontWeight picks the right file (see packages/ui/fonts).
    ReactFontManager.getInstance().addCustomFont(this, "Space Grotesk", R.font.space_grotesk)
    ReactFontManager.getInstance().addCustomFont(this, "DM Serif Display", R.font.dm_serif_display)
  }
}
