// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20Permit} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {SafeERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "../../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {IEVault} from "evk/EVault/IEVault.sol";  

/// @notice ERC4626 whose underlying asset is e-shares (EVault's senior token).
/// The "assets" of this wrapper = e-shares of the EVault.
/// The "shares" of this wrapper = j-shares (this wrapper's token).
contract JuniorERC4626 is ERC20, ERC20Permit, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IEVault public immutable vault;        // EVault (also the e-shares ERC20)
    IERC20  public immutable senior;       // = IERC20(address(vault))
    uint8   private immutable _decimals;   // e-shares decimals

    constructor(address _vault, string memory name_, string memory symbol_)
        ERC20(name_, symbol_) ERC20Permit(name_)
    {
        vault     = IEVault(_vault);
        senior    = IERC20(_vault);                    // eToken
        _decimals = IERC20Metadata(_vault).decimals(); // use the eToken's decimals
    }

    // ===== ERC20Metadata =====
    function decimals() public view override returns (uint8) { return _decimals; }

    // ===== ERC4626 surface (interpreted with asset = e-shares) =====

    /// @notice underlying asset of the vault (e-shares)
    function asset() public view returns (address) { return address(senior); }

    /// @notice total e-shares "represented" by the j-shares held by this wrapper.
    function totalAssets() public view returns (uint256) {
        uint256 jHeld = vault.jBalanceOf(address(this));               // j-shares inside the EVault on behalf of the wrapper
        uint256 assetsUSDC = vault.convertToJuniorAssets(jHeld);       // j -> assets (USDC)
        return vault.convertToShares(assetsUSDC);                       // assets (USDC) -> e-shares
    }

    /// @notice e-shares -> j-shares (floor), via value in assets (USDC).
    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 assetsUSDC = vault.convertToAssets(assets);            // e-shares -> USDC
        return vault.previewDepositJunior(assetsUSDC);                 // USDC -> j-shares (floor)
    }

    /// @notice j-shares -> e-shares (floor), via value in assets (USDC).
    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 assetsUSDC = vault.convertToJuniorAssets(shares);      // j -> USDC
        return vault.convertToShares(assetsUSDC);                      // USDC -> e-shares (floor)
    }

    /// @dev limit by junior cap, expressed in e-shares.
    function maxDeposit(address /*receiver*/) public view returns (uint256) {
        uint256 leftUSDC = vault.juniorCapacityLeftAssets();           // junior gap in USDC
        return vault.convertToShares(leftUSDC);                        // to e-shares
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        return convertToShares(assets);
    }

    function maxMint(address receiver) public view returns (uint256) {
        return convertToShares(maxDeposit(receiver));
    }

    function previewMint(uint256 shares) public view returns (uint256) {
        // how many e-shares are needed to mint 'j' shares, with conservative rounding:
        uint256 assetsUSDC = vault.previewMintJunior(shares);          // USDC (ceil)
        return vault.convertToShares(assetsUSDC);                      // -> e-shares (floor). The require in mint adjusts accuracy.
    }

    /// @notice withdraw limit to e-shares: does not depend on cash, only on your j-balance.
    function maxWithdraw(address owner) public view returns (uint256) {
        uint256 userJ = balanceOf(owner);
        uint256 assetsUSDC = vault.convertToJuniorAssets(userJ);
        return vault.convertToShares(assetsUSDC); // how much you could demote to senior
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        // desired e-shares -> USDC -> required j-shares (ceil)
        uint256 assetsUSDC = vault.convertToAssets(assets);
        return vault.previewWithdrawJunior(assetsUSDC); // j (ceil)
    }

    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner); // all your j-balance is demotable to senior
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return convertToAssets(shares);
    }

    // ===== Mutables =====

    /// @notice Deposits e-shares and receives j-shares.
    function deposit(uint256 assets, address receiver)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) return 0;

        // 1) pull e-shares from the user
        senior.safeTransferFrom(msg.sender, address(this), assets);

        // 2) promote to junior
        shares = vault.promoteToJunior(assets, address(this));

        // 3) mint j to the receiver
        _mint(receiver, shares);

    }

    /// @notice Mints EXACTLY `shares` j, charging the necessary e-shares.
    function mint(uint256 shares, address receiver)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) return 0;

        // How many e-shares are needed (approx):
        uint256 assetsUSDC = vault.previewMintJunior(shares);  // USDC (ceil)
        assets = vault.convertToShares(assetsUSDC);            // e-shares (floor approx)

        // Pull e-shares
        senior.safeTransferFrom(msg.sender, address(this), assets);

        // Promote and check accuracy
        uint256 jOut = vault.promoteToJunior(assets, address(this));
        require(jOut == shares, "JUNIOR_MINT_MISMATCH");

        _mint(receiver, shares);
    }

    /// @notice Removes j-shares and delivers EXACTLY `assets` e-shares to the receiver.
    function withdraw(uint256 assets, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) return 0;

        // necessary j-shares (ceil), calculated via USDC
        uint256 assetsUSDC = vault.convertToAssets(assets);
        shares = vault.previewWithdrawJunior(assetsUSDC);

        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);

        // Demote to senior
        uint256 seniorOut = vault.demoteToSenior(shares, address(this));
        require(seniorOut >= assets, "WITHDRAW_DEFICIT");

        // Delivers exactly 'assets'
        senior.safeTransfer(receiver, assets);

        // If there are leftover e-shares due to rounding, re-promote them to avoid trapping value
        uint256 excess = seniorOut - assets;
        if (excess > 0) {
            vault.promoteToJunior(excess, address(this));
        }

    }

    /// @notice Redeems `shares` j and delivers ALL the resulting e-shares.
    function redeem(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) return 0;
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);

        assets = vault.demoteToSenior(shares, address(this)); // total e-shares (floor)
        senior.safeTransfer(receiver, assets);

    }

    // ===== Optional helpers for UIs =====

    function previewDepositFromSenior(uint256 seniorShares) external view returns (uint256 jOut) {
        uint256 assetsUSDC = vault.convertToAssets(seniorShares);
        jOut = vault.convertToJuniorShares(assetsUSDC);
    }

    function previewRedeemToSenior(uint256 jShares) external view returns (uint256 seniorOut) {
        uint256 assetsUSDC = vault.convertToJuniorAssets(jShares);
        seniorOut = vault.convertToShares(assetsUSDC);
    }
}