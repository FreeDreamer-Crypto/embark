import { Account, Embark } from "embark-core";
const { blockchain: blockchainConstants } = require("embark-core/constants");
import RpcInterceptor from "./rpcInterceptor";
import { ProxyResponseParams } from "embark-proxy";
import { AccountParser, dappPath } from "embark-utils";
import Web3 from "web3";

export default class EthAccounts extends RpcInterceptor {

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
    return this.embark.events.request2(
      "rpc:response:interceptor:register",
      [blockchainConstants.transactionMethods.eth_accounts,
      blockchainConstants.transactionMethods.personal_listAccounts],
      this.ethAccountsResponse.bind(this)
    );
  }

  private async ethAccountsResponse(params: ProxyResponseParams<string, any>) {
    const accounts = await this.accounts;
    if (!accounts?.length) {
      return params;
    }

    params.response.result = accounts.map((acc) => acc.address);

    return params;
  }
}
