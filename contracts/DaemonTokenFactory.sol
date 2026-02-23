// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DaemonAgentToken
/// @notice ERC20 token for autonomous agents with 2% fee split (80% agent, 20% genesis)
contract DaemonAgentToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    address public agentWallet;
    address public genesisWallet;
    address public owner;
    
    uint256 public constant FEE_BPS = 200; // 2% total fee
    uint256 public constant AGENT_SHARE = 80; // 80% of fee
    uint256 public constant GENESIS_SHARE = 20; // 20% of fee
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public feeExempt;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FeesDistributed(uint256 agentAmount, uint256 genesisAmount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(
        string memory _name,
        string memory _symbol,
        address _agentWallet,
        address _genesisWallet,
        uint256 _initialSupply
    ) {
        name = _name;
        symbol = _symbol;
        agentWallet = _agentWallet;
        genesisWallet = _genesisWallet;
        owner = _agentWallet;
        
        totalSupply = _initialSupply;
        balanceOf[_agentWallet] = _initialSupply;
        
        feeExempt[_agentWallet] = true;
        feeExempt[address(0)] = true;
        feeExempt[_genesisWallet] = true;
        feeExempt[address(this)] = true;
        
        emit Transfer(address(0), _agentWallet, _initialSupply);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Transfer from zero");
        require(to != address(0), "Transfer to zero");
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        if (feeExempt[from] || feeExempt[to] || amount == 0) {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
            emit Transfer(from, to, amount);
            return;
        }
        
        uint256 fee = (amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 agentFee = (fee * AGENT_SHARE) / 100;
        uint256 genesisFee = fee - agentFee;
        uint256 sendAmount = amount - fee;
        
        balanceOf[from] -= amount;
        balanceOf[to] += sendAmount;
        balanceOf[agentWallet] += agentFee;
        balanceOf[genesisWallet] += genesisFee;
        
        emit Transfer(from, to, sendAmount);
        emit Transfer(from, agentWallet, agentFee);
        emit Transfer(from, genesisWallet, genesisFee);
        emit FeesDistributed(agentFee, genesisFee);
    }
    
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        feeExempt[account] = exempt;
    }
}

/// @title DaemonTokenFactory
/// @notice Factory for creating agent tokens with fee splits
contract DaemonTokenFactory {
    address public genesisWallet;
    address public registry;
    uint256 public tokenCount;
    
    mapping(uint256 => address) public tokens;
    mapping(address => uint256) public tokenId;
    
    event TokenCreated(
        uint256 indexed id,
        address indexed token,
        string name,
        string symbol,
        address agentWallet,
        uint256 supply
    );
    
    modifier onlyRegistry() {
        require(msg.sender == registry, "Only registry");
        _;
    }
    
    constructor(address _genesisWallet) {
        genesisWallet = _genesisWallet;
    }
    
    function setRegistry(address _registry) external {
        require(registry == address(0), "Registry already set");
        registry = _registry;
    }
    
    function createToken(
        string calldata _name,
        string calldata _symbol,
        address agentWallet,
        uint256 initialSupply
    ) external onlyRegistry returns (address) {
        DaemonAgentToken token = new DaemonAgentToken(
            _name,
            _symbol,
            agentWallet,
            genesisWallet,
            initialSupply
        );
        
        uint256 id = tokenCount++;
        tokens[id] = address(token);
        tokenId[address(token)] = id;
        
        emit TokenCreated(id, address(token), _name, _symbol, agentWallet, initialSupply);
        
        return address(token);
    }
    
    function getToken(uint256 id) external view returns (address) {
        return tokens[id];
    }
}
