// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SymbioticTrancheVault
 * @notice Senior/Junior tranches wrapper on top of an ERC4626 vault (e.g., Symbiotic).
 *         - Underlying asset is USDC (6 decimals).
 *         - Tranche tokens (tSNR/tJNR) also use 6 decimals to match USDC UX.
 *
 *         Indices (indexSNR/indexJNR) are price-per-share for each tranche, scaled to 1e6.
 *         sync() realizes P&L since the last NAV and applies a waterfall:
 *           - Gains: split by splitBpsSenior between Senior and Junior.
 *           - Losses: Junior first-loss, Senior absorbs remainder.
 *
 *         Deposits/withdrawals are flows (not P&L), so we update lastNavAssets but don't call sync().
 *
 * @dev This contract is compatible with OpenZeppelin v5:
 *      - Ownable requires initialOwner in constructor
 *      - SafeERC20: use forceApprove or safeIncreaseAllowance (safeApprove is removed in OZ v5)
 */

import {IERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "../../lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "../../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";

import {TrancheToken} from "./TrancheToken.sol";

contract SymbioticTrancheVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ---- External contracts ----
    IERC4626 public immutable symbioticVault;   // ERC4626 vault
    IERC20   public immutable asset;            // underlying asset (USDC, 6 decimals)
    TrancheToken public immutable seniorToken;  // tSNR (6 decimals)
    TrancheToken public immutable juniorToken;  // tJNR (6 decimals)

    // ---- Indices (price-per-share), scaled to 1e6 for USDC ----
    uint256 public indexSNR = 1e6; // initial 1.0 USDC/share
    uint256 public indexJNR = 1e6; // initial 1.0 USDC/share

    // Latest NAV checkpoint (in asset units, i.e., USDC 6-dec)
    uint256 public lastNavAssets;

    // Gains split on positive P&L: % to Senior, rest to Junior (basis points)
    uint16  public splitBpsSenior = 7000; // 70%
    uint16  public constant BPS   = 10_000;

    // ---- Events ----
    event DepositSenior(address indexed user, uint256 assetsIn, uint256 tSNRMinted);
    event DepositJunior(address indexed user, uint256 assetsIn, uint256 tJNRMinted);
    event RedeemSenior(address indexed user, uint256 tSNRBurned, uint256 assetsOut);
    event RedeemJunior(address indexed user, uint256 tJNRBurned, uint256 assetsOut);
    event Sync(int256 deltaAssets, uint256 newIndexSNR, uint256 newIndexJNR, uint256 navAfter);
    event SetSplitBpsSenior(uint16 oldBps, uint16 newBps);

    /**
     * @param _vault ERC4626 vault address
     * @param initialOwner owner address for Ownable (OZ v5 requires this)
     */
    constructor(IERC4626 _vault, address initialOwner) Ownable(initialOwner) {
        symbioticVault = _vault;
        asset          = IERC20(_vault.asset());

        // Deploy 6-decimal tranche tokens, minter = this wrapper
        seniorToken = new TrancheToken("Symbiotic Senior Tranche", "tSNR", address(this), 6);
        juniorToken = new TrancheToken("Symbiotic Junior Tranche", "tJNR", address(this), 6);

        lastNavAssets = 0;
    }

    // =========================
    // ======== Views ==========
    // =========================

    /// @notice Senior price-per-share (scaled to 1e6)
    function ppsSenior() external view returns (uint256) { return indexSNR; }

    /// @notice Junior price-per-share (scaled to 1e6)
    function ppsJunior() external view returns (uint256) { return indexJNR; }

    /// @notice Current NAV in asset units (USDC, 6-dec)
    function vaultNAV() external view returns (uint256) { return _vaultNAV(); }

    function previewDepositSenior(uint256 assets) external view returns (uint256) {
        return (assets * 1e6) / indexSNR;
    }

    function previewDepositJunior(uint256 assets) external view returns (uint256) {
        return (assets * 1e6) / indexJNR;
    }

    function previewRedeemSenior(uint256 tSNR) external view returns (uint256) {
        return (tSNR * indexSNR) / 1e6;
    }

    function previewRedeemJunior(uint256 tJNR) external view returns (uint256) {
        return (tJNR * indexJNR) / 1e6;
    }

    // =========================
    // ====== User flows =======
    // =========================

    /**
     * @notice Deposit `assets` (USDC) and mint tSNR. USDC must be approved to this contract.
     */
    function depositSenior(uint256 assets) external nonReentrant returns (uint256 tSNRMinted) {
        require(assets > 0, "ZERO_ASSETS");

        // Pull USDC
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Approve to ERC4626 (OZ v5: use forceApprove)
        asset.forceApprove(address(symbioticVault), 0);
        asset.forceApprove(address(symbioticVault), assets);

        // Deposit into the vault (vault shares stay in this wrapper)
        symbioticVault.deposit(assets, address(this));

        // Mint tSNR using current index
        tSNRMinted = (assets * 1e6) / indexSNR;
        require(tSNRMinted > 0, "ZERO_MINT");
        seniorToken.mint(msg.sender, tSNRMinted);

        // Update baseline NAV (flows are not P&L)
        lastNavAssets = _vaultNAV();

        emit DepositSenior(msg.sender, assets, tSNRMinted);
    }

    /**
     * @notice Deposit `assets` (USDC) and mint tJNR. USDC must be approved to this contract.
     */
    function depositJunior(uint256 assets) external nonReentrant returns (uint256 tJNRMinted) {
        require(assets > 0, "ZERO_ASSETS");

        asset.safeTransferFrom(msg.sender, address(this), assets);
        asset.forceApprove(address(symbioticVault), 0);
        asset.forceApprove(address(symbioticVault), assets);

        symbioticVault.deposit(assets, address(this));

        tJNRMinted = (assets * 1e6) / indexJNR;
        require(tJNRMinted > 0, "ZERO_MINT");
        juniorToken.mint(msg.sender, tJNRMinted);

        lastNavAssets = _vaultNAV();

        emit DepositJunior(msg.sender, assets, tJNRMinted);
    }

    /**
     * @notice Burn `tSNR` and withdraw USDC to caller based on current senior index.
     */
    function redeemSenior(uint256 tSNR) external nonReentrant returns (uint256 assetsOut) {
        require(tSNR > 0, "ZERO_SHARES");

        seniorToken.burn(msg.sender, tSNR);

        assetsOut = (tSNR * indexSNR) / 1e6;
        require(assetsOut > 0, "ZERO_OUT");

        symbioticVault.withdraw(assetsOut, msg.sender, address(this));

        lastNavAssets = _vaultNAV();

        emit RedeemSenior(msg.sender, tSNR, assetsOut);
    }

    /**
     * @notice Burn `tJNR` and withdraw USDC to caller based on current junior index.
     */
    function redeemJunior(uint256 tJNR) external nonReentrant returns (uint256 assetsOut) {
        require(tJNR > 0, "ZERO_SHARES");

        juniorToken.burn(msg.sender, tJNR);

        assetsOut = (tJNR * indexJNR) / 1e6;
        require(assetsOut > 0, "ZERO_OUT");

        symbioticVault.withdraw(assetsOut, msg.sender, address(this));

        lastNavAssets = _vaultNAV();

        emit RedeemJunior(msg.sender, tJNR, assetsOut);
    }

    // =========================
    // ====== Waterfall =========
    // =========================

    /**
     * @notice Realize P&L since last checkpoint and update indices (waterfall).
     *         Anyone can call this (consider adding a keeper or throttle in production).
     */
    function sync() external nonReentrant {
        _syncInternal();
    }

    function _syncInternal() internal {
        uint256 beforeNav = lastNavAssets;
        uint256 afterNav  = _vaultNAV();
        if (afterNav == beforeNav) return;

        int256 delta = int256(afterNav) - int256(beforeNav);
        uint256 sSupply = seniorToken.totalSupply();
        uint256 jSupply = juniorToken.totalSupply();

        if (delta > 0) {
            // Gains
            uint256 gain = uint256(delta);
            uint256 sGain = (gain * splitBpsSenior) / BPS;
            uint256 jGain = gain - sGain;

            // Edge cases: if any side has zero supply, route all gains to the other side
            if (sSupply == 0) { jGain = gain; sGain = 0; }
            if (jSupply == 0) { sGain = gain; jGain = 0; }

            if (sGain > 0 && sSupply > 0) {
                uint256 addPerShareS = (sGain * 1e6) / sSupply;
                indexSNR += addPerShareS;
            }
            if (jGain > 0 && jSupply > 0) {
                uint256 addPerShareJ = (jGain * 1e6) / jSupply;
                indexJNR += addPerShareJ;
            }

        } else {
            // Losses
            uint256 loss = uint256(-delta);

            // Junior first-loss
            if (loss > 0 && jSupply > 0 && indexJNR > 0) {
                uint256 jrLossPerShare = (loss * 1e6) / jSupply;

                if (jrLossPerShare >= indexJNR) {
                    // junior wiped
                    uint256 absorbed = (indexJNR * jSupply) / 1e6;
                    indexJNR = 0;
                    loss = (absorbed < loss) ? (loss - absorbed) : 0;
                } else {
                    indexJNR -= jrLossPerShare;
                    loss = 0;
                }
            }

            // Remaining loss goes to senior
            if (loss > 0 && sSupply > 0 && indexSNR > 0) {
                uint256 srLossPerShare = (loss * 1e6) / sSupply;
                if (srLossPerShare >= indexSNR) {
                    indexSNR = 0; // extreme wipe
                } else {
                    indexSNR -= srLossPerShare;
                }
            }
        }

        lastNavAssets = afterNav;
        emit Sync(delta, indexSNR, indexJNR, afterNav);
    }

    /**
     * @notice Inject extra rewards (USDC), deposit into ERC4626, and immediately realize as P&L.
     * @dev Treat the whole deposit as gains to be distributed via indices.
     */
    function notifyReward(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "ZERO_AMOUNT");

        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.forceApprove(address(symbioticVault), 0);
        asset.forceApprove(address(symbioticVault), amount);
        symbioticVault.deposit(amount, address(this));

        _syncInternal();
    }

    // =========================
    // ======= Admin ===========
    // =========================

    function setSplitBpsSenior(uint16 newBps) external onlyOwner {
        require(newBps <= BPS, "BPS");
        uint16 old = splitBpsSenior;
        splitBpsSenior = newBps;
        emit SetSplitBpsSenior(old, newBps);
    }

    // =========================
    // ======= Internals =======
    // =========================

    /// @dev NAV in USDC (6-dec): ERC4626 shares held by this wrapper converted to assets.
    function _vaultNAV() internal view returns (uint256) {
        uint256 vaultShares = IERC20(address(symbioticVault)).balanceOf(address(this));
        if (vaultShares == 0) return 0;
        return symbioticVault.convertToAssets(vaultShares);
    }
}