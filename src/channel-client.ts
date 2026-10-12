import { ChannelVoucherManager, ChannelVoucher } from "./channel-manager";

export class KiteAgentChannelClient {
  public readonly manager: ChannelVoucherManager;
  private currentVoucher?: ChannelVoucher;

  constructor(chainId: bigint = 2368n, contractAddress: string) {
    this.manager = new ChannelVoucherManager(chainId, contractAddress);
  }

  public updateState(newVoucher: ChannelVoucher): void {
    if (this.currentVoucher) {
      if (!this.manager.validateNonDecreasingNonce(this.currentVoucher.nonce, newVoucher.nonce)) {
        throw new Error("Invalid state voucher: nonce must be strictly increasing");
      }
    }
    this.currentVoucher = newVoucher;
  }

  public getLatestState(): ChannelVoucher | undefined {
    return this.currentVoucher;
  }
}
