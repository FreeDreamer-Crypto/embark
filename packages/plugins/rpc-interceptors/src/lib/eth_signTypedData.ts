import { sign, transaction } from "@omisego/omg-js-util";
import { Account, Embark } from "embark-core";
import { AccountParser, dappPath } from "embark-utils";
import { __ } from "embark-i18n";
import Web3 from "web3";
import RpcInterceptor from "./rpcInterceptor";
import { handleSignRequest, isNodeAccount } from './utils/signUtils';
const { blockchain: blockchainConstants } = require("embark-core/constants");
import { ProxyRequestParams, ProxyResponseParams } from "embark-proxy";

export default class EthSignTypedData extends RpcInterceptor {

  public _accounts: Account[] | null = null;

  public _nodeAccounts: string[] | null = null;

  private _web3: Web3 | null = null;

  constructor(embark: Embark) {
    super(embark);
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

  private get nodeAccounts() {
    return (async () => {
      if (!this._nodeAccounts) {
        const web3 = await this.web3;
        this._nodeAccounts = await web3.eth.getAccounts();
      }
      return this._nodeAccounts || [];
    })();
  }

  public async registerRpcInterceptors() {
    return Promise.all([
      // check for:
      // - eth_signTypedData
      // - eth_signTypedData_v3
      // - eth_signTypedData_v4
      // - personal_signTypedData (parity)
      this.embark.events.request2("rpc:request:interceptor:register", /.*signTypedData.*/, this.ethSignTypedDataRequest.bind(this)),
      this.embark.events.request2("rpc:response:interceptor:register", /.*signTypedData.*/, this.ethSignTypedDataResponse.bind(this))
    ]);
  }

  private async ethSignTypedDataRequest(params: ProxyRequestParams<string>) {
    const nodeAccounts = await this.nodeAccounts;
    return handleSignRequest(nodeAccounts, params);
  }

  private async ethSignTypedDataResponse(params: ProxyResponseParams<string, string>) {
    const [fromAddr, typedData] = params.request.params;
    const accounts = await this.accounts;
    const nodeAccounts = await this.nodeAccounts;

    if (isNodeAccount(nodeAccounts, fromAddr)) {
      // If it's a node account, we send the result because it should already be signed
      return params;
    }

    const account = accounts.find((acc) => Web3.utils.toChecksumAddress(acc.address) === Web3.utils.toChecksumAddress(fromAddr));
    if (!(account && account.privateKey)) {
      throw new Error(__("Could not sign transaction because Embark does not have a private key associated with '%s'. " +
        "Please ensure you have configured your account(s) to use a mnemonic, privateKey, or privateKeyFile.", fromAddr));
    }
    const toSign = transaction.getToSignHash(typeof typedData === "string" ? JSON.parse(typedData) : typedData);
    const signature = sign(toSign, [account.privateKey]);

    params.response.result = signature[0];
    return params;
  }
}
