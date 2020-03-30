import { Embark } from "embark-core";
const { blockchain: blockchainConstants } = require("embark-core/constants");
import RpcInterceptor from "./rpcInterceptor";
import { ProxyResponseParams } from "embark-proxy";

export default class PersonalNewAccount extends RpcInterceptor {

  constructor(embark: Embark) {
    super(embark);
  }

  public async registerRpcInterceptors() {
    return this.embark.events.request2("rpc:response:interceptor:register", blockchainConstants.transactionMethods.personal_newAccount, this.personalNewAccountResponse.bind(this));
  }

  private async personalNewAccountResponse(params: ProxyResponseParams<string, string>) {
    // emit event so tx modifiers can refresh accounts
    await this.events.request2("rpc:accounts:reset");
    return params;
  }
}
