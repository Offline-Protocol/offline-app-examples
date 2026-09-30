# Contributing

Thanks for helping improve the Offline Protocol example apps. Bug reports,
fixes and small improvements to the existing examples are welcome.

## Before you start

- For a security issue, do not open an issue. Follow [SECURITY.md](./SECURITY.md).
- For a new example or a large change, open an issue first so we can agree on
  the scope before you spend time on it.
- Questions about the SDK itself are best answered by the
  [documentation](https://www.offlineprotocol.com/docs).

## Development setup

Follow the prerequisites in the [README](./README.md#prerequisites), then from
the repository root:

```sh
corepack enable
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

Bluetooth discovery only works on physical phones. If your change affects
discovery, joining or sync, test it on at least two phones (ideally one iOS and
one Android) and say in the pull request what you tested.

## Pull requests

- Keep each pull request focused on one change.
- Make sure `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. CI runs the same
  checks and builds every app.
- Add or update tests for pure logic (`src/domain/`, `packages/mesh/src/hosts.ts`
  and similar).
- Update the app's README when behavior or setup changes.
- Never commit API keys, signing keys, provisioning profiles, `.env` files or
  personal paths (`ios/.xcode.env.local`, `xcuserdata/`).

## Adding a new example

1. Create `apps/<your-app>/` with its own `package.json` (`"private": true`).
2. Use a scoped name: `@offline-app-examples/<your-app>`.
3. Provide the scripts Turbo runs: `typecheck`, `lint` and `test`.
4. Give it a unique mesh `appId` (see the README section on app ids).
5. Write `apps/<your-app>/README.md`: what it shows, how to run it, how sync
   works, and the licensing note for `@offline-protocol/mesh-sdk`.

## License

By contributing, you agree that your contributions are licensed under the
repository's [MIT-0 license](./LICENSE).
