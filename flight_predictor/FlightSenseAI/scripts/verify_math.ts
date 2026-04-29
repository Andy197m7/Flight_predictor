import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
const idl = require("../packages/solana/target/idl/flightsense_solana.json");

// Run with: npx ts-node scripts/verify_math.ts

async function main() {
    // Configure client detailed
    const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
    const wallet = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(require("fs").readFileSync(require("os").homedir() + "/.config/solana/id.json", "utf-8")))
    );
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: "confirmed", preflightCommitment: "confirmed" });
    anchor.setProvider(provider);

    const programId = new PublicKey("D7CUNAs5Gr4bCbYn4cBJiDUtVNJdCPwWQVaJVspjHCow");
    const program = new Program(idl, provider);

    const marketId = "math_test_" + Date.now();
    console.log("Testing Market:", marketId);

    // 1. Initialize
    const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), Buffer.from(marketId)],
        programId
    );
    console.log("Market PDA:", marketPda.toString());

    console.log("Initializing...");
    const initTx = await program.methods.initializeMarket(marketId, 5000) // 50% prob
        .accounts({
            market: marketPda,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    console.log("Market Initialized! Tx:", initTx);

    console.log("Confirming...");
    await connection.confirmTransaction(initTx, "confirmed");

    // Check account
    const marketAccount = await program.account["marketAccount"].fetch(marketPda);
    console.log("Market Initial State:", {
        yes: marketAccount.yesPool.toString(),
        no: marketAccount.noPool.toString(),
        volume: marketAccount.volume.toString()
    });

    // 2. Buy YES 0.1 SOL
    const buyAmount = 0.1 * 1e9;
    const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
        programId
    );

    console.log("Buying YES 0.1 SOL...");
    const buyTx = await program.methods.buy({ yes: {} }, new BN(buyAmount))
        .accounts({
            market: marketPda,
            position: positionPda,
            user: wallet.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    await connection.confirmTransaction(buyTx, "confirmed");

    // @ts-ignore
    let posAccount = await program.account.positionAccount.fetch(positionPda);
    console.log("Buy Complete. Shares:", posAccount.yesShares.toString());
    const shares = posAccount.yesShares;

    // 3. Sell All YES
    console.log("Selling All YES...");
    const sellTx = await program.methods.sell({ yes: {} }, shares)
        .accounts({
            market: marketPda,
            position: positionPda,
            user: wallet.publicKey,
        })
        .rpc();

    await connection.confirmTransaction(sellTx, "confirmed");

    // @ts-ignore
    posAccount = await program.account.positionAccount.fetch(positionPda);
    console.log("Sell Complete. Remaining Shares:", posAccount.yesShares.toString());
    console.log("Realized P/L:", posAccount.realizedPl.toString());
}

main().catch(console.error);
