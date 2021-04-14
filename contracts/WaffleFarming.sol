pragma solidity 0.6.4;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WaffleFarming {
    using SafeMath for uint256;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. WAFs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that WAFs distribution occurs.
        uint256 accWafPerShare; // Accumulated Waffles per share, times 1e12. See below.
    }

    // The REWARD TOKEN
    IERC20 public rewardToken;

    uint256 public rewardPerBlock;

    // Info of each pool.
    PoolInfo public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (address => UserInfo) public userInfo;
    // Max amount to stake
    uint256 public limitAmount; 
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when WAF mining starts.
    uint256 public startBlock;
    // The block number when WAF mining ends.
    uint256 public bonusEndBlock;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(
        IERC20 _lp,
        IERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock,
        uint256 _limitAmount
    ) public {
        require(_lp != _rewardToken, "LP and Reward must be different");
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;
        limitAmount = _limitAmount;

        // staking pool
        poolInfo = PoolInfo({
            lpToken: _lp,
            allocPoint: 1000,
            lastRewardBlock: startBlock,
            accWafPerShare: 0
        });

        totalAllocPoint = 1000;

    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from);
        } else if (_from >= bonusEndBlock) {
            return 0;
        } else {
            return bonusEndBlock.sub(_from);
        }
    }

    // View function to see pending Reward on frontend.
    function pendingReward(address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[_user];
        uint256 accWafPerShare = pool.accWafPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 wafReward = multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accWafPerShare = accWafPerShare.add(wafReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accWafPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables 
    function updatePool() public {
        PoolInfo storage pool = poolInfo;
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 wafReward = multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accWafPerShare = pool.accWafPerShare.add(wafReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }


    // Stake tokens to SmartChef
    function deposit(uint256 amount) public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];

        require(user.amount.add(amount) <= limitAmount, 'exceed the top');

        updatePool();
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accWafPerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                IERC20(rewardToken).transfer(address(msg.sender), pending);
            }
        }
        if(amount > 0) {
            IERC20(pool.lpToken).transferFrom(msg.sender, address(this), amount);
            user.amount = user.amount.add(amount);
        }
        user.rewardDebt = user.amount.mul(pool.accWafPerShare).div(1e12);

        emit Deposit(msg.sender, amount);
    }

    // Withdraw tokens from STAKING.
    function withdraw(uint256 _amount) public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: too much amount");
        updatePool();
        uint256 pending = user.amount.mul(pool.accWafPerShare).div(1e12).sub(user.rewardDebt);
        if(pending > 0) {
            rewardToken.transfer(address(msg.sender), pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            IERC20(pool.lpToken).transfer(msg.sender, _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accWafPerShare).div(1e12);

        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];
        pool.lpToken.transfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

}