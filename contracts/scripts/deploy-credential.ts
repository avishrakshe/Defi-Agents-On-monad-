import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==================================================");
  console.log("Deploying AcademyCredential Soulbound NFT to Monad");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Native MON Balance:", ethers.formatEther(balance), "MON");

  const AcademyCredential = await ethers.getContractFactory("AcademyCredential");
  const credentialContract = await AcademyCredential.deploy();
  await credentialContract.waitForDeployment();

  const credentialAddress = await credentialContract.getAddress();
  console.log("AcademyCredential Contract deployed to:", credentialAddress);
  console.log("Explorer URL:", `https://testnet.monadvision.com/address/${credentialAddress}`);

  // Save to deployed-addresses.json
  const deployedPath = path.resolve(__dirname, "../deployed-addresses.json");
  let deployedData: any = {};
  if (fs.existsSync(deployedPath)) {
    deployedData = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));
  }
  deployedData.academyCredential = credentialAddress;
  fs.writeFileSync(deployedPath, JSON.stringify(deployedData, null, 2));

  console.log("Updated deployed-addresses.json successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
