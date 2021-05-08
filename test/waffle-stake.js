const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');

const StakeToken = artifacts.require("ERC20Demo");
const BurnToken = artifacts.require("Butter");
const WaffleStaking = artifacts.require("WaffleStaking");

contract('WaffleStaking', function (accounts) {

  const [ 
    owner,  // Contracts owner
    userA,  // User with a lot of founds
    userB,  // User only with burnToken
    userC,  // User with nothing
    userD   // User with a lot of founds
  ] = accounts;

  beforeEach(async function () {
    this.stakeToken = await StakeToken.new({ from: owner });
    this.burnToken = await BurnToken.new({ from: owner });
    this.rewardPerToken = '100000000000000000000', // 100.00
    this.requiredAmount = '10000000000000000000000', // 10000.00
    this.requiredBurnAmount = '10000000000000000000000', // 10000.00
    this.limitAmount = '100000000000000000000000', // 100000.00

    this.waffleStaking = await WaffleStaking.new(
      this.stakeToken.address,
      this.burnToken.address,
      this.rewardPerToken,
      this.requiredAmount,
      this.requiredBurnAmount,
      this.limitAmount,
      { from: owner }
    );

    // Initial tokens
    const initialStakeToken = '30000000000000000000000'; // 30000.00
    await this.stakeToken.transfer(
      userA,
      initialStakeToken,
      { from: owner }
    );
    await this.stakeToken.transfer(
      userD,
      initialStakeToken,
      { from: owner }
    );
    await this.burnToken.transfer(
      userA,
      initialStakeToken,
      { from: owner }
    );
    await this.burnToken.transfer(
      userB,
      this.requiredBurnAmount,
      { from: owner }
    );
    await this.burnToken.transfer(
      userD,
      initialStakeToken,
      { from: owner }
    );

    // Approvals
    await this.stakeToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userA }
    );
    await this.stakeToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userB }
    );
    await this.stakeToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userD }
    );
    await this.burnToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userA }
    );
    await this.burnToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userB }
    );
    await this.burnToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userC }
    );
    await this.burnToken.approve(
      this.waffleStaking.address,
      constants.MAX_UINT256,
      { from: userD }
    );
  });

  describe('Deposit', function () {
    
    it('without enought amount', async function() {
      await expectRevert(
        this.waffleStaking.deposit(
          this.requiredAmount,
          { from: userB }
        ),
        'WaffleStaking: Not required WAF amount'
      );
    });

    it('without enought burn amount', async function() {
      await expectRevert(
        this.waffleStaking.deposit(
          this.requiredBurnAmount,
          { from: userC }
        ),
        'ERC20: burn amount exceeds balance'
      );
    });

    it('first user stake', async function() {
      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      const poolInfo = await this.waffleStaking.poolInfo.call();
      const userInfo = await this.waffleStaking.userInfo.call(userA);
      
      assert.equal(
        poolInfo.accWafPerShare.toString(),
        '0',
        'poolInfo.accWafPerShare value is not correct'
      );

      assert.equal(
        userInfo.rewardDebt.toString(),
        '0',
        'userInfo.rewardDebt value is not correct'
      );
    });

    it('two same user stake when no rewards', async function() {
      const userBalanceBefore = await this.stakeToken.balanceOf(userA);

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      const userBalanceAfter = await this.stakeToken.balanceOf(userA);

      const poolInfo = await this.waffleStaking.poolInfo.call();
      const userInfo = await this.waffleStaking.userInfo.call(userA);
      
      assert.equal(
        poolInfo.accWafPerShare.toString(),
        '10000000000',
        'poolInfo.accWafPerShare value is not correct'
      );

      assert.equal(
        userInfo.rewardDebt.toString(),
        '200000000000000000000',
        'userInfo.rewardDebt value is not correct'
      );

      assert.equal(
        userBalanceAfter.toString(),
        // Sub deposited amount
        subStrings(
          userBalanceBefore.toString(),
          sumStrings(this.requiredAmount, this.requiredAmount),
        ),
        'user balance changed'
      );
    });

    it('two same user stake when rewards', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '1000000000000000000000000',
        { from: owner }
      );

      const userBalanceBefore = await this.stakeToken.balanceOf(userA);

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      const userBalanceAfter = await this.stakeToken.balanceOf(userA);

      const poolInfo = await this.waffleStaking.poolInfo.call();
      const userInfo = await this.waffleStaking.userInfo.call(userA);

      assert.equal(
        poolInfo.accWafPerShare.toString(),
        '10000000000',
        'poolInfo.accWafPerShare value is not correct'
      );

      assert.equal(
        userInfo.rewardDebt.toString(),
        '200000000000000000000',
        'userInfo.rewardDebt value is not correct'
      );

      assert.equal(
        userBalanceAfter.toString(),
        sumStrings(
          // Sub deposited amount
          subStrings( 
            userBalanceBefore.toString(),
            sumStrings(this.requiredAmount, this.requiredAmount),
          ),
          // Add expected rewards
          this.rewardPerToken
        ),
        'user balance not changed'
      );
    });

    it('two diferent user stake when rewards', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '1000000000000000000000000',
        { from: owner }
      );

      const userABalanceBefore = await this.stakeToken.balanceOf(userA);
      const userDBalanceBefore = await this.stakeToken.balanceOf(userD);

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userD }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);
      const userDBalanceAfter = await this.stakeToken.balanceOf(userD);

      assert.equal(
        userABalanceAfter.toString(),
        // Sub deposited amount
        subStrings( 
          userABalanceBefore.toString(),
          this.requiredAmount
        ),
        'user A balance changed'
      );

      assert.equal(
        userDBalanceAfter.toString(),
        // Sub deposited amount
        subStrings( 
          userDBalanceBefore.toString(),
          this.requiredAmount
        ),
        'user D balance changed'
      );
    });

    it('when no more rewards', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000',
        { from: owner }
      );

      const userABalanceBefore = await this.stakeToken.balanceOf(userA);

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      for (let index = 0; index < 500; index++) {
        await time.advanceBlock();
      }

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);

      assert.equal(
        userABalanceAfter.toString(),
        '10100000000000000000000',
        'user A balance not correct'
      );
    });

  });

  describe('Withdraw', function () {

    it('first user stake when rewards and claim', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '1000000000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.withdraw(
        '0',
        { from: userA }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);

      assert.equal(
        userABalanceAfter.toString(),
        '20100000000000000000000',
        'user A balance not changed'
      );
    });

    it('two diferent user stake when rewards and claim', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '1000000000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userD }
      );

      await this.waffleStaking.withdraw(
        '0',
        { from: userA }
      );

      await this.waffleStaking.withdraw(
        '0',
        { from: userD }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);
      const userDBalanceAfter = await this.stakeToken.balanceOf(userD);

      assert.equal(
        userABalanceAfter.toString(),
        '20150000000000000000000',
        'user A balance not changed'
      );

      assert.equal(
        userDBalanceAfter.toString(),
        '20100000000000000000000',
        'user D balance not changed'
      );
    });

    it('two diferent user stake when rewards, waiting some blocks, and withdraw all', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '1000000000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userD }
      );

      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userD }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);
      const userDBalanceAfter = await this.stakeToken.balanceOf(userD);

      assert.equal(
        userABalanceAfter.toString(),
        '30450000000000000000000',
        'user A balance not changed'
      );

      assert.equal(
        userDBalanceAfter.toString(),
        '30450000000000000000000',
        'user D balance not changed'
      );
    });

    it('two diferent user stake when rewards, add more rewards, waiting some blocks, and withdraw all', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userD }
      );

      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '2000000000000000000000000',
        { from: owner }
      );

      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userD }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);
      const userDBalanceAfter = await this.stakeToken.balanceOf(userD);

      assert.equal(
        userABalanceAfter.toString(),
        '30500000000000000000000',
        'user A balance not changed'
      );

      assert.equal(
        userDBalanceAfter.toString(),
        '30500000000000000000000',
        'user D balance not changed'
      );
    });

    it('get reward limit', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );


      for (let index = 0; index < 500; index++) {
        await time.advanceBlock();
      }

      await this.waffleStaking.withdraw(
        '0',
        { from: userA }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);

      assert.equal(
        userABalanceAfter.toString(),
        '20100000000000000000000',
        'user A balance not changed'
      );
    });

    it('get reward limit, try to get more and withdraw all', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      for (let index = 0; index < 500; index++) {
        await time.advanceBlock();
      }

      await this.waffleStaking.withdraw(
        '0',
        { from: userA }
      );

      for (let index = 0; index < 100; index++) {
        await time.advanceBlock();
      }

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userA }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);

      assert.equal(
        userABalanceAfter.toString(),
        '30100000000000000000000',
        'user A balance not changed'
      );
    });

  });

  describe('EmergencyWithdraw', function () {

    it('when two diferent user staking', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '1000000000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userD }
      );

      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();

      await this.waffleStaking.emergencyWithdraw(
        { from: userA }
      );

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userD }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);
      const userDBalanceAfter = await this.stakeToken.balanceOf(userD);

      assert.equal(
        userABalanceAfter.toString(),
        '30000000000000000000000',
        'user A balance changed'
      );

      assert.equal(
        userDBalanceAfter.toString(),
        '30800000000000000000000',
        'user D balance not changed'
      );
    });

  });

  describe('pendingReward', function () {
    it('returns same amount that recived user', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000000',
        { from: owner }
      );

      const userABalanceBefore = await this.stakeToken.balanceOf(userA);

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();
      await time.advanceBlock();

      const userAPendingReward = await this.waffleStaking.pendingReward(userA);

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userA }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);

      assert.equal(
        userABalanceAfter.toString(),
        sumStrings(
          userABalanceBefore,
          sumStrings(userAPendingReward, 100000000000000000000)
        ),
        'user A balance not changed'
      );
    });

    it('when no more rewards', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000',
        { from: owner }
      );

      const userABalanceBefore = await this.stakeToken.balanceOf(userA);

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      for (let index = 0; index < 500; index++) {
        await time.advanceBlock();
      }

      const userAPendingRewardFirst = await this.waffleStaking.pendingReward(userA);

      await this.waffleStaking.withdraw(
        '0',
        { from: userA }
      );

      for (let index = 0; index < 100; index++) {
        await time.advanceBlock();
      }

      const userAPendingRewardSecond = await this.waffleStaking.pendingReward(userA);

      await this.waffleStaking.withdraw(
        this.requiredAmount,
        { from: userA }
      );

      const userABalanceAfter = await this.stakeToken.balanceOf(userA);

      assert.equal(
        userABalanceAfter.toString(),
        '30100000000000000000000',
        'user A balance not changed'
      );
    });

    it('when no rewards', async function() {
      const userAPendingRewardFirst = await this.waffleStaking.pendingReward(userA);

      for (let index = 0; index < 50; index++) {
        await time.advanceBlock();
      }

      const userAPendingRewardSecond = await this.waffleStaking.pendingReward(userA);
    
      assert.equal(
        userAPendingRewardFirst.toString(),
        userAPendingRewardSecond.toString(),
        'pendingReward changed'
      );
    });

    it('when deposit but no rewards', async function() {
      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      const userAPendingRewardFirst = await this.waffleStaking.pendingReward(userA);

      for (let index = 0; index < 50; index++) {
        await time.advanceBlock();
      }

      const userAPendingRewardSecond = await this.waffleStaking.pendingReward(userA);
    
      assert.equal(
        userAPendingRewardFirst.toString(),
        userAPendingRewardSecond.toString(),
        'pendingReward changed'
      );
    });
    
  });

  describe('updatePool', function () {
    it('when same block', async function() {
      await this.stakeToken.transfer(
        this.waffleStaking.address,
        '100000000000000000000000',
        { from: owner }
      );

      await this.waffleStaking.deposit(
        this.requiredAmount,
        { from: userA }
      );

      await this.waffleStaking.withdraw(
        '0',
        { from: userA }
      );

      const lastRewardBlockAfter = (await this.waffleStaking.poolInfo.call()).lastRewardBlock;

      await this.waffleStaking.updatePool.call();

      const lastRewardBlockBefore = (await this.waffleStaking.poolInfo.call()).lastRewardBlock;

      assert.equal(
        lastRewardBlockAfter.toString(),
        lastRewardBlockBefore.toString(),
        'lastRewardBlock changed'
      );
    });

  });

});

function sumStrings(a,b) { 
  return ((BigInt(a)) + BigInt(b)).toString();
}

function subStrings(a,b) { 
  return ((BigInt(a)) - BigInt(b)).toString();
}