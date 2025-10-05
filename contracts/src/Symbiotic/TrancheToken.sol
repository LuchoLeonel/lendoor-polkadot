// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrancheToken
 * @notice Minimal ERC20-like token with fixed decimals and a single minter (the tranche wrapper).
 *         - decimals: configurable (6 for USDC-like UX)
 *         - mint/burn only callable by `minter`
 *
 * NOTE: This is purposefully minimal. If you want full ERC20 behavior, import OZ ERC20
 * and add the necessary APIs. For this MVP we expose only what the wrapper needs.
 */
contract TrancheToken {
    string public name;
    string public symbol;
    uint8  private immutable _decimals;
    address public immutable minter;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyMinter() {
        require(msg.sender == minter, "NOT_MINTER");
        _;
    }

    constructor(string memory name_, string memory symbol_, address minter_, uint8 decimals_) {
        name = name_;
        symbol = symbol_;
        minter = minter_;
        _decimals = decimals_;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    // ---- ERC20 basic ----

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= value, "ALLOWANCE");
        if (a != type(uint256).max) {
            allowance[from][msg.sender] = a - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "ZERO_TO");
        uint256 b = balanceOf[from];
        require(b >= value, "BALANCE");
        unchecked { balanceOf[from] = b - value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    // ---- Mint/Burn for the wrapper ----

    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "ZERO_TO");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyMinter {
        uint256 b = balanceOf[from];
        require(b >= amount, "BALANCE");
        unchecked { balanceOf[from] = b - amount; }
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}