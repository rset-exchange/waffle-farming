pragma solidity 0.6.4;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import "../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IButter.sol";

contract WaffleStaking {
    using SafeMath for uint256;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    // Info of each pool.
    struct PoolInfo {
        uint256 accWafPerShare;     // Accumulated Waffles per share, times 1e12. See below.
        uint256 lastRewardBlock;    // Last block number that WAFs distribution occurs.
    }

    // The REWARD TOKEN
    IERC20 public rewardToken;

    uint256 public rewardPerBlock;
    uint256 public totalStaked;
    uint256 public requiredAmount;
    uint256 public requiredBurnAmount;

    IButter public btr;

    // Info of each pool.
    PoolInfo public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (address => UserInfo) public userInfo;
    // Max amount to stake
    uint256 public limitAmount;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event Log(uint256 amount);

    constructor(
        IERC20 _rewardToken,
        IButter _btr,
        uint256 _rewardPerBlock,
        uint256 _requiredAmount,
        uint256 _requiredBurnAmount,
        uint256 _limitAmount
    ) public {
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        requiredAmount = _requiredAmount;
        requiredBurnAmount = _requiredBurnAmount;
        limitAmount = _limitAmount;
        btr = _btr;

        // staking pool
        poolInfo = PoolInfo({
            accWafPerShare: 0,
            lastRewardBlock: 0
        });
    }

    // View function to see pending Reward on frontend.
    function pendingReward(address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[_user];

        uint256 accWafPerShare = pool.accWafPerShare;

        if (block.number > pool.lastRewardBlock && totalStaked != 0) {
            uint256 multiplier = block.number.sub(pool.lastRewardBlock);
            uint256 wafReward = multiplier.mul(rewardPerBlock);
            accWafPerShare = accWafPerShare.add(wafReward.mul(1e12).div(totalStaked));
        }

        uint256 remainingRewards = (IERC20(rewardToken).balanceOf(address(this))).sub(totalStaked);
        uint256 rewards = user.amount.mul(accWafPerShare).div(1e12).sub(user.rewardDebt);

        if (remainingRewards == 0) {
            rewards = 0;
        } else if (rewards > remainingRewards) {
            rewards = remainingRewards;
        }

        return rewards;
    }

    // Update reward variables 
    function updatePool() public {
        PoolInfo storage pool = poolInfo;

        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        if (totalStaked == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = block.number.sub(pool.lastRewardBlock);
        uint256 wafReward = multiplier.mul(rewardPerBlock);
        pool.accWafPerShare = pool.accWafPerShare.add(wafReward.mul(1e12).div(totalStaked));
        pool.lastRewardBlock = block.number;
    }

    // Stake tokens to SmartChef
    function deposit(uint256 amount) public {
        IButter(btr).burnFrom(msg.sender, requiredBurnAmount);

        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];

        require(IERC20(rewardToken).balanceOf(address(msg.sender)) >= requiredAmount, 'WaffleStaking: Not required WAF amount');
        require(user.amount.add(amount) <= limitAmount, 'WaffleStaking: Exceed the top');

        updatePool();

        if (user.amount > 0) {
            uint256 remainingRewards = (IERC20(rewardToken).balanceOf(address(this))).sub(totalStaked);
            uint256 pending = user.amount.mul(pool.accWafPerShare).div(1e12).sub(user.rewardDebt);

            if (remainingRewards == 0) {
                pending = 0;
            } else if (pending > remainingRewards) {
                pending = remainingRewards;
            }

            if (pending > 0) {
                IERC20(rewardToken).transfer(address(msg.sender), pending);
            }
        }
        if (amount > 0) {
            IERC20(rewardToken).transferFrom(msg.sender, address(this), amount);
            user.amount = user.amount.add(amount);
        }
        user.rewardDebt = user.amount.mul(pool.accWafPerShare).div(1e12);

        totalStaked = totalStaked.add(amount);

        emit Deposit(msg.sender, amount);
    }

    // Withdraw tokens from STAKING.
    function withdraw(uint256 _amount) public {
        PoolInfo storage pool = poolInfo;
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "WaffleStaking: Too much amount");

        updatePool();

        uint256 remainingRewards = (IERC20(rewardToken).balanceOf(address(this))).sub(totalStaked);
        uint256 pending = user.amount.mul(pool.accWafPerShare).div(1e12).sub(user.rewardDebt);

        if (remainingRewards == 0) {
            pending = 0;
        } else if (pending > remainingRewards) {
            pending = remainingRewards;
        }

        if(pending > 0) {
            rewardToken.transfer(address(msg.sender), pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            IERC20(rewardToken).transfer(msg.sender, _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accWafPerShare).div(1e12);

        totalStaked = totalStaked.sub(_amount);

        emit Withdraw(msg.sender, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public {
        UserInfo storage user = userInfo[msg.sender];
        
        rewardToken.transfer(address(msg.sender), user.amount);

        emit EmergencyWithdraw(msg.sender, user.amount);

        totalStaked = totalStaked.sub(user.amount);
        
        user.amount = 0;
        user.rewardDebt = 0;
    }

}
