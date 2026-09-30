# Third-party notices

The code in this repository is licensed under MIT-0 (see [LICENSE](./LICENSE)),
except for the material listed below, which keeps its own license. Dependencies
installed from npm, CocoaPods or Maven keep their own licenses and are not
covered by this repository's LICENSE.

## Offline Protocol SDK

`@offline-protocol/mesh-sdk` is not included in this repository; each app
installs it from npm. It is dual-licensed: AGPL-3.0-only, or a commercial
license from Offline Protocol, Inc. See the installed package's `LICENSE` and
`LICENSE-COMMERCIAL.md`, and https://www.offlineprotocol.com/docs/operations/licensing.

## Fonts

`packages/ui/fonts/` contains DM Serif Display and Space Grotesk, both licensed
under the SIL Open Font License 1.1. The license texts and copyright notices
are in `packages/ui/fonts/OFL-DMSerifDisplay.txt` and
`packages/ui/fonts/OFL-SpaceGrotesk.txt`.

## React Native Reusables

The components in `packages/ui/src/components/` are adapted from
[React Native Reusables](https://github.com/founded-labs/react-native-reusables),
licensed under the MIT License:

```
MIT License

Copyright (c) 2025 Founded Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## React Native project files

The native iOS and Android project files in each app (`apps/*/ios`,
`apps/*/android`) are generated from the React Native app template
(MIT License, Copyright (c) Meta Platforms, Inc. and affiliates). The Gradle
wrapper scripts and `gradle-wrapper.jar` are part of Gradle and are licensed
under the Apache License 2.0. `debug.keystore` is the standard, publicly known
React Native debug signing key: use it for local testing only, never for a
release build.
