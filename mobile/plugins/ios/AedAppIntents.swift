// Siri / Shortcuts integration for the GdzieAED emergency screen.
// Added to the main app target by plugins/with-aed-siri.js during `expo prebuild`
// (App Shortcuts are only discovered when they live in the app target, not in a pod).

import AppIntents
import UIKit

@available(iOS 16.0, *)
private func openInApp(_ path: String) async {
  guard let url = URL(string: "mobywatelaed://\(path)") else { return }
  await MainActor.run {
    UIApplication.shared.open(url)
  }
}

@available(iOS 16.0, *)
struct FindNearestAedIntent: AppIntent {
  static var title: LocalizedStringResource = "Find the nearest AED"
  static var description = IntentDescription("Shows defibrillators (AED) near you and how to get there.")
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    await openInApp("emergency")
    return .result()
  }
}

@available(iOS 16.0, *)
struct NavigateToNearestAedIntent: AppIntent {
  static var title: LocalizedStringResource = "Navigate to the nearest AED"
  static var description = IntentDescription("Starts walking directions in Google Maps to the nearest defibrillator.")
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    await openInApp("emergency?go=1")
    return .result()
  }
}

@available(iOS 16.0, *)
struct AedShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: FindNearestAedIntent(),
      phrases: [
        "I have an emergency in \(.applicationName)",
        "Emergency in \(.applicationName)",
        "\(.applicationName) emergency",
        "Where is the nearest AED in \(.applicationName)",
        "Find the nearest AED with \(.applicationName)",
        "Find the nearest defibrillator with \(.applicationName)",
      ],
      shortTitle: "Nearest AED",
      systemImageName: "heart.fill"
    )
    AppShortcut(
      intent: NavigateToNearestAedIntent(),
      phrases: [
        "Take me to the nearest AED with \(.applicationName)",
        "Navigate to the nearest AED with \(.applicationName)",
        "Navigate to a defibrillator with \(.applicationName)",
      ],
      shortTitle: "Navigate to AED",
      systemImageName: "figure.walk"
    )
  }
}
