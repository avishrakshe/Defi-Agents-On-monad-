// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistryV2.sol";

/**
 * @title ReputationRegistryV2
 * @dev Every review is tied to exactly one recorded paid call (callId) and is tagged with who wrote it:
 *  - Client:   the wallet that paid for the call, via submitFeedback      → counts as independent
 *  - Operator: an authorized recorder, via submitFeedbackFor, and only for
 *              calls the operator itself paid for                          → shown separately
 * A call can be reviewed once. Operators and the agent's own owner/payee cannot write Client reviews.
 */
contract ReputationRegistryV2 is Ownable {
    enum ReviewerKind {
        Client,
        Operator
    }

    struct PaidCall {
        uint256 agentId;
        address client;
        uint64 recordedAt;
        bool reviewed;
    }

    struct Feedback {
        address reviewer;
        ReviewerKind kind;
        bytes32 callId;
        uint8 score; // 0..100
        string note;
        uint256 timestamp;
    }

    struct Tally {
        uint128 total;
        uint128 count;
    }

    IdentityRegistryV2 public immutable identityRegistry;
    mapping(address => bool) public authorizedRecorders;
    mapping(bytes32 => PaidCall) private _calls;
    mapping(uint256 => Feedback[]) private _feedbacks;
    mapping(uint256 => uint256) public paidCallCount;
    // agentId => kind => tally
    mapping(uint256 => mapping(ReviewerKind => Tally)) private _tallies;

    event RecorderAuthorized(address indexed recorder, bool status);
    event PaidCallRecorded(uint256 indexed agentId, address indexed client, bytes32 indexed callId);
    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed reviewer,
        bytes32 indexed callId,
        ReviewerKind kind,
        uint8 score,
        string note
    );

    modifier onlyAuthorizedRecorder() {
        require(authorizedRecorders[msg.sender] || msg.sender == owner(), "Not authorized to record paid calls");
        _;
    }

    constructor(address _identityRegistry) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IdentityRegistryV2(_identityRegistry);
    }

    function setAuthorizedRecorder(address recorder, bool status) external onlyOwner {
        require(recorder != address(0), "Zero address");
        authorizedRecorders[recorder] = status;
        emit RecorderAuthorized(recorder, status);
    }

    function isOperator(address account) public view returns (bool) {
        return authorizedRecorders[account] || account == owner();
    }

    function recordPaidCall(uint256 agentId, address client, bytes32 callId) external onlyAuthorizedRecorder {
        require(client != address(0), "Invalid client address");
        require(callId != bytes32(0), "callId required");
        require(_calls[callId].client == address(0), "callId already recorded");
        require(identityRegistry.getAgent(agentId).active, "Agent is not active");

        _calls[callId] = PaidCall({agentId: agentId, client: client, recordedAt: uint64(block.timestamp), reviewed: false});
        paidCallCount[agentId] += 1;
        emit PaidCallRecorded(agentId, client, callId);
    }

    /// @notice Review by the wallet that paid for `callId` — stored as an independent (Client) review
    function submitFeedback(uint256 agentId, bytes32 callId, uint8 score, string calldata note) external {
        PaidCall storage c = _useCall(agentId, callId);
        require(c.client == msg.sender, "Caller did not pay for this call");
        require(!isOperator(msg.sender), "Operators must use submitFeedbackFor");
        IdentityRegistryV2.Agent memory a = identityRegistry.getAgent(agentId);
        require(msg.sender != a.owner && msg.sender != a.payee, "Agent cannot review itself");
        _store(agentId, callId, msg.sender, ReviewerKind.Client, score, note);
    }

    /// @notice Review by an authorized recorder for a call the operator itself paid for — stored as Operator
    function submitFeedbackFor(uint256 agentId, bytes32 callId, uint8 score, string calldata note) external onlyAuthorizedRecorder {
        PaidCall storage c = _useCall(agentId, callId);
        require(isOperator(c.client), "Not an operator-paid call");
        _store(agentId, callId, msg.sender, ReviewerKind.Operator, score, note);
    }

    function _useCall(uint256 agentId, bytes32 callId) private returns (PaidCall storage c) {
        c = _calls[callId];
        require(c.client != address(0), "No paid call for this callId");
        require(c.agentId == agentId, "callId belongs to another agent");
        require(!c.reviewed, "Call already reviewed");
        c.reviewed = true;
    }

    function _store(uint256 agentId, bytes32 callId, address reviewer, ReviewerKind kind, uint8 score, string calldata note) private {
        require(score <= 100, "Score must be 0-100");
        _feedbacks[agentId].push(Feedback(reviewer, kind, callId, score, note, block.timestamp));
        Tally storage t = _tallies[agentId][kind];
        t.total += score;
        t.count += 1;
        emit FeedbackSubmitted(agentId, reviewer, callId, kind, score, note);
    }

    /// @return avgAll average over every review, countAll, avgIndependent Client-only average, countIndependent
    function getReputation(uint256 agentId)
        external
        view
        returns (uint256 avgAll, uint256 countAll, uint256 avgIndependent, uint256 countIndependent)
    {
        Tally memory c = _tallies[agentId][ReviewerKind.Client];
        Tally memory o = _tallies[agentId][ReviewerKind.Operator];
        countAll = uint256(c.count) + o.count;
        avgAll = countAll == 0 ? 0 : (uint256(c.total) + o.total) / countAll;
        countIndependent = c.count;
        avgIndependent = c.count == 0 ? 0 : uint256(c.total) / c.count;
    }

    function getOperatorReputation(uint256 agentId) external view returns (uint256 avgOperator, uint256 countOperator) {
        Tally memory o = _tallies[agentId][ReviewerKind.Operator];
        countOperator = o.count;
        avgOperator = o.count == 0 ? 0 : uint256(o.total) / o.count;
    }

    function getCall(bytes32 callId) external view returns (PaidCall memory) {
        return _calls[callId];
    }

    function getFeedbacks(uint256 agentId) external view returns (Feedback[] memory) {
        return _feedbacks[agentId];
    }
}
