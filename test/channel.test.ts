import { describe, it } from "node:test";
import assert from "node:assert";
import { ethers } from "ethers";
import { ChannelVoucherManager, KiteAgentChannelClient, ChannelVoucher } from "../src/index";

describe("Kite Agent Channel Settlement Suite", () => {
  const contractAddress = "0x1234567890123456789012345678901234567890";
  const manager = new ChannelVoucherManager(2368n, contractAddress);

  it("should generate deterministic state hashes and recover signer", async () => {
    const wallet = ethers.Wallet.createRandom();
    const voucher: ChannelVoucher = {
      channelId: ethers.id("test-channel-1"),
      balanceA: ethers.parseEther("0.8"),
      balanceB: ethers.parseEther("0.2"),
      nonce: 1n,
    };

    const signature = await manager.signVoucher(wallet, voucher);
    const recovered = manager.verifyVoucherSigner(voucher, signature);

    assert.strictEqual(recovered.toLowerCase(), wallet.address.toLowerCase());
  });

  it("should enforce strictly monotonic nonce updates in client", () => {
    const client = new KiteAgentChannelClient(2368n, contractAddress);
    const channelId = ethers.id("test-channel-2");

    client.updateState({
      channelId,
      balanceA: 100n,
      balanceB: 0n,
      nonce: 1n,
    });

    client.updateState({
      channelId,
      balanceA: 90n,
      balanceB: 10n,
      nonce: 2n,
    });

    assert.strictEqual(client.getLatestState()?.nonce, 2n);

    assert.throws(() => {
      client.updateState({
        channelId,
        balanceA: 80n,
        balanceB: 20n,
        nonce: 2n, // Stale nonce
      });
    }, /nonce must be strictly increasing/);
  });
});
