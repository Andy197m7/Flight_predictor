"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "@/lib/utils";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import idl from "@/lib/idl.json";
import { FlightDetailsModal } from "./FlightDetailsModal";

interface FlightPrediction {
    flight_id: string;
    route: string;
    scheduled_departure: string;
    disruption_type: string;
    disruption_probability: number;
    confidence: number;
    recommendation: string;
    contributing_signals: Array<{
        source: string;
        signal_id: string;
        probability: number;
        weight: number;
    }>;
    status?: string;
    raw_data?: { yesShares: number, noShares: number, price: number };
}

interface FlightCardProps {
    flight: FlightPrediction;
    priority: "high" | "medium" | "low";
    onRefresh?: () => void;
}

export function FlightCard({ flight, priority, onRefresh }: FlightCardProps) {
    const probability = Math.round(flight.disruption_probability * 100);
    const [departure, arrival] = flight.route.split("-");
    const [isTrading, setIsTrading] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    // Trading State
    const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
    const [outcome, setOutcome] = useState<"yes" | "no">("yes");
    const [amount, setAmount] = useState("0.1");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    // User Position State with P/L
    const [userPosition, setUserPosition] = useState<{
        yesSOL: number,
        noSOL: number,
        yesCostBasis: number,
        noCostBasis: number,
        yesAvgPrice: number,
        noAvgPrice: number,
        yesCurrentValue: number,
        noCurrentValue: number,
        yesPL: number,
        noPL: number,
    } | null>(null);

    const wallet = useAnchorWallet();
    const { connection } = useConnection();

    // Fetch user position with P/L calculations when trade panel opens
    useEffect(() => {
        const fetchPosition = async () => {
            if (!wallet || !isTrading) return;
            try {
                const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
                const program = new Program(idl as Idl, provider);

                const [marketPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("market"), Buffer.from(flight.flight_id)],
                    program.programId
                );

                const [positionPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                    program.programId
                );

                const positionAccount = await connection.getAccountInfo(positionPda);
                if (positionAccount) {
                    let yesShares = 0, noShares = 0, yesCostBasis = 0, noCostBasis = 0;

                    try {
                        const data = program.coder.accounts.decode("positionAccount", positionAccount.data);
                        yesShares = new BN(data.yesShares || data.yes_shares || 0).toNumber();
                        noShares = new BN(data.noShares || data.no_shares || 0).toNumber();
                        yesCostBasis = new BN(data.yesCostBasis || data.yes_cost_basis || 0).toNumber();
                        noCostBasis = new BN(data.noCostBasis || data.no_cost_basis || 0).toNumber();
                    } catch (decodeErr) {
                        // Old position account without cost_basis fields - skip cost tracking
                        console.warn("Old position account detected, cost tracking unavailable:", decodeErr);
                        // Try to at least get shares from raw buffer (fallback)
                        try {
                            const buffer = positionAccount.data;
                            // Skip 8-byte discriminator + 32-byte owner
                            yesShares = Number(buffer.readBigUInt64LE(40));
                            noShares = Number(buffer.readBigUInt64LE(48));
                        } catch { /* ignore */ }
                    }

                    // Current price from market
                    const yesPrice = flight.disruption_probability;
                    const noPrice = 1 - yesPrice;

                    // Convert everything to SOL first for consistent calculations
                    const yesSharesSOL = yesShares / 1_000_000_000;
                    const noSharesSOL = noShares / 1_000_000_000;
                    const yesCostSOL = yesCostBasis / 1_000_000_000;
                    const noCostSOL = noCostBasis / 1_000_000_000;

                    // Avg entry price (cost per share in SOL terms)
                    const yesAvgPrice = yesSharesSOL > 0 ? yesCostSOL / yesSharesSOL : 0;
                    const noAvgPrice = noSharesSOL > 0 ? noCostSOL / noSharesSOL : 0;

                    // Current value (what you'd get if you sold now at market price)
                    // tokens * price = value in SOL
                    const yesCurrentValue = yesSharesSOL * yesPrice;
                    const noCurrentValue = noSharesSOL * noPrice;

                    // Unrealized P/L = current value - cost basis (both in SOL now)
                    const yesPL = yesCurrentValue - yesCostSOL;
                    const noPL = noCurrentValue - noCostSOL;

                    setUserPosition({
                        yesSOL: yesSharesSOL,
                        noSOL: noSharesSOL,
                        yesCostBasis: yesCostSOL,
                        noCostBasis: noCostSOL,
                        yesAvgPrice,
                        noAvgPrice,
                        yesCurrentValue,
                        noCurrentValue,
                        yesPL,
                        noPL,
                    });
                } else {
                    setUserPosition({ yesSOL: 0, noSOL: 0, yesCostBasis: 0, noCostBasis: 0, yesAvgPrice: 0, noAvgPrice: 0, yesCurrentValue: 0, noCurrentValue: 0, yesPL: 0, noPL: 0 });
                }
            } catch (e) {
                console.error("Failed to fetch position:", e);
                setUserPosition({ yesSOL: 0, noSOL: 0, yesCostBasis: 0, noCostBasis: 0, yesAvgPrice: 0, noAvgPrice: 0, yesCurrentValue: 0, noCurrentValue: 0, yesPL: 0, noPL: 0 });
            }
        };
        fetchPosition();
    }, [wallet, isTrading, connection, flight.flight_id, flight.disruption_probability, msg]);

    // Estimate Payout logic for UI
    const price = flight.disruption_probability;
    const isYes = outcome === "yes";
    // If trade YES, price is `price`. If trade NO, price is `1-price`.
    const tradePrice = isYes ? price : (1 - price);

    const handleTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wallet) return;

        try {
            setLoading(true);
            setMsg("Processing...");

            const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
            const program = new Program(idl as Idl, provider);

            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(flight.flight_id)],
                program.programId
            );

            const marketAccount = await connection.getAccountInfo(marketPda);
            if (!marketAccount) {
                setMsg("Market not initialized! Contact admin.");
                setLoading(false);
                return;
            }

            const [positionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            const outcomeVal = outcome === "yes" ? { yes: {} } : { no: {} };

            if (tradeAction === "buy") {
                const lamports = new BN(parseFloat(amount) * 1_000_000_000);
                await program.methods
                    .buy(outcomeVal, lamports)
                    .accounts({
                        market: marketPda,
                        position: positionPda,
                        user: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    } as any)
                    .rpc();
                setMsg("Buy successful!");
                console.log("✅ Buy successful!");
            } else {
                // Sell: In SOL-pool model, 1 share = 1 lamport
                // So selling X SOL worth means selling X * 1e9 shares
                const sharesToSell = new BN(parseFloat(amount) * 1_000_000_000);
                await program.methods
                    .sell(outcomeVal, sharesToSell)
                    .accounts({
                        market: marketPda,
                        position: positionPda,
                        user: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    } as any)
                    .rpc();
                setMsg("Sell successful!");
                console.log("✅ Sell successful!");
            }

            // Refresh with a longer delay to allow Solana state to propagate across more nodes
            setTimeout(async () => {
                console.log("🔄 Triggering delayed market data refresh...");
                if (onRefresh) onRefresh();
                setMsg(prev => prev + " (Refreshed)");
            }, 3500);

            setTimeout(() => {
                setIsTrading(false);
                setMsg("");
            }, 6000);
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes("MarketNotActive") || err.message?.includes("6000")) {
                setMsg("Market is closed/resolved. You can only claim winnings now.");
            } else {
                setMsg("Failed: " + (err.message || "Error"));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!wallet) return;
        try {
            setLoading(true);
            setMsg("Claiming...");
            const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
            const program = new Program(idl as Idl, provider);

            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(flight.flight_id)],
                program.programId
            );

            const [positionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            await program.methods
                .claim()
                .accounts({
                    market: marketPda,
                    position: positionPda,
                    user: wallet.publicKey,
                } as any)
                .rpc();

            setMsg("Payout Claimed!");
            setTimeout(() => setMsg(""), 3000);
        } catch (err: any) {
            console.error(err);
            setMsg("Error/Nothing to claim");
        } finally {
            setLoading(false);
        }
    };

    const getProbabilityClass = () => {
        if (probability >= 65) return "probability-high";
        if (probability >= 30) return "probability-medium";
        return "probability-low";
    };

    const getDisruptionLabel = () => {
        switch (flight.disruption_type) {
            case "cancellation":
                return "Cancellation Risk";
            case "delay_2hr_6hr":
                return "Major Delay Risk";
            case "delay_30min_2hr":
                return "Minor Delay Risk";
            default:
                return "Monitoring";
        }
    };

    const departureDate = new Date(flight.scheduled_departure);
    const timeUntil = formatDistanceToNow(departureDate);

    return (
        <div
            className={`glass-card flight-card p-5 ${priority === "high" ? "border-[var(--fs-danger)]/30" : ""
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => setShowDetailsModal(true)}
                    className="mono text-lg font-semibold text-[var(--fs-accent)] hover:text-[var(--fs-accent)]/80 hover:underline transition-colors cursor-pointer"
                >
                    {flight.flight_id}
                </button>
                <div className="flex flex-col items-end">
                    <span
                        className={`badge ${priority === "high" ? "badge-danger" : "badge-warning"
                            }`}
                    >
                        {getDisruptionLabel()}
                    </span>
                    {flight.raw_data && (
                        <span className="text-[10px] text-white/20 mt-1 mono">
                            Y:{flight.raw_data.yesShares} N:{flight.raw_data.noShares}
                        </span>
                    )}
                </div>
            </div>

            {/* Route */}
            <div className="flex items-center gap-3 mb-4">
                <div className="text-center">
                    <div className="mono text-2xl font-bold">{departure}</div>
                    <div className="text-xs text-[var(--fs-muted)]">Departure</div>
                </div>
                <div className="flex-1 flex items-center">
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-[var(--fs-accent)] to-transparent"></div>
                    <svg
                        className="w-5 h-5 text-[var(--fs-accent)] mx-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                    </svg>
                    <div className="h-[2px] flex-1 bg-gradient-to-l from-[var(--fs-accent)] to-transparent"></div>
                </div>
                <div className="text-center">
                    <div className="mono text-2xl font-bold">{arrival}</div>
                    <div className="text-xs text-[var(--fs-muted)]">Arrival</div>
                </div>
            </div>

            {/* Probability Meter */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[var(--fs-muted)]">
                        Disruption Probability
                    </span>
                    <span
                        className={`mono text-lg font-bold ${priority === "high" ? "text-[var(--fs-danger)]" : "text-[var(--fs-warning)]"
                            }`}
                    >
                        {probability}%
                    </span>
                </div>
                <div className="probability-bar">
                    <div
                        className={`probability-fill ${getProbabilityClass()}`}
                        style={{ width: `${probability}%` }}
                    ></div>
                </div>
            </div>

            {/* Details */}
            <div className="flex justify-between items-center text-sm mb-4">
                <div className="text-[var(--fs-muted)]">
                    Departs {isNaN(departureDate.getTime()) ? flight.scheduled_departure : timeUntil}
                </div>
            </div>

            {/* Trading Interface */}
            <div className="pt-4 border-t border-white/5">
                {flight.status === "Resolved" ? (
                    <div className="text-center py-4">
                        <div className="text-sm text-[var(--fs-warning)] mb-2">🏁 Market Resolved</div>
                        <button
                            onClick={handleClaim}
                            disabled={loading}
                            className="w-full py-2 bg-[var(--fs-success)]/10 hover:bg-[var(--fs-success)]/20 text-[var(--fs-success)] rounded-lg text-sm font-semibold transition-colors border border-[var(--fs-success)]/20"
                        >
                            {loading ? "Claiming..." : "Claim Winnings"}
                        </button>
                    </div>
                ) : !isTrading ? (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsTrading(true)}
                            className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors"
                        >
                            Trade
                        </button>
                        <button
                            onClick={handleClaim}
                            className="flex-1 py-2 bg-[var(--fs-success)]/10 hover:bg-[var(--fs-success)]/20 text-[var(--fs-success)] rounded-lg text-sm font-semibold transition-colors border border-[var(--fs-success)]/20"
                        >
                            Claim Winnings
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleTrade} className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        {/* Buy/Sell Tabs */}
                        <div className="flex bg-black/40 rounded-lg p-1 mb-2">
                            <button
                                type="button"
                                onClick={() => { setTradeAction("buy"); setAmount("0.1"); }}
                                className={`flex-1 py-1 text-xs font-bold rounded ${tradeAction === "buy" ? "bg-[var(--fs-accent)] text-black" : "text-[var(--fs-muted)]"}`}
                            >
                                BUY
                            </button>
                            <button
                                type="button"
                                onClick={() => { setTradeAction("sell"); setAmount("100"); }}
                                className={`flex-1 py-1 text-xs font-bold rounded ${tradeAction === "sell" ? "bg-[var(--fs-warning)] text-black" : "text-[var(--fs-muted)]"}`}
                            >
                                SELL
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setOutcome("yes")}
                                className={`py-2 rounded text-xs font-bold transition-colors ${outcome === "yes" ? "bg-[var(--fs-danger)] text-white ring-2 ring-white/20 shadow-lg shadow-red-500/20" : "bg-white/5 text-[var(--fs-muted)]"
                                    }`}
                            >
                                <div className="text-[10px] uppercase opacity-70 mb-1">Bet Disruption</div>
                                <div className="text-lg">YES</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setOutcome("no")}
                                className={`py-2 rounded text-xs font-bold transition-colors ${outcome === "no" ? "bg-[var(--fs-success)] text-white ring-2 ring-white/20 shadow-lg shadow-green-500/20" : "bg-white/5 text-[var(--fs-muted)]"
                                    }`}
                            >
                                <div className="text-[10px] uppercase opacity-70 mb-1">Bet Safe</div>
                                <div className="text-lg">NO</div>
                            </button>
                        </div>

                        {/* User Position Display with P/L */}
                        {userPosition && (userPosition.yesSOL > 0 || userPosition.noSOL > 0) && (
                            <div className="bg-gradient-to-br from-black/40 to-black/20 p-4 rounded-xl border border-white/10 mb-3">
                                <div className="text-xs text-[var(--fs-muted)] mb-3 uppercase tracking-wider">Your Portfolio</div>

                                {/* YES Position */}
                                {userPosition.yesSOL > 0 && (
                                    <div className="mb-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[var(--fs-danger)] font-bold">YES</span>
                                            <span className="text-white font-mono">{userPosition.yesSOL.toFixed(4)} SOL</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-[var(--fs-muted)]">Avg Price: </span>
                                                <span className="text-white">{(userPosition.yesAvgPrice * 100).toFixed(1)}¢</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--fs-muted)]">Cost: </span>
                                                <span className="text-white">{userPosition.yesCostBasis.toFixed(4)} SOL</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--fs-muted)]">Value: </span>
                                                <span className="text-white">{userPosition.yesCurrentValue.toFixed(4)} SOL</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--fs-muted)]">P/L: </span>
                                                <span className={userPosition.yesPL >= 0 ? "text-green-400" : "text-red-400"}>
                                                    {userPosition.yesPL >= 0 ? "+" : ""}{userPosition.yesPL.toFixed(4)} SOL
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* NO Position */}
                                {userPosition.noSOL > 0 && (
                                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[var(--fs-success)] font-bold">NO</span>
                                            <span className="text-white font-mono">{userPosition.noSOL.toFixed(4)} SOL</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-[var(--fs-muted)]">Avg Price: </span>
                                                <span className="text-white">{(userPosition.noAvgPrice * 100).toFixed(1)}¢</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--fs-muted)]">Cost: </span>
                                                <span className="text-white">{userPosition.noCostBasis.toFixed(4)} SOL</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--fs-muted)]">Value: </span>
                                                <span className="text-white">{userPosition.noCurrentValue.toFixed(4)} SOL</span>
                                            </div>
                                            <div>
                                                <span className="text-[var(--fs-muted)]">P/L: </span>
                                                <span className={userPosition.noPL >= 0 ? "text-green-400" : "text-red-400"}>
                                                    {userPosition.noPL >= 0 ? "+" : ""}{userPosition.noPL.toFixed(4)} SOL
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Potential Payouts */}
                                <div className="mt-3 pt-3 border-t border-white/10 text-xs">
                                    <div className="flex justify-between text-[var(--fs-muted)]">
                                        <span>If YES wins:</span>
                                        <span className="text-green-400">+{((userPosition.yesSOL * (1 / flight.disruption_probability)) - userPosition.yesCostBasis).toFixed(4)} SOL</span>
                                    </div>
                                    <div className="flex justify-between text-[var(--fs-muted)]">
                                        <span>If NO wins:</span>
                                        <span className="text-green-400">+{((userPosition.noSOL * (1 / (1 - flight.disruption_probability))) - userPosition.noCostBasis).toFixed(4)} SOL</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                            <div className="flex justify-between text-xs text-[var(--fs-muted)] mb-2">
                                <span>{tradeAction === "buy" ? "Amount (SOL)" : "Tokens to Sell"}</span>
                                {tradeAction === "sell" && userPosition && (
                                    <button
                                        type="button"
                                        onClick={() => setAmount((outcome === "yes" ? userPosition.yesSOL : userPosition.noSOL).toFixed(6))}
                                        className="text-[var(--fs-accent)] hover:underline"
                                    >
                                        Max ({(outcome === "yes" ? userPosition.yesSOL : userPosition.noSOL).toFixed(4)})
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--fs-accent)] text-white"
                                    placeholder="0.1"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !wallet}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity ${tradeAction === "buy"
                                        ? "bg-gradient-to-r from-[var(--fs-accent)] to-[var(--fs-primary)]"
                                        : "bg-gradient-to-r from-[var(--fs-warning)] to-orange-700"
                                        }`}
                                >
                                    {loading ? "..." : (tradeAction === "buy" ? "Confirm" : "Sell")}
                                </button>
                            </div>

                            {/* Price Impact Preview */}
                            {parseFloat(amount) > 0 && (
                                <div className="mt-2 p-2 bg-black/30 rounded text-xs">
                                    <div className="flex justify-between text-[var(--fs-muted)]">
                                        <span>Est. Price Impact:</span>
                                        <span className={tradeAction === "buy" && outcome === "yes" ? "text-green-400" : "text-red-400"}>
                                            {tradeAction === "buy"
                                                ? (outcome === "yes" ? "↑" : "↓") + " ~" + ((parseFloat(amount) / 0.2) * 5).toFixed(1) + "%"
                                                : (outcome === "yes" ? "↓" : "↑") + " ~" + ((parseFloat(amount) / 0.2) * 5).toFixed(1) + "%"
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {msg && <div className={`text-xs text-center ${msg.includes("Success") ? "text-green-400" : "text-red-400"}`}>{msg}</div>}
                        <button
                            type="button"
                            onClick={() => setIsTrading(false)}
                            className="w-full text-xs text-[var(--fs-muted)] hover:text-white py-1"
                        >
                            Cancel
                        </button>
                    </form>
                )}
            </div>

            {/* Signals (Hidden when trading to save space) */}
            {!isTrading && flight.contributing_signals.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="text-xs text-[var(--fs-muted)] mb-2">Signal Sources</div>
                    <div className="flex flex-wrap gap-2">
                        {flight.contributing_signals.slice(0, 3).map((signal) => (
                            <span
                                key={signal.signal_id}
                                className="px-2 py-1 bg-white/5 rounded text-xs mono"
                            >
                                {signal.source.replace("_", " ")}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Flight Details Modal */}
            <FlightDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                flight={{
                    flight_id: flight.flight_id,
                    route: flight.route,
                    scheduled_departure: flight.scheduled_departure,
                    disruption_probability: flight.disruption_probability,
                    disruption_type: flight.disruption_type,
                    status: flight.status,
                }}
            />
        </div>
    );
}
