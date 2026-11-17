import ExpoModulesCore
import Foundation

/**
 The player's own iCloud key-value store, for keeping their progress safe
 when the game is deleted or moved to a new iPhone (src/game/cloudSave.ts).

 Apple's NSUbiquitousKeyValueStore: up to 1 MB per app per Apple ID,
 stored in the player's iCloud account, never on our servers. Every call
 here is synchronous and cheap; the system syncs with iCloud on its own.
 Nothing here throws.
 */
public class ICloudStoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ICloudStore")

    // Signed in to iCloud on this phone. Writes still succeed when this is
    // false; they simply stay on the phone until the player signs in.
    Function("isSignedIn") { () -> Bool in
      return FileManager.default.ubiquityIdentityToken != nil
    }

    // Asks the system to exchange changes with iCloud soon. False means the
    // app was built without the iCloud entitlement.
    Function("synchronize") { () -> Bool in
      return NSUbiquitousKeyValueStore.default.synchronize()
    }

    Function("getString") { (key: String) -> String? in
      return NSUbiquitousKeyValueStore.default.string(forKey: key)
    }

    Function("setString") { (key: String, value: String) -> Bool in
      let store = NSUbiquitousKeyValueStore.default
      store.set(value, forKey: key)
      return store.synchronize()
    }

    Function("remove") { (key: String) -> Bool in
      let store = NSUbiquitousKeyValueStore.default
      store.removeObject(forKey: key)
      return store.synchronize()
    }

    Function("keys") { () -> [String] in
      return Array(NSUbiquitousKeyValueStore.default.dictionaryRepresentation.keys)
    }
  }
}
