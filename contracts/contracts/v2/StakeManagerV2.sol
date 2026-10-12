// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IdentityRegistryV2.sol";

/**
 * @title StakeManagerV2
 * @dev Same logic as StakeManager v1, pointed at IdentityRegistryV2.
 * slash() is callable by the dispute resolver or the contract owner; no dispute process is wired to it yet.
 */
contract StakeManagerV2 is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    IdentityRegistryV2 public immutable identityRegistry;

    mapping(uint256 => uint256) private _stakes;
    mapping(uint256 => mapping(address => uint256)) private _stakerBalances;
    address public disputeResolver;

    event Staked(uint256 indexed agentId, address indexed staker, uint256 amount, uint256 totalStake);
    event Unstaked(uint256 indexed agentId, address indexed staker, uint256 amount, uint256 remainingStake);
    event Slashed(uint256 indexed agentId, uint256 amount, address indexed recipient, string reason);
    event DisputeResolverUpdated(address indexed oldResolver, address indexed newResolver);

    constructor(address _usdcToken, address _identityRegistry) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_identityRegistry != address(0), "Invalid IdentityRegistry address");
        usdcToken = IERC20(_usdcToken);
        identityRegistry = IdentityRegistryV2(_identityRegistry);
    }

    function setDisputeResolver(address _resolver) external onlyOwner {
        emit DisputeResolverUpdated(disputeResolver, _resolver);
        disputeResolver = _resolver;
    }

    function stake(uint256 agentId, uint256 amount) external {
        require(amount > 0, "Stake amount must be > 0");
        require(identityRegistry.getAgent(agentId).active, "Agent not active");

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        _stakes[agentId] += amount;
        _stakerBalances[agentId][msg.sender] += amount;
        emit Staked(agentId, msg.sender, amount, _stakes[agentId]);
    }

    function unstake(uint256 agentId, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(_stakerBalances[agentId][msg.sender] >= amount, "Insufficient staked balance");
        require(_stakes[agentId] >= amount, "Exceeds total agent stake");

        _stakerBalances[agentId][msg.sender] -= amount;
        _stakes[agentId] -= amount;
        usdcToken.safeTransfer(msg.sender, amount);
        emit Unstaked(agentId, msg.sender, amount, _stakes[agentId]);
    }

    function getStake(uint256 agentId) external view returns (uint256) {
        return _stakes[agentId];
    }

    function getStakerBalance(uint256 agentId, address staker) external view returns (uint256) {
        return _stakerBalances[agentId][staker];
    }

    function slash(uint256 agentId, uint256 amount, address recipient, string calldata reason) external {
        require(msg.sender == disputeResolver || msg.sender == owner(), "Caller is not authorized dispute resolver");
        require(amount > 0, "Amount must be > 0");
        require(_stakes[agentId] >= amount, "Slash amount exceeds total stake");
        require(recipient != address(0), "Invalid recipient");

        _stakes[agentId] -= amount;
        usdcToken.safeTransfer(recipient, amount);
        emit Slashed(agentId, amount, recipient, reason);
    }
}
