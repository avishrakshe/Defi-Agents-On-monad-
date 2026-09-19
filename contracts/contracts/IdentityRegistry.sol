// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistry
 * @dev ERC-8004 style Agent Identity Registry for Monad Testnet
 * Stores onchain agent profile, skill identifier, endpoint, price, and metadata URI.
 */
contract IdentityRegistry is Ownable {
    struct Agent {
        uint256 id;
        address owner;
        string name;
        string skill;
        string endpoint;
        uint256 priceUSDC; // In 6 decimals (e.g., 1000 = $0.001 USDC)
        string metadataURI;
        uint256 registeredAt;
        bool active;
    }

    uint256 private _nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;
    uint256[] private _agentIds;
    mapping(address => uint256[]) private _ownerToAgentIds;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string skill,
        string name,
        uint256 priceUSDC,
        string endpoint,
        string metadataURI
    );

    event AgentUpdated(
        uint256 indexed agentId,
        string endpoint,
        uint256 priceUSDC,
        string metadataURI,
        bool active
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Register a new autonomous specialist agent
     */
    function registerAgent(
        string calldata name,
        string calldata skill,
        string calldata endpoint,
        uint256 priceUSDC,
        string calldata metadataURI
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(skill).length > 0, "Skill required");
        require(bytes(endpoint).length > 0, "Endpoint required");

        uint256 agentId = _nextAgentId++;

        _agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            name: name,
            skill: skill,
            endpoint: endpoint,
            priceUSDC: priceUSDC,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            active: true
        });

        _agentIds.push(agentId);
        _ownerToAgentIds[msg.sender].push(agentId);

        emit AgentRegistered(
            agentId,
            msg.sender,
            skill,
            name,
            priceUSDC,
            endpoint,
            metadataURI
        );

        return agentId;
    }

    /**
     * @notice Update agent details (owner only)
     */
    function updateAgent(
        uint256 agentId,
        string calldata endpoint,
        uint256 priceUSDC,
        string calldata metadataURI,
        bool active
    ) external {
        Agent storage agent = _agents[agentId];
        require(agent.id != 0, "Agent does not exist");
        require(agent.owner == msg.sender || msg.sender == owner(), "Not agent owner");

        agent.endpoint = endpoint;
        agent.priceUSDC = priceUSDC;
        agent.metadataURI = metadataURI;
        agent.active = active;

        emit AgentUpdated(agentId, endpoint, priceUSDC, metadataURI, active);
    }

    /**
     * @notice Get single agent by ID
     */
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        require(_agents[agentId].id != 0, "Agent does not exist");
        return _agents[agentId];
    }

    /**
     * @notice Return all registered agents
     */
    function getAllAgents() external view returns (Agent[] memory) {
        uint256 total = _agentIds.length;
        Agent[] memory list = new Agent[](total);
        for (uint256 i = 0; i < total; i++) {
            list[i] = _agents[_agentIds[i]];
        }
        return list;
    }

    /**
     * @notice Total number of registered agents
     */
    function getAgentCount() external view returns (uint256) {
        return _agentIds.length;
    }

    /**
     * @notice Check if agent is valid and active
     */
    function isAgentActive(uint256 agentId) external view returns (bool) {
        return _agents[agentId].active;
    }
}
