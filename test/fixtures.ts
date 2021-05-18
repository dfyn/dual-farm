import chai from 'chai'
import { Contract, Wallet, BigNumber, providers } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utils'

import DfynV2ERC20 from '@uniswap/v2-core/build/ERC20.json'
import TestERC20 from '../build/TestERC20.json'
import StakingRewards from '../build/StakingRewards.json'
import StakingRewardsFactory from '../build/StakingRewardsFactory.json'

chai.use(solidity)

const NUMBER_OF_STAKING_TOKENS = 4

interface StakingRewardsFixture {
  stakingRewards: Contract
  rewardsToken: Contract
  stakingToken: Contract
}

export async function stakingRewardsFixture([wallet]: Wallet[]): Promise<StakingRewardsFixture> {
  const rewardsDistribution = wallet.address
  const rewardsToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const stakingToken = await deployContract(wallet, DfynV2ERC20, [expandTo18Decimals(1000000)])

  const stakingRewards = await deployContract(wallet, StakingRewards, [
    rewardsDistribution,
    [rewardsToken.address],
    stakingToken.address,
  ])

  return { stakingRewards, rewardsToken, stakingToken }
}

interface StakingRewardsMultiTokenFixture {
  stakingRewardsMulti: Contract
  rewardsTokenOne: Contract
  rewardsTokenTwo: Contract
  stakingTokenMulti: Contract
}

export async function StakingRewardsMultiTokenFixture([wallet]: Wallet[]): Promise<StakingRewardsMultiTokenFixture> {
  const rewardsDistribution = wallet.address
  const rewardsTokenOne = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const rewardsTokenTwo = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const stakingTokenMulti = await deployContract(wallet, DfynV2ERC20, [expandTo18Decimals(1000000)])

  const stakingRewardsMulti = await deployContract(wallet, StakingRewards, [
    rewardsDistribution,
    [rewardsTokenOne.address, rewardsTokenTwo.address],
    stakingTokenMulti.address,
  ])

  return { stakingRewardsMulti, rewardsTokenOne, rewardsTokenTwo, stakingTokenMulti }
}
interface StakingRewardsMultiTokenFixture {
  stakingRewardsMulti: Contract
  rewardsTokenOne: Contract
  rewardsTokenTwo: Contract
  stakingTokenMulti: Contract
}

export async function StakingRewardsMultiTokenTwoFixture([wallet]: Wallet[]): Promise<StakingRewardsMultiTokenFixture> {
  const rewardsDistribution = wallet.address
  const rewardsTokenOne = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const rewardsTokenTwo = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const stakingTokenMulti = await deployContract(wallet, DfynV2ERC20, [expandTo18Decimals(1000000)])

  const stakingRewardsMulti = await deployContract(wallet, StakingRewards, [
    rewardsDistribution,
    [rewardsTokenOne.address, rewardsTokenTwo.address],
    stakingTokenMulti.address,
  ])

  return { stakingRewardsMulti, rewardsTokenOne, rewardsTokenTwo, stakingTokenMulti }
}
interface StakingRewardsFactoryFixture {
  rewardsTokens: Contract[]
  stakingTokens: Contract[]
  genesis: number
  rewardAmounts: BigNumber[]
  stakingRewardsFactory: Contract
}

export async function stakingRewardsFactoryFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<StakingRewardsFactoryFixture> {
  const rewardsTokenOne = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])
  const rewardsTokenTwo = await deployContract(wallet, TestERC20, [expandTo18Decimals(1000000)])

  const rewardsTokens = [rewardsTokenOne, rewardsTokenTwo];
  // deploy staking tokens
  const stakingTokens = []
  for (let i = 0; i < NUMBER_OF_STAKING_TOKENS; i++) {
    const stakingToken = await deployContract(wallet, TestERC20, [expandTo18Decimals(1_000_000_000)])
    stakingTokens.push(stakingToken)
  }

  // deploy the staking rewards factory
  const { timestamp: now } = await provider.getBlock('latest')
  const genesis = now + 60 * 60
  const rewardAmounts: BigNumber[] = new Array(rewardsTokens.length).fill(expandTo18Decimals(10))
  const stakingRewardsFactory = await deployContract(wallet, StakingRewardsFactory, [genesis])
  return { rewardsTokens, stakingTokens, genesis, rewardAmounts, stakingRewardsFactory }
}
