// Import modules from libraries
import {
    Blockfrost,
    C,
    Data,
    Lucid,
    SpendingValidator,
    TxHash,
    fromHex,
    toHex,
} from "https://deno.land/x/lucid@0.8.4/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

// Initialize the lucid API
const lucid = await Lucid.new(
    new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        "previewad7caqvYiu70SZAKSYQKg3EE9WsIrcF3",
    ),
    "Preview",
);

// Select buyer wallet
const wallet = lucid.selectWalletFromSeed(await Deno.readTextFile("./beneficiary.seed"));

// Function to read validator from plutus.json file
async function readValidator(): Promise<SpendingValidator> {
    const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0];
    return {
        type: "PlutusV2",
        script: toHex(cbor.encode(fromHex(validator.compiledCode))),
    };
}

// Read the validator and assign it to a variable
const validator = await readValidator();

// Public key of the seller
const beneficiaryPublicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address()
).paymentCredential.hash;

// --------------------------------------------------------------------------
// Read the contract address from the validator variable
const scriptAddress = lucid.utils.validatorToAddress(validator);

// we get all the UTXOs sitting at the script address
const scriptUtxos = await lucid.utxosAt(scriptAddress);

// initialize the Datum object
const Datum = Data.Object({
    policyId: Data.String,
    assetName: Data.String,
    lock_until: Data.BigInt,
    bider: Data.String,
    winter: Data.String,
    smc_addr: Data.String,
    author: Data.String,
    price: Data.BigInt,
    royalties: Data.BigInt,
});

type Datum = Data.Static<typeof Datum>;

// NFT data to filter out UTxOs containing that NFT
const policyId = "dc5e9468d8a32d2680245ee3e5287a52f7a0048f4a4c457ad29ecd86";
const assetName = "4e677579656e204b68616e68";
const NFT = policyId + assetName;

// Get the UTxO datum containing the NFT you want to buy
let UTOut;
const currentTime = new Date().getTime();
// Retrieve all UTxOs present on the contract address
const scriptUtxos = await lucid.utxosAt(scriptAddress);

// Filter out UTxOs containing NFTs to purchase
const utxos = scriptUtxos.filter((utxo) => {
    try {
        // Pour datum data into the temp variable of the current UTxO
        const temp = Data.from<Datum>(utxo.datum, Datum);

        // Check to see if that UTxO actually contains the NFT you want to buy?
        if (temp.policyId === policyId && temp.assetName === assetName && temp.lock_until <= currentTime) {
            UTOut = Data.from<Datum>(utxo.datum, Datum); // Get the data of UTxO and pour it into a variable
            return true; // That UTxO has been taken
        }
        return false; // That UTxO is not selected
    } catch (e) {
        return false; // That UTxO is not selected
    }
});

console.log(UTOut)


// If no UTxO is selected, the program will stop
if (utxos.length === 0) {
    console.log("No redeemable utxo found. You need to wait a little longer...");
    Deno.exit(1);
}

const exchange_fee = BigInt(parseInt(UTOut.price) * 1 / 100);

// The contract does not use a redeemer, but this is required so it is initialized empty
const redeemer = Data.void();

// The function unlocks the assets on the contract
async function unlock(utxos, UTOut, { from, using }): Promise<TxHash> {
    const contractAddress = lucid.utils.validatorToAddress(from);
    const currentTime = new Date().getTime();
    const payment_bider = { type: "Key", hash: UTOut.bider }
    const payment_author = { type: "Key", hash: UTOut.author }

    console.log(price);
    // Initiate transaction
    const tx = await lucid
        .newTx()
        .payToAddress(await lucid.utils.credentialToAddress(payment_bider), { lovelace: UTOut.price }) // Send money to the seller
        .payToAddress("addr_test1qqayue6h7fxemhdktj9w7cxsnxv40vm9q3f7temjr7606s3j0xykpud5ms6may9d6rf34mgwxqv75rj89zpfdftn0esq3pcfjg", { lovelace: exchange_fee }) // trading platform fees
        .payToAddress(await lucid.utils.credentialToAddress(payment_author), { lovelace: UTOut.royalties }) // Send money to buyer
        .collectFrom(utxos, using) // Consume UTxO (Get NFTs on the contract to the wallet)
        .validFrom(currentTime)
        .attachSpendingValidator(from) // Refers to the contract, if confirmed, all outputs will be implemented
        .complete();

    console.log(1)

    // Sign the transaction
    const signedTx = await tx
        .sign()
        .complete();

    // Send transactions to onchain
    return signedTx.submit();
}

// Execute the asset purchase transaction in the contract
const txUnlock = await unlock(utxos, UTOut, { from: validator, using: redeemer });
console.log(1);

// Waiting time until the transaction is confirmed on the Blockchain
await lucid.awaitTx(txUnlock);

console.log(`NFT recovered from the contract
    Tx ID: ${txUnlock}
    Redeemer: ${redeemer}
`);

