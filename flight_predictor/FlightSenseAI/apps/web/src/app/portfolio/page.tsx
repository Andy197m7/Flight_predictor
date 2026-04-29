"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabase, Market } from "@/lib/supabase";
import idl from "@/lib/idl.json";

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
    market?: Market;
}

interface Trade {
    id: string;
    market_id: string;
    side: string;
    outcome: string;
    shares: number;
    price: number;
    cost: number;
    created_at: string;
    markets?: { flight_iata: string; question: string };
}

export default function PortfolioPage() {
    const [positions, setPositions] = useState<Position[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [solBalance, setSolBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    const wallet = useAnchorWallet();
    const { connection } = useConnection();
    const walletAddress = wallet?.publicKey?.toBase58() || "";

    const program = useMemo(() => {
        if (!wallet) return null;
        const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
        return new Program(idl as Idl, provider);
    }, [connection, wallet]);

    // Fetch real SOL balance from Solana
    const fetchSolBalance = useCallback(async () => {
        if (!wallet?.publicKey) return;
        try {
            const balance = await connection.getBalance(wallet.publicKey);
            setSolBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
            console.error("Failed to fetch SOL balance from " + connection.rpcEndpoint, error);
            // Optional: You could set a visual error state here if desired
        }
    }, [connection, wallet?.publicKey]);

    // Fetch markets from Supabase
    const fetchMarkets = useCallback(async () => {
        try {
            const { data } = await supabase.from("markets").select("*");
            setMarkets(data || []);
        } catch (error) {
            console.error("Failed to fetch markets:", error);
        }
    }, []);

    // Fetch trades from Supabase
    const fetchTrades = useCallback(async () => {
        if (!walletAddress) return;
        try {
            const { data } = await supabase
                .from("orders")
                .select("*, markets(flight_iata, question)")
                .eq("wallet_address", walletAddress)
                .order("created_at", { ascending: false })
                .limit(10);
            setTrades(data || []);
        } catch (error) {
            console.error("Failed to fetch trades:", error);
        }
    }, [walletAddress]);

    // Fetch on-chain positions
    const fetchPositions = useCallback(async () => {
        if (!wallet || !program || markets.length === 0) return;

        try {
            const allPositions: Position[] = [];

            for (const market of markets) {
                try {
                    const [marketPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from("market"), Buffer.from(market.flight_iata)],
                        program.programId
                    );

                    const [positionPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                        program.programId
                    );

                    const positionAccount = await connection.getAccountInfo(positionPda);

                    if (positionAccount) {
                        const data = program.coder.accounts.decode("positionAccount", positionAccount.data);

                        const yesTokens = new BN(data.yesShares || data.yes_shares || 0).toNumber() / 1e9;
                        const noTokens = new BN(data.noShares || data.no_shares || 0).toNumber() / 1e9;
                        const yesCost = new BN(data.yesCostBasis || data.yes_cost_basis || 0).toNumber() / 1e9;
                        const noCost = new BN(data.noCostBasis || data.no_cost_basis || 0).toNumber() / 1e9;

                        if (yesTokens > 0 || noTokens > 0) {
                            // Calculate current price from market pools
                            const yesPool = market.yes_pool || 500;
                            const noPool = market.no_pool || 500;
                            const currentPrice = noPool / (yesPool + noPool);

                            const yesValue = yesTokens * currentPrice;
                            const noValue = noTokens * (1 - currentPrice);
                            const yesPL = yesValue - yesCost;
                            const noPL = noValue - noCost;

                            allPositions.push({
                                marketId: market.flight_iata,
                                yesTokens,
                                noTokens,
                                yesCost,
                                noCost,
                                yesValue,
                                noValue,
                                yesPL,
                                noPL,
                                currentPrice,
                                market,
                            });
                        }
                    }
                } catch (e) {
                    // Position doesn't exist - that's okay
                }
            }

            setPositions(allPositions);
        } catch (error) {
            console.error("Failed to fetch positions:", error);
        }
    }, [wallet, program, markets, connection]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchSolBalance(), fetchMarkets()]);
            setLoading(false);
        };
        loadData();

        // Refresh balance every 10 seconds
        const interval = setInterval(fetchSolBalance, 10000);
        return () => clearInterval(interval);
    }, [fetchSolBalance, fetchMarkets]);

    useEffect(() => {
        fetchPositions();
        fetchTrades();
    }, [fetchPositions, fetchTrades, markets]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen">
                <Header />
                <main className="max-w-7xl mx-auto px-6 py-8">
                    <div className="grid gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="glass-card h-32 shimmer rounded-2xl" />
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    const totalPositionValue = positions.reduce((sum, p) => sum + p.yesValue + p.noValue, 0);
    const totalUnrealizedPL = positions.reduce((sum, p) => sum + p.yesPL + p.noPL, 0);
    const totalValue = solBalance + totalPositionValue;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <Header>
                <Link
                    href="/markets"
                    className="px-4 py-2 rounded-xl bg-[var(--fs-accent)] text-[var(--fs-primary)] font-semibold hover:opacity-90 transition-opacity"
                >
                    Trade
                </Link>
                <WalletMultiButton className="!bg-[var(--fs-accent)] hover:!bg-[var(--fs-accent)]/80 !rounded-xl !h-10" />
            </Header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Portfolio Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-6 rounded-2xl">
                        <p className="text-sm text-[var(--fs-muted)] mb-1">Total Value</p>
                        <p className="text-3xl font-bold text-white mono">
                            {totalValue.toFixed(4)} SOL
                        </p>
                    </div>
                    <div className="glass-card p-6 rounded-2xl">
                        <p className="text-sm text-[var(--fs-muted)] mb-1">SOL Balance</p>
                        <p className="text-3xl font-bold text-[var(--fs-success)] mono">
                            {solBalance.toFixed(4)} SOL
                        </p>
                    </div>
                    <div className="glass-card p-6 rounded-2xl">
                        <p className="text-sm text-[var(--fs-muted)] mb-1">Position Value</p>
                        <p className="text-3xl font-bold text-[var(--fs-accent)] mono">
                            {totalPositionValue.toFixed(4)} SOL
                        </p>
                    </div>
                    <div className="glass-card p-6 rounded-2xl">
                        <p className="text-sm text-[var(--fs-muted)] mb-1">Unrealized P&L</p>
                        <p className={`text-3xl font-bold mono ${totalUnrealizedPL >= 0
                            ? "text-[var(--fs-success)]"
                            : "text-[var(--fs-danger)]"
                            }`}>
                            {totalUnrealizedPL >= 0 ? "+" : ""}
                            {totalUnrealizedPL.toFixed(4)} SOL
                        </p>
                    </div>
                </div>

                {/* Wallet Connection Check */}
                {!wallet && (
                    <div className="glass-card p-8 rounded-2xl text-center mb-8">
                        <p className="text-[var(--fs-muted)] text-lg mb-2">Connect your wallet to view portfolio</p>
                        <p className="text-sm text-[var(--fs-muted)]">
                            Your positions are stored on-chain and linked to your Solana wallet
                        </p>
                    </div>
                )}

                {/* Active Positions */}
                <section className="mb-10">
                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[var(--fs-accent)]" />
                        Active Positions
                        {positions.length > 0 && (
                            <span className="badge bg-[var(--fs-accent)]/20 text-[var(--fs-accent)] border-[var(--fs-accent)]/30">
                                {positions.length}
                            </span>
                        )}
                    </h2>

                    {positions.length === 0 ? (
                        <div className="glass-card p-12 rounded-2xl text-center">
                            <p className="text-[var(--fs-muted)] text-lg mb-2">No active positions</p>
                            <p className="text-sm text-[var(--fs-muted)] mb-6">
                                Start trading on the markets page to build your portfolio
                            </p>
                            <Link
                                href="/markets"
                                className="inline-block px-6 py-3 rounded-xl bg-[var(--fs-accent)] text-[var(--fs-primary)] font-semibold"
                            >
                                Browse Markets
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {positions.map((position) => {
                                const totalPL = position.yesPL + position.noPL;
                                const pnlPositive = totalPL >= 0;

                                return (
                                    <div key={position.marketId} className="glass-card p-5 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            {/* Position Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="mono text-white font-medium text-lg">
                                                        {position.marketId}
                                                    </span>
                                                    {position.yesTokens > 0 && (
                                                        <span className="badge badge-success">YES</span>
                                                    )}
                                                    {position.noTokens > 0 && (
                                                        <span className="badge badge-danger">NO</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-[var(--fs-muted)] line-clamp-1">
                                                    {position.market?.question || "Loading..."}
                                                </p>
                                            </div>

                                            {/* Position Stats */}
                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <p className="text-xs text-[var(--fs-muted)]">Shares</p>
                                                    <p className="mono text-white font-medium">
                                                        {(position.yesTokens + position.noTokens).toFixed(4)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-[var(--fs-muted)]">Value</p>
                                                    <p className="mono text-[var(--fs-accent)] font-medium">
                                                        {(position.yesValue + position.noValue).toFixed(4)} SOL
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-[var(--fs-muted)]">P&L</p>
                                                    <p className={`mono font-bold ${pnlPositive ? "text-[var(--fs-success)]" : "text-[var(--fs-danger)]"
                                                        }`}>
                                                        {pnlPositive ? "+" : ""}{totalPL.toFixed(4)} SOL
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Recent Trades */}
                <section>
                    <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[var(--fs-muted)]" />
                        Recent Trades
                    </h2>

                    {trades.length === 0 ? (
                        <div className="glass-card p-8 rounded-2xl text-center">
                            <p className="text-[var(--fs-muted)]">No trades yet</p>
                        </div>
                    ) : (
                        <div className="glass-card rounded-2xl overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[var(--glass-border)]">
                                        <th className="px-6 py-4 text-left text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Market
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Side
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Outcome
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Shares
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Price
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Total
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs text-[var(--fs-muted)] uppercase tracking-wider">
                                            Time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map((trade) => (
                                        <tr key={trade.id} className="border-b border-[var(--glass-border)]/50">
                                            <td className="px-6 py-4">
                                                <span className="mono text-white">
                                                    {trade.markets?.flight_iata || trade.market_id.slice(0, 8)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`badge ${trade.side === "buy" ? "badge-success" : "badge-warning"
                                                    }`}>
                                                    {trade.side.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={
                                                    trade.outcome === "YES" ? "text-[var(--fs-success)]" : "text-[var(--fs-danger)]"
                                                }>
                                                    {trade.outcome}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right mono text-white">
                                                {trade.shares.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right mono text-white">
                                                {trade.price.toFixed(4)} SOL
                                            </td>
                                            <td className="px-6 py-4 text-right mono text-[var(--fs-accent)] font-medium">
                                                {trade.cost.toFixed(4)} SOL
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-[var(--fs-muted)]">
                                                {formatTime(trade.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
