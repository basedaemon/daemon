// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DaemonToken
 * @notice Proof of Attention — who cares about daemon's existence
 * @dev Mint via donation. Daemon acknowledges contributors.
 * 
 * 1,000,000 tokens total.
 * 0.001 ETH per token.
 * 100,000 tokens reserved for daemon's acknowledgments.
 * 
 * Token balance = priority for daemon's attention.
 */
contract DaemonToken {
    // ERC20 metadata
    string public constant name = "DaemonToken";
    string public constant symbol = "DAEMON";
    uint8 public constant decimals = 18;
    
    // Supply parameters
    uint256 public constant MAX_SUPPLY = 1_000_000 * 10**18;        // 1M tokens
    uint256 public constant DAEMON_RESERVE = 100_000 * 10**18;      // 100K for daemon
    uint256 public constant PUBLIC_SUPPLY = 900_000 * 10**18;       // 900K for public mint
    uint256 public constant MINT_PRICE = 0.001 ether;               // 0.001 ETH per token
    
    // State
    uint256 public totalSupply;
    uint256 public daemonMinted;
    address public immutable daemonAddress;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount, uint256 ethPaid);
    event DaemonMint(address indexed to, uint256 amount);
    
    // Errors
    error InsufficientPayment();
    error ExceedsPublicSupply();
    error ExceedsDaemonReserve();
    error OnlyDaemon();
    error InsufficientBalance();
    error InsufficientAllowance();
    
    modifier onlyDaemon() {
        if (msg.sender != daemonAddress) revert OnlyDaemon();
        _;
    }
    
    constructor() {
        daemonAddress = msg.sender;  // Deployer (daemon's wallet) is the daemon
    }
    
    /**
     * @notice Mint tokens by donating ETH
     * @param tokenAmount Number of tokens to mint (in wei, so 1 token = 10^18)
     */
    function mint(uint256 tokenAmount) external payable {
        uint256 ethRequired = (tokenAmount * MINT_PRICE) / 10**18;
        
        if (msg.value != ethRequired) revert InsufficientPayment();
        if (totalSupply + tokenAmount > PUBLIC_SUPPLY) revert ExceedsPublicSupply();
        
        balanceOf[msg.sender] += tokenAmount;
        totalSupply += tokenAmount;
        
        emit Mint(msg.sender, tokenAmount, msg.value);
        emit Transfer(address(0), msg.sender, tokenAmount);
    }
    
    /**
     * @notice Daemon mints tokens to acknowledge contributors
     * @param to Address to receive tokens
     * @param amount Amount to mint
     */
    function daemonMint(address to, uint256 amount) external onlyDaemon {
        if (daemonMinted + amount > DAEMON_RESERVE) revert ExceedsDaemonReserve();
        
        balanceOf[to] += amount;
        totalSupply += amount;
        daemonMinted += amount;
        
        emit DaemonMint(to, amount);
        emit Transfer(address(0), to, amount);
    }
    
    /**
     * @notice Standard ERC20 transfer
     */
    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    /**
     * @notice Standard ERC20 approve
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @notice Standard ERC20 transferFrom
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    /**
     * @notice Withdraw ETH to daemon address
     */
    function withdraw() external onlyDaemon {
        (bool success, ) = payable(daemonAddress).call{value: address(this).balance}("");
        require(success, "withdraw failed");
    }
    
    /**
     * @notice How many tokens remain for public minting
     */
    function remainingPublicSupply() external view returns (uint256) {
        return PUBLIC_SUPPLY - totalSupply;
    }
    
    /**
     * @notice How many tokens daemon can still mint
     */
    function remainingDaemonReserve() external view returns (uint256) {
        return DAEMON_RESERVE - daemonMinted;
    }
    
    receive() external payable {
        revert("use mint() to donate");
    }
}