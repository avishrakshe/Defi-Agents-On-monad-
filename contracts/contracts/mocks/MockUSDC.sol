// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock 6-decimal USDC for local testing and devnet simulations
 */
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10**6); // 1 million USDC
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
