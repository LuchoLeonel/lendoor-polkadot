// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import {IVault, IEVault, IERC4626} from "evk/EVault/IEVault.sol";
import {Base} from "evk/EVault/shared/Base.sol";
import {BalanceUtils} from "evk/EVault/shared/BalanceUtils.sol";
import {AssetTransfers} from "evk/EVault/shared/AssetTransfers.sol";
import {SafeERC20Lib} from "evk/EVault/shared/lib/SafeERC20Lib.sol";
import {ProxyUtils} from "evk/EVault/shared/lib/ProxyUtils.sol";
import {UserStorage} from "evk/EVault/shared/types/UserStorage.sol";

import "evk/EVault/shared/types/Types.sol";
import "evk/EVault/shared/Constants.sol";

/// @title VaultModule
/// @custom:security-contact security@euler.xyz
/// @author Euler Labs (https://www.eulerlabs.com/)
/// @notice An EVault module handling ERC4626 standard behaviour,
///         modified to integrate senior/junior tranche logic.
/// @dev This fork extends the original VaultModule by:
///      - Adding tranche-related state variables (`psSeniorRay`, `psJuniorRay`, `totalSharesJunior`, etc.).
///      - Initializing tranche accounting in `initialize()`.
///      - Supporting separate exchange rates and redemption paths for senior vs. junior tranches.
///      - Preserving compatibility with the base EVault interfaces, while expanding semantics.
abstract contract VaultModule is IVault, AssetTransfers, BalanceUtils {
    using TypesLib for uint256;
    using SafeERC20Lib for IERC20;
    using {addShares, subShares} for Shares;

    // Junior tranche cap in basis points (bps)
    uint256 internal constant JUNIOR_CAP_BPS = 2_000; // 20%

    /// @inheritdoc IERC4626
    function asset() public view virtual reentrantOK returns (address) {
        (IERC20 _asset,,) = ProxyUtils.metadata();
        return address(_asset);
    }

    /// @inheritdoc IERC4626
    // ERC-4626: NAV SENIOR ONLY (eToken)
    function totalAssets() public view virtual nonReentrantView returns (uint256) {
        uint256 s = vaultStorage.totalShares.toUint(); // Supply of the senior tranche (eToken)
        if (s == 0) return 0;
        return (s * vaultStorage.psSeniorRay) / ONE_RAY; // NAV of the senior tranche (eToken)
    }

    /// @inheritdoc IERC4626
    function convertToAssets(uint256 shares) public view virtual nonReentrantView returns (uint256) {
        return _seniorSharesToAssetsDown(TypesLib.toShares(shares)).toUint(); // floor
    }

    /// @inheritdoc IERC4626
    function convertToShares(uint256 assets) public view virtual nonReentrantView returns (uint256) {
        return _assetsToSeniorSharesDown(TypesLib.toAssets(assets)).toUint(); // floor
    }

    /// @inheritdoc IERC4626
    function previewDeposit(uint256 assets) public view virtual nonReentrantView returns (uint256) {
        return _assetsToSeniorSharesDown(TypesLib.toAssets(assets)).toUint(); // floor
    }

    /// @inheritdoc IERC4626
    function previewMint(uint256 shares) public view virtual nonReentrantView returns (uint256) {
        return _seniorSharesToAssetsUp(TypesLib.toShares(shares)).toUint(); // ceil
    }

    /// @inheritdoc IERC4626
    function previewWithdraw(uint256 assets) public view virtual nonReentrantView returns (uint256) {
    // ceil: shares = ceil(assets * 1e27 / psSeniorRay)
    return _assetsToSeniorSharesUp(TypesLib.toAssets(assets)).toUint(); // ceil
    }

    /// @inheritdoc IERC4626
    function previewRedeem(uint256 shares) public view virtual nonReentrantView returns (uint256) {
        return _seniorSharesToAssetsDown(TypesLib.toShares(shares)).toUint(); // floor
    }

    /// @inheritdoc IERC4626
    function maxDeposit(address account) public view virtual nonReentrantView returns (uint256) {
        VaultCache memory vaultCache = loadVault();
        if (isOperationDisabled(vaultCache.hookedOps, OP_DEPOSIT)) return 0;

        // the result may underestimate due to rounding
        Assets max = maxMintInternal(vaultCache, account).toAssetsDown(vaultCache);

        // if assets round down to zero, deposit reverts with E_ZeroShares
        return max.toSharesDown(vaultCache).toUint() == 0 ? 0 : max.toUint();
    }

    /// @inheritdoc IERC4626
    function maxMint(address account) public view virtual nonReentrantView returns (uint256) {
        VaultCache memory vaultCache = loadVault();

        return isOperationDisabled(vaultCache.hookedOps, OP_MINT) ? 0 : maxMintInternal(vaultCache, account).toUint();
    }

    /// @inheritdoc IERC4626
    function maxWithdraw(address owner)
        public
        view
        virtual
        nonReentrantView
        returns (uint256)
    {
        if (isOperationDisabled(vaultStorage.hookedOps, OP_WITHDRAW)) return 0;
        VaultCache memory v = loadVault();

        Shares maxShares = _maxRedeemShares(v, owner);  
        // conversion using senior's PPS (floor)
        return _seniorSharesToAssetsDown(maxShares).toUint();
    }

    /// @inheritdoc IVault
    function accumulatedFeesAssets() public view virtual nonReentrantView returns (uint256) {
        VaultCache memory vaultCache = loadVault();

        return vaultCache.accumulatedFees.toAssetsDown(vaultCache).toUint();
    }

    /// @inheritdoc IVault
    function creator() public view virtual reentrantOK returns (address) {
        return vaultStorage.creator;
    }

    /// @inheritdoc IERC4626
    function deposit(uint256 amount, address receiver) public virtual nonReentrant returns (uint256) {
        _accrueTranches();
        (VaultCache memory vaultCache, address account) = initOperation(OP_DEPOSIT, CHECKACCOUNT_NONE);

        Assets assets = amount == type(uint256).max ? vaultCache.asset.balanceOf(account).toAssets() : amount.toAssets();
        if (assets.isZero()) return 0;

        Shares shares = _assetsToSeniorSharesDown(assets);

        if (shares.isZero()) revert E_ZeroShares();

        finalizeDeposit(vaultCache, assets, shares, account, receiver);

        return shares.toUint();
    }

    /// @inheritdoc IERC4626
    function mint(uint256 amount, address receiver) public virtual nonReentrant returns (uint256) {
        _accrueTranches();
        (VaultCache memory vaultCache, address account) = initOperation(OP_MINT, CHECKACCOUNT_NONE);

        Shares shares = amount.toShares();
        if (shares.isZero()) return 0;

        Assets assets = _seniorSharesToAssetsUp(shares);

        finalizeDeposit(vaultCache, assets, shares, account, receiver);

        return assets.toUint();
    }

    /// @inheritdoc IERC4626
    function withdraw(uint256 amount, address receiver, address owner) public virtual nonReentrant returns (uint256) {
        _accrueTranches();
        (VaultCache memory vaultCache, address account) = initOperation(OP_WITHDRAW, owner);

        Assets assets = amount.toAssets();
        if (assets.isZero()) return 0;

        Shares shares = _assetsToSeniorSharesUp(assets);

        finalizeWithdraw(vaultCache, assets, shares, account, receiver, owner);

        return shares.toUint();
    }

    /// @inheritdoc IERC4626
    function redeem(uint256 amount, address receiver, address owner) public virtual nonReentrant returns (uint256) {
        _accrueTranches();
        (VaultCache memory vaultCache, address account) = initOperation(OP_REDEEM, owner);

        Shares shares = amount == type(uint256).max ? vaultStorage.users[owner].getBalance() : amount.toShares();
        if (shares.isZero()) return 0;

        Assets assets = _seniorSharesToAssetsDown(shares);
        if (assets.isZero()) revert E_ZeroAssets();

        finalizeWithdraw(vaultCache, assets, shares, account, receiver, owner);

        return assets.toUint();
    }

    /// @inheritdoc IVault
    function skim(uint256 amount, address receiver) public virtual nonReentrant returns (uint256) {
        _accrueTranches();
        (VaultCache memory vaultCache, address account) = initOperation(OP_SKIM, CHECKACCOUNT_NONE);

        Assets balance = vaultCache.asset.balanceOf(address(this)).toAssets();
        Assets available = balance <= vaultCache.cash ? Assets.wrap(0) : balance.subUnchecked(vaultCache.cash);

        Assets assets;
        if (amount == type(uint256).max) {
            assets = available;
        } else {
            assets = amount.toAssets();
            if (assets > available) revert E_InsufficientAssets();
        }
        if (assets.isZero()) return 0;

        Shares shares = _assetsToSeniorSharesDown(assets);

        if (shares.isZero()) revert E_ZeroShares();

        vaultStorage.netExternalFlowAssets += int256(assets.toUint());

        vaultStorage.cash = vaultCache.cash = vaultCache.cash + assets;
        increaseBalance(vaultCache, receiver, account, shares, assets);

        return shares.toUint();
    }

    function finalizeDeposit(
        VaultCache memory vaultCache,
        Assets assets,
        Shares shares,
        address sender,
        address receiver
    ) private {
        pullAssets(vaultCache, sender, assets);

        vaultStorage.netExternalFlowAssets += int256(assets.toUint());
        increaseBalance(vaultCache, receiver, sender, shares, assets);
    }

    function finalizeWithdraw(
        VaultCache memory vaultCache,
        Assets assets,
        Shares shares,
        address sender,
        address receiver,
        address owner
    ) private {
        if (vaultCache.cash < assets) revert E_InsufficientCash();

        decreaseAllowance(owner, sender, shares);

        vaultStorage.netExternalFlowAssets -= int256(assets.toUint());
        decreaseBalance(vaultCache, owner, sender, receiver, shares, assets);

        pushAssets(vaultCache, receiver, assets);
    }

    /**
    * @dev Lower bound on senior shares redeemable by `owner` without reverting
    *      (ERC-4626 senior-only semantics).
    *
    * Rationale:
    * - If an account-level controller is enabled (e.g., borrow/health checks), we
    *   conservatively return 0 because the controller may retain assets or cause
    *   the operation to revert.
    * - Otherwise, cap by on-chain liquidity (vault cash). Convert `v.cash` to
    *   senior shares using the current senior PPS `psSeniorRay` with floor rounding,
    *   then clamp the user's balance to that amount.
    *
    * NOTE: We deliberately do NOT use totalAssets/totalShares with any virtual
    *       deposit mechanism here. This ERC-4626 surface models only the Senior
    *       tranche; previews/limits must be consistent with `psSeniorRay`.
    */
    function _maxRedeemShares(VaultCache memory v, address owner)
        private
        view
        returns (Shares)
    {
        // User's current senior share balance
        Shares max = vaultStorage.users[owner].getBalance();

        // Be conservative: if zero balance or controllers enabled, redeemable = 0
        if (max.isZero() || hasAnyControllerEnabled(owner)) return Shares.wrap(0);

        // Bound by available cash, expressed in senior shares (floor at PPS)
        Shares cashAsShares = _assetsToSeniorSharesDown(v.cash);
        if (max > cashAsShares) max = cashAsShares;

        return max;
    }

    /// @inheritdoc IVault
    function accumulatedFees() public view virtual nonReentrantView returns (uint256) {
        return loadVault().accumulatedFees.toUint();
    }

    /// @inheritdoc IERC4626
    function maxRedeem(address owner)
        public
        view
        virtual
        override
        nonReentrantView
        returns (uint256)
    {
        // If the operation is disabled by hooks, it cannot be redeemed
        if (isOperationDisabled(vaultStorage.hookedOps, OP_REDEEM)) return 0;

        // We load the cache (for liquidity/cash limits)
        VaultCache memory v = loadVault();

        // Maximum shares that could be redeemed without reverting (limited by cash and controllers)
        Shares max = _maxRedeemShares(v, owner);

        // If those shares, when converted to assets with floor, result in 0, return 0 (4626 behavior)
        if (_seniorSharesToAssetsDown(max).toUint() == 0) return 0;

        return max.toUint();
    }

    function maxMintInternal(VaultCache memory vaultCache, address) private pure returns (Shares) {
        uint256 supply = totalAssetsInternal(vaultCache);
        if (supply >= vaultCache.supplyCap) return Shares.wrap(0); // at or over the supply cap already

        unchecked {
            // limit to supply cap
            uint256 max = vaultCache.supplyCap - supply;

            // limit to cash remaining space
            uint256 limit = MAX_SANE_AMOUNT - vaultCache.cash.toUint();
            max = limit < max ? limit : max;

            // limit to total shares remaining space
            max = max.toAssets().toSharesDownUint(vaultCache);
            limit = MAX_SANE_AMOUNT - vaultCache.totalShares.toUint();

            return (limit < max ? limit : max).toShares();
        }
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    function jTotalSupply() public view virtual nonReentrantView() returns (uint256) {
        return vaultStorage.totalSharesJunior.toUint();
    }

    function jBalanceOf(address addr) public view virtual nonReentrantView() returns (uint256) {
        return vaultStorage.users[addr].juniorBalance.toUint();
    }
    function psSeniorRay() external view returns (uint256) { return vaultStorage.psSeniorRay; }
    
    function psJuniorRay() external view returns (uint256) { return vaultStorage.psJuniorRay; }

    // -------------------------------------------------------------------------
    // Conversion public view helpers
    // -------------------------------------------------------------------------

    function convertToJuniorShares(uint256 assets) public view virtual nonReentrantView returns (uint256) {
        return _assetsToJuniorSharesDown(TypesLib.toAssets(assets)).toUint(); // floor
    }

    function convertToJuniorAssets(uint256 jShares) public view virtual nonReentrantView returns (uint256) {
        return _juniorSharesToAssetsDown(TypesLib.toShares(jShares)).toUint(); // floor
    }

    function previewDepositJunior(uint256 assets) public view virtual nonReentrantView returns (uint256) {
        return _assetsToJuniorSharesDown(TypesLib.toAssets(assets)).toUint(); // floor
    }

    function previewMintJunior(uint256 jShares) public view virtual nonReentrantView returns (uint256) {
        return _juniorSharesToAssetsUp(TypesLib.toShares(jShares)).toUint();  // ceil
    }

    function previewWithdrawJunior(uint256 assets) public view virtual nonReentrantView returns (uint256) {
        return _assetsToJuniorSharesUp(TypesLib.toAssets(assets)).toUint();   // ceil
    }

    function previewRedeemJunior(uint256 jShares) public view virtual nonReentrantView returns (uint256){
        return _juniorSharesToAssetsDown(TypesLib.toShares(jShares)).toUint();// floor
    }

    function availableCashAssets() public view virtual nonReentrantView returns (uint256) {
        return loadVault().cash.toUint();
    }

    function juniorCapacityLeftAssets() public view virtual nonReentrantView returns (uint256) {
        VaultCache memory v = loadVault();
        uint256 poolNAV   = _poolNAVNet(v);
        uint256 capNAV    = (poolNAV * JUNIOR_CAP_BPS) / 10_000;
        uint256 juniorNAV = _juniorSharesToAssetsDown(vaultStorage.totalSharesJunior).toUint();
        return capNAV > juniorNAV ? capNAV - juniorNAV : 0;
    }

    /// @dev Accumulate interest and harvest the tranches.
    /// Use a simple IRM with a fixed rate for the Senior tranche as a placeholder.
    function _accrueTranches() internal {
        uint64 nowTs = uint64(block.timestamp);

        // Updated cache (IRM already applied by EVK in loadVault)
        VaultCache memory v = loadVault();

        // NAV net of fees in this block
        uint256 poolNAV_now = _poolNAVNet(v);

        // Bootstrap: first time or empty snapshot
        if (vaultStorage.lastAccrualTs == 0 || vaultStorage.lastAssetsSnap == 0) {
            if (vaultStorage.psSeniorRay == 0) vaultStorage.psSeniorRay = ONE_RAY;
            if (vaultStorage.psJuniorRay == 0) vaultStorage.psJuniorRay = ONE_RAY;
            vaultStorage.lastAssetsSnap = poolNAV_now;
            vaultStorage.lastAccrualTs  = nowTs;
            vaultStorage.netExternalFlowAssets = 0; // clear accumulated
            return;
        }

        uint256 dt = nowTs - vaultStorage.lastAccrualTs;
        if (dt == 0) return; // nothing to do without passage of time

        uint256 poolNAV_prev = vaultStorage.lastAssetsSnap;

        // Current supplies before applying accrual
        uint256 senSupply = vaultStorage.totalShares.toUint();       // eToken (senior)
        uint256 junSupply = vaultStorage.totalSharesJunior.toUint(); // junior

        // If there is no supply, just advance snapshot/time and reset external flow
        if (senSupply == 0 && junSupply == 0) {
            vaultStorage.lastAssetsSnap = poolNAV_now;
            vaultStorage.lastAccrualTs  = nowTs;
            vaultStorage.netExternalFlowAssets = 0;
            return;
        }

        // NAVs at the beginning of the period (according to current ps*)
        uint256 senNAV0 = (senSupply == 0) ? 0 : (vaultStorage.psSeniorRay * senSupply) / ONE_RAY;
        uint256 junNAV0 = (junSupply == 0) ? 0 : (vaultStorage.psJuniorRay * junSupply) / ONE_RAY;

        // Gross P&L for the period (net of fees)
        int256 pnlGross = int256(poolNAV_now) - int256(poolNAV_prev);

        // Discount accumulated external flows (dep/withd/skim) so they don't count as P&L
        int256 extFlow = vaultStorage.netExternalFlowAssets; // read accumulated
        vaultStorage.netExternalFlowAssets = 0;              // reset for the next period
        int256 pnlNet = pnlGross - extFlow;

        // Senior's target for this dt (linear interest placeholder)
        uint256 senTarget = (senNAV0 == 0)
            ? 0
            : (senNAV0 * (SENIOR_RATE_PER_SEC_RAY * dt)) / ONE_RAY;

        // Deltas to apply
        int256 dSen;
        int256 dJun;

        if (pnlNet >= 0) {
            uint256 gain = uint256(pnlNet);
            if (gain >= senTarget) {
                // Senior collects its target; the excess goes to Junior
                dSen = int256(senTarget);
                dJun = int256(gain - senTarget);
            } else {
                // Missing the target: top-up from Junior (as far as it goes)
                uint256 shortfall  = senTarget - gain;
                uint256 fromJunior = shortfall > junNAV0 ? junNAV0 : shortfall;
                dSen = int256(gain + fromJunior);
                dJun = -int256(fromJunior);
            }
        } else {
            // Loss: first Junior, then Senior
            uint256 loss       = uint256(-pnlNet);
            uint256 fromJunior = loss > junNAV0 ? junNAV0 : loss;
            uint256 rem        = loss - fromJunior;
            dJun = -int256(fromJunior);
            dSen = -int256(rem);
        }

        // Apply ΔNAV via Δps with clamps to 0
        if (senSupply > 0 && dSen != 0) {
            uint256 mag = uint256(dSen > 0 ? dSen : -dSen);
            uint256 dPs = (mag * ONE_RAY) / senSupply;
            if (dSen > 0) {
                vaultStorage.psSeniorRay += dPs;
            } else {
                vaultStorage.psSeniorRay = vaultStorage.psSeniorRay > dPs ? vaultStorage.psSeniorRay - dPs : 0;
            }
        }

        if (junSupply > 0 && dJun != 0) {
            uint256 mag = uint256(dJun > 0 ? dJun : -dJun);
            uint256 dPs = (mag * ONE_RAY) / junSupply;
            if (dJun > 0) {
                vaultStorage.psJuniorRay += dPs;
            } else {
                vaultStorage.psJuniorRay = vaultStorage.psJuniorRay > dPs ? vaultStorage.psJuniorRay - dPs : 0;
            }
        }

        // Update snapshot/time
        vaultStorage.lastAssetsSnap = poolNAV_now;
        vaultStorage.lastAccrualTs  = nowTs;
    }

    // ===== Internal helpers (NO modifiers), only math/reading =====

    /// @dev Helper returns the NAV of the pool, net of accumulated fees.
    function _poolNAVNet(VaultCache memory v) internal pure returns (uint256) {
        uint256 gross = totalAssetsInternal(v);
        uint256 fees  = v.accumulatedFees.toAssetsDown(v).toUint();
        return gross > fees ? gross - fees : 0;
    }

    // ====== DEBUG VIEWS (external view, read-only) ======
    function debugSnapshot() external view returns (uint64 lastAccrualTs, uint256 lastAssetsSnap) {
        return (vaultStorage.lastAccrualTs, vaultStorage.lastAssetsSnap);
    }
    function debugSupplies() external view returns (uint256 senSupply, uint256 junSupply) {
        return (vaultStorage.totalShares.toUint(), vaultStorage.totalSharesJunior.toUint());
    }
    function debugPps() external view returns (uint256 psSen, uint256 psJun) {
        return (vaultStorage.psSeniorRay, vaultStorage.psJuniorRay);
    }
    function debugPoolNAVs() external view returns (uint256 gross, uint256 net) {
        VaultCache memory v = loadVault();

        gross = totalAssetsInternal(v);
        net   = _poolNAVNet(v);
    }
    function debugExternalFlow() external view returns (int256) {
        return vaultStorage.netExternalFlowAssets; // if you implement the accumulator
    }
    
    /// -------------------------------------------------------------------------

    function _assetsToSeniorSharesDown(Assets assets) internal view returns (Shares) {
        uint256 ps = vaultStorage.psSeniorRay;
        if (ps == 0) return Shares.wrap(0);
        uint256 s = (assets.toUint() * ONE_RAY) / ps; // floor
        return Shares.wrap(uint112(s));
    }

    function _assetsToSeniorSharesUp(Assets assets) internal view returns (Shares) {
        uint256 ps = vaultStorage.psSeniorRay;
        if (ps == 0) return Shares.wrap(0);
        uint256 num = assets.toUint() * ONE_RAY;
        uint256 s = (num + ps - 1) / ps; // ceil
        return Shares.wrap(uint112(s));
    }

    function _seniorSharesToAssetsDown(Shares shares) internal view returns (Assets) {
        uint256 a = (shares.toUint() * vaultStorage.psSeniorRay) / ONE_RAY; // floor
        return Assets.wrap(uint112(a));
    }

    function _seniorSharesToAssetsUp(Shares shares) internal view returns (Assets) {
        uint256 ps = vaultStorage.psSeniorRay;
        uint256 num = shares.toUint() * ps;
        uint256 a = (num + ONE_RAY - 1) / ONE_RAY; // ceil
        return Assets.wrap(uint112(a));
    }

    function _assetsToJuniorSharesDown(Assets a) internal view returns (Shares) {
        uint256 ps = vaultStorage.psJuniorRay;
        if (ps == 0) return Shares.wrap(0);
        uint256 s = (a.toUint() * ONE_RAY) / ps; // floor
        return Shares.wrap(uint112(s));
    }

    function _assetsToJuniorSharesUp(Assets a) internal view returns (Shares) {
        uint256 ps = vaultStorage.psJuniorRay;
        if (ps == 0) return Shares.wrap(0);
        uint256 num = a.toUint() * ONE_RAY;
        uint256 s = (num + ps - 1) / ps; // ceil
        return Shares.wrap(uint112(s));
    }

    function _juniorSharesToAssetsDown(Shares j) internal view returns (Assets) {
        uint256 a = (j.toUint() * vaultStorage.psJuniorRay) / ONE_RAY; // floor
        return Assets.wrap(uint112(a));
    }

    function _juniorSharesToAssetsUp(Shares j) internal view returns (Assets) {
        uint256 ps = vaultStorage.psJuniorRay;
        uint256 num = j.toUint() * ps;
        uint256 a = (num + ONE_RAY - 1) / ONE_RAY; // ceil
        return Assets.wrap(uint112(a));
    }

    function promoteToJunior(uint256 seniorSharesIn, address to)
        public virtual nonReentrant
        returns (uint256 jSharesOut)
    {
        _accrueTranches();
        (VaultCache memory v, address owner) = initOperation(OP_TRANSFER, CHECKACCOUNT_CALLER);

        // seniorSharesIn -> assets (floor)
        Assets assetsA = _seniorSharesToAssetsDown(seniorSharesIn.toShares());
        if (assetsA.toUint() == 0) revert E_ZeroAssets();

        // Cap check: juniorNAV + assets ≤ cap * poolNAV / 10_000
        uint256 poolNAV   = _poolNAVNet(v);
        uint256 juniorNAV = _juniorSharesToAssetsDown(vaultStorage.totalSharesJunior).toUint();
        if ((juniorNAV + assetsA.toUint()) * 10_000 > JUNIOR_CAP_BPS * poolNAV) {
            revert E_JuniorTrancheCapExceeded();
        }

        // assets -> junior shares (floor)
        Shares jShares = _assetsToJuniorSharesDown(assetsA);
        jSharesOut = jShares.toUint();

        // Removes senior from balance and credits junior
        decreaseBalance(v, owner, owner, address(0), seniorSharesIn.toShares(), assetsA);
        vaultStorage.users[to].juniorBalance = vaultStorage.users[to].juniorBalance.addShares(jShares);
        vaultStorage.totalSharesJunior       = vaultStorage.totalSharesJunior.addShares(jShares);

        return jSharesOut;
    }

    function demoteToSenior(uint256 jSharesIn, address to)
        public virtual nonReentrant
        returns (uint256 seniorSharesOut)
    {
        _accrueTranches();
        (VaultCache memory v, address owner) = initOperation(OP_TRANSFER, CHECKACCOUNT_CALLER);

        if (jSharesIn == 0) return 0;

        // jShares -> assets (floor)
        Shares jShares = jSharesIn.toShares();
        Assets assetsA = _juniorSharesToAssetsDown(jShares);
        if (assetsA.toUint() == 0) revert E_ZeroAssets();

        // Debit junior from owner
        UserStorage storage user = vaultStorage.users[owner];
        if (jShares.toUint() > user.juniorBalance.toUint()) revert E_InsufficientBalance();
        user.juniorBalance = user.juniorBalance.subShares(jShares);
        vaultStorage.totalSharesJunior = vaultStorage.totalSharesJunior.subShares(jShares);

        // assets -> senior shares (floor)
        Shares seniorShares = _assetsToSeniorSharesDown(assetsA);
        seniorSharesOut = seniorShares.toUint();

        // Credit senior
        increaseBalance(v, to, owner, seniorShares, assetsA);

        return seniorSharesOut;
    }
}
/// @dev Deployable module contract
contract Vault is VaultModule {
    constructor(Integrations memory integrations) Base(integrations) {}
}
