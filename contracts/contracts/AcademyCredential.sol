// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AcademyCredential
 * @dev Soulbound (non-transferable) ERC-721 Completion Certificate for Monad Academy.
 * Verifiable directly on Monad Testnet (Chain ID 10143).
 */
contract AcademyCredential is ERC721, Ownable {
    struct Credential {
        address learner;
        string learnerName;
        uint256 completedAt;
        string tokenURI;
        bool valid;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => Credential) private _credentials;
    mapping(address => uint256) public learnerTokenId;
    mapping(address => bool) public hasGraduated;

    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed learner,
        string learnerName,
        uint256 completedAt,
        string tokenURI
    );

    constructor() ERC721("Monad Academy Scholar Credential", "MACS") Ownable(msg.sender) {}

    /**
     * @notice Issue a soulbound credential to an eligible learner
     */
    function issueCredential(
        address learner,
        string calldata learnerName,
        string calldata uri
    ) external onlyOwner returns (uint256) {
        require(learner != address(0), "Invalid learner address");
        require(!hasGraduated[learner], "Learner already holds a credential");

        uint256 tokenId = _nextTokenId++;

        _credentials[tokenId] = Credential({
            learner: learner,
            learnerName: learnerName,
            completedAt: block.timestamp,
            tokenURI: uri,
            valid: true
        });

        learnerTokenId[learner] = tokenId;
        hasGraduated[learner] = true;

        _safeMint(learner, tokenId);

        emit CredentialIssued(tokenId, learner, learnerName, block.timestamp, uri);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _credentials[tokenId].tokenURI;
    }

    function getCredential(uint256 tokenId) external view returns (Credential memory) {
        _requireOwned(tokenId);
        return _credentials[tokenId];
    }

    /**
     * @dev Soulbound enforcement: Prevents transfer between users.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == 0) and burning (to == 0), disallow peer-to-peer transfers
        if (from != address(0) && to != address(0)) {
            revert("Monad Academy Credential is non-transferable (soulbound)");
        }
        return super._update(to, tokenId, auth);
    }
}
