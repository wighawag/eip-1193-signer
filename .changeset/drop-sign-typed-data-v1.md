---
'@eip-1193/signer': minor
---

Breaking: `eth_signTypedData` is no longer signed. That method name is v1, which takes `[typedData, address]` with a flat `{name, type, value}[]` payload and hashes it with a scheme viem does not implement. The local signer used to read it as `[address, EIP-712 object]` and sign it as v4, so it only worked for callers using the name as a non-standard v4 alias, and a real v1 request crashed with `address.toLowerCase is not a function`. It now throws `eth_signTypedData (v1) is not supported by the local signer, use eth_signTypedData_v4`. Callers that relied on the alias should call `eth_signTypedData_v4` with the same parameters.

Fixed: `wrapProviderWithMultipleSigners` now reads the signing address from the position each method defines. It used to take the first string parameter, so `personal_sign` (`[message, address]`) was routed by its message and always failed with `no signer registered`, and a v1 `eth_signTypedData` request was rejected as unsupported instead of reaching the registered signer.
