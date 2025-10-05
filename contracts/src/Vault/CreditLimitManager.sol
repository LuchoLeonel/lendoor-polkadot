// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface consumed by RiskManagerUncollat (do not change)
interface ICLM {
    function creditLimit(address account) external view returns (uint256);
}

/// @title CreditLimitManager (per-user)
/// @notice Registers score (0..255) and limit per user, in units of the asset (e.g. USDC 6 dec)
contract CreditLimitManager is ICLM {
    address public owner;

    struct Line {
        uint8   score;   // 0..255
        uint248 limit;   // in units of the asset (e.g. 1000 USDC = 1000e6)
    }

    mapping(address => Line) public lines;

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event LineSet(address indexed account, uint8 score, uint256 limit);
    event LineCleared(address indexed account);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor(address _owner) {
        owner = _owner == address(0) ? msg.sender : _owner;
    }

    function setOwner(address n) external onlyOwner {
        require(n != address(0), "owner=0");
        emit OwnerChanged(owner, n);
        owner = n;
    }

    /// @notice Sets score and limit for `account`
    /// @param limit In units of the asset (e.g. USDC: 6 decimals)
    function setLine(address account, uint8 score, uint256 limit) public onlyOwner {
        require(account != address(0), "acct=0");
        lines[account] = Line({score: score, limit: uint248(limit)});
        emit LineSet(account, score, limit);
    }

    /// @notice Convenient batch (for multiple users)
    struct LineUpdate { address account; uint8 score; uint256 limit; }
    function batchSetLines(LineUpdate[] calldata ups) external onlyOwner {
        for (uint256 i; i < ups.length; ++i) {
            setLine(ups[i].account, ups[i].score, ups[i].limit);
        }
    }

    /// @notice Deletes the user's score/limit (equivalent to a limit of 0)
    function clearLine(address account) external onlyOwner {
        delete lines[account];
        emit LineCleared(account);
    }

    /// @inheritdoc ICLM
    function creditLimit(address account) external view returns (uint256) {
        return uint256(lines[account].limit);
    }

    /// @notice Helper to read the user's score
    function scoreOf(address account) external view returns (uint8) {
        return lines[account].score;
    }
}