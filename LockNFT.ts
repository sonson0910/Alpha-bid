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

console.log(ownerPublicKeyHash)

// Public key of the NFT creator
const authorPublicKeyHash =
    lucid.utils.getAddressDetails("addr_test1qrq4nuljy5qhd582yltw46p3k77cjk8vc5tff552yy9mcevcrkqlr3ha73femq0vgsuedz2x3qev4z0n3vm6ketr9xjq6jet33")
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
const lock_until = BigInt(new Date(new Date().getTime() + 5 * 60 * 1000).getTime());
const royalties = BigInt(parseInt(Price) * 1 / 100);
const policyId = "dc5e9468d8a32d2680245ee3e5287a52f7a0048f4a4c457ad29ecd86";
const assetName = "4e677579656e204b68616e68";
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

// NFTs are for sale
const NFT = policyId + assetName;
console.log(NFT)

// Asset locking function
async function lock(NFT, { into, datum }): Promise<TxHash> {
    // Read the contract address from the validator variable
    const contractAddress = lucid.utils.validatorToAddress(into);
    console.log(datum);

    console.log(contractAddress);
    // Create transaction
    const tx = await lucid
        .newTx()
        .payToContract(contractAddress, { inline: datum }, { [NFT]: 1n }) // Send NFT, datum to the contract with the address read above
        .complete();

    // Sign transaction
    const signedTx = await tx.sign().complete();

    // Send transactions to onchain
    return signedTx.submit();
}

// Lock assets into contracts
const txLock = await lock(NFT, { into: validator, datum: datum });

// Time until the transaction is confirmed on the Blockchain
await lucid.awaitTx(txLock);

console.log(`NFT locked into the contract
    Tx ID: ${txLock}
    Datum: ${datum}
`);
