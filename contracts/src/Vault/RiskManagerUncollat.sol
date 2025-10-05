// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IRiskManager, IEVCVault} from "evk/EVault/IEVault.sol";
import {Base} from "evk/EVault/shared/Base.sol";
import {LiquidityUtils} from "evk/EVault/shared/LiquidityUtils.sol";
import "evk/EVault/shared/types/Types.sol";

interface ICLM { function creditLimit(address account) external view returns (uint256); }

// Minimum Gov view (provided by the Governance mixin in Dispatch)
interface IGovernanceView { function governorAdmin() external view returns (address); }

abstract contract RiskManagerUncollatModule is IRiskManager, LiquidityUtils {
    error E_CreditLimitExceeded();
    error E_InvalidAddress();

    // Default CLM address 
    address internal constant DEFAULT_CLM = 0xe42fDdeb988c6D59f767A366444Bd92770AA0352;

    // Storage in the VAULT (written via delegatecall)
    address private _creditLimitManager; // 0 = uses DEFAULT_CLM

    event CreditLimitManagerUpdated(address indexed oldCLM, address indexed newCLM);

    // Uses governorAdmin() from the VAULT (Governance mixin)
    modifier onlyGov() {
        if (IGovernanceView(address(this)).governorAdmin() != msg.sender) revert E_Unauthorized();
        _;
    }

    // GETTER: uses default if you haven't set anything in the VAULT's storage yet
    function creditLimitManager() public view returns (address) {
        address clm = _creditLimitManager;
        return clm == address(0) ? DEFAULT_CLM : clm;
    }

    // Governed SETTER (optional if the hardcoded default is enough for you)
    function setCreditLimitManager(address clm)
        external
        virtual
        nonReentrant
        onlyGov
    {
        if (clm == address(0)) revert E_InvalidAddress();
        address old = creditLimitManager();
        _creditLimitManager = clm;             // writes to the VAULT's storage
        emit CreditLimitManagerUpdated(old, clm);
    }

    // ---------------- Uncollateral logic ----------------

    function accountLiquidity(address account, bool /*liquidation*/)
        public
        view
        virtual
        nonReentrantView
        returns (uint256 collateralValue, uint256 liabilityValue)
    {
        VaultCache memory vaultCache = loadVault();
        validateController(account);

        liabilityValue  = getCurrentOwed(vaultCache, account).toAssetsUp().toUint();
        collateralValue = ICLM(creditLimitManager()).creditLimit(account);
    }

    function accountLiquidityFull(address account, bool liquidation)
        public
        view
        virtual
        override
        nonReentrantView
        returns (address[] memory collaterals, uint256[] memory collateralValues, uint256 liabilityValue) 
        {                                                               
            // no collaterals (uncollat)                                                                                                                                             
            collaterals = new address[](0);                                                                       
            collateralValues = new uint256[](0);                                                                  
            (, liabilityValue) = accountLiquidity(account, liquidation);                                          
        }                                        

    function checkAccountStatus(address account, address[] calldata /*collaterals*/)
        public
        view
        virtual
        reentrantOK
        onlyEVCChecks
        returns (bytes4 magicValue)
    {
        VaultCache memory vaultCache = loadVault();
        uint256 owed  = getCurrentOwed(vaultCache, account).toAssetsUp().toUint();
        uint256 limit = ICLM(creditLimitManager()).creditLimit(account);
        if (owed > limit) revert E_CreditLimitExceeded();
        magicValue = IEVCVault.checkAccountStatus.selector;
    }

    function disableController() public virtual nonReentrant {
        address account = EVCAuthenticate();
        if (!vaultStorage.users[account].getOwed().isZero()) revert E_OutstandingDebt();
        disableControllerInternal(account);
    }

    function checkVaultStatus() public virtual reentrantOK onlyEVCChecks returns (bytes4 magicValue) {
        VaultCache memory vaultCache = updateVault();
        uint256 newRate = computeInterestRate(vaultCache);
        logVaultStatus(vaultCache, newRate);

        if (vaultCache.snapshotInitialized) {
            vaultStorage.snapshotInitialized = vaultCache.snapshotInitialized = false;

            Assets snapshotCash = snapshot.cash;
            Assets snapshotBorrows = snapshot.borrows;

            uint256 prevBorrows = snapshotBorrows.toUint();
            uint256 borrows = vaultCache.totalBorrows.toAssetsUp().toUint();
            if (borrows > vaultCache.borrowCap && borrows > prevBorrows) revert E_BorrowCapExceeded();

            uint256 prevSupply = snapshotCash.toUint() + prevBorrows;
            uint256 supply = vaultCache.cash.toUint() + vaultCache.totalBorrows.toAssetsDown().toUint();
            if (supply > vaultCache.supplyCap && supply > prevSupply) revert E_SupplyCapExceeded();

            snapshot.reset();
        }

        callHookWithLock(vaultCache.hookedOps, OP_VAULT_STATUS_CHECK, address(evc));
        magicValue = IEVCVault.checkVaultStatus.selector;
    }
}

// (optional) deployable wrapper for MODULE_RISKMANAGER
contract RiskManagerUncollat is RiskManagerUncollatModule {
    constructor(Integrations memory integrations) Base(integrations) {}
}