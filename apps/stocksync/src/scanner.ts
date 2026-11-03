// Barcode scans from Zebra DataWedge, via the small Android module in
// android/app/src/main/java/com/offlineappexamples/stocksync/DataWedgeModule.kt.
//
// Optional by design: on iOS, or if the module is missing, the hook does nothing and
// taps keep working. On any Android phone the module still listens for the scan
// broadcast, so `zebra/simulate-scan.sh` can stand in for a real scanner.

import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

export type Scan = {
  /** The barcode's characters (com.symbol.datawedge.data_string). */
  data: string;
  /** Symbology, e.g. LABEL-TYPE-EAN13 (com.symbol.datawedge.label_type). */
  labelType: string | null;
};

type DataWedgeModule = {
  /** Listens for scans and, on a Zebra device, sets up the DataWedge profile. */
  start(): Promise<{ dataWedge: boolean }>;
  stop(): void;
};

const SCAN_EVENT = 'StockSyncScan'; // DataWedgeModule.SCAN_EVENT
const dataWedge: DataWedgeModule | undefined =
  Platform.OS === 'android' ? NativeModules.DataWedge : undefined;

/**
 * Calls `onScan` (its latest version) for each scan while mounted.
 * Returns true once DataWedge, i.e. a Zebra scanner, is set up on this device.
 */
export function useScanner(onScan: (scan: Scan) => void): boolean {
  const latest = useRef(onScan);
  latest.current = onScan;
  const [hasScanner, setHasScanner] = useState(false);

  useEffect(() => {
    if (!dataWedge) return;
    let mounted = true;
    const subscription = DeviceEventEmitter.addListener(
      SCAN_EVENT,
      (scan: Scan) => latest.current(scan),
    );
    dataWedge
      .start()
      .then((result) => mounted && setHasScanner(result.dataWedge))
      .catch((error) => console.warn('[stocksync] scanner unavailable', error));
    return () => {
      mounted = false;
      subscription.remove();
      dataWedge.stop();
    };
  }, []);

  return hasScanner;
}
