// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICreditLimitManager} from "../Interfaces/ICreditLimitManager.sol";

/// @title CreditLimitManager (per-user)
/// @notice Registers score (0..255) and limit per user, in asset units (e.g., USDC 6 dec)
contract CreditLimitManager is ICreditLimitManager {
    address public owner; // satisfies owner() of the interface by public getter

    struct Line {
        uint8   score;   // 0..255
        uint248 limit;   // asset units (e.g., 1000 USDC = 1000e6)
    }

    mapping(address => Line) public lines;

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(address _owner) {
        owner = _owner == address(0) ? msg.sender : _owner;
    }

    /// @inheritdoc ICreditLimitManager
    function setOwner(address n) external override onlyOwner {
        require(n != address(0), "owner=0");
        emit OwnerChanged(owner, n);
        owner = n;
    }

    /// @inheritdoc ICreditLimitManager
    function setLine(address account, uint8 score, uint256 limit) public override onlyOwner {
        require(account != address(0), "acct=0");
        lines[account] = Line({score: score, limit: uint248(limit)});
        emit LineSet(account, score, limit);
    }

    /// @inheritdoc ICreditLimitManager
    function batchSetLines(ICreditLimitManager.LineUpdate[] calldata ups)
        external
        override
        onlyOwner
    {
        for (uint256 i; i < ups.length; ++i) {
            setLine(ups[i].account, ups[i].score, ups[i].limit);
        }
    }

    /// @inheritdoc ICreditLimitManager
    function clearLine(address account) external override onlyOwner {
        delete lines[account];
        emit LineCleared(account);
    }

    /// @inheritdoc ICreditLimitManager
    function creditLimit(address account) external view override returns (uint256) {
        return uint256(lines[account].limit);
    }

    /// @inheritdoc ICreditLimitManager
    function scoreOf(address account) external view override returns (uint8) {
        return lines[account].score;
    }
}