// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IdentityRegistry.sol";

/**
 * @title ReputationRegistry
 * @dev Onchain reputation and feedback registry for registered DeFi agents.
 * Enforces that only addresses that have actually executed a paid call can submit feedback.
 */
contract ReputationRegistry is Ownable {
    IdentityRegistry public immutable identityRegistry;

    struct Feedback {
        address reviewer;
        uint8 score; // 0 to 100
        string note;
        uint256 timestamp;
    }

    // agentId => Feedback[]
    mapping(uint256 => Feedback[]) private _feedbacks;
    // agentId => totalScore
    mapping(uint256 => uint256) private _totalScores;
    // agentId => user => remaining feedback submissions allowed
    mapping(uint256 => mapping(address => uint256)) public paidCalls;
    // Authorized recorders (e.g. Orchestrator, x402 resource server, or deployer)
    mapping(address => bool) public authorizedRecorders;

    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 score,
        string note,
        uint256 timestamp
    );

    event PaidCallRecorded(
        uint256 indexed agentId,
        address indexed client,
        uint256 count
    );

    event RecorderAuthorized(address indexed recorder, bool status);

    modifier onlyAuthorizedRecorder() {
        require(
            authorizedRecorders[msg.sender] || msg.sender == owner(),
            "Not authorized to record paid calls"
        );
        emit RecorderAuthorized(msg.sender, true);
        _;
    }

    constructor(address _identityRegistry) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Invalid registry address");
        identityRegistry = IdentityRegistry(_identityRegistry);
        authorizedRecorders[msg.sender] = true;
    }

    function setAuthorizedRecorder(address recorder, bool status) external onlyOwner {
        require(recorder != address(0), "Zero address");
        authorizedRecorders[recorder] = status;
        emit RecorderAuthorized(recorder, status);
    }

    /**
     * @notice Records that a client paid and executed a call with the agent
     */
    function recordPaidCall(uint256 agentId, address client) external onlyAuthorizedRecorder {
        require(client != address(0), "Invalid client address");
        // Verify agent exists
        IdentityRegistry.Agent memory agent = identityRegistry.getAgent(agentId);
        require(agent.active, "Agent is not active");

        paidCalls[agentId][client] += 1;
        emit PaidCallRecorded(agentId, client, paidCalls[agentId][client]);
    }

    /**
     * @notice Submit feedback for an agent. Must have a recorded paid call.
     * @param agentId The target agent ID
     * @param score Score between 0 and 100
     * @param note Short feedback commentary
     */
    function submitFeedback(
        uint256 agentId,
        uint8 score,
        string calldata note
    ) external {
        require(score <= 100, "Score must be 0-100");
        require(paidCalls[agentId][msg.sender] > 0, "Caller has not used/paid for this agent");

        paidCalls[agentId][msg.sender] -= 1;

        Feedback memory fb = Feedback({
            reviewer: msg.sender,
            score: score,
            note: note,
            timestamp: block.timestamp
        });

        _feedbacks[agentId].push(fb);
        _totalScores[agentId] += score;

        emit FeedbackSubmitted(agentId, msg.sender, score, note, block.timestamp);
    }

    /**
     * @notice Direct authorized submission (e.g. from orchestrator executing on user's behalf)
     */
    function submitFeedbackFor(
        uint256 agentId,
        address reviewer,
        uint8 score,
        string calldata note
    ) external onlyAuthorizedRecorder {
        require(score <= 100, "Score must be 0-100");
        require(reviewer != address(0), "Invalid reviewer");

        Feedback memory fb = Feedback({
            reviewer: reviewer,
            score: score,
            note: note,
            timestamp: block.timestamp
        });

        _feedbacks[agentId].push(fb);
        _totalScores[agentId] += score;

        emit FeedbackSubmitted(agentId, reviewer, score, note, block.timestamp);
    }

    /**
     * @notice Get average score and count. If count == 0, returns (0, 0)
     */
    function getReputation(uint256 agentId) external view returns (uint256 avgScore, uint256 feedbackCount) {
        uint256 count = _feedbacks[agentId].length;
        if (count == 0) {
            return (0, 0);
        }
        return (_totalScores[agentId] / count, count);
    }

    /**
     * @notice Retrieve all feedbacks for an agent
     */
    function getFeedbacks(uint256 agentId) external view returns (Feedback[] memory) {
        return _feedbacks[agentId];
    }
}
