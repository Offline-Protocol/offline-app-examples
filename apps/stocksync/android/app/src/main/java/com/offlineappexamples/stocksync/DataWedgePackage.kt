package com.offlineappexamples.stocksync

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers [DataWedgeModule]. A plain native module, reached through the TurboModule interop. */
class DataWedgePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == DataWedgeModule.NAME) DataWedgeModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
        DataWedgeModule.NAME to
            ReactModuleInfo(
                name = DataWedgeModule.NAME,
                className = DataWedgeModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = false,
            ),
    )
  }
}
