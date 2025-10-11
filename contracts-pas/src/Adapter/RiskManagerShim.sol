// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICreditLimitManager} from "../Interfaces/ICreditLimitManager.sol";

contract RiskManagerShim {
    address public immutable governor; // opcional: quién puede cambiar el CLM
    address private _clm;

    event CreditLimitManagerUpdated(address indexed oldCLM, address indexed newCLM);

    constructor(address initialClm, address _governor) {
        require(initialClm != address(0), "CLM=0");
        _clm = initialClm;
        governor = _governor;
    }

    // Ruta que espera el front
    function creditLimitManager() external view returns (address) { return _clm; }
    function clm() external view returns (address) { return _clm; }

    // (opcional) permitir actualizar el CLM
    function setCreditLimitManager(address newClm) external {
        require(msg.sender == governor, "not gov");
        require(newClm != address(0), "CLM=0");
        address old = _clm;
        _clm = newClm;
        emit CreditLimitManagerUpdated(old, newClm);
    }
}