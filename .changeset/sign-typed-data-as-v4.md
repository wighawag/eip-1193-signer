---
'@eip-1193/signer': patch
---

**`eth_signTypedData` is signed again, as v4.** 0.4.0 refused it on the reading that the method name means the legacy V1 API (`[typedData, address]` with a flat field array). V1 is used by no one, viem included, and eip-1193 0.7.4 now types `eth_signTypedData` like v4 (`[address, typedData]`). The local signer signs it exactly like `eth_signTypedData_v4`, and `wrapProviderWithMultipleSigners` routes it by its first parameter, the address. Both methods now also accept the typed data as MetaMask's JSON string as well as the object. Requires `eip-1193` `^0.7.4`.
