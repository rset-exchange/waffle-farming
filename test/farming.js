const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const ERC20 = artifacts.require("ERC20Demo");
const ERC20_2 = artifacts.require("ERC20Demo2");
const WaffleFarming = artifacts.require("WaffleFarming");

let snapshotId;

advanceTime = () => {
  return new Promise((resolve, reject) => {
      web3.currentProvider.send({
          jsonrpc: "2.0",
          method: "evm_mine",
          params: [],
          id: new Date().getTime()
      }, (err, result) => {
        return resolve(result);
      });
  });
}

restoreSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_revert", params: [snapshotId]}, () => {
      resolve();
    });
  })
}

takeSnapshot = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_snapshot"}, (err, result) => {
      snapshotId = result.result;
      resolve();
    });
  })
}

contract('Waffle Farming', function (accounts) {
  beforeEach(async function () {    
    this.erc20 = await ERC20.new({from: accounts[0]});
    this.erc20_2 = await ERC20_2.new({from: accounts[0]});
    let block = await web3.eth.getBlock("latest");
    this.farming = await WaffleFarming.new(
      this.erc20.address,
      this.erc20_2.address,
      '500000000000000000',
      block.number,
      block.number + 2000,
      '1000000000000000000000',
      {from: accounts[0]}
    );
    this.erc20_2.transfer(this.farming.address, '1000000000000000000000', {from: accounts[0]});
    this.erc20.transfer(accounts[1], '10000000000000000000000', {from: accounts[0]});
    this.erc20.transfer(accounts[2], '10000000000000000000000', {from: accounts[0]});
    await takeSnapshot();
  });

  afterEach(async function () {    
    await restoreSnapshot();
  });
  
  describe('farming', function () {
    it('should deposit and get rewards', async function () {
      await this.erc20.approve(this.farming.address, '1000000000000000000000', {from: accounts[1]});
      await this.erc20.approve(this.farming.address, '1000000000000000000000', {from: accounts[2]});

      await this.farming.deposit('1000000000000000000000', {from:accounts[1]});
      assert.equal((await this.farming.pendingReward(accounts[1])).valueOf(), 0, "Incorrect value");
      await advanceTime();
      assert.equal((await this.farming.pendingReward(accounts[1])).valueOf(), '500000000000000000', "Incorrect value");

      await advanceTime();
      assert.equal((await this.farming.pendingReward(accounts[1])).valueOf(), 500000000000000000+500000000000000000, "Incorrect value");
      await this.farming.deposit('1000000000000000000000', {from:accounts[2]});
      await advanceTime();
      const amount = 500000000000000000+500000000000000000+500000000000000000+250000000000000000;
      assert.equal((await this.farming.pendingReward(accounts[1])).valueOf(), amount, "Incorrect value");
      assert.equal((await this.farming.pendingReward(accounts[2])).valueOf(), 250000000000000000, "Incorrect value");
      assert.equal((await this.erc20_2.balanceOf(accounts[1])).valueOf(), '0', "Incorrect value");
      await this.farming.withdraw('1000000000000000000000', {from: accounts[1]});
      assert.equal((await this.farming.pendingReward(accounts[1])).valueOf(), 0, "Incorrect value");
      assert.equal((await this.erc20_2.balanceOf(accounts[1])).valueOf(), '2000000000000000000', "Incorrect value");
      assert.equal((await this.erc20.balanceOf(accounts[1])).valueOf(), '10000000000000000000000', "Incorrect value");
    });
  });
});
