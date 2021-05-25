const StakingRewardsFactory = artifacts.require('./StakingRewardsFactory.sol');

module.exports = async done => {
    const stakingRewardFactory = await StakingRewardsFactory.at("0x9f75001DFAD0a1dc139eeA591F3b5975d2a96682");
    await stakingRewardFactory.deploy("0xebc4f9b1ce66258ac3a48578ffeeba1330ddb68b",["0xD33dcD9673e1fA99F064CB4682c6299351AD771C","0x246b774CfB1087620620dAbC1f8D46938403C487"],[web3.utils.toWei(1000),web3.utils.toWei(1000)])
    console.log("done")
    done();
};