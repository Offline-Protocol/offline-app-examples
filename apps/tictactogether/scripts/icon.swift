import AppKit
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor(red: 0.984, green: 0.973, blue: 0.949, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1024, height: 1024)).fill()
NSColor(red: 0.94, green: 0.47, blue: 0.41, alpha: 1).setStroke()
let cross = NSBezierPath(); cross.lineWidth = 80; cross.lineCapStyle = .round
cross.move(to: NSPoint(x: 190, y: 620)); cross.line(to: NSPoint(x: 450, y: 360))
cross.move(to: NSPoint(x: 450, y: 620)); cross.line(to: NSPoint(x: 190, y: 360)); cross.stroke()
NSColor(red: 0.545, green: 0.47, blue: 0.835, alpha: 1).setStroke()
let circle = NSBezierPath(ovalIn: NSRect(x: 565, y: 355, width: 265, height: 265)); circle.lineWidth = 80; circle.stroke()
NSColor(red: 0.80, green: 0.91, blue: 0.86, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 370, y: 155, width: 280, height: 48), xRadius: 24, yRadius: 24).fill()
NSGraphicsContext.restoreGraphicsState()
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "ios/Tictactogether/Images.xcassets/AppIcon.appiconset/Icon.png"))
