import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
#if DEBUG
import Network
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  #if DEBUG
  /// Keeps a Bonjour browser alive so iOS shows Local Network permission (needed for Metro on device).
  private static var localNetworkBrowser: NWBrowser?
  #endif

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    #if DEBUG
    triggerLocalNetworkPermissionIfNeeded()
    #endif

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "OutageNet",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  #if DEBUG
  private func triggerLocalNetworkPermissionIfNeeded() {
    let params = NWParameters()
    params.includePeerToPeer = true
    let browser = NWBrowser(for: .bonjour(type: "_http._tcp", domain: nil), using: params)
    browser.start(queue: .main)
    AppDelegate.localNetworkBrowser = browser
  }
  #endif
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    #if targetEnvironment(simulator)
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
    // Device Debug builds embed main.jsbundle at compile time; prefer it so the app
    // opens when Metro / Local Network is unavailable (see react-native-xcode.sh).
    if let embedded = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
      return embedded
    }
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #endif
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
