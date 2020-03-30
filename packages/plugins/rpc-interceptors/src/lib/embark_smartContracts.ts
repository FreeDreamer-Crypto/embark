import { Embark } from 'embark-core';
import { ProxyRequestParams, ProxyResponseParams } from 'embark-proxy';
import RpcInterceptor from "./rpcInterceptor";

export default class EmbarkSmartContracts extends RpcInterceptor {

  constructor(embark: Embark) {
    super(embark);
  }

  async registerRpcInterceptors() {
    this.embark.events.request(
      'rpc:request:interceptor:register',
      'embark_getSmartContracts',
      this.interceptRequest.bind(this)
    );
    this.embark.events.request(
      'rpc:response:interceptor:register',
      'embark_getSmartContracts',
      this.interceptResponse.bind(this)
    );
  }

  private async interceptRequest(params: ProxyRequestParams<any>) {
    params.sendToNode = false;
    return params;
  }

  private async interceptResponse(params: ProxyResponseParams<any, any>) {
    params.response.result = await this.embark.events.request2('contracts:list');
    return params;
  }
}
