#!/bin/sh
# Simulates a Zebra DataWedge scan on an attached Android phone or emulator.
#
#   zebra/simulate-scan.sh                 # scans Milk (2000000000015)
#   zebra/simulate-scan.sh 2000000000060   # scans Cheese
#   ANDROID_SERIAL=<serial> zebra/simulate-scan.sh ...   # pick a device
#
# Stock Sync must be open in a store. It sends the same broadcast DataWedge sends
# (https://techdocs.zebra.com/datawedge/latest/guide/output/intent/), so it works on
# any Android phone with the app installed, Zebra or not. Override the action with
# SCAN_ACTION if you changed the applicationId.
set -eu

barcode="${1:-2000000000015}"
action="${SCAN_ACTION:-com.offlineappexamples.stocksync.SCAN}"

adb shell am broadcast \
  -a "$action" \
  --es com.symbol.datawedge.data_string "$barcode" \
  --es com.symbol.datawedge.label_type LABEL-TYPE-EAN13 \
  --es com.symbol.datawedge.source scanner
