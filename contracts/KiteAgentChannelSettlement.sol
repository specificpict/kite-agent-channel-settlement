// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title KiteAgentChannelSettlement
 * @notice High-throughput off-chain state channel & x402 micropayment settlement network on Kite Chain.
 */
contract KiteAgentChannelSettlement {
    enum ChannelState { Uninitialized, Open, Challenged, Settled }

    struct Channel {
        bytes32 channelId;
        address agentA;
        address agentB;
        uint256 totalDeposit;
        uint256 challengeExpiry;
        uint256 challengeNonce;
        uint256 pendingBalanceA;
        uint256 pendingBalanceB;
        ChannelState state;
    }

    mapping(bytes32 => Channel) public channels;
    mapping(address => uint256) public agentChannelCount;

    event ChannelOpened(bytes32 indexed channelId, address indexed agentA, address indexed agentB, uint256 deposit);
    event ChannelDepositAdded(bytes32 indexed channelId, address indexed funder, uint256 addedAmount);
    event ChannelCooperativeClosed(bytes32 indexed channelId, uint256 payoutA, uint256 payoutB);
    event ChannelChallenged(bytes32 indexed channelId, uint256 nonce, uint256 expiry);
    event ChannelSettled(bytes32 indexed channelId, uint256 payoutA, uint256 payoutB);

    error ChannelAlreadyExists();
    error ChannelNotActive();
    error InvalidParticipants();
    error BalanceMismatch();
    error InvalidSignature();
    error StaleNonce();
    error ChallengeNotExpired();

    function openChannel(address counterparty, uint256 challengeDuration) external payable returns (bytes32) {
        if (counterparty == address(0) || counterparty == msg.sender) revert InvalidParticipants();
        if (msg.value == 0) revert BalanceMismatch();

        bytes32 channelId = keccak256(
            abi.encodePacked(msg.sender, counterparty, block.chainid, agentChannelCount[msg.sender]++)
        );

        if (channels[channelId].state != ChannelState.Uninitialized) revert ChannelAlreadyExists();

        channels[channelId] = Channel({
            channelId: channelId,
            agentA: msg.sender,
            agentB: counterparty,
            totalDeposit: msg.value,
            challengeExpiry: challengeDuration > 0 ? challengeDuration : 1 days,
            challengeNonce: 0,
            pendingBalanceA: 0,
            pendingBalanceB: 0,
            state: ChannelState.Open
        });

        emit ChannelOpened(channelId, msg.sender, counterparty, msg.value);
        return channelId;
    }

    function deposit(bytes32 channelId) external payable {
        Channel storage ch = channels[channelId];
        if (ch.state != ChannelState.Open) revert ChannelNotActive();
        ch.totalDeposit += msg.value;

        emit ChannelDepositAdded(channelId, msg.sender, msg.value);
    }

    function cooperativeClose(
        bytes32 channelId,
        uint256 balanceA,
        uint256 balanceB,
        bytes calldata sigA,
        bytes calldata sigB
    ) external {
        Channel storage ch = channels[channelId];
        if (ch.state != ChannelState.Open) revert ChannelNotActive();
        if (balanceA + balanceB != ch.totalDeposit) revert BalanceMismatch();

        bytes32 stateHash = getChannelStateHash(channelId, balanceA, balanceB, type(uint256).max);
        
        address signerA = recoverSigner(stateHash, sigA);
        address signerB = recoverSigner(stateHash, sigB);

        if (signerA != ch.agentA || signerB != ch.agentB) revert InvalidSignature();

        ch.state = ChannelState.Settled;

        if (balanceA > 0) payable(ch.agentA).transfer(balanceA);
        if (balanceB > 0) payable(ch.agentB).transfer(balanceB);

        emit ChannelCooperativeClosed(channelId, balanceA, balanceB);
    }

    function getChannelStateHash(
        bytes32 channelId,
        uint256 balanceA,
        uint256 balanceB,
        uint256 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(this), channelId, balanceA, balanceB, nonce))
            )
        );
    }

    function recoverSigner(bytes32 hash, bytes memory sig) public pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return ecrecover(hash, v, r, s);
    }
}
