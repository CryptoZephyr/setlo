// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SetloPackages} from "../src/SetloPackages.sol";
import {SetloBase} from "./SetloBase.t.sol";

contract SetloPackagesTest is SetloBase {
    // ---------------------------------------------------------------- creation

    function test_create_storesPackageAndSlots() public {
        uint256 id = _create();
        SetloPackages.Package memory p = setlo.getPackage(id);
        assertEq(p.agency, agency);
        assertEq(p.client, client);
        assertEq(uint8(p.status), uint8(SetloPackages.Status.Open));
        assertEq(p.revision, 1);
        assertEq(setlo.getSlots(id).length, 3);
        assertEq(setlo.requiredFunding(id), TOTAL);
    }

    function test_create_rejectsBadDeadlines() public {
        SetloPackages.PackageParams memory p = _params();
        p.finalExpiry = p.eventDate + 1;
        SetloPackages.SlotInput[] memory s = _slots();
        vm.prank(agency);
        vm.expectRevert(SetloPackages.InvalidParams.selector);
        setlo.createPackage(p, s);
    }

    function test_create_rejectsHoldFeeAboveCap() public {
        SetloPackages.PackageParams memory p = _params();
        p.holdFeeCap = 34e6;
        SetloPackages.SlotInput[] memory s = _slots();
        vm.prank(agency);
        vm.expectRevert(SetloPackages.HoldFeeCapExceeded.selector);
        setlo.createPackage(p, s);
    }

    function test_create_rejectsNoRequiredSlot() public {
        SetloPackages.SlotInput[] memory s = _slots();
        s[0].required = false;
        s[1].required = false;
        SetloPackages.PackageParams memory p = _params();
        vm.prank(agency);
        vm.expectRevert(SetloPackages.InvalidParams.selector);
        setlo.createPackage(p, s);
    }

    function test_create_rejectsClientAsPayee() public {
        SetloPackages.SlotInput[] memory s = _slots();
        s[0].payee = client;
        SetloPackages.PackageParams memory p = _params();
        vm.prank(agency);
        vm.expectRevert(SetloPackages.InvalidParams.selector);
        setlo.createPackage(p, s);
    }

    // ---------------------------------------------------------------- happy path

    function test_gasless_autoConfirm_paysDepositsAndAgencyFee() public {
        uint256 id = _create();
        _fundWithPermit(id, true);
        assertEq(usdg.balanceOf(address(setlo)), TOTAL);

        _acceptSig(id, 2, photoPk);
        _acceptSig(id, 0, venuePk);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Open));
        _acceptSig(id, 1, catererPk);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Confirmed));

        assertEq(setlo.claimable(venue), 200e6);
        assertEq(setlo.claimable(caterer), 150e6);
        assertEq(setlo.claimable(photo), 100e6);
        assertEq(setlo.claimable(agency), 50e6);
        assertEq(setlo.getPackage(id).held, 650e6);

        _claimAll();
        assertEq(usdg.balanceOf(venue), 200e6);
        assertEq(usdg.balanceOf(agency), 50e6);

        _clientActionSig(id, SetloPackages.ClientAction.Release);
        _claimAll();
        assertEq(usdg.balanceOf(venue), 500e6);
        assertEq(usdg.balanceOf(caterer), 400e6);
        assertEq(usdg.balanceOf(photo), 200e6);
        assertEq(usdg.balanceOf(address(setlo)), 0);
    }

    function test_acceptBeforeFunding_thenFundingAutoConfirms() public {
        uint256 id = _create();
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        _fundDirect(id, true);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Confirmed));
        // optional photographer never accepted: refunded in full
        assertEq(setlo.claimable(client), 200e6);
    }

    function test_manualConfirm_whenAutoConfirmOff() public {
        uint256 id = _create();
        _fundDirect(id, false);
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Open));
        assertTrue(setlo.isReadyToConfirm(id));
        _clientActionSig(id, SetloPackages.ClientAction.Confirm);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Confirmed));
    }

    function test_confirm_revertsWhenRequiredMissing() public {
        uint256 id = _create();
        _fundDirect(id, false);
        _accept(id, 0, venue);
        vm.prank(client);
        vm.expectRevert(SetloPackages.NotReady.selector);
        setlo.clientConfirm(id);
    }

    function test_confirm_revertsWhenUnfunded() public {
        uint256 id = _create();
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        vm.prank(client);
        vm.expectRevert(SetloPackages.NotReady.selector);
        setlo.clientConfirm(id);
    }

    // ---------------------------------------------------------------- expiry

    function test_expiry_paysEarnedHoldsAndRefundsRest() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);
        _accept(id, 2, photo);
        vm.prank(caterer);
        setlo.supplierDecline(id, 1);

        vm.expectRevert(SetloPackages.NotReady.selector);
        setlo.expirePackage(id);

        vm.warp(t0 + 1 days + 1);
        vm.prank(relayer);
        setlo.expirePackage(id);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Expired));
        assertEq(setlo.claimable(venue), 20e6);
        assertEq(setlo.claimable(photo), 5e6);
        assertEq(setlo.claimable(caterer), 0);
        assertEq(setlo.claimable(agency), 0);
        assertEq(setlo.claimable(client), TOTAL - 25e6);
        _claimAll();
        assertEq(usdg.balanceOf(address(setlo)), 0);
    }

    function test_expiry_unfundedPackageOwesNothing() public {
        uint256 id = _create();
        _accept(id, 0, venue);
        vm.warp(t0 + 1 days + 1);
        setlo.expirePackage(id);
        assertEq(setlo.claimable(venue), 0);
        assertEq(setlo.totalClaimable(), 0);
    }

    function test_expiry_afterConfirmDeadlineEvenIfAllAccepted() public {
        uint256 id = _create();
        _fundDirect(id, false);
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        vm.warp(t0 + 1 days + 1);
        vm.expectRevert(SetloPackages.NotReady.selector);
        setlo.expirePackage(id);
        vm.warp(t0 + 2 days + 1);
        setlo.expirePackage(id);
        assertEq(setlo.claimable(venue), 20e6);
        assertEq(setlo.claimable(caterer), 10e6);
        assertEq(setlo.claimable(client), TOTAL - 30e6);
    }

    function test_accept_revertsAfterDeadline() public {
        uint256 id = _create();
        vm.warp(t0 + 1 days + 1);
        bytes32 sh = setlo.slotHash(id, 0);
        vm.prank(venue);
        vm.expectRevert(SetloPackages.DeadlinePassed.selector);
        setlo.supplierAccept(id, 0, sh);
    }

    // ---------------------------------------------------------------- revisions

    function test_slotRevision_invalidatesOnlyThatSlotAndNeedsClientReapproval() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);

        vm.prank(agency);
        setlo.updateQuote(id, 1, 160e6, 10e6, 260e6, keccak256("caterer-v2"));
        assertEq(setlo.getSlots(id)[1].version, 2);

        _accept(id, 1, caterer);
        // venue acceptance still valid, but client has not approved the new config
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Open));
        assertFalse(setlo.isReadyToConfirm(id));

        _fundDirect(id, true);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Confirmed));
        assertEq(setlo.claimable(venue), 200e6);
        assertEq(setlo.claimable(caterer), 160e6);
    }

    function test_slotRevision_staleAcceptanceRejected() public {
        uint256 id = _create();
        bytes32 oldHash = setlo.slotHash(id, 1);
        vm.prank(agency);
        setlo.updateQuote(id, 1, 160e6, 10e6, 260e6, keccak256("caterer-v2"));
        vm.prank(caterer);
        vm.expectRevert(SetloPackages.ConfigMismatch.selector);
        setlo.supplierAccept(id, 1, oldHash);
    }

    function test_sharedRevision_invalidatesAllAcceptances() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);
        vm.prank(agency);
        setlo.updateSharedTerms(id, t0 + 11 days, keccak256("shared-terms-v2"));
        assertEq(setlo.getPackage(id).revision, 2);

        _accept(id, 1, caterer);
        _fundDirect(id, true);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Open));
        _accept(id, 0, venue);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Confirmed));
    }

    function test_revisionLoweringTotal_refundsExcessOnReapproval() public {
        uint256 id = _create();
        _fundDirect(id, true);
        vm.prank(agency);
        setlo.updateQuote(id, 2, 50e6, 5e6, 50e6, keccak256("photo-v2"));
        uint256 req = setlo.requiredFunding(id);
        bytes32 cfg = setlo.configHash(id);
        vm.prank(client);
        setlo.fund(id, cfg, 0, true);
        assertEq(setlo.getPackage(id).funded, req);
        assertEq(setlo.claimable(client), 100e6);
    }

    function test_fund_wrongAmountReverts() public {
        uint256 id = _create();
        bytes32 cfg = setlo.configHash(id);
        vm.startPrank(client);
        usdg.approve(address(setlo), TOTAL);
        vm.expectRevert(SetloPackages.WrongAmount.selector);
        setlo.fund(id, cfg, TOTAL - 1, true);
        vm.stopPrank();
    }

    function test_replaceSupplier_keepsEarnedHoldWithinCap() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);

        vm.prank(agency);
        setlo.replaceSupplier(id, 0, newVenue, 200e6, 15e6, 300e6, keccak256("new-venue"));
        assertEq(setlo.getPackage(id).earnedHoldTotal, 20e6);
        assertEq(setlo.requiredFunding(id), TOTAL + 20e6);

        // re-replacing an unaccepted slot earns nothing; but a hold that breaks the cap reverts
        vm.prank(agency);
        vm.expectRevert(SetloPackages.HoldFeeCapExceeded.selector);
        setlo.replaceSupplier(id, 0, newVenue, 200e6, 20e6, 300e6, keccak256("new-venue-2"));

        _accept(id, 0, newVenue);
        _accept(id, 1, caterer);
        _fundDirect(id, true);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Confirmed));
        assertEq(setlo.claimable(venue), 20e6);
        assertEq(setlo.claimable(newVenue), 200e6);
    }

    function test_replaceSupplier_earnedHoldPaidOnExpiry() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);
        vm.prank(agency);
        setlo.replaceSupplier(id, 0, newVenue, 200e6, 15e6, 300e6, keccak256("new-venue"));
        uint256 top = setlo.requiredFunding(id) - setlo.getPackage(id).funded;
        vm.startPrank(client);
        usdg.approve(address(setlo), top);
        setlo.fund(id, setlo.configHash(id), top, true);
        vm.stopPrank();

        vm.warp(t0 + 3 days + 1);
        setlo.expirePackage(id);
        assertEq(setlo.claimable(venue), 20e6);
        assertEq(setlo.claimable(client), TOTAL);
    }

    function test_revision_extendsDeadlinesButNeverPastFinalExpiry() public {
        uint256 id = _create();
        vm.warp(t0 + 1 days - 10 minutes);
        vm.prank(agency);
        setlo.updateQuote(id, 2, 100e6, 5e6, 90e6, keccak256("photo-v2"));
        assertEq(setlo.getPackage(id).acceptDeadline, t0 + 1 days + 50 minutes);

        vm.warp(t0 + 3 days - 10 minutes);
        vm.prank(agency);
        setlo.updateQuote(id, 2, 100e6, 5e6, 80e6, keccak256("photo-v3"));
        SetloPackages.Package memory p = setlo.getPackage(id);
        assertEq(p.acceptDeadline, p.finalExpiry);
        assertEq(p.confirmDeadline, p.finalExpiry);
    }

    function test_revision_onlyAgencyAndOnlyOpen() public {
        uint256 id = _create();
        vm.prank(client);
        vm.expectRevert(SetloPackages.NotAgency.selector);
        setlo.updateQuote(id, 0, 1e6, 0, 1e6, bytes32(0));

        _fundDirect(id, true);
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        vm.prank(agency);
        vm.expectRevert(SetloPackages.InvalidStatus.selector);
        setlo.updateQuote(id, 0, 1e6, 0, 1e6, bytes32(0));
    }

    // ---------------------------------------------------------------- after confirmation

    function _confirmed() internal returns (uint256 id) {
        id = _create();
        _fundDirect(id, true);
        _accept(id, 2, photo);
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
    }

    function test_accept_afterConfirmReverts() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        bytes32 sh = setlo.slotHash(id, 2);
        vm.prank(photo);
        vm.expectRevert(SetloPackages.InvalidStatus.selector);
        setlo.supplierAccept(id, 2, sh);
    }

    function test_autoRelease_onlyAfterReviewWindow() public {
        uint256 id = _confirmed();
        vm.warp(t0 + 10 days + 2 days - 1);
        vm.prank(relayer);
        vm.expectRevert(SetloPackages.NotReady.selector);
        setlo.releaseBalances(id);
        vm.warp(t0 + 12 days);
        vm.prank(relayer);
        setlo.releaseBalances(id);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Released));
        assertEq(setlo.claimable(venue), 500e6);
    }

    function test_cancelAfterConfirm_keepsDepositsRefundsBalances() public {
        uint256 id = _confirmed();
        vm.prank(client);
        setlo.cancelAfterConfirm(id);
        assertEq(uint8(_status(id)), uint8(SetloPackages.Status.Cancelled));
        assertEq(setlo.claimable(venue), 200e6);
        assertEq(setlo.claimable(client), 650e6);
        _claimAll();
        assertEq(usdg.balanceOf(address(setlo)), 0);
    }

    function test_cancelAfterConfirm_revertsOnEventDay() public {
        uint256 id = _confirmed();
        vm.warp(t0 + 10 days);
        vm.prank(client);
        vm.expectRevert(SetloPackages.DeadlinePassed.selector);
        setlo.cancelAfterConfirm(id);
    }

    function test_cancel_onlyClient() public {
        uint256 id = _confirmed();
        vm.prank(agency);
        vm.expectRevert(SetloPackages.NotClient.selector);
        setlo.cancelAfterConfirm(id);
    }

    // ---------------------------------------------------------------- signatures

    function test_fundWithPermit_rejectsStaleConfig() public {
        uint256 id = _create();
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, TOTAL, true);
        SetloPackages.PermitData memory p = _permit(TOTAL);
        vm.prank(agency);
        setlo.updateQuote(id, 2, 100e6, 5e6, 90e6, keccak256("photo-v2"));
        vm.prank(relayer);
        vm.expectRevert(SetloPackages.ConfigMismatch.selector);
        setlo.fundWithPermit(ins, sig, p);
    }

    function test_fundWithPermit_rejectsTamperedInstruction() public {
        uint256 id = _create();
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, TOTAL, true);
        SetloPackages.PermitData memory p = _permit(TOTAL);
        ins.autoConfirm = false;
        vm.prank(relayer);
        vm.expectRevert(SetloPackages.InvalidSignature.selector);
        setlo.fundWithPermit(ins, sig, p);
    }

    function test_fundWithPermit_rejectsOtherPackage() public {
        uint256 id = _create();
        uint256 id2 = _create();
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, TOTAL, true);
        SetloPackages.PermitData memory p = _permit(TOTAL);
        ins.packageId = id2;
        vm.prank(relayer);
        vm.expectRevert(SetloPackages.InvalidSignature.selector);
        setlo.fundWithPermit(ins, sig, p);
    }

    function test_fundWithPermit_rejectsReplay() public {
        uint256 id = _create();
        vm.prank(agency);
        setlo.updateQuote(id, 2, 100e6, 5e6, 100e6, keccak256("photo"));
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, TOTAL, false);
        SetloPackages.PermitData memory p = _permit(TOTAL);
        vm.prank(relayer);
        setlo.fundWithPermit(ins, sig, p);
        vm.prank(relayer);
        vm.expectRevert();
        setlo.fundWithPermit(ins, sig, p);
    }

    function test_fundWithPermit_frontRunPermitDoesNotBlock() public {
        uint256 id = _create();
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, TOTAL, true);
        SetloPackages.PermitData memory p = _permit(TOTAL);
        usdg.permit(client, address(setlo), p.value, p.deadline, p.v, p.r, p.s);
        vm.prank(relayer);
        setlo.fundWithPermit(ins, sig, p);
        assertEq(setlo.getPackage(id).funded, TOTAL);
    }

    function test_fundWithPermit_expiredSignature() public {
        uint256 id = _create();
        (SetloPackages.FundingInstruction memory ins, bytes memory sig) = _fundInstruction(id, TOTAL, true);
        SetloPackages.PermitData memory p = _permit(TOTAL);
        vm.warp(block.timestamp + 2 hours);
        vm.prank(relayer);
        vm.expectRevert(SetloPackages.SignatureExpired.selector);
        setlo.fundWithPermit(ins, sig, p);
    }

    function test_acceptWithSig_rejectsNonPayeeSigner() public {
        uint256 id = _create();
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 sh = setlo.slotHash(id, 0);
        bytes memory sig = _sign(catererPk, keccak256(abi.encode(ACCEPT_TYPEHASH, caterer, id, 0, sh, 1, 0, deadline)));
        vm.expectRevert(SetloPackages.NotPayee.selector);
        setlo.acceptWithSig(caterer, id, 0, sh, 1, 0, deadline, sig);
    }

    function test_acceptWithSig_rejectsForgedSupplier() public {
        uint256 id = _create();
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 sh = setlo.slotHash(id, 0);
        bytes memory sig = _sign(catererPk, keccak256(abi.encode(ACCEPT_TYPEHASH, venue, id, 0, sh, 1, 0, deadline)));
        vm.expectRevert(SetloPackages.InvalidSignature.selector);
        setlo.acceptWithSig(venue, id, 0, sh, 1, 0, deadline, sig);
    }

    function test_declineWithSig() public {
        uint256 id = _create();
        _accept(id, 0, venue);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(venuePk, keccak256(abi.encode(DECLINE_TYPEHASH, venue, id, 0, 0, deadline)));
        vm.prank(relayer);
        setlo.declineWithSig(venue, id, 0, 0, deadline, sig);
        SetloPackages.Slot memory s = setlo.getSlots(id)[0];
        assertTrue(s.declined);
        assertEq(s.acceptedVersion, 0);
    }

    function test_clientActionWithSig_rejectsNonClientSigner() public {
        uint256 id = _confirmed();
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(
            venuePk,
            keccak256(
                abi.encode(CLIENT_ACTION_TYPEHASH, client, id, uint8(SetloPackages.ClientAction.Release), 0, deadline)
            )
        );
        vm.expectRevert(SetloPackages.InvalidSignature.selector);
        setlo.clientActionWithSig(id, SetloPackages.ClientAction.Release, 0, deadline, sig);
    }

    // ---------------------------------------------------------------- claims and owner

    function test_claimFor_alwaysPaysRecipient() public {
        uint256 id = _confirmed();
        uint256 before = usdg.balanceOf(relayer);
        vm.prank(relayer);
        setlo.claimFor(venue);
        assertEq(usdg.balanceOf(venue), 200e6);
        assertEq(usdg.balanceOf(relayer), before);
        assertEq(setlo.claimable(venue), 0);
        vm.expectRevert(SetloPackages.NothingToClaim.selector);
        setlo.claimFor(venue);
        id;
    }

    function test_pause_blocksOnlyCreation() public {
        uint256 id = _create();
        _fundDirect(id, true);
        _accept(id, 0, venue);

        vm.prank(owner);
        setlo.pause();

        SetloPackages.PackageParams memory p = _params();
        SetloPackages.SlotInput[] memory s = _slots();
        vm.prank(agency);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        setlo.createPackage(p, s);

        vm.warp(t0 + 1 days + 1);
        setlo.expirePackage(id);
        vm.prank(client);
        setlo.claim();
        setlo.claimFor(venue);
        assertEq(usdg.balanceOf(address(setlo)), 0);

        vm.prank(owner);
        setlo.unpause();
        t0 = uint64(block.timestamp);
        _create();
    }

    function test_pause_onlyOwner() public {
        vm.prank(agency);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, agency));
        setlo.pause();
    }

    function test_ownership_twoStep() public {
        address next = makeAddr("next");
        vm.prank(owner);
        setlo.transferOwnership(next);
        assertEq(setlo.owner(), owner);
        vm.prank(next);
        setlo.acceptOwnership();
        assertEq(setlo.owner(), next);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_settlementConservesFunds(uint128 d0, uint128 b0, uint128 d1, uint128 b1, uint128 fee, bool cancel)
        public
    {
        d0 = uint128(bound(d0, 1, 1_000e6));
        b0 = uint128(bound(b0, 0, 1_000e6));
        d1 = uint128(bound(d1, 1, 1_000e6));
        b1 = uint128(bound(b1, 0, 1_000e6));
        fee = uint128(bound(fee, 0, 100e6));
        SetloPackages.PackageParams memory p = _params();
        p.agencyFee = fee;
        p.holdFeeCap = d0 + d1;
        SetloPackages.SlotInput[] memory s = new SetloPackages.SlotInput[](2);
        s[0] = SetloPackages.SlotInput(venue, true, d0, d0, b0, bytes32(0));
        s[1] = SetloPackages.SlotInput(caterer, true, d1, 0, b1, bytes32(0));
        vm.prank(agency);
        uint256 id = setlo.createPackage(p, s);
        _fundDirect(id, true);
        _accept(id, 0, venue);
        _accept(id, 1, caterer);
        vm.prank(client);
        if (cancel) setlo.cancelAfterConfirm(id);
        else setlo.releaseBalances(id);
        assertEq(setlo.getPackage(id).held, 0);
        _claimAll();
        assertEq(usdg.balanceOf(address(setlo)), 0);
        assertEq(usdg.balanceOf(venue), cancel ? d0 : d0 + b0);
        assertEq(usdg.balanceOf(agency), fee);
    }
}
