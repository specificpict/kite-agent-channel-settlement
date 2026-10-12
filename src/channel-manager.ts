import { ethers } from "ethers";

export interface ChannelVoucher {
  channelId: string;
  balanceA: bigint;
  balanceB: bigint;
  nonce: bigint;
  signature?: string;
}

export class ChannelVoucherManager {
  public readonly chainId: bigint;
  public readonly settlementContract: string;

  constructor(chainId: bigint = 2368n, settlementContract: string) {
    this.chainId = chainId;
    this.settlementContract = settlementContract;
  }

  public computeInnerHash(voucher: ChannelVoucher): string {
    const encodedInner = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "bytes32", "uint256", "uint256", "uint256"],
      [
        this.chainId,
        this.settlementContract,
        voucher.channelId,
        voucher.balanceA,
        voucher.balanceB,
        voucher.nonce,
      ]
    );
    return ethers.keccak256(encodedInner);
  }

  public computeStateHash(voucher: ChannelVoucher): string {
    const innerHash = this.computeInnerHash(voucher);
    return ethers.solidityPackedKeccak256(
      ["string", "bytes32"],
      ["\x19Ethereum Signed Message:\n32", innerHash]
    );
  }

  public async signVoucher(signer: ethers.Signer, voucher: ChannelVoucher): Promise<string> {
    const innerHash = this.computeInnerHash(voucher);
    // signMessage automatically adds "\x19Ethereum Signed Message:\n32" when signing raw 32-byte digest
    return await signer.signMessage(ethers.getBytes(innerHash));
  }

  public verifyVoucherSigner(voucher: ChannelVoucher, signature: string): string {
    const innerHash = this.computeInnerHash(voucher);
    return ethers.verifyMessage(ethers.getBytes(innerHash), signature);
  }

  public validateNonDecreasingNonce(lastNonce: bigint, currentNonce: bigint): boolean {
    return currentNonce > lastNonce;
  }
}
