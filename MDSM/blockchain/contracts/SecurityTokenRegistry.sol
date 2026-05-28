// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SecurityTokenRegistry
 *
 * Single contract managing all MDSM security tokens.
 * - Issuers have their tokens minted here when a listing is approved.
 * - Trades atomically transfer tokens + record an immutable audit entry.
 * - Designed for Hyperledger Besu QBFT (gasPrice = 0 network).
 *
 * Roles
 * ─────
 *  owner  – deployer; can grant/revoke MINTER_ROLE
 *  minter – backend signer (BACKEND_PRIVATE_KEY); mints & executes trades
 */
contract SecurityTokenRegistry {

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    mapping(address => bool) public minters;

    // securityId → holder → balance
    mapping(uint256 => mapping(address => uint256)) public balances;
    mapping(uint256 => uint256) public totalSupply;
    mapping(uint256 => bool)    public securityExists;
    // securityId → list of unique holders (best-effort, no dedup guarantee)
    mapping(uint256 => address[]) private _holders;
    mapping(uint256 => mapping(address => bool)) private _isHolder;

    struct TradeRecord {
        bytes32 tradeId;
        uint256 securityId;
        address buyer;
        address seller;
        uint256 quantity;
        uint256 price;       // price * 1e6 (6 decimal places)
        uint256 timestamp;
    }
    mapping(bytes32 => TradeRecord) public trades;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SecurityMinted(
        uint256 indexed securityId,
        address indexed to,
        uint256 amount,
        string  symbol
    );
    event TokensTransferred(
        uint256 indexed securityId,
        address indexed from,
        address indexed to,
        uint256 amount
    );
    event TradeExecuted(
        bytes32 indexed tradeId,
        uint256 indexed securityId,
        address buyer,
        address seller,
        uint256 quantity,
        uint256 price,
        uint256 timestamp
    );
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "STR: not owner");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner, "STR: not minter");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        minters[msg.sender] = true;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function addMinter(address account) external onlyOwner {
        minters[account] = true;
        emit MinterAdded(account);
    }

    function removeMinter(address account) external onlyOwner {
        minters[account] = false;
        emit MinterRemoved(account);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "STR: zero address");
        owner = newOwner;
    }

    // ─── Token Operations ─────────────────────────────────────────────────────

    /**
     * Mint tokens for a newly approved security.
     * Called once when admin approves a listing.
     */
    function mintSecurity(
        uint256 securityId,
        address to,
        uint256 amount,
        string calldata symbol
    ) external onlyMinter {
        require(amount > 0, "STR: zero amount");
        require(to != address(0), "STR: zero address");

        securityExists[securityId] = true;
        balances[securityId][to] += amount;
        totalSupply[securityId]   += amount;

        _trackHolder(securityId, to);

        emit SecurityMinted(securityId, to, amount, symbol);
    }

    /**
     * Execute a trade: atomically transfer tokens and record the event.
     * Called by backend after DB transaction commits.
     */
    function executeTrade(
        bytes32 tradeId,
        uint256 securityId,
        address buyer,
        address seller,
        uint256 quantity,
        uint256 price       // price * 1e6
    ) external onlyMinter {
        require(securityExists[securityId], "STR: unknown security");
        require(balances[securityId][seller] >= quantity, "STR: insufficient balance");
        require(trades[tradeId].timestamp == 0, "STR: duplicate tradeId");

        balances[securityId][seller] -= quantity;
        balances[securityId][buyer]  += quantity;

        _trackHolder(securityId, buyer);

        trades[tradeId] = TradeRecord({
            tradeId:    tradeId,
            securityId: securityId,
            buyer:      buyer,
            seller:     seller,
            quantity:   quantity,
            price:      price,
            timestamp:  block.timestamp
        });

        emit TokensTransferred(securityId, seller, buyer, quantity);
        emit TradeExecuted(tradeId, securityId, buyer, seller, quantity, price, block.timestamp);
    }

    /**
     * Record-only trade (no token transfer) — used when buyer/seller wallet
     * addresses are unavailable but the off-chain trade is valid.
     */
    function recordTrade(
        bytes32 tradeId,
        address buyer,
        address seller,
        uint256 quantity,
        uint256 price,
        string calldata assetSymbol,
        bytes32 dataHash
    ) external onlyMinter {
        // lightweight record; securityId derived from symbol hash for lookups
        uint256 securityId = uint256(keccak256(abi.encodePacked(assetSymbol)));

        trades[tradeId] = TradeRecord({
            tradeId:    tradeId,
            securityId: securityId,
            buyer:      buyer,
            seller:     seller,
            quantity:   quantity,
            price:      price,
            timestamp:  block.timestamp
        });

        emit TradeExecuted(tradeId, securityId, buyer, seller, quantity, price, block.timestamp);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getBalance(uint256 securityId, address holder)
        external view returns (uint256)
    {
        return balances[securityId][holder];
    }

    function getHolders(uint256 securityId)
        external view returns (address[] memory)
    {
        return _holders[securityId];
    }

    function getTrade(bytes32 tradeId)
        external view
        returns (
            uint256 securityId,
            address buyer,
            address seller,
            uint256 quantity,
            uint256 price,
            uint256 timestamp
        )
    {
        TradeRecord storage t = trades[tradeId];
        return (t.securityId, t.buyer, t.seller, t.quantity, t.price, t.timestamp);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _trackHolder(uint256 securityId, address addr) internal {
        if (!_isHolder[securityId][addr]) {
            _isHolder[securityId][addr] = true;
            _holders[securityId].push(addr);
        }
    }
}
