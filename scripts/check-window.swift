// Used by the GitHub build (.github/workflows/build.yml) on a Mac, while Lux is open: checks that the Lux window is
// inside the part of the main screen a window can use (below the menu bar, above the Dock), and with --fills that it
// takes up all of it (when Lux was told to open bigger than the screen). Exits with 1 if not, or if there is no Lux
// window.
import AppKit

_ = NSApplication.shared
guard let screen = NSScreen.screens.first else { print("No screen"); exit(1) }
// Cocoa counts up from the bottom of the main screen; the window list counts down from its top.
let visible = screen.visibleFrame, top = screen.frame.maxY
let usable = CGRect(x: visible.minX, y: top - visible.maxY, width: visible.width, height: visible.height)
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as NSArray? as? [[String: Any]] ?? []
let lux = windows.compactMap { w -> CGRect? in
    guard (w[kCGWindowOwnerName as String] as? String ?? "").hasPrefix("Lux"),
          (w[kCGWindowLayer as String] as? Int ?? -1) == 0,
          let bounds = w[kCGWindowBounds as String] as? NSDictionary else { return nil }
    return CGRect(dictionaryRepresentation: bounds as CFDictionary)
}.max { $0.width * $0.height < $1.width * $1.height }
guard let window = lux else { print("No Lux window found"); exit(1) }
print("Lux window: \(window), usable part of the screen: \(usable)")
let fills = !CommandLine.arguments.contains("--fills") || (window.width >= usable.width - 2 && window.height >= usable.height - 2)
exit(usable.insetBy(dx: -2, dy: -2).contains(window) && window.width >= 400 && window.height >= 400 && fills ? 0 : 1)
