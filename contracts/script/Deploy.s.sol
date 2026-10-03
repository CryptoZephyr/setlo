// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SetloPackages} from "../src/SetloPackages.sol";

/// @notice Deploys SetloPackages with the chain's pinned Paxos USDG and OWNER_WALLET_ADDRESS as owner.
contract Deploy is Script {
    address constant USDG_ARBITRUM_SEPOLIA = 0xFFC95faa3d63Cde504a05B567C600B78C0b41892;
    address constant USDG_ROBINHOOD_TESTNET = 0x7E955252E15c84f5768B83c41a71F9eba181802F;

    function run() external returns (SetloPackages setlo) {
        address owner = vm.envAddress("OWNER_WALLET_ADDRESS");
        address usdg;
        if (block.chainid == 421614) usdg = USDG_ARBITRUM_SEPOLIA;
        else if (block.chainid == 46630) usdg = USDG_ROBINHOOD_TESTNET;
        else revert("unsupported chain");

        vm.startBroadcast();
        setlo = new SetloPackages(IERC20(usdg), owner);
        vm.stopBroadcast();
        console.log("SetloPackages", address(setlo));
    }
}
