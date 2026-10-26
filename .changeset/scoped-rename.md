---
'@eip-1193/signer': minor
---

Renamed to `@eip-1193/signer`. The unscoped `eip-1193-signer` is no longer updated: replace the dependency and the import specifier (`from 'eip-1193-signer'` becomes `from '@eip-1193/signer'`). The exported API is unchanged apart from the provider constraints below.

Fixed: `eip-1193` is now a regular `dependency` instead of a `devDependency`. The public types reference it, but because it was only a devDependency the build inlined a frozen copy of the `eip-1193@0.6.2` types into the published `.d.ts`. That copy contains a typo from 0.6.2 (`resu; t` in `eth_getUncleCountByBlockNumber`) which reports `TS7008` for consumers that do not set `skipLibCheck`, and it never picked up later `eip-1193` fixes. The `.d.ts` now imports the types from the installed `eip-1193` package.

Requires `eip-1193@^0.7.0`, a breaking release of the types (see its release notes). In 0.7.0 `EIP1193ProviderWithoutEvents` is the browser-wallet surface only, so the old constraint rejected node providers. The wrappers now ask only for what they use: `wrapProviderWithLocalSigner` accepts any `RequestRPC<WriteMethods>` (it signs locally and only needs `eth_sendRawTransaction`), and `wrapProviderWithMultipleSigners` accepts any `EIP1193SignerProvider` (the provider is the fallback signer). Both accept `EIP1193Provider`, `EIP1193WalletProvider`, `EIP1193NodeProvider`, `EIP1193HttpNodeProvider` and `EIP1193AllMethodsProvider`.
