// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin-contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC (Mint público, 6 decimales)
 * @notice Token de prueba tipo USDC con función de mint abierta a cualquiera.
 * @dev    ¡Usar SOLO en testnet/dev! En producción, proteger el mint con roles.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin (Mock)", "USDC") {}

    /// @dev USDC usa 6 decimales.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint público (cualquiera puede mintear).
    /// @param to     Dirección que recibirá los tokens
    /// @param amount Cantidad con 6 decimales (p.ej. 100 USDC = 100_000000)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Conveniencia para un faucet: mintea a msg.sender.
    function mintToSelf(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}