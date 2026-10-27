// Runs against the build (`pnpm test` builds first): eth_signTypedData is signed like v4, routed by
// its first parameter, from either the object or MetaMask's JSON-string form.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyTypedData} from 'viem';
import {EIP1193LocalSigner, wrapProviderWithMultipleSigners} from '../dist/index.mjs';

const pk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const typedData = {
	domain: {name: 'T', chainId: 1},
	types: {Mail: [{name: 'x', type: 'string'}]},
	primaryType: 'Mail',
	message: {x: 'hi'},
};

for (const method of ['eth_signTypedData', 'eth_signTypedData_v4']) {
	for (const payload of [typedData, JSON.stringify(typedData)]) {
		test(`${method} [address, ${typeof payload}] is signed by the registered signer`, async () => {
			const signer = new EIP1193LocalSigner(pk);
			const address = signer.addresses[0];
			const fallback = {
				request: async () => {
					throw new Error('the fallback provider must not be asked');
				},
			};
			const {provider, registerAccount} = wrapProviderWithMultipleSigners(fallback);
			registerAccount(address, signer);
			const signature = await provider.request({method, params: [address, payload]});
			assert.equal(await verifyTypedData({address, ...typedData, signature}), true);
		});
	}
}
