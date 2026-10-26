# @eip-1193/signer

## 0.4.0

### Minor Changes

- 9435114: Breaking: `eth_signTypedData` is no longer signed. That method name is v1, which takes `[typedData, address]` with a flat `{name, type, value}[]` payload and hashes it with a scheme viem does not implement. The local signer used to read it as `[address, EIP-712 object]` and sign it as v4, so it only worked for callers using the name as a non-standard v4 alias, and a real v1 request crashed with `address.toLowerCase is not a function`. It now throws `eth_signTypedData (v1) is not supported by the local signer, use eth_signTypedData_v4`. Callers that relied on the alias should call `eth_signTypedData_v4` with the same parameters.

  Fixed: `wrapProviderWithMultipleSigners` now reads the signing address from the position each method defines. It used to take the first string parameter, so `personal_sign` (`[message, address]`) was routed by its message and always failed with `no signer registered`, and a v1 `eth_signTypedData` request was rejected as unsupported instead of reaching the registered signer.

## 0.3.0

### Minor Changes

- 4017b9c: Renamed to `@eip-1193/signer`. The unscoped `eip-1193-signer` is no longer updated: replace the dependency and the import specifier (`from 'eip-1193-signer'` becomes `from '@eip-1193/signer'`). The exported API is unchanged apart from the provider constraints below.

  Fixed: `eip-1193` is now a regular `dependency` instead of a `devDependency`. The public types reference it, but because it was only a devDependency the build inlined a frozen copy of the `eip-1193@0.6.2` types into the published `.d.ts`. That copy contains a typo from 0.6.2 (`resu; t` in `eth_getUncleCountByBlockNumber`) which reports `TS7008` for consumers that do not set `skipLibCheck`, and it never picked up later `eip-1193` fixes. The `.d.ts` now imports the types from the installed `eip-1193` package.

  Requires `eip-1193@^0.7.0`, a breaking release of the types (see its release notes). In 0.7.0 `EIP1193ProviderWithoutEvents` is the browser-wallet surface only, so the old constraint rejected node providers. The wrappers now ask only for what they use: `wrapProviderWithLocalSigner` accepts any `RequestRPC<WriteMethods>` (it signs locally and only needs `eth_sendRawTransaction`), and `wrapProviderWithMultipleSigners` accepts any `EIP1193SignerProvider` (the provider is the fallback signer). Both accept `EIP1193Provider`, `EIP1193WalletProvider`, `EIP1193NodeProvider`, `EIP1193HttpNodeProvider` and `EIP1193AllMethodsProvider`.
