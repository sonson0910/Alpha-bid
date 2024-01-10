// // import modules from libraries
// import {
//     Blockfrost,
//     C,
//     Data,
//     Lucid,
//     SpendingValidator,
//     TxHash,
//     fromHex,
//     toHex,
//     Wallet,
// } from "https://deno.land/x/lucid@0.8.4/mod.ts";
// import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

// // Create the lucid api
// const lucid = await Lucid.new(
//     new Blockfrost(
//         "https://cardano-preview.blockfrost.io/api/v0",
//         "previewad7caqvYiu70SZAKSYQKg3EE9WsIrcF3",
//     ),
//     "Preview",
// );

// // Select wallet
// const wallet = lucid.selectWalletFromSeed(await Deno.readTextFile("./owner.seed"));

// // Function to read validator from plutus.json file
// async function readValidator(): Promise<SpendingValidator> {
//     const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0];
//     return {
//         type: "PlutusV2",
//         script: toHex(cbor.encode(fromHex(validator.compiledCode))),
//     };
// }

// // Read the validator and assign it to a variable
// const validator = await readValidator();


// const lock_until = 1704789905n;
// const currentTime = new Date().getTime();
// console.log("Current time: " + currentTime)
// console.log("Lock time: " + lock_until)

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
    lucid.utils.getAddressDetails("addr_test1qrq4nuljy5qhd582yltw46p3k77cjk8vc5tff552yy9mcevcrkqlr3ha73femq0vgsuedz2x3qev4z0n3vm6ketr9xjq6jet33")
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
const policyId = "dc5e9468d8a32d2680245ee3e5287a52f7a0048f4a4c457ad29ecd86";
const assetName = "4e677579656e204b68616e68";
const NFT = policyId + assetName;

const newPrice = 200000000n;
const newRoyalties = BigInt(parseInt(newPrice) * 1 / 100);

// const Price = 100000000n;
// const lock_until = BigInt(new Date(new Date().getTime() + 5 * 60 * 1000).getTime());
// const royalties = BigInt(parseInt(Price) * 1 / 100);
// const policyId = "dc5e9468d8a32d2680245ee3e5287a52f7a0048f4a4c457ad29ecd86";
// const assetName = "4e677579656e204b68616e68";
// const contractAddress =
//     lucid.utils.getAddressDetails(
//         await lucid.utils.validatorToAddress(validator)
//     ).paymentCredential.hash;

// const datum = Data.to<Datum>(
//     {
//         policyId: policyId,
//         assetName: assetName,
//         lock_until: lock_until,
//         bider: beneficiaryPublicKeyHash,
//         winter: beneficiaryPublicKeyHash,
//         smc_addr: contractAddress,
//         author: authorPublicKeyHash,
//         price: Price,
//         royalties: royalties,
//     },
//     Datum
// );

// Get the UTxO datum containing the NFT you want to buy
let UTOut;
const currentTime = new Date().getTime();

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

// If no UTxO is selected, the program will stop
if (utxos.length === 0) {
    console.log("No redeemable utxo found. You need to wait a little longer...");
    Deno.exit(1);
}

const smc_addr = UTOut.smc_addr
const author = UTOut.author
const lock_until = UTOut.lock_until
const bider = UTOut.bider

const datum = Data.to<Datum>(
    {
        policyId: policyId,
        assetName: assetName,
        lock_until: lock_until,
        bider: UTOut.bider,
        winter: beneficiaryPublicKeyHash,
        smc_addr: UTOut.smc_addr,
        author: author,
        price: newPrice,
        royalties: newRoyalties,
    },
    Datum
);

let winter_addr = { type: "Key", hash: UTOut.winter }

let winter = await lucid.utils.credentialToAddress(winter_addr)
console.log(winter)