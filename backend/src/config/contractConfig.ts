import { ethers, JsonRpcProvider, parseUnits } from "ethers";
import dotenv from "dotenv";
import * as CreditLimitManager from "./abi/CreditLimitManager.json";
dotenv.config();

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  throw new Error("Missing RPC URL in environment variables");
}

// Set contract address based on environment
const CONTRACT_ADDRESS = process.env.VITE_EVAULT;
if (!CONTRACT_ADDRESS) {
  throw new Error("Missing contract addresses in environment variables");
}
// Validate private key
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY in environment variables");
}

// Initialize provider and signer
const provider = new JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(privateKey, provider);

// Instance of the contract
const contract = new ethers.Contract(CONTRACT_ADDRESS, CreditLimitManager.abi, signer);

export const giveCreditScoreAndLimit = async (address: string) => {
  try {


    const amount = parseUnits("1000", 6);
    const tx = await contract.setLine(address, 120, amount);
    console.log("setLine transaction sent:", tx.hash);

    await tx.wait();
    console.log(`Line set successfully to: ${address}`);
    return 200;
  } catch (error) {
    console.error(`Error setting line:`, error);
  }
};

export { provider, signer, contract };
