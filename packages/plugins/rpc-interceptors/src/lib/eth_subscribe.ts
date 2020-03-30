import { Embark } from "embark-core";
import RpcInterceptor from "./rpcInterceptor";
import { ProxyRequestParams, ProxyResponseParams } from "embark-proxy";

export default class EthSubscribe extends RpcInterceptor {
  constructor(embark: Embark) {
    super(embark);
  }

  public async registerRpcInterceptors() {
    return Promise.all([
      this.embark.events.request2("rpc:request:interceptor:register", 'eth_subscribe', this.ethSubscribeRequest.bind(this)),
      this.embark.events.request2("rpc:response:interceptor:register", 'eth_subscribe', this.ethSubscribeResponse.bind(this))
    ]);
  }

  private async ethSubscribeRequest(params: ProxyRequestParams<string>) {
    // check for websockets
    if (params.isWs) {
      // indicate that we do not want this call to go to the node
      params.sendToNode = false;
    }
    return params;
  }
  private async ethSubscribeResponse(params: ProxyResponseParams<string, any>) {

    const { isWs, transport, request, response } = params;

    // check for websockets
    if (!isWs) {
      return params;
    }

    const nodeResponse = await this.events.request2("proxy:websocket:subscribe", transport, request, response);
    params.response = nodeResponse;

    return params;
  }
}
