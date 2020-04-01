import { __ } from "embark-i18n";
import { Events } from "embark-core";
import { Account, Callback, Embark, EmbarkEvents } from "embark-core";
import { Logger } from 'embark-logger';
import { AccountParser, dappPath } from "embark-utils";
import { ProxyRequestParams, ProxyResponseParams } from '.';
import Web3 from "web3";

export type RpcRequestInterceptor<T> = (params: ProxyRequestParams<T>) => ProxyRequestParams<T>;
export type RpcResponseInterceptor<T, R> = (params: ProxyRequestParams<T> | ProxyResponseParams<T, R>) => ProxyResponseParams<T, R>;

interface RegistrationOptions {
  priority: number;
}

interface RpcRegistration {
  filter: string | string[] | RegExp;
  options: RegistrationOptions;
}

interface RpcRequestRegistration<T> extends RpcRegistration {
  interceptor: RpcRequestInterceptor<T>;
}

interface RpcResponseRegistration<T, R> extends RpcRegistration {
  interceptor: RpcResponseInterceptor<T, R>;
}

export default class RpcManager {

  private _web3: Web3 | null = null;

  private logger: Logger;

  private events: EmbarkEvents;

  public _accounts: Account[] | null = null;

  public _nodeAccounts: string[] | null = null;

  private requestInterceptors: Array<RpcRequestRegistration<any>> = [];

  private responseInterceptors: Array<RpcResponseRegistration<any, any>> = [];

  constructor(private readonly embark: Embark) {
    this.events = embark.events;
    this.logger = embark.logger;
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

  public init() {
    this.registerActions();
    this.setCommandHandlers();
  }

  private registerActions() {
    this.embark.registerActionForEvent("tests:config:updated", { priority: 40 }, (_params, cb) => {
      // blockchain configs may have changed (ie endpoint)
      this._web3 = null;

      // web.eth.getAccounts may return a different value now
      // update accounts across all modifiers
      this.resetAccounts(cb);
    });

    this.embark.registerActionForEvent("blockchain:proxy:request", this.onProxyRequest.bind(this));
    this.embark.registerActionForEvent("blockchain:proxy:response", this.onProxyResponse.bind(this));
  }

  private setCommandHandlers() {
    this.events.setCommandHandler("rpc:accounts:reset", this.resetAccounts.bind(this));

    this.events.setCommandHandler("rpc:request:interceptor:register", this.registerRequestInterceptor.bind(this));
    this.events.setCommandHandler("rpc:response:interceptor:register", this.registerResponseInterceptor.bind(this));
  }

  private async onProxyRequest<T>(params: ProxyRequestParams<T>, callback: Callback<ProxyRequestParams<T>>) {
    try {
      params = await this.executeInterceptors(this.requestInterceptors, params);
    } catch (err) {
      err.message = __("Error executing RPC request modifications for '%s': %s", params?.request?.method, err.message);
      return callback(err);
    }
    callback(null, params);
  }

  private async onProxyResponse<T, R>(params: ProxyResponseParams<T, R>, callback: Callback<ProxyResponseParams<T, R>>) {
    try {
      params = await this.executeInterceptors(this.responseInterceptors, params);
    } catch (err) {
      err.message = __("Error executing RPC response modifications for '%s': %s", params?.request?.method, err.message);
      return callback(err);
    }
    callback(null, params);
  }

  private registerRequestInterceptor<T>(filter: string | RegExp, interceptor: RpcRequestInterceptor<T>, options: RegistrationOptions = { priority: 50 }, callback?: Callback<null>) {
    this.requestInterceptors.push({ filter, options, interceptor });
    if (callback) {
      callback();
    }
  }

  private registerResponseInterceptor<T, R>(filter: string | RegExp, interceptor: RpcResponseInterceptor<T, R>, options: RegistrationOptions = { priority: 50 }, callback?: Callback<null>) {
    this.responseInterceptors.push({ filter, options, interceptor });
    if (callback) {
      callback();
    }
  }

  private async resetAccounts(cb: Callback<null>) {
    this._nodeAccounts = null;
    this._accounts = null;
    cb();
  }

  private async executeInterceptors<T>(
    registrations: Array<RpcRequestRegistration<T>>,
    params: ProxyRequestParams<T>
  ): Promise<ProxyRequestParams<T>>;
  private async executeInterceptors<T, R>(
    registrations: Array<RpcResponseRegistration<T, R>>,
    params: ProxyResponseParams<T, R>
  ): Promise<ProxyResponseParams<T, R>>;
  private async executeInterceptors<T, R>(
    registrations: Array<RpcRequestRegistration<T> | RpcResponseRegistration<T, R>>,
    params: ProxyRequestParams<T> | ProxyResponseParams<T, R>
  ): Promise<ProxyRequestParams<T> | ProxyResponseParams<T, R>> {
    const { method } = params.request;
    const registrationsToRun = registrations
      .filter(registration => this.shouldIntercept(registration.filter, method))
      .sort((a, b) => this.sortByPriority(a.options.priority, b.options.priority));

    for (const registration of registrationsToRun) {
      params = await registration.interceptor(params);
    }
    return params;
  }

  private shouldIntercept(filter: string | string[] | RegExp, method: string) {
    let applyModification = false;
    if (filter instanceof RegExp) {
      applyModification = filter.test(method);
    } else if (typeof filter === "string") {
      applyModification = (filter === method);
    } else if (Array.isArray(filter)) {
      applyModification = filter.includes(method);
    }
    return applyModification;
  }

  private sortByPriority<T>(a: number, b: number) {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }
}
