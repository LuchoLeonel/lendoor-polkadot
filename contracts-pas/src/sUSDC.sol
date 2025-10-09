// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20, IERC20} from "@openzeppelin-contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin-contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC4626} from "@openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {Math} from "@openzeppelin-contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";

/**
 * @title sUSDC (Senior)
 * @notice ERC-4626 sobre USDC con hook de waterfall tipo 3Jane:
 *         - report(profit, loss) quema shares de jUSDC ante pérdidas (first-loss)
 *         - opcional: mintea shares a jUSDC por el exceso de ganancia (fee)
 */
contract SUSDC is ERC4626, Ownable {
    using Math for uint256;

    address public jUSDC;          // contrato junior (holder de sUSDC)
    address public keeper;         // bot que llama report()
    uint16  public juniorFeeBps;   // % de profit para jUSDC (0..10000)

    event SetJUSDC(address j);
    event SetKeeper(address k);
    event SetJuniorFeeBps(uint16 bps);
    event Report(uint256 profit, uint256 loss, uint256 burnedFromJunior, uint256 mintedToJunior);

    modifier onlyKeeper() {
        require(msg.sender == keeper || msg.sender == owner(), "not keeper");
        _;
    }

    constructor(IERC20 usdc)
        ERC20("sUSDC", "sUSDC")
        ERC4626(usdc) // asset = USDC
    {}

    function setJUSDC(address _j) external onlyOwner {
        require(_j != address(0), "zero");
        jUSDC = _j;
        emit SetJUSDC(_j);
    }

    function setKeeper(address _k) external onlyOwner {
        keeper = _k;
        emit SetKeeper(_k);
    }

    function setJuniorFeeBps(uint16 bps) external onlyOwner {
        require(bps <= 10_000, "bps");
        juniorFeeBps = bps;
        emit SetJuniorFeeBps(bps);
    }

    /**
     * @notice Marca PnL y aplica waterfall:
     *         - Pérdida: burn de shares de jUSDC a tipo pre-loss
     *         - Ganancia: mint de shares a jUSDC (fee) a tipo pre-profit
     * @dev Asume que el asset.balanceOf(address(this)) ya refleja PnL (o lo pasas por params).
     */
    function report(uint256 profit, uint256 loss) external onlyKeeper {
        require(jUSDC != address(0), "jUSDC not set");

        uint256 ts = totalSupply();
        uint256 ta = totalAssets(); // post-PnL si ya cobraste/interes; usamos correcciones abajo

        uint256 burned;
        uint256 minted;

        // === 1) PÉRDIDAS: burn de shares del junior a tasa PRE-LOSS ===
        if (loss > 0 && ts > 0) {
            // precio pre-loss = (ta + loss) / ts
            // sharesToBurn = loss * ts / (ta + loss)
            uint256 sharesToBurn = loss.mulDiv(ts, ta + loss, Math.Rounding.Floor);

            uint256 juniorBal = balanceOf(jUSDC);
            if (sharesToBurn > juniorBal) {
                sharesToBurn = juniorBal;
            }
            if (sharesToBurn > 0) {
                _burn(jUSDC, sharesToBurn);
                burned = sharesToBurn;
                ts -= sharesToBurn; // supply cae
                // Nota: totalAssets ya está "bajo" por la pérdida neta del activo
            }
        }

        // === 2) GANANCIAS: mint de shares al junior (fee) a tasa PRE-PROFIT ===
        if (profit > 0 && ts > 0 && juniorFeeBps > 0) {
            // precio pre-profit = (ta - profit) / ts
            // sharesToMint = (profit_fee) * ts / (ta - profit)
            uint256 taPre = ta - profit;
            if (taPre > 0) {
                uint256 feeAssets = profit * juniorFeeBps / 10_000;
                uint256 sharesToMint = feeAssets.mulDiv(ts, taPre, Math.Rounding.Floor);
                if (sharesToMint > 0) {
                    _mint(jUSDC, sharesToMint);
                    minted = sharesToMint;
                    // Nota: el resto del profit queda implícito en el aumento de PPS para todos
                }
            }
        }

        emit Report(profit, loss, burned, minted);
    }

    // (Opcional) overrides de preview/convert para redondeos si querés
}