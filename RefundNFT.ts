// import modules from libraries
import {
    Blockfrost,
    C,
    Data,
    Lucid,
    SpendingValidator,
    TxHash,
    fromHex,
    toHex,
    Wallet,
} from "https://deno.land/x/lucid@0.8.3/mod.ts";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

// Create the lucid api
const lucid = await Lucid.new(
    new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        "previewad7caqvYiu70SZAKSYQKg3EE9WsIrcF3",
    ),
    "Preview",
);

// Select wallet
const wallet = lucid.selectWalletFromSeed(await Deno.readTextFile("./owner.seed"));

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
const ownerPublicKeyHash = lucid.utils.getAddressDetails(
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

// NFT data to filter out UTxO containing the NFT to be retrieved
const policyId = "dc5e9468d8a32d2680245ee3e5287a52f7a0048f4a4c457ad29ecd86";
const assetName = "4e677579656e204b68616e68";

// Get the UTxO datum containing the NFT you want to buy
let UTOut;

// Filter out UTxOs containing NFTs to purchase
const utxos = scriptUtxos.filter((utxo) => {
    try {
        // Pour datum data into the temp variable of the current UTxO
        const temp = Data.from<Datum>(utxo.datum, Datum);

        // Check to see if UTxO is currently available as an NFT that can be purchased? Check to see if the UTxO actually contains the NFT you want to buy
        if (temp.policyId === policyId && temp.assetName === assetName) {
            UTOut = Data.from<Datum>(utxo.datum, Datum); // get the datum of that UTxO into a variable
            return true; // UTxO is getted
        }

        return false; // That UTxO is not selected 
    } catch (e) {
        return false; // That UTxO is not selected
    }
});

// NFTs are for sale
const NFT = policyId + assetName;
console.log(UTOut)
console.log("-----------------------------------------------------")
console.log(utxos)


// If no UTxO is selected, the program will be used
if (utxos.length === 0) {
    console.log("No redeemable utxo found. You need to wait a little longer...");
    Deno.exit(1);
}


// The contract does not use a redeemer, but this is required so it is initialized empty
const redeemer = Data.empty();

// function unlocks assets onto the contract
async function unlock(utxos, NFT, { from, using }): Promise<TxHash> {
    const contractAddress = lucid.utils.validatorToAddress(from);
    let datum = utxos[0].datum;
    const tx = await lucid // Initialize transaction
        .newTx()
        .collectFrom(utxos, using) // Consume UTxO (retrieve NFTs on the contract to the wallet)
        .addSigner(await lucid.wallet.address()) // Add a signature from the seller
        // .payToContract(contractAddress, { inline: datum }, { [NFT]: 1n }) // Send NFT, datum to the contract with the address read above
        .attachSpendingValidator(from) // Refers to the contract, if confirmed all output will be executed
        .complete();

    // Sign transaction
    const signedTx = await tx
        .sign()
        .complete();
    // Send transaction to onchain
    return signedTx.submit();
}

// Execution of taking back the sold property in the contract
const txUnlock = await unlock(utxos, NFT, { from: validator, using: redeemer });

// Time until the transaction is confirmed on the blockchain
await lucid.awaitTx(txUnlock);

console.log(`NFT recovered from the contract
    Tx ID: ${txUnlock}
    Redeemer: ${redeemer}
`);

