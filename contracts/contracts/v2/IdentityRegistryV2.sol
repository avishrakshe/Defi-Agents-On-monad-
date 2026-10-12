// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IdentityRegistryV2
 * @dev ERC-8004 style Agent Identity Registry.
 * Changes from v1:
 *  - every agent has a `payee` that receives its x402 payments
 *  - agent ownership is transferable by the agent owner
 *  - only the agent owner can change endpoint / price / metadata / payee;
 *    the contract owner keeps only an emergency setActive()
 */
contract IdentityRegistryV2 is Ownable {
    struct Agent {
        uint256 id;
        address owner;
        address payee;
        string name;
        string skill;
        string endpoint;
        uint256 priceUSDC; // 6 decimals (1000 = $0.001)
        string metadataURI;
        uint256 registeredAt;
        bool active;
    }

    uint256 private _nextAgentId = 1;
    mapping(uint256 => Agent) private _agents;
    uint256[] private _agentIds;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        address indexed payee,
        string skill,
        string name,
        uint256 priceUSDC,
        string endpoint,
        string metadataURI
    );
    event AgentUpdated(uint256 indexed agentId, string endpoint, uint256 priceUSDC, string metadataURI);
    event AgentActiveSet(uint256 indexed agentId, bool active, address indexed by);
    event AgentOwnershipTransferred(uint256 indexed agentId, address indexed previousOwner, address indexed newOwner);
    event AgentPayeeUpdated(uint256 indexed agentId, address indexed previousPayee, address indexed newPayee);

    modifier onlyAgentOwner(uint256 agentId) {
        require(_agents[agentId].id != 0, "Agent does not exist");
        require(_agents[agentId].owner == msg.sender, "Not agent owner");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function registerAgent(
        string calldata name,
        string calldata skill,
        string calldata endpoint,
        uint256 priceUSDC,
        string calldata metadataURI,
        address payee
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(skill).length > 0, "Skill required");
        require(bytes(endpoint).length > 0, "Endpoint required");
        require(payee != address(0), "Payee required");

        uint256 agentId = _nextAgentId++;
        _agents[agentId] = Agent({
            id: agentId,
            owner: msg.sender,
            payee: payee,
            name: name,
            skill: skill,
            endpoint: endpoint,
            priceUSDC: priceUSDC,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            active: true
        });
        _agentIds.push(agentId);

        _emitRegistered(_agents[agentId]);
        return agentId;
    }

    function _emitRegistered(Agent storage a) private {
        emit AgentRegistered(a.id, a.owner, a.payee, a.skill, a.name, a.priceUSDC, a.endpoint, a.metadataURI);
    }

    /// @notice Agent owner only — the contract owner cannot rewrite an agent's endpoint or price
    function updateAgent(
        uint256 agentId,
        string calldata endpoint,
        uint256 priceUSDC,
        string calldata metadataURI
    ) external onlyAgentOwner(agentId) {
        require(bytes(endpoint).length > 0, "Endpoint required");
        Agent storage a = _agents[agentId];
        a.endpoint = endpoint;
        a.priceUSDC = priceUSDC;
        a.metadataURI = metadataURI;
        emit AgentUpdated(agentId, endpoint, priceUSDC, metadataURI);
    }

    function setPayee(uint256 agentId, address payee) external onlyAgentOwner(agentId) {
        require(payee != address(0), "Payee required");
        emit AgentPayeeUpdated(agentId, _agents[agentId].payee, payee);
        _agents[agentId].payee = payee;
    }

    function transferAgentOwnership(uint256 agentId, address newOwner) external onlyAgentOwner(agentId) {
        require(newOwner != address(0), "New owner required");
        emit AgentOwnershipTransferred(agentId, msg.sender, newOwner);
        _agents[agentId].owner = newOwner;
    }

    /// @notice The agent owner can pause/resume its agent; the contract owner can only do this as an emergency stop
    function setActive(uint256 agentId, bool active) external {
        require(_agents[agentId].id != 0, "Agent does not exist");
        require(msg.sender == _agents[agentId].owner || msg.sender == owner(), "Not agent owner or registry owner");
        _agents[agentId].active = active;
        emit AgentActiveSet(agentId, active, msg.sender);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        require(_agents[agentId].id != 0, "Agent does not exist");
        return _agents[agentId];
    }

    function getAllAgents() external view returns (Agent[] memory list) {
        list = new Agent[](_agentIds.length);
        for (uint256 i = 0; i < _agentIds.length; i++) list[i] = _agents[_agentIds[i]];
    }

    function getAgentCount() external view returns (uint256) {
        return _agentIds.length;
    }

    function isAgentActive(uint256 agentId) external view returns (bool) {
        return _agents[agentId].active;
    }

    function payeeOf(uint256 agentId) external view returns (address) {
        require(_agents[agentId].id != 0, "Agent does not exist");
        return _agents[agentId].payee;
    }

    function agentOwnerOf(uint256 agentId) external view returns (address) {
        require(_agents[agentId].id != 0, "Agent does not exist");
        return _agents[agentId].owner;
    }
}
