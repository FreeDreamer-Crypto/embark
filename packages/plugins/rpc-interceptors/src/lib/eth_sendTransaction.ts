import async from "async";
import { Account, Callback, Embark, EmbarkPlugins } from "embark-core";
import { AccountParser, dappPath } from "embark-utils";
import Web3 from "web3";
const { blockchain: blockchainConstants } = require("embark-core/constants");
import RpcInterceptor from "./rpcInterceptor";
import cloneDeep from "lodash.clonedeep";
import { ProxyRequestParams } from "embark-proxy";

export default class EthSendTransaction extends RpcInterceptor {

  public _accounts: Account[] | null = null;

  public _nodeAccounts: string[] | null = null;

  private signTransactionQueue: any;

  private nonceCache: any = {};

  private plugins: EmbarkPlugins;

  private _web3: Web3 | null = null;

  constructor(embark: Embark) {
    super(embark);

    this.plugins = embark.config.plugins;
    this.signTransactionQueue = async.queue(({ payload, account, web3 }, callback: Callback<string>) => {
      this.getNonce(web3, payload.from, async (err: any, newNonce: number) => {
        if (err) {
          return callback(err);
        }
        payload.nonce = newNonce;
        try {
          const result = await web3.eth.accounts.signTransaction(payload, account.privateKey);
          callback(null, result.rawTransaction);
        } catch (err) {
          callback(err);
        }
      });
    }, 1);
  }

  protected get web3() {
    return (async () => {
      if (!this._web3) {
        await this.events.request2("blockchain:started");
        // get connection directly to the node
        const provider = await this.events.request2("blockchain:node:provider", "ethereum");
        this._web3 = new Web3(provider);
      }
      return this._web3;
    })();
  }

  private get nodeAccounts() {
    return (async () => {
      if (!this._nodeAccounts) {
        const web3 = await this.web3;
        this._nodeAccounts = await web3.eth.getAccounts();
      }
      return this._nodeAccounts || [];
    })();
  }

  private get accounts() {
    return (async () => {
      if (!this._accounts) {
        const web3 = await this.web3;
        const nodeAccounts = await this.nodeAccounts;
        this._accounts = AccountParser.parseAccountsConfig(this.embark.config.blockchainConfig.accounts, web3, dappPath(), this.logger, nodeAccounts);
      }
      return this._accounts || [];
    })();
  }

  // TODO: pull this out in to rpc-manager/utils once https://github.com/embarklabs/embark/pull/2150 is merged.
  private async getNonce(web3: Web3, address: string, callback: Callback<any>) {
    web3.eth.getTransactionCount(address, (error: any, transactionCount: number) => {
      if (error) {
        return callback(error, null);
      }
      if (this.nonceCache[address] === undefined) {
        this.nonceCache[address] = -1;
      }

      if (transactionCount > this.nonceCache[address]) {
        this.nonceCache[address] = transactionCount;
        return callback(null, this.nonceCache[address]);
      }

      this.nonceCache[address]++;
      callback(null, this.nonceCache[address]);
    });
  }

  public async registerRpcInterceptors() {
    return this.embark.events.request2("rpc:request:interceptor:register", blockchainConstants.transactionMethods.eth_sendTransaction, this.ethSendTransactionRequest.bind(this));
  }

  private async ethSendTransactionRequest(params: ProxyRequestParams<any>) {
    const accounts = await this.accounts;
    const web3 = await this.web3;

    if (!accounts?.length) {
      return params;
    }
    // Check if we have that account in our wallet
    const account = accounts.find((acc) => Web3.utils.toChecksumAddress(acc.address) === Web3.utils.toChecksumAddress(params.request.params[0].from));
    if (account && account.privateKey) {
      return new Promise((resolve, reject) => {

        return this.signTransactionQueue.push({ payload: params.request.params[0], account, web3 }, (err: any, newPayload: any) => {
          if (err) {
            return reject(err);
          }
          params.originalRequest = cloneDeep(params.request);
          params.request.method = blockchainConstants.transactionMethods.eth_sendRawTransaction;
          params.request.params = [newPayload];
          // allow for any mods to eth_sendRawTransaction
          this.plugins.runActionsForEvent('blockchain:proxy:request', params, (error, requestParams) => {
            if (err) {
              return reject(err);
            }
            resolve(requestParams);
          });
        });
      });
    }
    return params;
  }
}
