import { Embark } from "embark-core";
import RpcInterceptor from "./rpcInterceptor";
import { ProxyRequestParams, ProxyResponseParams } from "embark-proxy";

export default class EthUnsubscribe extends RpcInterceptor {

  constructor(embark: Embark) {
    super(embark);
  }

  public async registerRpcInterceptors() {
    return Promise.all([
      this.embark.events.request2("rpc:request:interceptor:register", 'eth_unsubscribe', this.ethUnsubscribeRequest.bind(this)),
      this.embark.events.request2("rpc:response:interceptor:register", 'eth_unsubscribe', this.ethUnsubscribeResponse.bind(this))
    ]);
  }

  private async ethUnsubscribeRequest(params: ProxyRequestParams<string>) {
    // check for websockets
    if (params.isWs) {
      // indicate that we do not want this call to go to the node
      params.sendToNode = false;
    }
    return params;
  }
  private async ethUnsubscribeResponse(params: ProxyResponseParams<string, any>) {

    const { isWs, request, response } = params;

    // check for eth_subscribe and websockets
    if (!isWs) {
      return params;
    }

    const nodeResponse = await this.events.request2("proxy:websocket:unsubscribe", request, response);
    params.response = nodeResponse;
    return params;
  }
}
