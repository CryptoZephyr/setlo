// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title SetloPackages
/// @notice Conditional multi-supplier booking settlement. Supplier deposits release only when every
/// required supplier accepts the client-approved package; on expiry the client reclaims everything
/// except earned hold fees. All payouts are pull-based. The owner can only pause package creation.
contract SetloPackages is Ownable2Step, Pausable, ReentrancyGuard, EIP712, Nonces {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SLOTS = 16;

    enum Status {
        None,
        Open,
        Confirmed,
        Released,
        Cancelled,
        Expired
    }

    enum ClientAction {
        Confirm,
        Release,
        Cancel
    }

    struct SlotInput {
        address payee;
        bool required;
        uint128 deposit;
        uint128 holdFee;
        uint128 balance;
        bytes32 termsHash;
    }

    struct Slot {
        address payee;
        bool required;
        bool declined;
        uint128 deposit;
        uint128 holdFee;
        uint128 balance;
        bytes32 termsHash;
        uint32 version;
        uint32 acceptedVersion;
        uint32 acceptedRevision;
    }

    struct PackageParams {
        address client;
        uint64 eventDate;
        uint64 acceptDeadline;
        uint64 confirmDeadline;
        uint64 finalExpiry;
        uint64 reviewWindow;
        uint64 minResponseWindow;
        uint128 agencyFee;
        uint128 holdFeeCap;
        bytes32 sharedTermsHash;
    }

    struct Package {
        address agency;
        address client;
        Status status;
        bool autoConfirm;
        uint32 revision;
        uint64 eventDate;
        uint64 acceptDeadline;
        uint64 confirmDeadline;
        uint64 finalExpiry;
        uint64 reviewWindow;
        uint64 minResponseWindow;
        uint128 agencyFee;
        uint128 holdFeeCap;
        uint128 earnedHoldTotal;
        uint256 funded;
        uint256 held;
        bytes32 sharedTermsHash;
        bytes32 approvedConfig;
    }

    struct EarnedHold {
        address recipient;
        uint128 amount;
    }

    struct FundingInstruction {
        address client;
        uint256 packageId;
        bytes32 configHash;
        uint256 amount;
        bool autoConfirm;
        uint256 nonce;
        uint256 deadline;
    }

    struct PermitData {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    bytes32 private constant FUND_TYPEHASH = keccak256(
        "Fund(address client,uint256 packageId,bytes32 configHash,uint256 amount,bool autoConfirm,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant ACCEPT_TYPEHASH = keccak256(
        "Accept(address supplier,uint256 packageId,uint256 slotIndex,bytes32 slotHash,uint256 revision,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant DECLINE_TYPEHASH =
        keccak256("Decline(address supplier,uint256 packageId,uint256 slotIndex,uint256 nonce,uint256 deadline)");
    bytes32 private constant CLIENT_ACTION_TYPEHASH =
        keccak256("ClientAction(address client,uint256 packageId,uint8 action,uint256 nonce,uint256 deadline)");

    IERC20 public immutable token;

    uint256 public packageCount;
    uint256 public totalClaimable;
    mapping(address => uint256) public claimable;

    mapping(uint256 => Package) private _packages;
    mapping(uint256 => Slot[]) private _slots;
    mapping(uint256 => EarnedHold[]) private _earnedHolds;

    event PackageCreated(uint256 indexed packageId, address indexed agency, address indexed client, uint256 slotCount);
    event Funded(uint256 indexed packageId, bytes32 configHash, uint256 amount, uint256 funded, bool autoConfirm);
    event SlotAccepted(
        uint256 indexed packageId, uint256 indexed slotIndex, address indexed payee, uint32 version, uint32 revision
    );
    event SlotDeclined(uint256 indexed packageId, uint256 indexed slotIndex, address indexed payee);
    event SlotRevised(uint256 indexed packageId, uint256 indexed slotIndex, address payee, uint32 version);
    event SharedTermsRevised(uint256 indexed packageId, uint32 revision, uint64 eventDate, bytes32 sharedTermsHash);
    event HoldEarned(uint256 indexed packageId, address indexed recipient, uint128 amount);
    event Confirmed(uint256 indexed packageId);
    event BalancesReleased(uint256 indexed packageId, bool automatic);
    event Cancelled(uint256 indexed packageId);
    event Expired(uint256 indexed packageId);
    event Credited(uint256 indexed packageId, address indexed recipient, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);

    error InvalidParams();
    error InvalidStatus();
    error NotAgency();
    error NotClient();
    error NotPayee();
    error DeadlinePassed();
    error SignatureExpired();
    error InvalidSignature();
    error ConfigMismatch();
    error WrongAmount();
    error NotReady();
    error HoldFeeCapExceeded();
    error NothingToClaim();

    constructor(IERC20 token_, address owner_) Ownable(owner_) EIP712("Setlo", "1") {
        if (address(token_) == address(0)) revert InvalidParams();
        token = token_;
    }

    // ---------------------------------------------------------------- owner

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- agency

    function createPackage(PackageParams calldata p, SlotInput[] calldata slots)
        external
        whenNotPaused
        returns (uint256 packageId)
    {
        if (p.client == address(0) || p.minResponseWindow == 0) revert InvalidParams();
        if (!(block.timestamp < p.acceptDeadline && p.acceptDeadline <= p.confirmDeadline
                    && p.confirmDeadline <= p.finalExpiry && p.finalExpiry <= p.eventDate)) revert InvalidParams();
        if (slots.length == 0 || slots.length > MAX_SLOTS) revert InvalidParams();

        packageId = ++packageCount;
        Package storage pkg = _packages[packageId];
        pkg.agency = msg.sender;
        pkg.client = p.client;
        pkg.status = Status.Open;
        pkg.revision = 1;
        pkg.eventDate = p.eventDate;
        pkg.acceptDeadline = p.acceptDeadline;
        pkg.confirmDeadline = p.confirmDeadline;
        pkg.finalExpiry = p.finalExpiry;
        pkg.reviewWindow = p.reviewWindow;
        pkg.minResponseWindow = p.minResponseWindow;
        pkg.agencyFee = p.agencyFee;
        pkg.holdFeeCap = p.holdFeeCap;
        pkg.sharedTermsHash = p.sharedTermsHash;

        bool anyRequired = false;
        Slot[] storage s = _slots[packageId];
        for (uint256 i; i < slots.length; ++i) {
            _validateSlot(slots[i], p.client);
            anyRequired = anyRequired || slots[i].required;
            s.push(
                Slot({
                    payee: slots[i].payee,
                    required: slots[i].required,
                    declined: false,
                    deposit: slots[i].deposit,
                    holdFee: slots[i].holdFee,
                    balance: slots[i].balance,
                    termsHash: slots[i].termsHash,
                    version: 1,
                    acceptedVersion: 0,
                    acceptedRevision: 0
                })
            );
        }
        if (!anyRequired) revert InvalidParams();
        _checkHoldCap(packageId);

        emit PackageCreated(packageId, msg.sender, p.client, slots.length);
    }

    /// @notice Change one slot's quote and terms. Only that supplier must re-accept.
    function updateQuote(
        uint256 packageId,
        uint256 slotIndex,
        uint128 deposit,
        uint128 holdFee,
        uint128 balance,
        bytes32 termsHash
    ) external {
        Package storage pkg = _openAsAgency(packageId);
        Slot storage s = _slot(packageId, slotIndex);
        _validateSlot(SlotInput(s.payee, s.required, deposit, holdFee, balance, termsHash), pkg.client);
        s.deposit = deposit;
        s.holdFee = holdFee;
        s.balance = balance;
        s.termsHash = termsHash;
        _bumpSlot(packageId, pkg, slotIndex, s);
    }

    /// @notice Replace a slot's supplier before confirmation. A replaced supplier that had a valid
    /// acceptance keeps its hold fee, which counts toward the client's hold fee cap.
    function replaceSupplier(
        uint256 packageId,
        uint256 slotIndex,
        address payee,
        uint128 deposit,
        uint128 holdFee,
        uint128 balance,
        bytes32 termsHash
    ) external {
        Package storage pkg = _openAsAgency(packageId);
        Slot storage s = _slot(packageId, slotIndex);
        _validateSlot(SlotInput(payee, s.required, deposit, holdFee, balance, termsHash), pkg.client);
        if (_isAccepted(pkg, s) && s.holdFee > 0) {
            _earnedHolds[packageId].push(EarnedHold(s.payee, s.holdFee));
            pkg.earnedHoldTotal += s.holdFee;
            emit HoldEarned(packageId, s.payee, s.holdFee);
        }
        s.payee = payee;
        s.deposit = deposit;
        s.holdFee = holdFee;
        s.balance = balance;
        s.termsHash = termsHash;
        _bumpSlot(packageId, pkg, slotIndex, s);
    }

    /// @notice Change the event date or shared terms. Every supplier must re-accept.
    function updateSharedTerms(uint256 packageId, uint64 eventDate, bytes32 sharedTermsHash) external {
        Package storage pkg = _openAsAgency(packageId);
        if (eventDate < pkg.finalExpiry) revert InvalidParams();
        pkg.eventDate = eventDate;
        pkg.sharedTermsHash = sharedTermsHash;
        pkg.revision += 1;
        _extendDeadlines(pkg);
        emit SharedTermsRevised(packageId, pkg.revision, eventDate, sharedTermsHash);
    }

    // ---------------------------------------------------------------- client

    function fund(uint256 packageId, bytes32 configHash_, uint256 amount, bool autoConfirm) external nonReentrant {
        Package storage pkg = _packages[packageId];
        if (msg.sender != pkg.client) revert NotClient();
        _fund(packageId, pkg, configHash_, amount, autoConfirm);
    }

    /// @notice Relayed funding. `sig` is the client's EIP-712 Fund instruction; `permit` optionally
    /// grants the USDG allowance (EIP-2612). The permit alone never authorizes funding.
    function fundWithPermit(FundingInstruction calldata ins, bytes calldata sig, PermitData calldata permit)
        external
        nonReentrant
    {
        Package storage pkg = _packages[ins.packageId];
        if (ins.client != pkg.client) revert NotClient();
        _useSig(
            ins.client,
            ins.nonce,
            ins.deadline,
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
            ),
            sig
        );
        if (permit.value > 0) {
            try IERC20Permit(address(token))
                .permit(ins.client, address(this), permit.value, permit.deadline, permit.v, permit.r, permit.s) {}
                catch {}
        }
        _fund(ins.packageId, pkg, ins.configHash, ins.amount, ins.autoConfirm);
    }

    function clientConfirm(uint256 packageId) external nonReentrant {
        if (msg.sender != _packages[packageId].client) revert NotClient();
        _clientAction(packageId, ClientAction.Confirm);
    }

    function releaseBalances(uint256 packageId) external nonReentrant {
        Package storage pkg = _packages[packageId];
        if (msg.sender == pkg.client) {
            _clientAction(packageId, ClientAction.Release);
        } else {
            if (pkg.status != Status.Confirmed) revert InvalidStatus();
            if (block.timestamp < uint256(pkg.eventDate) + pkg.reviewWindow) revert NotReady();
            _release(packageId, pkg, true);
        }
    }

    function cancelAfterConfirm(uint256 packageId) external nonReentrant {
        if (msg.sender != _packages[packageId].client) revert NotClient();
        _clientAction(packageId, ClientAction.Cancel);
    }

    function clientActionWithSig(
        uint256 packageId,
        ClientAction action,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external nonReentrant {
        address client = _packages[packageId].client;
        if (client == address(0)) revert InvalidStatus();
        _useSig(
            client,
            nonce,
            deadline,
            keccak256(abi.encode(CLIENT_ACTION_TYPEHASH, client, packageId, uint8(action), nonce, deadline)),
            sig
        );
        _clientAction(packageId, action);
    }

    // ---------------------------------------------------------------- supplier

    function supplierAccept(uint256 packageId, uint256 slotIndex, bytes32 slotHash_) external nonReentrant {
        _accept(packageId, slotIndex, msg.sender, slotHash_, _packages[packageId].revision);
    }

    function acceptWithSig(
        address supplier,
        uint256 packageId,
        uint256 slotIndex,
        bytes32 slotHash_,
        uint256 revision,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external nonReentrant {
        _useSig(
            supplier,
            nonce,
            deadline,
            keccak256(
                abi.encode(ACCEPT_TYPEHASH, supplier, packageId, slotIndex, slotHash_, revision, nonce, deadline)
            ),
            sig
        );
        _accept(packageId, slotIndex, supplier, slotHash_, revision);
    }

    function supplierDecline(uint256 packageId, uint256 slotIndex) external {
        _decline(packageId, slotIndex, msg.sender);
    }

    function declineWithSig(
        address supplier,
        uint256 packageId,
        uint256 slotIndex,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external {
        _useSig(
            supplier,
            nonce,
            deadline,
            keccak256(abi.encode(DECLINE_TYPEHASH, supplier, packageId, slotIndex, nonce, deadline)),
            sig
        );
        _decline(packageId, slotIndex, supplier);
    }

    // ---------------------------------------------------------------- anyone

    function expirePackage(uint256 packageId) external nonReentrant {
        Package storage pkg = _packages[packageId];
        if (pkg.status != Status.Open) revert InvalidStatus();
        bool pastAccept = block.timestamp > pkg.acceptDeadline && !_allRequiredAccepted(packageId, pkg);
        if (!(pastAccept || block.timestamp > pkg.confirmDeadline)) revert NotReady();

        pkg.status = Status.Expired;
        Slot[] storage s = _slots[packageId];
        for (uint256 i; i < s.length; ++i) {
            if (_isAccepted(pkg, s[i])) _credit(packageId, pkg, s[i].payee, s[i].holdFee);
        }
        _creditEarnedHolds(packageId, pkg);
        _credit(packageId, pkg, pkg.client, pkg.held);
        emit Expired(packageId);
    }

    function claim() external nonReentrant {
        _claim(msg.sender);
    }

    /// @notice Anyone (e.g. the relayer) may pay gas to push a recipient's claimable balance to it.
    function claimFor(address recipient) external nonReentrant {
        _claim(recipient);
    }

    // ---------------------------------------------------------------- views

    function getPackage(uint256 packageId) external view returns (Package memory) {
        return _packages[packageId];
    }

    function getSlots(uint256 packageId) external view returns (Slot[] memory) {
        return _slots[packageId];
    }

    function getEarnedHolds(uint256 packageId) external view returns (EarnedHold[] memory) {
        return _earnedHolds[packageId];
    }

    function requiredFunding(uint256 packageId) public view returns (uint256 total) {
        Package storage pkg = _packages[packageId];
        Slot[] storage s = _slots[packageId];
        total = uint256(pkg.agencyFee) + pkg.earnedHoldTotal;
        for (uint256 i; i < s.length; ++i) {
            total += uint256(s[i].deposit) + s[i].balance;
        }
    }

    function slotHash(uint256 packageId, uint256 slotIndex) public view returns (bytes32) {
        Slot storage s = _slot(packageId, slotIndex);
        return keccak256(
            abi.encode(
                packageId, slotIndex, s.payee, s.required, s.deposit, s.holdFee, s.balance, s.termsHash, s.version
            )
        );
    }

    /// @notice Hash of everything the client approves when funding.
    function configHash(uint256 packageId) public view returns (bytes32) {
        Package storage pkg = _packages[packageId];
        Slot[] storage s = _slots[packageId];
        bytes32[] memory slotHashes = new bytes32[](s.length);
        for (uint256 i; i < s.length; ++i) {
            slotHashes[i] = slotHash(packageId, i);
        }
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                packageId,
                pkg.agency,
                pkg.client,
                pkg.revision,
                pkg.eventDate,
                pkg.finalExpiry,
                pkg.reviewWindow,
                pkg.agencyFee,
                pkg.holdFeeCap,
                pkg.earnedHoldTotal,
                pkg.sharedTermsHash,
                keccak256(abi.encodePacked(slotHashes))
            )
        );
    }

    function isReadyToConfirm(uint256 packageId) public view returns (bool) {
        Package storage pkg = _packages[packageId];
        return pkg.status == Status.Open && block.timestamp <= pkg.confirmDeadline && pkg.approvedConfig != bytes32(0)
            && pkg.approvedConfig == configHash(packageId) && pkg.funded == requiredFunding(packageId)
            && _allRequiredAccepted(packageId, pkg);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- internal

    function _fund(uint256 packageId, Package storage pkg, bytes32 configHash_, uint256 amount, bool autoConfirm)
        internal
    {
        if (pkg.status != Status.Open) revert InvalidStatus();
        if (block.timestamp > pkg.confirmDeadline) revert DeadlinePassed();
        if (configHash_ != configHash(packageId)) revert ConfigMismatch();
        uint256 required = requiredFunding(packageId);
        uint256 excess = 0;
        if (pkg.funded >= required) {
            if (amount != 0) revert WrongAmount();
            excess = pkg.funded - required;
        } else if (pkg.funded + amount != required) {
            revert WrongAmount();
        }

        pkg.approvedConfig = configHash_;
        pkg.autoConfirm = autoConfirm;
        if (amount > 0) {
            pkg.funded += amount;
            pkg.held += amount;
            token.safeTransferFrom(pkg.client, address(this), amount);
        }
        if (excess > 0) {
            pkg.funded -= excess;
            _credit(packageId, pkg, pkg.client, excess);
        }
        emit Funded(packageId, configHash_, amount, pkg.funded, autoConfirm);

        if (autoConfirm && isReadyToConfirm(packageId)) _confirm(packageId, pkg);
    }

    function _accept(uint256 packageId, uint256 slotIndex, address supplier, bytes32 slotHash_, uint256 revision)
        internal
    {
        Package storage pkg = _packages[packageId];
        if (pkg.status != Status.Open) revert InvalidStatus();
        if (block.timestamp > pkg.acceptDeadline) revert DeadlinePassed();
        Slot storage s = _slot(packageId, slotIndex);
        if (supplier != s.payee) revert NotPayee();
        if (revision != pkg.revision || slotHash_ != slotHash(packageId, slotIndex)) revert ConfigMismatch();
        s.declined = false;
        s.acceptedVersion = s.version;
        s.acceptedRevision = pkg.revision;
        emit SlotAccepted(packageId, slotIndex, supplier, s.version, pkg.revision);

        if (pkg.autoConfirm && isReadyToConfirm(packageId)) _confirm(packageId, pkg);
    }

    function _decline(uint256 packageId, uint256 slotIndex, address supplier) internal {
        Package storage pkg = _packages[packageId];
        if (pkg.status != Status.Open) revert InvalidStatus();
        Slot storage s = _slot(packageId, slotIndex);
        if (supplier != s.payee) revert NotPayee();
        s.declined = true;
        s.acceptedVersion = 0;
        s.acceptedRevision = 0;
        emit SlotDeclined(packageId, slotIndex, supplier);
    }

    function _clientAction(uint256 packageId, ClientAction action) internal {
        Package storage pkg = _packages[packageId];
        if (action == ClientAction.Confirm) {
            if (!isReadyToConfirm(packageId)) revert NotReady();
            _confirm(packageId, pkg);
        } else if (action == ClientAction.Release) {
            if (pkg.status != Status.Confirmed) revert InvalidStatus();
            _release(packageId, pkg, false);
        } else {
            if (pkg.status != Status.Confirmed) revert InvalidStatus();
            if (block.timestamp >= pkg.eventDate) revert DeadlinePassed();
            pkg.status = Status.Cancelled;
            _credit(packageId, pkg, pkg.client, pkg.held);
            emit Cancelled(packageId);
        }
    }

    function _confirm(uint256 packageId, Package storage pkg) internal {
        pkg.status = Status.Confirmed;
        Slot[] storage s = _slots[packageId];
        for (uint256 i; i < s.length; ++i) {
            if (_isAccepted(pkg, s[i])) {
                _credit(packageId, pkg, s[i].payee, s[i].deposit);
            } else {
                _credit(packageId, pkg, pkg.client, uint256(s[i].deposit) + s[i].balance);
            }
        }
        _creditEarnedHolds(packageId, pkg);
        _credit(packageId, pkg, pkg.agency, pkg.agencyFee);
        emit Confirmed(packageId);
    }

    function _release(uint256 packageId, Package storage pkg, bool automatic) internal {
        pkg.status = Status.Released;
        Slot[] storage s = _slots[packageId];
        for (uint256 i; i < s.length; ++i) {
            if (_isAccepted(pkg, s[i])) _credit(packageId, pkg, s[i].payee, s[i].balance);
        }
        emit BalancesReleased(packageId, automatic);
    }

    function _creditEarnedHolds(uint256 packageId, Package storage pkg) internal {
        EarnedHold[] storage e = _earnedHolds[packageId];
        for (uint256 i; i < e.length; ++i) {
            _credit(packageId, pkg, e[i].recipient, e[i].amount);
        }
    }

    /// @dev Moves value from the package's held funds to a recipient's claimable balance, capped at
    /// what the package still holds (an unfunded package owes nothing).
    function _credit(uint256 packageId, Package storage pkg, address to, uint256 amount) internal {
        if (amount > pkg.held) amount = pkg.held;
        if (amount == 0) return;
        pkg.held -= amount;
        claimable[to] += amount;
        totalClaimable += amount;
        emit Credited(packageId, to, amount);
    }

    function _claim(address recipient) internal {
        uint256 amount = claimable[recipient];
        if (amount == 0) revert NothingToClaim();
        claimable[recipient] = 0;
        totalClaimable -= amount;
        emit Claimed(recipient, amount);
        token.safeTransfer(recipient, amount);
    }

    function _bumpSlot(uint256 packageId, Package storage pkg, uint256 slotIndex, Slot storage s) internal {
        s.version += 1;
        s.declined = false;
        s.acceptedVersion = 0;
        s.acceptedRevision = 0;
        _checkHoldCap(packageId);
        _extendDeadlines(pkg);
        emit SlotRevised(packageId, slotIndex, s.payee, s.version);
    }

    function _extendDeadlines(Package storage pkg) internal {
        uint256 target = block.timestamp + pkg.minResponseWindow;
        if (target > pkg.finalExpiry) target = pkg.finalExpiry;
        // forge-lint: disable-next-line(unsafe-typecast)
        if (pkg.acceptDeadline < target) pkg.acceptDeadline = uint64(target);
        if (pkg.confirmDeadline < pkg.acceptDeadline) pkg.confirmDeadline = pkg.acceptDeadline;
    }

    function _checkHoldCap(uint256 packageId) internal view {
        Package storage pkg = _packages[packageId];
        Slot[] storage s = _slots[packageId];
        uint256 total = pkg.earnedHoldTotal;
        for (uint256 i; i < s.length; ++i) {
            total += s[i].holdFee;
        }
        if (total > pkg.holdFeeCap) revert HoldFeeCapExceeded();
    }

    function _useSig(address signer, uint256 nonce, uint256 deadline, bytes32 structHash, bytes calldata sig) internal {
        if (block.timestamp > deadline) revert SignatureExpired();
        if (!SignatureChecker.isValidSignatureNow(signer, _hashTypedDataV4(structHash), sig)) {
            revert InvalidSignature();
        }
        _useCheckedNonce(signer, nonce);
    }

    function _openAsAgency(uint256 packageId) internal view returns (Package storage pkg) {
        pkg = _packages[packageId];
        if (msg.sender != pkg.agency) revert NotAgency();
        if (pkg.status != Status.Open) revert InvalidStatus();
    }

    function _slot(uint256 packageId, uint256 slotIndex) internal view returns (Slot storage) {
        Slot[] storage s = _slots[packageId];
        if (slotIndex >= s.length) revert InvalidParams();
        return s[slotIndex];
    }

    function _isAccepted(Package storage pkg, Slot storage s) internal view returns (bool) {
        return s.acceptedVersion != 0 && s.acceptedVersion == s.version && s.acceptedRevision == pkg.revision;
    }

    function _allRequiredAccepted(uint256 packageId, Package storage pkg) internal view returns (bool) {
        Slot[] storage s = _slots[packageId];
        for (uint256 i; i < s.length; ++i) {
            if (s[i].required && !_isAccepted(pkg, s[i])) return false;
        }
        return true;
    }

    function _validateSlot(SlotInput memory s, address client) internal pure {
        if (s.payee == address(0) || s.payee == client) revert InvalidParams();
        if (s.holdFee > s.deposit || uint256(s.deposit) + s.balance == 0) revert InvalidParams();
    }
}
