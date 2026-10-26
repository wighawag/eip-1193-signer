import type {EIP1193SignerProvider, EIP1193GenericRequest, RPCMethods, RequestRPC, WriteMethods} from 'eip-1193';
import {TypedDataDefinition} from 'viem';
import {privateKeyToAccount, mnemonicToAccount, LocalAccount} from 'viem/accounts';

function tobn(v?: `0x${string}`): bigint | undefined {
	return v ? BigInt(v) : undefined;
}

function ton(v: `0x${string}` | undefined): number | undefined {
	return v ? parseInt(v.slice(2), 16) : undefined;
}
function tonf(v: `0x${string}`): number {
	return parseInt(v.slice(2), 16);
}

export type RequestType<Method extends string> = {method: Method; params: RPCMethods[Method]['params']};
export type ResultType<Method extends string> = RPCMethods[Method]['result'];

export class EIP1193LocalSigner implements EIP1193SignerProvider {
	private accounts: {[address: `0x${string}`]: LocalAccount<'hd' | 'privateKey'>} = {};
	public readonly addresses: `0x${string}`[] = [];

	constructor(prv: `0x${string}` | {mnemonic: string; num: number}) {
		if (typeof prv === 'string') {
			const account = privateKeyToAccount(prv);
			this.accounts[account.address.toLowerCase() as `0x${string}`] = account;
			this.addresses.push(account.address);
		} else {
			for (let i = 0; i < (isNaN(prv.num) ? 1 : Math.max(prv.num, 1)); i++) {
				const account = mnemonicToAccount(prv.mnemonic, {accountIndex: i});
				this.accounts[account.address.toLowerCase() as `0x${string}`] = account;
				this.addresses.push(account.address);
			}
		}
	}
	async request(args: any): ReturnType<EIP1193SignerProvider['request']> {
		const getAccount = (address: `0x${string}`) => {
			const account = this.accounts[address.toLowerCase() as `0x${string}`];
			if (!account) {
				const addresses = Object.keys(this.accounts);
				if (addresses.length === 1) {
					throw new Error(`account (${addresses[0]}) cannot sign for ${address}`);
				} else {
					throw new Error(`no account found that can sign for ${address}`);
				}
			}
			return account;
		};

		if (args.method === 'eth_accounts') {
			return this.addresses;
		}

		// TODO test
		else if (args.method === 'eth_sign') {
			const [address, message] = args.params;
			const account = getAccount(address);
			return account.signMessage({message: {raw: message}});
		} else if (args.method === 'eth_signTransaction') {
			const txData = args.params[0];
			const account = getAccount(txData.from);
			if (!txData.type || txData.type === '0x0') {
				return account.signTransaction({
					type: 'legacy',
					// With chainId, viem signs with EIP-155 replay protection (v = chainId * 2 + 35/36).
					// Without it, a legacy tx is still valid and may be wanted on purpose, so we sign
					// an unprotected (pre-EIP-155, v = 27/28) tx instead of throwing.
					...(txData.chainId ? {chainId: tonf(txData.chainId)} : {}),
					data: txData.data,
					gas: tobn(txData.gas),
					gasPrice: tobn(txData.gasPrice),
					value: tobn(txData.value),
					nonce: ton(txData.nonce),
					to: txData.to,
				});
			} else if (txData.type === '0x1') {
				if (!txData.chainId) {
					throw new Error(`type 0x1 tx need to have the chainId specified`);
				}
				return account.signTransaction({
					type: 'eip2930',
					chainId: tonf(txData.chainId),
					accessList: txData.accessList,
					data: txData.data,
					gas: tobn(txData.gas),
					gasPrice: tobn(txData.gasPrice),
					value: tobn(txData.value),
					nonce: ton(txData.nonce),
					to: txData.to,
				});
			} else if (txData.type === '0x2') {
				if (!txData.chainId) {
					throw new Error(`type 0x2 tx need to have the chainId specified`);
				}
				return account.signTransaction({
					type: 'eip1559',
					chainId: tonf(txData.chainId),
					accessList: txData.accessList,
					data: txData.data,
					gas: tobn(txData.gas),
					maxFeePerGas: tobn(txData.maxFeePerGas),
					maxPriorityFeePerGas: tobn(txData.maxPriorityFeePerGas),
					value: tobn(txData.value),
					nonce: ton(txData.nonce),
					to: txData.to,
				});
			} else {
				throw new Error(`unlnown transaction type: ${txData.type}`);
			}
		} else if (args.method === 'eth_signTypedData') {
			// eth_signTypedData is v1: [typedData, address] with a flat {name, type, value}[] payload and
			// its own hashing scheme, which viem does not implement. Refuse it explicitly rather than
			// fall through to the generic error, so the caller knows to use v4.
			throw new Error(`eth_signTypedData (v1) is not supported by the local signer, use eth_signTypedData_v4`);
		} else if (args.method === 'eth_signTypedData_v4') {
			const [address, message] = args.params;
			const account = getAccount(address);
			return account.signTypedData(message as TypedDataDefinition<Record<string, unknown>, any>);
		} else if (args.method === 'personal_sign') {
			const [message, address] = args.params; // reverse
			const account = getAccount(address);
			return account.signMessage({message: {raw: message}});
		} else {
			throw new Error(`do not support method "${(args as any).method}"`);
		}
	}
}

