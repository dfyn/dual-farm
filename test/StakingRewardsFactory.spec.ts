import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { stakingRewardsFactoryFixture } from './fixtures'
import { expandTo18Decimals, mineBlock } from './utils'

import StakingRewards from '../build/StakingRewards.json'

chai.use(solidity)

describe('StakingRewardsFactory', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet, wallet1] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let rewardsTokens: Contract[]
  let genesis: number
  let rewardAmounts: BigNumber[]
  let rewardsTokensAddresses: String[]
  let stakingRewardsFactory: Contract
  let stakingTokens: Contract[]

  beforeEach('load fixture', async () => {
    const fixture = await loadFixture(stakingRewardsFactoryFixture)
    rewardsTokens = fixture.rewardsTokens
    genesis = fixture.genesis
    rewardAmounts = fixture.rewardAmounts
    rewardsTokensAddresses = rewardsTokens.map(rewardToken => rewardToken.address);
    stakingRewardsFactory = fixture.stakingRewardsFactory
    stakingTokens = fixture.stakingTokens
  })

  it('deployment gas', async () => {
    const receipt = await provider.getTransactionReceipt(stakingRewardsFactory.deployTransaction.hash)
    expect(receipt.gasUsed).to.eq('4633141')
  })

  describe('#deploy', () => {
    it('pushes the token into the list', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, rewardsTokensAddresses, rewardAmounts)
      expect(await stakingRewardsFactory.stakingTokens(0)).to.eq(stakingTokens[1].address)
    })

    it('fails if called twice for same token', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, rewardsTokensAddresses, rewardAmounts)
      await expect(stakingRewardsFactory.deploy(stakingTokens[1].address, rewardsTokensAddresses, rewardAmounts)).to.revertedWith(
        'StakingRewardsFactory::deploy: already deployed'
      )
    })

    it('can only be called by the owner', async () => {
      await expect(stakingRewardsFactory.connect(wallet1).deploy(stakingTokens[1].address, rewardsTokensAddresses, rewardAmounts)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('stores the address of stakingRewards and reward amount', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, rewardsTokensAddresses, rewardAmounts)
      const [stakingRewards, test, rewardAmount] = await stakingRewardsFactory.stakingRewardsInfo(
        stakingTokens[1].address
      )
      expect(await provider.getCode(stakingRewards)).to.not.eq('0x')
      expect(rewardAmount[0]).to.eq(rewardAmounts[0])
      expect(rewardAmount[1]).to.eq(rewardAmounts[1])
    })

    it('deployed staking rewards has correct parameters', async () => {
      await stakingRewardsFactory.deploy(stakingTokens[1].address, rewardsTokensAddresses, rewardAmounts)
      const [stakingRewardsAddress, rewardsTokensArray, [rewardAmount]] = await stakingRewardsFactory.stakingRewardsInfo(
        stakingTokens[1].address
      )
      const stakingRewards = new Contract(stakingRewardsAddress, StakingRewards.abi, provider)
      expect(await stakingRewards.rewardsDistribution()).to.eq(stakingRewardsFactory.address)
      expect(await stakingRewards.stakingToken()).to.eq(stakingTokens[1].address)
      expect(rewardsTokensArray).to.have.all.members(rewardsTokensAddresses)
    })
  })

  describe('#notifyRewardsAmounts', () => {
    let totalRewardAmount: BigNumber

    beforeEach(() => {
      totalRewardAmount = rewardAmounts.reduce((accumulator, current) => accumulator.add(current), BigNumber.from(0))
    })

    it('called before any deploys', async () => {
      await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
        'StakingRewardsFactory::notifyRewardAmounts: called before any deploys'
      )
    })

    describe('after deploying all staking reward contracts', async () => {
      let stakingRewards: Contract[]

      const update = async () => {
        for (let i = 0; i < stakingTokens.length; i++) {
          await stakingRewardsFactory.deploy(stakingTokens[i].address, rewardsTokensAddresses, rewardAmounts, true)
          const stakingRewardsAddress = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(
            stakingTokens[i].address
          )
          stakingRewards.push(new Contract(stakingRewardsAddress, StakingRewards.abi, provider))
        }
      }


      beforeEach('deploy staking reward contracts', async () => {
        stakingRewards = []
        for (let i = 0; i < stakingTokens.length; i++) {
          await stakingRewardsFactory.deploy(stakingTokens[i].address, rewardsTokensAddresses, rewardAmounts)
          const stakingRewardsAddress = await stakingRewardsFactory.stakingRewardsInfoByStakingToken(
            stakingTokens[i].address
          )
          stakingRewards.push(new Contract(stakingRewardsAddress, StakingRewards.abi, provider))
        }
      })


      // it('gas', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      //   await mineBlock(provider, genesis)
      //   const tx = await stakingRewardsFactory.notifyRewardAmounts()
      //   const receipt = await tx.wait()
      //   expect(receipt.gasUsed).to.eq('465150')
      // })

      // it('no op if called twice', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      //   await mineBlock(provider, genesis)
      //   await expect(stakingRewardsFactory.notifyRewardAmounts()).to.emit(rewardsToken, 'Transfer')
      //   await expect(stakingRewardsFactory.notifyRewardAmounts()).to.not.emit(rewardsToken, 'Transfer')
      // })

      // it('fails if called without sufficient balance', async () => {
      //   await mineBlock(provider, genesis)
      //   await expect(stakingRewardsFactory.notifyRewardAmounts()).to.be.revertedWith(
      //     'ERC20: transfer amount exceeds balance' // emitted from rewards token
      //   )
      // })

      // it('calls notifyRewards on each contract', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      //   await mineBlock(provider, genesis)
      //   await expect(stakingRewardsFactory.notifyRewardAmounts())
      //     .to.emit(stakingRewards[0], 'RewardAdded')
      //     .withArgs(rewardAmounts[0])
      //     .to.emit(stakingRewards[1], 'RewardAdded')
      //     .withArgs(rewardAmounts[1])
      //     .to.emit(stakingRewards[2], 'RewardAdded')
      //     .withArgs(rewardAmounts[2])
      //     .to.emit(stakingRewards[3], 'RewardAdded')
      //     .withArgs(rewardAmounts[3])
      // })

      // it('transfers the reward tokens to the individual contracts', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      //   await mineBlock(provider, genesis)
      //   await stakingRewardsFactory.notifyRewardAmounts()
      //   for (let i = 0; i < rewardAmounts.length; i++) {
      //     expect(await rewardsToken.balanceOf(stakingRewards[i].address)).to.eq(rewardAmounts[i])
      //   }
      // })

      // it('2#transfers the reward tokens to the individual contracts', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount.mul(2))
      //   await mineBlock(provider, genesis)
      //   await stakingRewardsFactory.notifyRewardAmounts()
      //   await update()
      //   await stakingRewardsFactory.notifyRewardAmounts()
      //   for (let i = 0; i < rewardAmounts.length; i++) {
      //     expect(await rewardsToken.balanceOf(stakingRewards[i].address)).to.eq(rewardAmounts[i].mul(2))
      //   }
      // })

      // it('sets rewardAmount to 0', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      //   await mineBlock(provider, genesis)
      //   for (let i = 0; i < stakingTokens.length; i++) {
      //     const [, , [amount]] = await stakingRewardsFactory.stakingRewardsInfo(stakingTokens[i].address)
      //     expect(amount).to.eq(rewardAmounts[i])
      //   }
      //   await stakingRewardsFactory.notifyRewardAmounts()
      //   for (let i = 0; i < stakingTokens.length; i++) {
      //     const [, , [amount]] = await stakingRewardsFactory.stakingRewardsInfo(stakingTokens[i].address)
      //     expect(amount).to.eq(0)
      //   }
      // })

      // it('succeeds when has sufficient balance and after genesis time', async () => {
      //   await rewardsToken.transfer(stakingRewardsFactory.address, totalRewardAmount)
      //   await mineBlock(provider, genesis)
      //   await stakingRewardsFactory.notifyRewardAmounts()
      // })
    })
  })
})
