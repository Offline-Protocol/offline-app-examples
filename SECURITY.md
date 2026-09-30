# Security policy

## Reporting a vulnerability

Please report security issues privately to **security@offlineprotocol.com**.
Do not open a public GitHub issue, pull request or discussion for a suspected
vulnerability.

Include what you can of the following:

- the affected example or package and the commit you tested
- the device models and OS versions involved
- steps to reproduce, and what an attacker could do
- any proof-of-concept code, logs or screenshots

We will acknowledge your report, keep you updated while we investigate, and
credit you when the fix is published if you would like us to.

## Scope

This repository contains example apps. Issues in the Offline Protocol SDK
itself (for example in encryption, discovery or transport code) are also in
scope; report them to the same address and we will route them.

The Android `debug.keystore` files in this repository are the standard, publicly
known React Native debug key. They are not a vulnerability. Sign any build you
distribute with your own key.
