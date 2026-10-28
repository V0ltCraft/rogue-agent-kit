// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice ROGUE's own onchain .rob namespace, not an Internet DNS registry or
/// a Robinhood-issued credential. One permanent, non-transferable name per wallet.
contract RobIdentity is ERC721 {
    uint256 public constant COMMIT_LIFETIME = 1 days;
    struct Commitment { uint256 blockNumber; uint256 timestamp; }
    mapping(address => mapping(bytes32 => Commitment)) public commitments;
    mapping(address => uint256) public tokenIdOf;
    mapping(uint256 => string) public labelOf;
    mapping(address => address) public agentSignerOf;
    error InvalidName();
    error AlreadyRegistered();
    error NameUnavailable();
    error InvalidAgentSigner();
    error CommitmentNotReady();
    error CommitmentExpired();
    error Soulbound();
    event Locked(uint256 tokenId);
    event NameCommitted(address indexed account, bytes32 indexed commitment);
    event NameRegistered(address indexed account, uint256 indexed tokenId, string name, address indexed agentSigner);
    event AgentSignerChanged(address indexed account, address indexed previousSigner, address indexed nextSigner);

    constructor() ERC721("ROGUE .rob Identity", "ROB") {}

    function validLabel(string memory label) public pure returns (bool) {
        bytes memory b = bytes(label);
        if (b.length < 3 || b.length > 24 || b[0] == 0x2d || b[b.length - 1] == 0x2d) return false;
        for (uint256 i; i < b.length; i++) {
            bytes1 c = b[i];
            if (!((c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x2d)) return false;
        }
        return true;
    }
    function available(string calldata label) external view returns (bool) {
        return validLabel(label) && _ownerOf(uint256(keccak256(bytes(label)))) == address(0);
    }
    function makeCommitment(string calldata label, address account, address agentSigner, bytes32 salt) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), block.chainid, account, keccak256(bytes(label)), agentSigner, salt));
    }
    function commit(bytes32 commitment) external {
        if (tokenIdOf[msg.sender] != 0) revert AlreadyRegistered();
        require(commitment != bytes32(0), "Empty commitment");
        commitments[msg.sender][commitment] = Commitment(block.number, block.timestamp);
        emit NameCommitted(msg.sender, commitment);
    }
    function register(string calldata label, address agentSigner, bytes32 salt) external returns (uint256 id) {
        if (!validLabel(label)) revert InvalidName();
        if (tokenIdOf[msg.sender] != 0) revert AlreadyRegistered();
        if (agentSigner == address(0) || agentSigner == msg.sender) revert InvalidAgentSigner();
        id = uint256(keccak256(bytes(label)));
        if (id == 0 || _ownerOf(id) != address(0)) revert NameUnavailable();
        bytes32 commitment = makeCommitment(label, msg.sender, agentSigner, salt);
        Commitment memory c = commitments[msg.sender][commitment];
        if (c.timestamp == 0 || block.number <= c.blockNumber) revert CommitmentNotReady();
        if (block.timestamp > c.timestamp + COMMIT_LIFETIME) revert CommitmentExpired();
        delete commitments[msg.sender][commitment];
        tokenIdOf[msg.sender] = id; labelOf[id] = label; agentSignerOf[msg.sender] = agentSigner;
        _safeMint(msg.sender, id);
        emit Locked(id);
        emit NameRegistered(msg.sender, id, string.concat(label, ".rob"), agentSigner);
    }
    /// @notice Wallet-controlled recovery. Already prepared signatures from the old
    /// agent cease to validate. This does not transfer or rename the identity.
    function setAgentSigner(address nextSigner) external {
        require(tokenIdOf[msg.sender] != 0, "No .rob identity");
        if (nextSigner == address(0) || nextSigner == msg.sender) revert InvalidAgentSigner();
        address previous = agentSignerOf[msg.sender]; agentSignerOf[msg.sender] = nextSigner;
        emit AgentSignerChanged(msg.sender, previous, nextSigner);
    }
    function nameOf(address account) external view returns (string memory) {
        uint256 id = tokenIdOf[account]; return id == 0 ? "" : string.concat(labelOf[id], ".rob");
    }
    function resolve(string calldata fullName) external view returns (address) {
        bytes memory n = bytes(fullName);
        if (n.length < 7 || n[n.length-4] != 0x2e || n[n.length-3] != 0x72 || n[n.length-2] != 0x6f || n[n.length-1] != 0x62) revert InvalidName();
        bytes memory label = new bytes(n.length - 4);
        for (uint256 i; i < label.length; i++) label[i] = n[i];
        if (!validLabel(string(label))) revert InvalidName();
        return _ownerOf(uint256(keccak256(label)));
    }
    function locked(uint256 id) external view returns (bool) { _requireOwned(id); return true; }
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) { return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId); }
    function approve(address, uint256) public pure override { revert Soulbound(); }
    function setApprovalForAll(address, bool) public pure override { revert Soulbound(); }
    function _update(address to, uint256 id, address auth) internal override returns (address) {
        if (_ownerOf(id) != address(0)) revert Soulbound();
        return super._update(to, id, auth);
    }
    function tokenURI(uint256 id) public view override returns (string memory) {
        address holder = _requireOwned(id); string memory n = string.concat(labelOf[id], ".rob");
        string memory svg = string.concat('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><rect width="720" height="480" fill="#080a08"/><path d="M44 56h28V28h28v28h28v28h28v112H16V84h28z" fill="#a6ff00"/><path d="M44 112h84v56H44z" fill="#080a08"/><path d="M56 128h16v16H56zm44 0h16v16h-16z" fill="#a6ff00"/><text x="40" y="300" fill="#f0f3eb" font-family="monospace" font-size="36">', n, '</text><text x="40" y="354" fill="#a6ff00" font-family="monospace" font-size="19">ROGUE / WALLET-BOUND IDENTITY</text><text x="40" y="424" fill="#a3ad9a" font-family="monospace" font-size="14">ONCHAIN NAME / NOT INTERNET DNS</text></svg>');
        string memory json = string.concat('{"name":"', n, '","description":"Wallet-bound ROGUE onchain identity. Not Internet DNS, not Robinhood certification, and not proof of AI inference.","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '","attributes":[{"trait_type":"Namespace","value":".rob"},{"trait_type":"Transferability","value":"Soulbound"},{"trait_type":"Wallet","value":"', Strings.toHexString(holder), '"}]}');
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }
}
