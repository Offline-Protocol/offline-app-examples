// Draws the Cowrite, Stock Sync and Order Up app icons and writes them into each app.
// Run from the repo root: swift scripts/app-icons.swift
//
// Art is drawn on a 1024 canvas (origin bottom-left) and kept inside a ~300px circle
// around the center, so the same drawing works as the Android adaptive foreground.
import AppKit

func hex(_ v: UInt32) -> NSColor {
  NSColor(red: CGFloat(v >> 16 & 0xFF) / 255, green: CGFloat(v >> 8 & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
}

func fill(_ color: UInt32, _ path: NSBezierPath) { hex(color).setFill(); path.fill() }
func rrect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> NSBezierPath {
  NSBezierPath(roundedRect: NSRect(x: x, y: y, width: w, height: h), xRadius: r, yRadius: r)
}
func circle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat) -> NSBezierPath {
  NSBezierPath(ovalIn: NSRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
}

struct AppIcon {
  let dir: String
  let iosTarget: String
  let background: UInt32
  let draw: () -> Void
}

let apps = [
  // A page with two collaborators' cursors.
  AppIcon(dir: "cowrite", iosTarget: "Cowrite", background: 0x8A5CD6) {
    fill(0xFFFFFF, rrect(352, 282, 320, 460, 36))
    let lines: [(CGFloat, CGFloat)] = [(652, 240), (592, 196), (532, 240), (472, 128)]
    for (y, w) in lines { fill(0xDDD0F5, rrect(392, y - 14, w, 28, 14)) }
    for (x, y, color) in [(608.0, 592.0, 0x00A699), (540.0, 472.0, 0xFF385C)] as [(CGFloat, CGFloat, UInt32)] {
      fill(color, rrect(x, y - 32, 14, 64, 7))
      fill(color, circle(x + 7, y + 40, 13))
    }
  },
  // Stacked stock boxes.
  AppIcon(dir: "stocksync", iosTarget: "StockSync", background: 0x00A699) {
    for (x, y) in [(302, 316), (522, 316), (412, 512)] as [(CGFloat, CGFloat)] {
      fill(0xF7C98B, rrect(x, y, 200, 176, 18))
      fill(0xE09A4F, NSBezierPath(rect: NSRect(x: x + 80, y: y + 106, width: 40, height: 70)))
      fill(0xFFFFFF, rrect(x + 122, y + 22, 56, 34, 8))
    }
  },
  // A service bell, mid-ding.
  AppIcon(dir: "orderup", iosTarget: "OrderUp", background: 0xFF385C) {
    fill(0xFFFFFF, rrect(292, 330, 440, 48, 24))
    let dome = NSBezierPath()
    dome.appendArc(withCenter: NSPoint(x: 512, y: 390), radius: 190, startAngle: 0, endAngle: 180)
    dome.close()
    fill(0xFFFFFF, dome)
    fill(0xFFFFFF, rrect(496, 570, 32, 60, 8))
    fill(0xFFFFFF, circle(512, 650, 30))
    hex(0xFFC2CC).setStroke()
    let shine = NSBezierPath()
    shine.appendArc(withCenter: NSPoint(x: 512, y: 390), radius: 140, startAngle: 115, endAngle: 150)
    shine.lineWidth = 26; shine.lineCapStyle = .round; shine.stroke()
    NSColor.white.setStroke()
    for (a, b) in [((420, 640), (376, 684)), ((604, 640), (648, 684))] as [((CGFloat, CGFloat), (CGFloat, CGFloat))] {
      let ding = NSBezierPath()
      ding.move(to: NSPoint(x: a.0, y: a.1)); ding.line(to: NSPoint(x: b.0, y: b.1))
      ding.lineWidth = 24; ding.lineCapStyle = .round; ding.stroke()
    }
  },
]

enum Shape { case square, roundedSquare, circle, none }

func render(_ app: AppIcon, size: Int, shape: Shape, to path: String) {
  // App Store icons must be opaque, so the full-bleed square has no alpha channel.
  let alpha = shape != .square
  let cg = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                     space: CGColorSpace(name: CGColorSpace.sRGB)!,
                     bitmapInfo: (alpha ? CGImageAlphaInfo.premultipliedLast : .noneSkipLast).rawValue)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: false)
  let t = NSAffineTransform(); t.scale(by: CGFloat(size) / 1024); t.concat()
  switch shape {
  case .square: fill(app.background, NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1024, height: 1024)))
  case .roundedSquare: fill(app.background, rrect(0, 0, 1024, 1024, 180))
  case .circle: fill(app.background, circle(512, 512, 512))
  case .none: break
  }
  if shape != .none {
    // No launcher mask to leave room for, so the art can be bigger.
    let zoom = NSAffineTransform()
    zoom.translateX(by: 512, yBy: 512); zoom.scale(by: 1.2); zoom.translateX(by: -512, yBy: -512); zoom.concat()
  }
  app.draw()
  NSGraphicsContext.restoreGraphicsState()
  try! NSBitmapImageRep(cgImage: cg.makeImage()!).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

func write(_ text: String, _ path: String) {
  try! FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
  try! text.write(toFile: path, atomically: true, encoding: .utf8)
}

// Density scale in half-steps (mdpi = 1x = 2).
let densities: [(String, Int)] = [("mdpi", 2), ("hdpi", 3), ("xhdpi", 4), ("xxhdpi", 6), ("xxxhdpi", 8)]

for app in apps {
  let ios = "apps/\(app.dir)/ios/\(app.iosTarget)/Images.xcassets/AppIcon.appiconset"
  render(app, size: 1024, shape: .square, to: "\(ios)/Icon.png")
  write("""
  {
    "images" : [
      { "filename" : "Icon.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" }
    ],
    "info" : { "author" : "xcode", "version" : 1 }
  }

  """, "\(ios)/Contents.json")

  let res = "apps/\(app.dir)/android/app/src/main/res"
  for (name, half) in densities {
    render(app, size: 24 * half, shape: .roundedSquare, to: "\(res)/mipmap-\(name)/ic_launcher.png")
    render(app, size: 24 * half, shape: .circle, to: "\(res)/mipmap-\(name)/ic_launcher_round.png")
    render(app, size: 54 * half, shape: .none, to: "\(res)/mipmap-\(name)/ic_launcher_foreground.png")
  }
  let adaptive = """
  <?xml version="1.0" encoding="utf-8"?>
  <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
      <background android:drawable="@color/ic_launcher_background" />
      <foreground android:drawable="@mipmap/ic_launcher_foreground" />
  </adaptive-icon>

  """
  write(adaptive, "\(res)/mipmap-anydpi-v26/ic_launcher.xml")
  write(adaptive, "\(res)/mipmap-anydpi-v26/ic_launcher_round.xml")
  write("""
  <?xml version="1.0" encoding="utf-8"?>
  <resources>
      <color name="ic_launcher_background">#\(String(format: "%06X", app.background))</color>
  </resources>

  """, "\(res)/values/ic_launcher_background.xml")
}
