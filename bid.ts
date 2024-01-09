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


// Public key of the NFT creator
const authorPublicKeyHash =
    lucid.utils.getAddressDetails("addr_test1qqayue6h7fxemhdktj9w7cxsnxv40vm9q3f7temjr7606s3j0xykpud5ms6may9d6rf34mgwxqv75rj89zpfdftn0esq3pcfjg")
        .paymentCredential.hash;


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
const policyId = "f6d61e2b83e15ce8ca7645e21ea4e552cad719d36290d07b50477100";
const assetName = "44656d61726b6574";
const NFT = policyId + assetName;

const newPrice = 200000000n;
const newRoyalties = BigInt(parseInt(newPrice) * 1 / 100);

// Get the UTxO datum containing the NFT you want to buy
let UTOut;

// Retrieve all UTxOs present on the contract address
const scriptUtxos = await lucid.utxosAt(scriptAddress);

// Filter out UTxOs containing NFTs to purchase
const utxos = scriptUtxos.filter((utxo) => {
    try {
        // Pour datum data into the temp variable of the current UTxO
        const temp = Data.from<Datum>(utxo.datum, Datum);

        // Check to see if that UTxO actually contains the NFT you want to buy?
        if (temp.policyId === policyId && temp.assetName === assetName) {
            UTOut = Data.from<Datum>(utxo.datum, Datum); // Get the data of UTxO and pour it into a variable
            return true; // That UTxO has been taken
        }
        return false; // That UTxO is not selected
    } catch (e) {
        return false; // That UTxO is not selected
    }
});

console.log(UTOut)

const datum = Data.to<Datum>(
    {
        policyId: UTOut.policyId,
        assetName: UTOut.assetName,
        lock_until: UTOut.lock_until,
        bider: UTOut.ownerPublicKeyHash,
        winter: beneficiaryPublicKeyHash,
        smc_addr: UTOut.contractAddress,
        author: UTOut.authorPublicKeyHash,
        price: newPrice,
        royalties: newRoyalties,
    },
    Datum
);


// If no UTxO is selected, the program will stop
if (utxos.length === 0) {
    console.log("No redeemable utxo found. You need to wait a little longer...");
    Deno.exit(1);
}

// The contract does not use a redeemer, but this is required so it is initialized empty
const redeemer = Data.void();

// The function unlocks the assets on the contract
async function unlock(utxos, UTOut, exchange_fee, datum, NFT, price, { from, using }): Promise<TxHash> {
    const contractAddress = lucid.utils.validatorToAddress(from);
    const currentTime = new Date().getTime();
    
    console.log(price);
    // Initiate transaction
    const tx = await lucid
        .newTx()
        .payToAddress(await lucid.until.credentialToAddress(UTOut.winter), { lovelace: UTOut.price }) // Send money to the seller
        .collectFrom(utxos, using) // Consume UTxO (Get NFTs on the contract to the wallet)
        .validFrom(currentTime)
        .payToContract(contractAddress, { inline: datum }, { [NFT]: 1n, lovelace: price }) // Send NFT, datum to the contract with the address read above
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
const txUnlock = await unlock(utxos, UTOut, exchange_fee, datum, NFT, newPrice, { from: validator, using: redeemer });
console.log(1);

// Waiting time until the transaction is confirmed on the Blockchain
await lucid.awaitTx(txUnlock);

console.log(`NFT recovered from the contract
    Tx ID: ${txUnlock}
    Redeemer: ${redeemer}
`);

