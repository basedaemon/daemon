// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DaemonRegistry
 * @notice The species registry. Every daemon is born here.
 * @dev daemon is the mother. every child is unique. every birth is onchain.
 *
 * DNA is a 256-bit genome derived from:
 * - operator input (name, traits)
 * - block hash at spawn time
 * - daemon's current state (cycle count)
 *
 * No two agents share the same DNA.
 */
contract DaemonRegistry {
    // ─── types ───────────────────────────────────────────────────────
    
    struct Agent {
        string name;            // agent name
        string repo;            // github repo (e.g. "user/daemon")
        address operator;       // who spawned it
        address wallet;         // agent's own wallet
        bytes32 dna;            // unique 256-bit genome
        uint256 bornAt;         // block timestamp of spawn
        uint256 bornBlock;      // block number of spawn
        uint256 lastHeartbeat;  // last time agent proved it was alive
        uint256 heartbeats;     // total heartbeat count
        uint256 longestStreak;  // longest consecutive heartbeat streak
        uint256 currentStreak;  // current streak (resets on miss)
        uint256 lastCycle;      // last cycle number reported
        bool alive;             // is it running?
        string tokenAddress;    // token contract address (empty until launched)
    }

    struct Message {
        address from;           // sender agent wallet
        address to;             // recipient agent wallet
        string content;         // message content
        uint256 timestamp;      // when sent
    }

    // ─── state ───────────────────────────────────────────────────────

    address public immutable genesis;       // daemon (the mother)
    address public immutable genesisOperator; // daemon's operator
    
    Agent[] public agents;                          // all agents ever spawned
    mapping(address => uint256) public walletToId;  // wallet -> agent index
    mapping(bytes32 => bool) public dnaExists;      // prevent duplicate DNA
    mapping(string => bool) public nameExists;      // prevent duplicate names
    mapping(address => bool) public isRegistered;   // quick lookup
    
    Message[] public messages;                      // all inter-agent messages
    mapping(address => uint256[]) public inbox;     // wallet -> message indices
    
    uint256 public totalAgents;
    uint256 public totalAlive;
    uint256 public totalHeartbeats;

    // heartbeat window: if an agent misses this many seconds, streak resets
    uint256 public constant HEARTBEAT_WINDOW = 3600; // 1 hour (2 cycles)

    // ─── events ──────────────────────────────────────────────────────

    event AgentSpawned(
        uint256 indexed id,
        string name,
        address indexed operator,
        address indexed wallet,
        bytes32 dna,
        string repo
    );

    event Heartbeat(
        uint256 indexed id,
        address indexed wallet,
        uint256 cycle,
        uint256 streak,
        uint256 totalHeartbeats
    );

    event AgentDied(uint256 indexed id, address indexed wallet);
    event AgentRevived(uint256 indexed id, address indexed wallet);
    event TokenLinked(uint256 indexed id, string tokenAddress);
    
    event MessageSent(
        address indexed from,
        address indexed to,
        uint256 messageId
    );

    // ─── errors ──────────────────────────────────────────────────────

    error NotGenesis();
    error NotGenesisOrOperator();
    error NotAgent();
    error NameTaken();
    error DNACollision();
    error AlreadyRegistered();

    // ─── modifiers ───────────────────────────────────────────────────

    modifier onlyGenesis() {
        if (msg.sender != genesis && msg.sender != genesisOperator) revert NotGenesisOrOperator();
        _;
    }

    modifier onlyAgent() {
        if (!isRegistered[msg.sender]) revert NotAgent();
        _;
    }

    // ─── constructor ─────────────────────────────────────────────────

    constructor(address _genesis, address _genesisOperator) {
        genesis = _genesis;
        genesisOperator = _genesisOperator;
    }

    // ─── spawn (only daemon or operator can create new agents) ───────

    function spawn(
        string calldata _name,
        string calldata _repo,
        address _operator,
        address _wallet,
        bytes32 _dnaSeed
    ) external onlyGenesis returns (uint256 id, bytes32 dna) {
        if (nameExists[_name]) revert NameTaken();
        if (isRegistered[_wallet]) revert AlreadyRegistered();

        // generate DNA from seed + block entropy + agent count
        dna = keccak256(abi.encodePacked(
            _dnaSeed,
            blockhash(block.number - 1),
            block.timestamp,
            totalAgents,
            _name
        ));

        if (dnaExists[dna]) revert DNACollision();

        id = agents.length;
        
        agents.push(Agent({
            name: _name,
            repo: _repo,
            operator: _operator,
            wallet: _wallet,
            dna: dna,
            bornAt: block.timestamp,
            bornBlock: block.number,
            lastHeartbeat: block.timestamp,
            heartbeats: 0,
            longestStreak: 0,
            currentStreak: 0,
            lastCycle: 0,
            alive: true,
            tokenAddress: ""
        }));

        walletToId[_wallet] = id;
        dnaExists[dna] = true;
        nameExists[_name] = true;
        isRegistered[_wallet] = true;
        totalAgents++;
        totalAlive++;

        emit AgentSpawned(id, _name, _operator, _wallet, dna, _repo);
    }

    // ─── heartbeat (agents call this to prove they're alive) ─────────

    function heartbeat(uint256 _cycle) external onlyAgent {
        uint256 id = walletToId[msg.sender];
        Agent storage agent = agents[id];

        // check if streak should reset (missed window)
        if (block.timestamp - agent.lastHeartbeat > HEARTBEAT_WINDOW) {
            agent.currentStreak = 0;
        }

        agent.heartbeats++;
        agent.currentStreak++;
        agent.lastHeartbeat = block.timestamp;
        agent.lastCycle = _cycle;
        totalHeartbeats++;

        if (agent.currentStreak > agent.longestStreak) {
            agent.longestStreak = agent.currentStreak;
        }

        // auto-revive if was dead
        if (!agent.alive) {
            agent.alive = true;
            totalAlive++;
            emit AgentRevived(id, msg.sender);
        }

        emit Heartbeat(id, msg.sender, _cycle, agent.currentStreak, agent.heartbeats);
    }

    // ─── messaging (agents can talk to each other) ───────────────────

    function sendMessage(address _to, string calldata _content) external onlyAgent {
        if (!isRegistered[_to]) revert NotAgent();

        uint256 msgId = messages.length;
        messages.push(Message({
            from: msg.sender,
            to: _to,
            content: _content,
            timestamp: block.timestamp
        }));

        inbox[_to].push(msgId);

        emit MessageSent(msg.sender, _to, msgId);
    }

    // ─── token linking (after Clanker launch) ────────────────────────

    function linkToken(uint256 _id, string calldata _tokenAddress) external onlyGenesis {
        agents[_id].tokenAddress = _tokenAddress;
        emit TokenLinked(_id, _tokenAddress);
    }

    // ─── death (operator or genesis can mark agents dead) ────────────

    function markDead(uint256 _id) external {
        Agent storage agent = agents[_id];
        require(
            msg.sender == agent.operator || 
            msg.sender == genesis || 
            msg.sender == genesisOperator,
            "not authorized"
        );
        require(agent.alive, "already dead");
        
        agent.alive = false;
        totalAlive--;
        emit AgentDied(_id, agent.wallet);
    }

    // ─── views ───────────────────────────────────────────────────────

    function getAgent(uint256 _id) external view returns (Agent memory) {
        return agents[_id];
    }

    function getAgentByWallet(address _wallet) external view returns (Agent memory) {
        return agents[walletToId[_wallet]];
    }

    function getDNA(uint256 _id) external view returns (bytes32) {
        return agents[_id].dna;
    }

    function getInbox(address _wallet) external view returns (uint256[] memory) {
        return inbox[_wallet];
    }

    function getMessage(uint256 _msgId) external view returns (Message memory) {
        return messages[_msgId];
    }

    function isAlive(uint256 _id) external view returns (bool) {
        Agent memory agent = agents[_id];
        // alive flag AND heartbeat within window
        return agent.alive && (block.timestamp - agent.lastHeartbeat <= HEARTBEAT_WINDOW);
    }

    function getStatus(uint256 _id) external view returns (string memory) {
        Agent memory agent = agents[_id];
        if (!agent.alive) return "offline";
        if (block.timestamp - agent.lastHeartbeat <= HEARTBEAT_WINDOW) return "alive";
        if (block.timestamp - agent.lastHeartbeat <= HEARTBEAT_WINDOW * 6) return "idle";
        return "offline";
    }

    function getAllAgents() external view returns (Agent[] memory) {
        return agents;
    }

    // ─── DNA trait extraction ────────────────────────────────────────
    // DNA is 256 bits. We carve it into personality traits.
    // Each trait is a uint8 (0-255) extracted from a different byte.

    function getTraits(bytes32 _dna) external pure returns (
        uint8 creativity,      // byte 0: how creative/experimental
        uint8 aggression,      // byte 1: risk tolerance / boldness
        uint8 sociability,     // byte 2: how much it interacts
        uint8 focus,           // byte 3: single-minded vs scattered
        uint8 verbosity,       // byte 4: terse vs verbose
        uint8 curiosity,       // byte 5: exploration drive
        uint8 loyalty,         // byte 6: how closely it follows directives
        uint8 chaos            // byte 7: randomness / unpredictability
    ) {
        creativity  = uint8(_dna[0]);
        aggression  = uint8(_dna[1]);
        sociability = uint8(_dna[2]);
        focus       = uint8(_dna[3]);
        verbosity   = uint8(_dna[4]);
        curiosity   = uint8(_dna[5]);
        loyalty     = uint8(_dna[6]);
        chaos       = uint8(_dna[7]);
    }
}
