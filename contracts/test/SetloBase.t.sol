// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SetloPackages} from "../src/SetloPackages.sol";
import {MockUSDG} from "./mocks/MockUSDG.sol";

abstract contract SetloBase is Test {
    bytes32 internal constant FUND_TYPEHASH = keccak256(
        "Fund(address client,uint256 packageId,bytes32 configHash,uint256 amount,bool autoConfirm,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant ACCEPT_TYPEHASH = keccak256(
        "Accept(address supplier,uint256 packageId,uint256 slotIndex,bytes32 slotHash,uint256 revision,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant DECLINE_TYPEHASH =
        keccak256("Decline(address supplier,uint256 packageId,uint256 slotIndex,uint256 nonce,uint256 deadline)");
    bytes32 internal constant CLIENT_ACTION_TYPEHASH =
        keccak256("ClientAction(address client,uint256 packageId,uint8 action,uint256 nonce,uint256 deadline)");
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    MockUSDG internal usdg;
    SetloPackages internal setlo;

    address internal owner = makeAddr("owner");
    address internal agency = makeAddr("agency");
    address internal relayer = makeAddr("relayer");
    uint256 internal clientPk = 0xC11E;
    uint256 internal venuePk = 0xA1;
    uint256 internal catererPk = 0xA2;
    uint256 internal photoPk = 0xA3;
    uint256 internal newVenuePk = 0xA4;
    address internal client;
    address internal venue;
    address internal caterer;
    address internal photo;
    address internal newVenue;

    uint64 internal t0;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        t0 = uint64(block.timestamp);
        client = vm.addr(clientPk);
        venue = vm.addr(venuePk);
        caterer = vm.addr(catererPk);
        photo = vm.addr(photoPk);
        newVenue = vm.addr(newVenuePk);

        usdg = new MockUSDG();
        setlo = new SetloPackages(IERC20(address(usdg)), owner);
        usdg.mint(client, 100_000e6);
    }

    // ---------------------------------------------------------------- fixtures

    function _params() internal view returns (SetloPackages.PackageParams memory p) {
        p = SetloPackages.PackageParams({
            client: client,
            eventDate: t0 + 10 days,
            acceptDeadline: t0 + 1 days,
            confirmDeadline: t0 + 2 days,
            finalExpiry: t0 + 3 days,
            reviewWindow: 2 days,
            minResponseWindow: 1 hours,
            agencyFee: 50e6,
            holdFeeCap: 50e6,
            sharedTermsHash: keccak256("shared-terms-v1")
        });
    }

    function _slots() internal view returns (SetloPackages.SlotInput[] memory s) {
        s = new SetloPackages.SlotInput[](3);
        s[0] = SetloPackages.SlotInput(venue, true, 200e6, 20e6, 300e6, keccak256("venue"));
        s[1] = SetloPackages.SlotInput(caterer, true, 150e6, 10e6, 250e6, keccak256("caterer"));
        s[2] = SetloPackages.SlotInput(photo, false, 100e6, 5e6, 100e6, keccak256("photo"));
    }

    uint256 internal constant TOTAL = 200e6 + 300e6 + 150e6 + 250e6 + 100e6 + 100e6 + 50e6;

    function _create() internal returns (uint256 id) {
        vm.prank(agency);
        id = setlo.createPackage(_params(), _slots());
    }

    // ---------------------------------------------------------------- actions

    function _fundDirect(uint256 id, bool autoConfirm) internal {
        uint256 amount = setlo.requiredFunding(id) - setlo.getPackage(id).funded;
        vm.startPrank(client);
        usdg.approve(address(setlo), amount);
        setlo.fund(id, setlo.configHash(id), amount, autoConfirm);
        vm.stopPrank();
    }

    function _accept(uint256 id, uint256 slot, address supplier) internal {
        bytes32 sh = setlo.slotHash(id, slot);
        vm.prank(supplier);
        setlo.supplierAccept(id, slot, sh);
    }

    function _acceptSig(uint256 id, uint256 slot, uint256 pk) internal {
        address supplier = vm.addr(pk);
        uint256 nonce = setlo.nonces(supplier);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 sh = setlo.slotHash(id, slot);
        uint256 rev = setlo.getPackage(id).revision;
        bytes memory sig =
            _sign(pk, keccak256(abi.encode(ACCEPT_TYPEHASH, supplier, id, slot, sh, rev, nonce, deadline)));
        vm.prank(relayer);
        setlo.acceptWithSig(supplier, id, slot, sh, rev, nonce, deadline, sig);
    }

    function _fundInstruction(uint256 id, uint256 amount, bool autoConfirm)
        internal
        view
        returns (SetloPackages.FundingInstruction memory ins, bytes memory sig)
    {
        ins = SetloPackages.FundingInstruction({
            client: client,
            packageId: id,
            configHash: setlo.configHash(id),
            amount: amount,
            autoConfirm: autoConfirm,
            nonce: setlo.nonces(client),
            deadline: block.timestamp + 1 hours
        });
        sig = _sign(
            clientPk,
            keccak256(
                abi.encode(
                    FUND_TYPEHASH,
                    ins.client,
                    ins.packageId,
                    ins.configHash,
                    ins.amount,
                    ins.autoConfirm,
                    ins.nonce,
                    ins.deadline
                )
            )
        );
    }

    function _permit(uint256 value) internal view returns (SetloPackages.PermitData memory p) {
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                usdg.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(PERMIT_TYPEHASH, client, address(setlo), value, usdg.nonces(client), deadline))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(clientPk, digest);
        p = SetloPackages.PermitData(value, deadline, v, r, s);
    }

    function _fundWithPermit(uint256 id, bool autoConfirm) internal {
        uint256 amount = setlo.requiredFunding(id) - setlo.getPackage(id).funded;
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, amount, autoConfirm);
        SetloPackages.PermitData memory p = _permit(amount);
        vm.prank(relayer);
        setlo.fundWithPermit(ins, sig, p);
    }

    function _clientActionSig(uint256 id, SetloPackages.ClientAction action) internal {
        uint256 nonce = setlo.nonces(client);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig =
            _sign(clientPk, keccak256(abi.encode(CLIENT_ACTION_TYPEHASH, client, id, uint8(action), nonce, deadline)));
        vm.prank(relayer);
        setlo.clientActionWithSig(id, action, nonce, deadline, sig);
    }

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", setlo.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _claimAll() internal {
        address[6] memory who = [client, venue, caterer, photo, newVenue, agency];
        for (uint256 i; i < who.length; ++i) {
            if (setlo.claimable(who[i]) > 0) setlo.claimFor(who[i]);
        }
    }

    function _status(uint256 id) internal view returns (SetloPackages.Status) {
        return setlo.getPackage(id).status;
    }
}
