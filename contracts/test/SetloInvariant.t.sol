// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SetloPackages} from "../src/SetloPackages.sol";
import {MockUSDG} from "./mocks/MockUSDG.sol";

contract SetloHandler is Test {
    SetloPackages internal setlo;
    MockUSDG internal usdg;
    address internal agency = makeAddr("h-agency");
    address internal client = makeAddr("h-client");
    address[4] internal suppliers = [makeAddr("h-s0"), makeAddr("h-s1"), makeAddr("h-s2"), makeAddr("h-s3")];

    uint256[] public ids;
    uint256 public ghostIn;
    uint256 public ghostOut;

    constructor(SetloPackages setlo_, MockUSDG usdg_) {
        setlo = setlo_;
        usdg = usdg_;
        usdg.mint(client, type(uint128).max);
        vm.prank(client);
        usdg.approve(address(setlo), type(uint256).max);
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    function _id(uint256 seed) internal view returns (uint256) {
        return ids[seed % ids.length];
    }

    function create(uint128 a, uint128 b, uint8 n) external {
        uint256 count = bound(n, 1, 4);
        SetloPackages.SlotInput[] memory s = new SetloPackages.SlotInput[](count);
        uint128 holds;
        for (uint256 i; i < count; ++i) {
            uint128 dep = uint128(bound(uint256(a) >> (i * 8), 1, 500e6));
            uint128 bal = uint128(bound(uint256(b) >> (i * 8), 0, 500e6));
            uint128 hold = dep / 10;
            holds += hold;
            s[i] = SetloPackages.SlotInput(suppliers[i], i != 3, dep, hold, bal, bytes32(i));
        }
        uint64 t = uint64(block.timestamp);
        SetloPackages.PackageParams memory p = SetloPackages.PackageParams({
            client: client,
            eventDate: t + 10 days,
            acceptDeadline: t + 1 days,
            confirmDeadline: t + 2 days,
            finalExpiry: t + 3 days,
            reviewWindow: 1 days,
            minResponseWindow: 1 hours,
            agencyFee: uint128(bound(a, 0, 50e6)),
            holdFeeCap: holds * 3,
            sharedTermsHash: bytes32(0)
        });
        vm.prank(agency);
        ids.push(setlo.createPackage(p, s));
    }

    function fund(uint256 seed, bool autoConfirm) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        uint256 req = setlo.requiredFunding(id);
        uint256 funded = setlo.getPackage(id).funded;
        uint256 amount = req > funded ? req - funded : 0;
        bytes32 cfg = setlo.configHash(id);
        vm.prank(client);
        try setlo.fund(id, cfg, amount, autoConfirm) {
            ghostIn += amount;
        } catch {}
    }

    function accept(uint256 seed, uint8 slot) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        uint256 n = setlo.getSlots(id).length;
        uint256 i = slot % n;
        address payee = setlo.getSlots(id)[i].payee;
        bytes32 sh = setlo.slotHash(id, i);
        vm.prank(payee);
        try setlo.supplierAccept(id, i, sh) {} catch {}
    }

    function decline(uint256 seed, uint8 slot) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        uint256 i = slot % setlo.getSlots(id).length;
        address payee = setlo.getSlots(id)[i].payee;
        vm.prank(payee);
        try setlo.supplierDecline(id, i) {} catch {}
    }

    function updateQuote(uint256 seed, uint8 slot, uint128 dep, uint128 bal) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        uint256 i = slot % setlo.getSlots(id).length;
        dep = uint128(bound(dep, 1, 500e6));
        bal = uint128(bound(bal, 0, 500e6));
        vm.prank(agency);
        try setlo.updateQuote(id, i, dep, dep / 10, bal, bytes32(uint256(dep))) {} catch {}
    }

    function replace(uint256 seed, uint8 slot, uint128 dep) external {
        if (ids.length == 0) return;
        uint256 id = _id(seed);
        uint256 i = slot % setlo.getSlots(id).length;
        dep = uint128(bound(dep, 1, 500e6));
        vm.prank(agency);
        try setlo.replaceSupplier(id, i, suppliers[(i + 1) % 4], dep, dep / 10, dep, bytes32(0)) {} catch {}
    }

    function confirm(uint256 seed) external {
        if (ids.length == 0) return;
        vm.prank(client);
        try setlo.clientConfirm(_id(seed)) {} catch {}
    }

    function release(uint256 seed) external {
        if (ids.length == 0) return;
        vm.prank(client);
        try setlo.releaseBalances(_id(seed)) {} catch {}
    }

    function cancel(uint256 seed) external {
        if (ids.length == 0) return;
        vm.prank(client);
        try setlo.cancelAfterConfirm(_id(seed)) {} catch {}
    }

    function expire(uint256 seed) external {
        if (ids.length == 0) return;
        try setlo.expirePackage(_id(seed)) {} catch {}
    }

    function claim(uint8 who) external {
        address r = who % 6 == 4 ? client : who % 6 == 5 ? agency : suppliers[who % 4];
        uint256 amount = setlo.claimable(r);
        if (amount == 0) return;
        setlo.claimFor(r);
        ghostOut += amount;
    }

    function warp(uint32 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 4 days));
    }
}

contract SetloInvariantTest is Test {
    SetloPackages internal setlo;
    MockUSDG internal usdg;
    SetloHandler internal handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        usdg = new MockUSDG();
        setlo = new SetloPackages(IERC20(address(usdg)), makeAddr("owner"));
        handler = new SetloHandler(setlo, usdg);
        targetContract(address(handler));
    }

    /// funded == claimed + claimable + locked (refunds are claimable credits to the client)
    function invariant_accounting() public view {
        uint256 held;
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            held += setlo.getPackage(handler.ids(i)).held;
        }
        uint256 bal = usdg.balanceOf(address(setlo));
        assertEq(bal, setlo.totalClaimable() + held, "balance != claimable + held");
        assertEq(handler.ghostIn() - handler.ghostOut(), bal, "in - out != balance");
    }

    function invariant_terminalPackagesHoldNothing() public view {
        uint256 n = handler.idCount();
        for (uint256 i; i < n; ++i) {
            SetloPackages.Package memory p = setlo.getPackage(handler.ids(i));
            if (
                p.status == SetloPackages.Status.Released || p.status == SetloPackages.Status.Cancelled
                    || p.status == SetloPackages.Status.Expired
            ) assertEq(p.held, 0);
            if (p.status == SetloPackages.Status.Open) assertLe(p.earnedHoldTotal, p.holdFeeCap);
        }
    }
}
