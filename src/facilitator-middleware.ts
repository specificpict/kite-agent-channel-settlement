export interface FacilitatorChallengePacket {
  channelId: string;
  nonce: bigint;
  challenger: string;
  timestamp: number;
}

export class FacilitatorStreamMiddleware {
  private activeChallenges: Map<string, FacilitatorChallengePacket> = new Map();

  public registerDispute(packet: FacilitatorChallengePacket): void {
    const existing = this.activeChallenges.get(packet.channelId);
    if (existing && existing.nonce >= packet.nonce) {
      throw new Error("Dispute rejected: stale or non-increasing challenge nonce");
    }
    this.activeChallenges.set(packet.channelId, packet);
  }

  public getDispute(channelId: string): FacilitatorChallengePacket | undefined {
    return this.activeChallenges.get(channelId);
  }

  public isChannelDisputed(channelId: string): boolean {
    return this.activeChallenges.has(channelId);
  }
}