// eth_signTypedData (v1) stays listed although the local signer refuses it: routing it to the signer
// gives a clear error, where passing it through would let the wrapped provider sign for an account
// that is meant to be signed for locally.
const signingRequests = [
	'eth_sign',
	'eth_signTransaction',
	'personal_sign',
	'eth_signTypedData_v4',
	'eth_signTypedData',
];

// Where each signing method carries the signing address. The positions differ per method, so the
// address cannot be read from the first string parameter: personal_sign is [message, address] and
// eth_signTypedData (v1) is [typedData, address], the reverse of eth_sign and eth_signTypedData_v4.
function signingAddress(args: EIP1193GenericRequest): `0x${string}` {
	const params = (Array.isArray(args.params) ? args.params : []) as unknown[];
	let address: unknown;
	switch (args.method) {
		case 'eth_sign':
		case 'eth_signTypedData_v4':
			address = params[0];
			break;
		case 'personal_sign':
		case 'eth_signTypedData':
			address = params[1];
			break;
		case 'eth_signTransaction':
			address = (params[0] as {from?: unknown} | undefined)?.from;
			break;
	}
	if (typeof address !== 'string') {
		throw new Error(`signing request not supported: ${args.method}`);
	}
	return address as `0x${string}`;
}

// The provider is the fallback signer for unregistered accounts, so it must serve the signer methods.
// Both the wallet surface and the node surfaces do.
export function wrapProviderWithMultipleSigners<T extends EIP1193SignerProvider>(
	provider: T
): {provider: T; registerAccount(address: `0x${string}`, signer: EIP1193SignerProvider): void} {
	const accounts: {[address: `0x${string}`]: EIP1193SignerProvider} = {};
	function registerAccount(address: `0x${string}`, signer?: EIP1193SignerProvider) {
		accounts[address] = signer || provider; // pass through
	}

	function request(args: EIP1193GenericRequest): Promise<any> {
		if (signingRequests.indexOf(args.method) >= 0) {
			const address = signingAddress(args);
			const signer = accounts[address];
			if (!signer) {
				throw new Error(`no signer registered for ${address}`);
			}
			return signer.request(args as any);
		}
		return provider.request(args as any);
	}
	const newProvider = new Proxy(provider, {
		get(target, param, receiver) {
			if (param === 'request') {
				return request;
			}
			return (target as any)[param];
		},
	});

	return {
		provider: newProvider,
		registerAccount,
	};
}

// Signing happens locally, so the provider only has to broadcast: anything serving eth_sendRawTransaction
// works, whether a wallet, a JSON-RPC node or an HTTP node.
export function wrapProviderWithLocalSigner<T extends RequestRPC<WriteMethods>>(
	provider: T,
	prv: `0x${string}` | {mnemonic: string; num: number} | EIP1193LocalSigner
): T {
	const signer = prv instanceof EIP1193LocalSigner ? prv : new EIP1193LocalSigner(prv);
	function request(args: EIP1193GenericRequest): Promise<any> {
		if (args.method === 'eth_accounts') {
			return Promise.resolve(signer.addresses);
		}
		if (args.method === 'eth_requestAccounts') {
			return Promise.resolve(signer.addresses);
		}

		if (args.method === 'eth_sendTransaction') {
			return signer.request({method: 'eth_signTransaction', params: args.params as any}).then((v) => {
				return provider.request({method: 'eth_sendRawTransaction', params: [v]});
			});
		}

		if (signingRequests.indexOf(args.method) >= 0) {
			return signer.request(args as any);
		}
		return provider.request(args as any);
	}
	return new Proxy(provider, {
		get(target, param, receiver) {
			if (param === 'request') {
				return request;
			}
			return (target as any)[param];
		},
	});
}
