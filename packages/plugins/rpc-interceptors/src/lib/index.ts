import { Embark } from "embark-core";
import EmbarkSmartContracts from './embark_smartContracts';
import EthAccounts from "./eth_accounts";
import EthSendTransaction from "./eth_sendTransaction";
import EthSignData from "./eth_signData";
import EthSignTypedData from "./eth_signTypedData";
import EthSubscribe from "./eth_subscribe";
import EthUnsubscribe from "./eth_unsubscribe";
import PersonalNewAccount from "./personal_newAccount";

export default class RpcInterceptors {
  constructor(private readonly embark: Embark) {
    this.init();
  }

  private async init() {
    return await Promise.all(
      [
        PersonalNewAccount,
        EthAccounts,
        EthSendTransaction,
        EthSignTypedData,
        EthSignData,
        EthSubscribe,
        EthUnsubscribe,
        EmbarkSmartContracts
      ].map((RpcMod) => {
        const interceptor = new RpcMod(this.embark);
        return interceptor.registerRpcInterceptors();
      })
    );
  }
}
