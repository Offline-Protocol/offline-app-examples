# Stock Sync on Zebra devices: IT guide

Stock Sync lets nearby Android devices count stock together over Bluetooth, with no Wi-Fi,
internet or server. On Zebra devices, a barcode scan adds one to the matching item on every
device. This page covers what the app needs from the device and how to set it up with
StageNow or an EMM. The profile in this folder hasn't been applied to a Zebra device yet, so
apply it to one device and run the checks below before you roll it out.

App package: `com.offlineappexamples.stocksync`. If you rebuild the app with a different
applicationId, change it in both XML files.

## What the app needs and why

| Need | Why | Set by |
| --- | --- | --- |
| Bluetooth on | Devices find and talk to each other over Bluetooth Low Energy. | `stocksync-mx.xml`: WirelessMgr `BluetoothState` |
| Bluetooth scan, connect and advertise, nearby Wi-Fi devices and location permissions | Android asks the user for these on first use. Pre-granting them removes the prompts. Location is only used on Android 11 and older, where Bluetooth scanning needs it. | AccessMgr "All Dangerous Permissions", plus `AutomaticPermissionControl` off so Android doesn't take them back from an app that sits unused |
| Location on | Android 11 and older only return Bluetooth scan results while Location is on. | WirelessMgr `LocationState` |
| No battery optimisation | Doze and App Standby restrict background work while a device sits idle with the screen off, which can drop its link to the other devices. | AppMgr `BatteryOptimization` |
| Wi-Fi on | Not used as shipped (Stock Sync connects over Bluetooth only). It's set so that turning on the mesh SDK's Wi-Fi transport later needs no device change. Android 8 and later keep Wi-Fi on during sleep anyway. | Wi-Fi `WiFiAction` |
| Allowed to run | Only if your devices use the AccessMgr app allowlist. | `stocksync-allowlist.xml` (optional, read its header first) |
| DataWedge scanning | Nothing to do. On launch the app creates a DataWedge profile named `StockSync` for itself (barcode input on, intent output as a broadcast, keystroke output off) through the DataWedge intent API. If you manage DataWedge profiles centrally, leave that profile alone or recreate it with the same settings. | The app |

The app doesn't need the internet, an account or any server. DataWedge uses the `StockSync`
profile only while Stock Sync is in the foreground; other apps keep their own scanning setup.

## How to apply

**StageNow.** In StageNow, create a profile in Xpert Mode, add the settings AppMgr, AccessMgr
(twice: once for the permission grant, once for automatic permission control), WirelessMgr and
Wi-Fi, and enter the values from `stocksync-mx.xml`. Every block there names its TechDocs page
and what each value means. Generate the staging barcodes, print them, and scan them with the
StageNow client on each device. Zebra recommends scanning from paper, not a screen.
See [StageNow staging profiles](https://techdocs.zebra.com/stagenow/latest/stagingprofiles/).

**EMM.** Install the app through your EMM, then send the same settings. If your EMM accepts
Zebra MX XML, submit the `<characteristic>` blocks from `stocksync-mx.xml`. If it configures
Zebra devices through Zebra OEMConfig instead, set the same items there. (UNVERIFIED: how each
EMM accepts MX XML and the exact OEMConfig setting names vary by EMM and OEMConfig version, so
check your EMM's Zebra documentation.)

Install the app before applying the profile. AccessMgr can pre-grant permissions to an app
that isn't installed yet (Android 10+), but this hasn't been confirmed for the battery
exemption.

## Check it worked

- Settings > Apps > Stock Sync > Permissions: Nearby devices (and Location) show Allowed.
- Settings > Apps > Stock Sync > Battery shows Unrestricted, or
  `adb shell dumpsys deviceidle whitelist` lists `com.offlineappexamples.stocksync`.
- Open the app and a store: it shows "Scanner ready" under the store name, and scanning a
  shelf label adds one to that item on every device.

## Requirements and licensing

- The permission grant and the automatic permission control parms need MX 13.1+ and
  Android 11+. Location State needs MX 10.4+ and Android 10+.
- Bluetooth Manager (BluetoothMgr) "now requires purchase of a Mobility DNA Enterprise
  License for access to all features on Professional-series devices"
  ([BluetoothMgr](https://techdocs.zebra.com/mx/bluetoothmgr/),
  [licensing](https://techdocs.zebra.com/licensing/)). The main profile doesn't use
  BluetoothMgr: it turns Bluetooth on with WirelessMgr, and TechDocs lists no licence
  requirement for the WirelessMgr, AppMgr, AccessMgr and Wi-Fi parms it uses. BluetoothMgr only
  appears in the optional BLE-scan allowlist block of `stocksync-allowlist.xml`.
- Items marked UNVERIFIED in the XML comments are the ones TechDocs doesn't settle. Check
  them on your first device.

References: [AppMgr](https://techdocs.zebra.com/mx/appmgr/),
[AccessMgr](https://techdocs.zebra.com/mx/accessmgr/),
[WirelessMgr](https://techdocs.zebra.com/mx/wirelessmgr/),
[Wi-Fi](https://techdocs.zebra.com/mx/wifi/),
[DataWedge SET_CONFIG](https://techdocs.zebra.com/datawedge/latest/guide/api/setconfig/).
