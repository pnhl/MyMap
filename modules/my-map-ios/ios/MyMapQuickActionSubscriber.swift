import ExpoModulesCore
import UIKit
public class MyMapQuickActionSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
    guard ["mymap.sos", "mymap.smart", "mymap.camera"].contains(shortcutItem.type) else { completionHandler(false); return }
    UserDefaults.standard.set(shortcutItem.type, forKey: "mymap.quick-action")
    NotificationCenter.default.post(name: Notification.Name("MyMapQuickAction"), object: nil)
    completionHandler(true)
  }
}
