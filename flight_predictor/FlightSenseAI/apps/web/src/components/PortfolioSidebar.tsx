"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import idl from "@/lib/idl.json";

const PROGRAM_ID = new PublicKey("D7CUNAs5Gr4bCbYn4cBJiDUtVNJdCPwWQVaJVspjHCow");

interface Position {
    marketId: string;
    yesTokens: number;
    noTokens: number;
    yesCost: number;
    noCost: number;
    yesValue: number;
    noValue: number;
    yesPL: number;
    noPL: number;
    currentPrice: number;
    realizedPL: number;
    claimed: boolean;
    isResolved: boolean;
    resolvedOutcome: number;
}

interface PortfolioSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    markets: Array<{ flight_id: string; disruption_probability: number }>;
}

export function PortfolioSidebar({ isOpen, onClose, markets }: PortfolioSidebarProps) {
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalUnrealizedPL, setTotalUnrealizedPL] = useState(0);
    const [totalRealizedPL, setTotalRealizedPL] = useState(0);
    const [totalValue, setTotalValue] = useState(0);

    const wallet = useAnchorWallet();
    const { connection } = useConnection();

    const handleClaim = async (flightId: string) => {
        if (!wallet) return;
        try {
            const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
            const program = new Program(idl as Idl, provider);

            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(flightId)],
                program.programId
            );

            const [positionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            const tx = await program.methods.claim()
                .accounts({
                    market: marketPda,
                    position: positionPda,
                    user: wallet.publicKey,
                })
                .rpc();

            console.log("Claim successful:", tx);
            // Refresh logic to be added
        } catch (e) {
            console.error("Claim failed:", e);
        }
    };

    useEffect(() => {
        const fetchAllPositions = async () => {
            if (!wallet || !isOpen || markets.length === 0) return;

            setLoading(true);
            try {
                const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
                const program = new Program(idl as Idl, provider);

                const allPositions: Position[] = [];

                for (const market of markets) {
                    const [marketPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from("market"), Buffer.from(market.flight_id)],
                        program.programId
                    );

                    const [positionPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                        program.programId
                    );

                    try {
                        // Fetch both market and position
                        const marketAccount = await connection.getAccountInfo(marketPda);
                        const positionAccount = await connection.getAccountInfo(positionPda);

                        let isResolved = false;
                        let resolvedOutcome = 0;

                        if (marketAccount) {
                            const marketData = program.coder.accounts.decode("marketAccount", marketAccount.data);
                            // Assuming status enum: 0=Active, 1=Resolved? Or checking specific field
                            isResolved = JSON.stringify(marketData.status).includes("resolved");
                            resolvedOutcome = marketData.resolvedOutcome;
                        }

                        if (positionAccount) {
                            const data = program.coder.accounts.decode("positionAccount", positionAccount.data);

                            const yesTokens = new BN(data.yesShares || data.yes_shares || 0).toNumber() / 1e9;
                            const noTokens = new BN(data.noShares || data.no_shares || 0).toNumber() / 1e9;
                            const yesCost = new BN(data.yesCostBasis || data.yes_cost_basis || 0).toNumber() / 1e9;
                            const noCost = new BN(data.noCostBasis || data.no_cost_basis || 0).toNumber() / 1e9;
                            const realizedPL = new BN(data.realizedPl || data.realized_pl || 0).toNumber() / 1e9;
                            const claimed = data.claimed;

                            if (yesTokens > 0 || noTokens > 0 || realizedPL !== 0) {
                                const currentPrice = market.disruption_probability;
                                const yesValue = yesTokens * currentPrice;
                                const noValue = noTokens * (1 - currentPrice);
                                const yesPL = yesValue - yesCost;
                                const noPL = noValue - noCost;

                                allPositions.push({
                                    marketId: market.flight_id,
                                    yesTokens,
                                    noTokens,
                                    yesCost,
                                    noCost,
                                    yesValue,
                                    noValue,
                                    yesPL,
                                    noPL,
                                    currentPrice,
                                    realizedPL,
                                    claimed,
                                    isResolved,
                                    resolvedOutcome
                                });
                            }
                        }
                    } catch (e) {
                        // Position doesn't exist or can't be decoded
                    }
                }

                setPositions(allPositions);

                // Calculate totals
                const totalPL = allPositions.reduce((sum, p) => sum + p.yesPL + p.noPL, 0);
                const totalVal = allPositions.reduce((sum, p) => sum + p.yesValue + p.noValue, 0);
                const totalRealized = allPositions.reduce((sum, p) => sum + p.realizedPL, 0);

                setTotalUnrealizedPL(totalPL);
                setTotalValue(totalVal);
                setTotalRealizedPL(totalRealized);

            } catch (e) {
                console.error("Failed to fetch positions:", e);
            }
            setLoading(false);
        };

        fetchAllPositions();
    }, [wallet, isOpen, connection, markets]);

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-0 h-full w-80 bg-[var(--fs-primary)] border-l border-white/10 shadow-2xl z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-[var(--fs-primary)] border-b border-white/10 p-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Portfolio</h2>
                    <button onClick={onClose} className="text-[var(--fs-muted)] hover:text-white text-xl">×</button>
                </div>
            </div>

            {/* Summary */}
            <div className="p-4 border-b border-white/10">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-[var(--fs-muted)] uppercase">Total Value</div>
                        <div className="text-xl font-bold text-white">{totalValue.toFixed(4)} SOL</div>
                    </div>
                    <div>
                        <div className="text-xs text-[var(--fs-muted)] uppercase">Unrealized P/L</div>
                        <div className={`text-xl font-bold ${totalUnrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {totalUnrealizedPL >= 0 ? '+' : ''}{totalUnrealizedPL.toFixed(4)} SOL
                        </div>
                    </div>
                </div>
            </div>

            {/* Realized P/L */}
            <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="grid grid-cols-1">
                    <div>
                        <div className="text-xs text-[var(--fs-muted)] uppercase mb-1">Total Realized P/L</div>
                        <div className={`text-xl font-bold ${totalRealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {totalRealizedPL >= 0 ? '+' : ''}{totalRealizedPL.toFixed(4)} SOL
                        </div>
                    </div>
                </div>
            </div>

            {/* Positions List */}
            <div className="p-4">
                <div className="text-xs text-[var(--fs-muted)] uppercase mb-3">Open Positions</div>

                {loading ? (
                    <div className="text-center text-[var(--fs-muted)] py-8">Loading positions...</div>
                ) : positions.length === 0 ? (
                    <div className="text-center text-[var(--fs-muted)] py-8">No open positions</div>
                ) : (
                    <div className="space-y-3">
                        {positions.map((pos) => (
                            <div key={pos.marketId} className="bg-black/30 rounded-lg p-3 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-mono text-sm text-white">{pos.marketId}</span>
                                    {pos.isResolved ? (
                                        <span className="badge badge-primary text-xs">Resolved</span>
                                    ) : (
                                        <span className="text-xs text-[var(--fs-muted)]">{(pos.currentPrice * 100).toFixed(0)}%</span>
                                    )}
                                </div>

                                {pos.yesTokens > 0 && (
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-[var(--fs-danger)]">YES: {pos.yesTokens.toFixed(4)}</span>
                                        <span className={pos.yesPL >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            {pos.yesPL >= 0 ? '+' : ''}{pos.yesPL.toFixed(4)}
                                        </span>
                                    </div>
                                )}

                                {pos.noTokens > 0 && (
                                    <div className="flex justify-between text-xs">
                                        <span className="text-[var(--fs-success)]">NO: {pos.noTokens.toFixed(4)}</span>
                                        <span className={pos.noPL >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            {pos.noPL >= 0 ? '+' : ''}{pos.noPL.toFixed(4)}
                                        </span>
                                    </div>
                                )}

                                {/* Claim Button */}
                                {pos.isResolved && !pos.claimed && (
                                    <button
                                        onClick={() => handleClaim(pos.marketId)}
                                        className="w-full mt-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded border border-green-500/50"
                                    >
                                        Claim Winnings
                                    </button>
                                )}
                                {pos.claimed && (
                                    <div className="mt-2 text-center text-xs text-[var(--fs-muted)] italic">
                                        Claimed
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
