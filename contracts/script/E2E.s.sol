// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SetloPackages} from "../src/SetloPackages.sol";

interface IUSDG {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address) external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @notice Live end-to-end run against a deployed SetloPackages using small USDG amounts.
/// The broadcaster is the client, agency and relayer; suppliers are throwaway keys derived from
/// the broadcaster key that only sign (they never need ETH). Supplier payouts are swept back to
/// the broadcaster with EIP-3009 transferWithAuthorization.
///
///   PHASE=setup  : package A (happy path, fully gasless) and package B (one decline) are created.
///                  A: permit funding -> relayed accepts -> auto-confirm -> deposits claimed ->
///                     relayed client release -> balances claimed -> payouts swept back.
///                  B: funded, venue accepts, caterer declines; expires after acceptDeadline.
///   PHASE=expire : package B is expired, refund + earned hold fee claimed, hold fee swept back.
contract E2E is Script {
    bytes32 constant FUND_TYPEHASH = keccak256(
        "Fund(address client,uint256 packageId,bytes32 configHash,uint256 amount,bool autoConfirm,uint256 nonce,uint256 deadline)"
    );
    bytes32 constant ACCEPT_TYPEHASH = keccak256(
        "Accept(address supplier,uint256 packageId,uint256 slotIndex,bytes32 slotHash,uint256 revision,uint256 nonce,uint256 deadline)"
    );
    bytes32 constant DECLINE_TYPEHASH =
        keccak256("Decline(address supplier,uint256 packageId,uint256 slotIndex,uint256 nonce,uint256 deadline)");
    bytes32 constant CLIENT_ACTION_TYPEHASH =
        keccak256("ClientAction(address client,uint256 packageId,uint8 action,uint256 nonce,uint256 deadline)");
    bytes32 constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 constant TRANSFER_AUTH_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    SetloPackages setlo;
    IUSDG usdg;
    uint256 clientPk;
    address client;
    uint256 venuePk;
    uint256 catererPk;

    function run() external {
        setlo = SetloPackages(vm.envAddress("SETLO_ADDRESS"));
        usdg = IUSDG(address(setlo.token()));
        clientPk = vm.envUint("SETLO_PRIVATE_KEY");
        client = vm.addr(clientPk);
        venuePk = _derive("venue");
        catererPk = _derive("caterer");
        string memory phase = vm.envString("PHASE");

        vm.startBroadcast(clientPk);
        if (keccak256(bytes(phase)) == keccak256("setup")) {
            _refundSetup();
            _happyPath();
        } else {
            _refundExpire(vm.envUint("PACKAGE_B"));
        }
        vm.stopBroadcast();
    }

    function _happyPath() internal {
        uint256 start = _pool();
        uint64 t = uint64(block.timestamp);
        SetloPackages.SlotInput[] memory s = new SetloPackages.SlotInput[](2);
        s[0] = SetloPackages.SlotInput(vm.addr(venuePk), true, 0.1e6, 0.01e6, 0.05e6, keccak256("e2e-venue"));
        s[1] = SetloPackages.SlotInput(vm.addr(catererPk), true, 0.08e6, 0.01e6, 0.04e6, keccak256("e2e-caterer"));
        uint256 id = setlo.createPackage(_params(t, 30 minutes, 45 minutes, 5 minutes), s);
        console.log("package A", id);

        uint256 amount = setlo.requiredFunding(id);
        setlo.fundWithPermit(_fundIns(id, amount, true), _fundSig(id, amount, true), _permit(amount));
        _acceptSig(id, 0, venuePk);
        _acceptSig(id, 1, catererPk);
        require(setlo.getPackage(id).status == SetloPackages.Status.Confirmed, "A not confirmed");
        _claimSuppliers();

        uint256 nonce = setlo.nonces(client);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(
            clientPk,
            keccak256(
                abi.encode(
                    CLIENT_ACTION_TYPEHASH, client, id, uint8(SetloPackages.ClientAction.Release), nonce, deadline
                )
            )
        );
        setlo.clientActionWithSig(id, SetloPackages.ClientAction.Release, nonce, deadline, sig);
        require(setlo.getPackage(id).status == SetloPackages.Status.Released, "A not released");
        _claimSuppliers();
        setlo.claimFor(client); // agency fee (broadcaster is also the agency)
        require(setlo.getPackage(id).held == 0, "A still holds funds");

        _sweep(venuePk);
        _sweep(catererPk);
        require(_pool() == start, "A: pool changed");
        console.log("package A released, all payouts claimed and swept back");
    }

    function _refundSetup() internal {
        uint64 t = uint64(block.timestamp);
        SetloPackages.SlotInput[] memory s = new SetloPackages.SlotInput[](2);
        s[0] = SetloPackages.SlotInput(vm.addr(venuePk), true, 0.05e6, 0.01e6, 0.02e6, keccak256("e2e-venue-b"));
        s[1] = SetloPackages.SlotInput(vm.addr(catererPk), true, 0.05e6, 0.01e6, 0.02e6, keccak256("e2e-caterer-b"));
        uint256 id = setlo.createPackage(_params(t, 10 minutes, 20 minutes, 1 minutes), s);
        console.log("package B", id);

        uint256 amount = setlo.requiredFunding(id);
        IERC20(address(usdg)).approve(address(setlo), amount);
        setlo.fund(id, setlo.configHash(id), amount, true);
        _acceptSig(id, 0, venuePk);

        address caterer = vm.addr(catererPk);
        uint256 nonce = setlo.nonces(caterer);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(catererPk, keccak256(abi.encode(DECLINE_TYPEHASH, caterer, id, 1, nonce, deadline)));
        setlo.declineWithSig(caterer, id, 1, nonce, deadline, sig);
        console.log("package B funded; expire after", setlo.getPackage(id).acceptDeadline);
    }

    function _refundExpire(uint256 id) internal {
        uint256 held = setlo.getPackage(id).held;
        uint256 before = _pool();
        uint256 clientCredit = setlo.claimable(client);
        uint256 venueCredit = setlo.claimable(vm.addr(venuePk));
        setlo.expirePackage(id);
        require(setlo.getPackage(id).status == SetloPackages.Status.Expired, "B not expired");
        uint256 refund = setlo.claimable(client) - clientCredit;
        require(setlo.claimable(vm.addr(venuePk)) - venueCredit == 0.01e6, "B: venue hold fee not credited");
        require(refund == held - 0.01e6, "B: refund != held - venue hold fee");
        setlo.claimFor(client);
        _claimSuppliers();
        _sweep(venuePk);
        require(_pool() == before + held, "B: pool != before + held");
        console.log("package B expired; client refund", refund);
    }

    // ---------------------------------------------------------------- helpers

    function _params(uint64 t, uint64 accept, uint64 eventIn, uint64 review)
        internal
        view
        returns (SetloPackages.PackageParams memory)
    {
        return SetloPackages.PackageParams({
            client: client,
            eventDate: t + eventIn,
            acceptDeadline: t + accept,
            confirmDeadline: t + accept,
            finalExpiry: t + accept + 1 minutes,
            reviewWindow: review,
            minResponseWindow: 1 minutes,
            agencyFee: 0.01e6,
            holdFeeCap: 0.02e6,
            sharedTermsHash: keccak256("e2e-shared-terms")
        });
    }

    /// @dev USDG the broadcaster can end up with from this script: its own balance plus everything
    /// claimable by or held by the derived suppliers. Every run must leave it unchanged.
    function _pool() internal view returns (uint256 total) {
        address[3] memory who = [client, vm.addr(venuePk), vm.addr(catererPk)];
        for (uint256 i; i < who.length; ++i) {
            total += usdg.balanceOf(who[i]) + setlo.claimable(who[i]);
        }
    }

    function _derive(string memory label) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(clientPk, "setlo-e2e", label)))
            % 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    }

    function _claimSuppliers() internal {
        address[2] memory who = [vm.addr(venuePk), vm.addr(catererPk)];
        for (uint256 i; i < who.length; ++i) {
            if (setlo.claimable(who[i]) > 0) setlo.claimFor(who[i]);
        }
    }

    function _acceptSig(uint256 id, uint256 slot, uint256 pk) internal {
        address supplier = vm.addr(pk);
        uint256 nonce = setlo.nonces(supplier);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 sh = setlo.slotHash(id, slot);
        uint256 rev = setlo.getPackage(id).revision;
        bytes memory sig =
            _sign(pk, keccak256(abi.encode(ACCEPT_TYPEHASH, supplier, id, slot, sh, rev, nonce, deadline)));
        setlo.acceptWithSig(supplier, id, slot, sh, rev, nonce, deadline, sig);
    }

    function _fundIns(uint256 id, uint256 amount, bool autoConfirm)
        internal
        view
        returns (SetloPackages.FundingInstruction memory)
    {
        return SetloPackages.FundingInstruction({
            client: client,
            packageId: id,
            configHash: setlo.configHash(id),
            amount: amount,
            autoConfirm: autoConfirm,
            nonce: setlo.nonces(client),
            deadline: block.timestamp + 1 hours
        });
    }

    function _fundSig(uint256 id, uint256 amount, bool autoConfirm) internal view returns (bytes memory) {
        SetloPackages.FundingInstruction memory ins = _fundIns(id, amount, autoConfirm);
        return _sign(
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

    function _sweep(uint256 pk) internal {
        address from = vm.addr(pk);
        uint256 value = usdg.balanceOf(from);
        if (value == 0) return;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256(abi.encode(from, value, block.timestamp));
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                usdg.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(TRANSFER_AUTH_TYPEHASH, from, client, value, 0, validBefore, nonce))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        usdg.transferWithAuthorization(from, client, value, 0, validBefore, nonce, v, r, s);
    }

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", setlo.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
