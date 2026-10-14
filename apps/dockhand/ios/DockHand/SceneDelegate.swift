import UIKit

/// iOS 27+ requires UIScene lifecycle when built with Xcode 27 (see TN3187).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let appWindow = appDelegate.window
    else {
      return
    }

    appWindow.windowScene = windowScene
    window = appWindow
    window?.makeKeyAndVisible()
  }
}
