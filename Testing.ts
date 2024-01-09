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
} from "https://deno.land/x/lucid@0.8.4/mod.ts";
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

// The data needed for the datum field (Public key of the seller and author above)
const Price = 100000000n;
const lock_until = BigInt(new Date().getTime());
const royalties = BigInt(parseInt(Price) * 1 / 100);
const policyId = "f6d61e2b83e15ce8ca7645e21ea4e552cad719d36290d07b50477100";
const assetName = "44656d61726b6574";
const contractAddress =
    lucid.utils.getAddressDetails(
        await lucid.utils.validatorToAddress(validator)
    ).paymentCredential.hash;

// Pass data into datum
const datum = Data.to<Datum>(
    {
        policyId: policyId,
        assetName: assetName,
        lock_until: lock_until,
        bider: ownerPublicKeyHash,
        winter: ownerPublicKeyHash,
        smc_addr: contractAddress,
        author: authorPublicKeyHash,
        price: Price,
        royalties: royalties,
    },
    Datum
);