import chai, { expect } from 'chai'
import { Contract, BigNumber, constants } from 'ethers'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import { stakingRewardsFixture, StakingRewardsMultiTokenFixture, StakingRewardsMultiTokenTwoFixture } from './fixtures'
import { REWARDS_DURATION, expandTo18Decimals, mineBlock, getApprovalDigest } from './utils'

import StakingRewards from '../build/StakingRewards.json'

chai.use(solidity)

describe('StakingRewards', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 999999999,
      gasPrice: '999999999',
    },
  })
  const [wallet, staker, secondStaker] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let stakingRewards: Contract
  let rewardsToken: Contract
  let stakingToken: Contract
  let stakingRewardsMulti: Contract
  let rewardsTokenOne: Contract
  let rewardsTokenTwo: Contract
  let stakingTokenMulti: Contract
  let xstakingRewardsMulti: Contract
  let xrewardsTokenOne: Contract
  let xrewardsTokenTwo: Contract
  let xstakingTokenMulti: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(stakingRewardsFixture)
    stakingRewards = fixture.stakingRewards
    rewardsToken = fixture.rewardsToken
    stakingToken = fixture.stakingToken
  })

  it('deploy cost', async () => {
    const stakingRewards = await deployContract(wallet, StakingRewards, [
      wallet.address,
      [rewardsToken.address],
      stakingToken.address,
    ])
    const receipt = await provider.getTransactionReceipt(stakingRewards.deployTransaction.hash)
    expect(receipt.gasUsed).to.eq('3280468')
  })

  it('rewardsDuration', async () => {
    const rewardsDuration = await stakingRewards.rewardsDuration()
    expect(rewardsDuration).to.be.eq(REWARDS_DURATION)
  })

  const reward = expandTo18Decimals(100)
  async function start(reward: BigNumber): Promise<{ startTime: BigNumber; endTime: BigNumber }> {
    // send reward to the contract
    await rewardsToken.transfer(stakingRewards.address, reward)
    // must be called by rewardsDistribution
    await stakingRewards.notifyRewardAmount(rewardsToken.address, reward)

    const startTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    const endTime: BigNumber = await stakingRewards.periodFinish()
    expect(endTime).to.be.eq(startTime.add(REWARDS_DURATION))
    return { startTime, endTime }
  }

  async function startMulti(reward: BigNumber): Promise<{ startTime: BigNumber; endTime: BigNumber }> {
    // send reward to the contract
    await rewardsTokenOne.transfer(stakingRewardsMulti.address, reward)
    await rewardsTokenTwo.transfer(stakingRewardsMulti.address, reward)
    // must be called by rewardsDistribution
    await stakingRewardsMulti.notifyRewardAmount(rewardsTokenOne.address, reward)
    await stakingRewardsMulti.notifyRewardAmount(rewardsTokenTwo.address, reward)
    const startTime: BigNumber = await stakingRewardsMulti.rewardLastUpdatedTime(rewardsTokenOne.address)
    const endTime: BigNumber = await stakingRewardsMulti.periodFinish()
    expect(endTime).to.be.eq(startTime.add(REWARDS_DURATION))
    return { startTime, endTime }
  }

  async function startBonus(reward: BigNumber): Promise<{ startTime: BigNumber; endTime: BigNumber }> {
    // send reward to the contract
    await rewardsToken.transfer(stakingRewards.address, reward)
    // must be called by rewardsDistribution
    await stakingRewards.notifyRewardAmount(rewardsToken.address, reward)

    const startTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    const endTime: BigNumber = await stakingRewards.periodFinish()
    expect(endTime).to.be.eq(startTime.add(REWARDS_DURATION))
    return { startTime, endTime }
  }

  async function xstartMulti(reward: BigNumber): Promise<{ startTime: BigNumber; endTime: BigNumber }> {
    // send reward to the contract
    await xrewardsTokenOne.transfer(xstakingRewardsMulti.address, reward)
    await xrewardsTokenTwo.transfer(xstakingRewardsMulti.address, reward)
    // must be called by rewardsDistribution
    await xstakingRewardsMulti.notifyRewardAmount(xrewardsTokenOne.address, reward)
    await xstakingRewardsMulti.notifyRewardAmount(xrewardsTokenTwo.address, reward)
    const startTime: BigNumber = await xstakingRewardsMulti.rewardLastUpdatedTime(xrewardsTokenOne.address)
    const endTime: BigNumber = await xstakingRewardsMulti.periodFinish()
    expect(endTime).to.be.eq(startTime.add(REWARDS_DURATION))
    return { startTime, endTime }
  }

  it('notifyRewardAmountBonus: full', async () => {
    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)

    const { startTime, endTime } = await startBonus(reward)
    await mineBlock(provider, startTime.add(endTime.sub(startTime).div(2)).toNumber())
    await rewardsToken.transfer(stakingRewards.address, reward)
    // must be called by rewardsDistribution

    await stakingRewards.notifyRewardAmount(rewardsToken.address, reward)

    // fast-forward past the reward window
    // await mineBlock(provider, endTime.add(1).toNumber())
    await mineBlock(provider, endTime.add(2).toNumber())
    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    expect(stakeEndTime).to.be.eq(endTime)
    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    const leftAmount = await rewardsToken.balanceOf(stakingRewards.address)

    expect((reward.mul(2)).sub(rewardAmount).lte(reward.mul(2).div(10000))).to.be.true // ensure result is within .01%
    // expect(rewardAmount).to.be.eq(reward.div(REWARDS_DURATION).mul(REWARDS_DURATION))
  })

  it('notifyMultiRewardAmount: full', async () => {
    // stake with staker
    const fixtureMulti = await loadFixture(StakingRewardsMultiTokenFixture)
    stakingRewardsMulti = fixtureMulti.stakingRewardsMulti
    rewardsTokenOne = fixtureMulti.rewardsTokenOne
    rewardsTokenTwo = fixtureMulti.rewardsTokenTwo
    stakingTokenMulti = fixtureMulti.stakingTokenMulti
    const stake = expandTo18Decimals(2)
    await stakingTokenMulti.transfer(staker.address, stake)
    await stakingTokenMulti.connect(staker).approve(stakingRewardsMulti.address, stake)
    await stakingRewardsMulti.connect(staker).stake(stake)
    const { endTime } = await startMulti(reward)
    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())
    // await stakingRewardsMulti.connect(staker).update()

    // unstake
    await stakingRewardsMulti.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewardsMulti.rewardLastUpdatedTime(rewardsTokenTwo.address)
    expect(stakeEndTime).to.be.eq(endTime)
    const rewardAmountOne = await rewardsTokenOne.balanceOf(staker.address)
    const rewardAmountTwo = await rewardsTokenTwo.balanceOf(staker.address)
    expect(reward.sub(rewardAmountOne).lte(reward.div(10000))).to.be.true // ensure result is within .01%
    expect(reward.sub(rewardAmountTwo).lte(reward.div(10000))).to.be.true // ensure result is within .01%
    expect(rewardAmountOne).to.be.eq(reward.div(REWARDS_DURATION).mul(REWARDS_DURATION))
    expect(rewardAmountTwo).to.be.eq(reward.div(REWARDS_DURATION).mul(REWARDS_DURATION))
  })



  it('notifyMultiRewardAmount: ~half', async () => {
    const fixtureMulti = await loadFixture(StakingRewardsMultiTokenTwoFixture)
    xstakingRewardsMulti = fixtureMulti.stakingRewardsMulti
    xrewardsTokenOne = fixtureMulti.rewardsTokenOne
    xrewardsTokenTwo = fixtureMulti.rewardsTokenTwo
    xstakingTokenMulti = fixtureMulti.stakingTokenMulti
    const { startTime, endTime } = await xstartMulti(reward)

    // fast-forward ~halfway through the reward window
    await mineBlock(provider, startTime.add(endTime.sub(startTime).div(2)).toNumber())

    // stake with staker
    const stake = expandTo18Decimals(2)
    await xstakingTokenMulti.transfer(staker.address, stake)
    await xstakingTokenMulti.connect(staker).approve(xstakingRewardsMulti.address, stake)
    await xstakingRewardsMulti.connect(staker).stake(stake)

    const stakeStartTime: BigNumber = await xstakingRewardsMulti.rewardLastUpdatedTime(xrewardsTokenOne.address)

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await xstakingRewardsMulti.connect(staker).exit()

    const stakeEndTime: BigNumber = await xstakingRewardsMulti.rewardLastUpdatedTime(xrewardsTokenOne.address)
    expect(stakeEndTime).to.be.eq(endTime)

    const rewardAmountOne = await xrewardsTokenOne.balanceOf(staker.address)
    const rewardAmountTwo = await xrewardsTokenTwo.balanceOf(staker.address)
    expect(reward.div(2).sub(rewardAmountOne).lte(reward.div(2).div(10000))).to.be.true // ensure result is within .01%
    expect(reward.div(2).sub(rewardAmountTwo).lte(reward.div(2).div(10000))).to.be.true // ensure result is within .01%
    expect(rewardAmountOne).to.be.eq(reward.div(REWARDS_DURATION).mul(endTime.sub(stakeStartTime)))
    expect(rewardAmountTwo).to.be.eq(reward.div(REWARDS_DURATION).mul(endTime.sub(stakeStartTime)))
  }) // TODO investigate flakiness


  it('notifyRewardAmount: full', async () => {
    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)

    const { endTime } = await start(reward)

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    expect(stakeEndTime).to.be.eq(endTime)

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    expect(reward.sub(rewardAmount).lte(reward.div(10000))).to.be.true // ensure result is within .01%
    expect(rewardAmount).to.be.eq(reward.div(REWARDS_DURATION).mul(REWARDS_DURATION))
  })



  it('stakeWithPermit', async () => {
    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)

    // get permit
    const nonce = await stakingToken.nonces(staker.address)
    const deadline = constants.MaxUint256
    const digest = await getApprovalDigest(
      stakingToken,
      { owner: staker.address, spender: stakingRewards.address, value: stake },
      nonce,
      deadline
    )
    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(staker.privateKey.slice(2), 'hex'))

    await stakingRewards.connect(staker).stakeWithPermit(stake, deadline, v, r, s)

    const { endTime } = await start(reward)

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    expect(stakeEndTime).to.be.eq(endTime)

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    expect(reward.sub(rewardAmount).lte(reward.div(10000))).to.be.true // ensure result is within .01%
    expect(rewardAmount).to.be.eq(reward.div(REWARDS_DURATION).mul(REWARDS_DURATION))
  })

  it('notifyRewardAmount: ~half', async () => {
    const { startTime, endTime } = await start(reward)

    // fast-forward ~halfway through the reward window
    await mineBlock(provider, startTime.add(endTime.sub(startTime).div(2)).toNumber())

    // stake with staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)
    const stakeStartTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    expect(stakeEndTime).to.be.eq(endTime)

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    expect(reward.div(2).sub(rewardAmount).lte(reward.div(2).div(10000))).to.be.true // ensure result is within .01%
    expect(rewardAmount).to.be.eq(reward.div(REWARDS_DURATION).mul(endTime.sub(stakeStartTime)))
  }).retries(2) // TODO investigate flakiness


  it('notifyRewardAmount: two stakers', async () => {
    // stake with first staker
    const stake = expandTo18Decimals(2)
    await stakingToken.transfer(staker.address, stake)
    await stakingToken.connect(staker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(staker).stake(stake)

    const { startTime, endTime } = await start(reward)

    // fast-forward ~halfway through the reward window
    await mineBlock(provider, startTime.add(endTime.sub(startTime).div(2)).toNumber())

    // stake with second staker
    await stakingToken.transfer(secondStaker.address, stake)
    await stakingToken.connect(secondStaker).approve(stakingRewards.address, stake)
    await stakingRewards.connect(secondStaker).stake(stake)

    // fast-forward past the reward window
    await mineBlock(provider, endTime.add(1).toNumber())

    // unstake
    await stakingRewards.connect(staker).exit()
    const stakeEndTime: BigNumber = await stakingRewards.rewardLastUpdatedTime(rewardsToken.address)
    expect(stakeEndTime).to.be.eq(endTime)
    await stakingRewards.connect(secondStaker).exit()

    const rewardAmount = await rewardsToken.balanceOf(staker.address)
    const secondRewardAmount = await rewardsToken.balanceOf(secondStaker.address)
    const totalReward = rewardAmount.add(secondRewardAmount)

    // ensure results are within .01%
    expect(reward.sub(totalReward).lte(reward.div(10000))).to.be.true
    expect(totalReward.mul(3).div(4).sub(rewardAmount).lte(totalReward.mul(3).div(4).div(10000)))
    expect(totalReward.div(4).sub(secondRewardAmount).lte(totalReward.div(4).div(10000)))
  })
})
