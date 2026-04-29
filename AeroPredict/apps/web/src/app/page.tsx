"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { supabase, Market, calculatePrice, formatVolume } from "@/lib/supabase";
import { FlightDetailsModal } from "@/components/FlightDetailsModal";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import idl from "@/lib/idl.json";

export default function MarketsPage() {
    const [markets, setMarkets] = useState<Market[]>([]);
    const [solBalance, setSolBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");
    const [showInactive, setShowInactive] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);

    const router = useRouter();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();

    const handleAdminLogin = () => {
        if (adminPassword === "americanairlines") {
            setShowAdminModal(false);
            setAdminPassword("");
            setPasswordError(false);
            router.push("/admin");
        } else {
            setPasswordError(true);
        }
    };

    // Create Anchor program instance
    const program = useMemo(() => {
        if (!anchorWallet) return null;
        const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
        return new Program(idl as Idl, provider);
    }, [connection, anchorWallet]);

    // Mock inactive/resolved markets for demo purposes
    const mockInactiveMarkets: Market[] = [
        {
            id: "mock-resolved-1",
            flight_iata: "UA789",
            departure_airport: "SFO",
            arrival_airport: "ORD",
            scheduled_departure: "2025-01-20T14:30:00Z",
            event_type: "delay_30_min",
            question: "Will UA789 from SFO to ORD be delayed by 30+ minutes?",
            description: "Flight was delayed due to weather",
            yes_pool: 1.5,
            no_pool: 0.8,
            volume: 2.3,
            status: "resolved",
            resolved_outcome: "YES",
            win_probability: 0.65,
            weather_risk_score: 0.4,
            created_at: "2025-01-19T10:00:00Z",
            updated_at: "2025-01-20T16:00:00Z",
        },
        {
            id: "mock-resolved-2",
            flight_iata: "DL456",
            departure_airport: "ATL",
            arrival_airport: "LAX",
            scheduled_departure: "2025-01-18T09:00:00Z",
            event_type: "cancellation",
            question: "Will DL456 from ATL to LAX be cancelled?",
            description: "Flight was not cancelled",
            yes_pool: 0.3,
            no_pool: 2.1,
            volume: 2.4,
            status: "resolved",
            resolved_outcome: "NO",
            win_probability: 0.12,
            weather_risk_score: 0.1,
            created_at: "2025-01-17T08:00:00Z",
            updated_at: "2025-01-18T12:00:00Z",
        },
        {
            id: "mock-resolved-3",
            flight_iata: "AA321",
            departure_airport: "DFW",
            arrival_airport: "MIA",
            scheduled_departure: "2025-01-15T11:45:00Z",
            event_type: "on_time",
            question: "Will AA321 from DFW to MIA arrive on time?",
            description: "Flight arrived on time",
            yes_pool: 1.8,
            no_pool: 0.6,
            volume: 2.4,
            status: "resolved",
            resolved_outcome: "YES",
            win_probability: 0.75,
            weather_risk_score: 0.05,
            created_at: "2025-01-14T09:00:00Z",
            updated_at: "2025-01-15T14:00:00Z",
        },
    ];

    const fetchMarkets = useCallback(async (includeInactive: boolean) => {
        try {
            setLoading(true);
            // Fetch markets directly from Supabase
            let query = supabase.from("markets").select("*");

            // Filter by status based on toggle
            if (!includeInactive) {
                query = query.eq("status", "active");
            }

            const { data, error } = await query.order("volume", { ascending: false });

            if (error) {
                console.error("Supabase error:", error);
                return;
            }

            // Add mock inactive markets when showing all markets
            let allMarkets = data || [];
            if (includeInactive) {
                allMarkets = [...allMarkets, ...mockInactiveMarkets];
            }

            console.log(`Fetched ${allMarkets.length} markets (includeInactive: ${includeInactive})`);
            setMarkets(allMarkets);
        } catch (error) {
            console.error("Failed to fetch markets:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSolBalance = useCallback(async () => {
        if (!anchorWallet?.publicKey) return;

        try {
            const balance = await connection.getBalance(anchorWallet.publicKey);
            setSolBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
            console.error("Failed to fetch SOL balance from " + connection.rpcEndpoint, error);
        }
    }, [connection, anchorWallet?.publicKey]);

    // Fetch markets when showInactive changes
    useEffect(() => {
        fetchMarkets(showInactive);
    }, [showInactive, fetchMarkets]);

    // Set up real-time subscriptions and polling
    useEffect(() => {
        fetchSolBalance();

        // Subscribe to real-time updates
        const subscription = supabase
            .channel("markets_changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "markets" }, () => {
                fetchMarkets(showInactive);
            })
            .subscribe();

        // Poll every 30 seconds as backup
        const marketsInterval = setInterval(() => fetchMarkets(showInactive), 30000);
        const balanceInterval = setInterval(fetchSolBalance, 10000);

        return () => {
            subscription.unsubscribe();
            clearInterval(marketsInterval);
            clearInterval(balanceInterval);
        };
    }, [fetchMarkets, fetchSolBalance, showInactive]);

    const filteredMarkets = markets.filter((m) => {
        if (filter === "all") return true;
        return m.event_type === filter;
    });

    const eventTypeLabels: Record<string, string> = {
        on_time: "On Time",
        delay_30_min: "30+ Min Delay",
        delay_1_hour: "1+ Hour Delay",
        cancellation: "Cancellation",
    };

    const activeCount = markets.filter(m => m.status === 'active').length;
    const highRiskCount = markets.filter(m => (m.win_probability || 0) > 0.5).length;
    const weatherAlertCount = markets.filter(m => (m.weather_risk_score || 0) > 0.3).length;

    return (
        <div className="min-h-screen">
            {/* Header */}
            <Header>
                {/* Wallet Balance & Connect Button */}
                <div className="flex items-center gap-4">
                    {anchorWallet && (
                        <div className="glass-card px-4 py-2 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--fs-success)] to-[var(--fs-accent)] flex items-center justify-center">
                                <span className="text-xs font-bold text-[var(--fs-primary)]">◎</span>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--fs-muted)]">Balance</p>
                                <p className="font-bold text-white mono">
                                    {`${solBalance.toFixed(4)} SOL`}
                                </p>
                            </div>
                        </div>
                    )}
                    <WalletMultiButton className="!bg-[var(--fs-accent)] hover:!bg-[var(--fs-accent)]/80 !rounded-xl !h-10" />
                </div>
            </Header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">Total Markets</p>
                        <p className="text-2xl font-bold text-white mono">{markets.length}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">Total Volume</p>
                        <p className="text-2xl font-bold text-[var(--fs-accent)] mono">
                            {formatVolume(markets.reduce((sum, m) => sum + m.volume, 0))}
                        </p>
                    </div>
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">High Risk</p>
                        <p className="text-2xl font-bold text-[var(--fs-danger)] mono">
                            {highRiskCount}
                        </p>
                    </div>
                    <div className="glass-card p-4 rounded-xl">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">Weather Alerts</p>
                        <p className="text-2xl font-bold text-[var(--fs-warning)] mono">
                            {weatherAlertCount}
                        </p>
                    </div>
                </div>

                {/* Title Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Flight Prediction Markets
                    </h1>
                    <p className="text-[var(--fs-muted)]">
                        Trade on flight outcomes. Buy YES if you think it will happen, NO if it won't. Volume in SOL.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                        {["all", "on_time", "delay_30_min", "cancellation"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f
                                    ? "bg-[var(--fs-accent)] text-[var(--fs-primary)]"
                                    : "glass-card text-white hover:bg-white/10"
                                    }`}
                            >
                                {f === "all" ? "All Markets" : eventTypeLabels[f]}
                            </button>
                        ))}
                    </div>

                    {/* Show Inactive Toggle */}
                    <button
                        onClick={() => setShowInactive(!showInactive)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${showInactive
                            ? "bg-[var(--fs-accent)] text-[var(--fs-primary)]"
                            : "glass-card text-white hover:bg-white/10"
                            }`}
                    >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${showInactive
                            ? "bg-[var(--fs-primary)] border-[var(--fs-primary)]"
                            : "border-white/40"
                            }`}>
                            {showInactive && (
                                <svg className="w-3 h-3 text-[var(--fs-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        Show Inactive Markets
                    </button>
                </div>

                {/* Markets Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="glass-card h-72 shimmer rounded-2xl" />
                        ))}
                    </div>
                ) : filteredMarkets.length === 0 ? (
                    <div className="glass-card p-12 text-center rounded-2xl">
                        <p className="text-[var(--fs-muted)] text-lg">No markets found</p>
                        <p className="text-sm text-[var(--fs-muted)] mt-2">
                            {showInactive
                                ? "No markets match your filters."
                                : "Try enabling 'Show Inactive Markets' to see resolved markets."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMarkets.map((market) => (
                            <MarketCard
                                key={market.id}
                                market={market}
                                program={program}
                                wallet={anchorWallet}
                                connection={connection}
                                onTrade={() => {
                                    fetchMarkets(showInactive);
                                    fetchSolBalance();
                                }}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Admin Button - Bottom Right */}
            <button
                onClick={() => setShowAdminModal(true)}
                className="fixed bottom-6 right-6 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-all backdrop-blur-sm"
            >
                Go to Admin
            </button>

            {/* Admin Password Modal */}
            {showAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => {
                            setShowAdminModal(false);
                            setAdminPassword("");
                            setPasswordError(false);
                        }}
                    />
                    <div className="relative bg-[var(--fs-primary)] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-4">Admin Access</h3>
                        <input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => {
                                setAdminPassword(e.target.value);
                                setPasswordError(false);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                            placeholder="Enter password"
                            className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[var(--fs-accent)] transition-colors ${
                                passwordError ? "border-red-500" : "border-white/10"
                            }`}
                            autoFocus
                        />
                        {passwordError && (
                            <p className="text-red-400 text-sm mt-2">Incorrect password</p>
                        )}
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setShowAdminModal(false);
                                    setAdminPassword("");
                                    setPasswordError(false);
                                }}
                                className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdminLogin}
                                className="flex-1 py-2 bg-[var(--fs-accent)] hover:opacity-90 rounded-lg text-[var(--fs-primary)] text-sm font-bold transition-opacity"
                            >
                                Enter
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Market Card Component - Now with On-Chain Trading and Details Modal
function MarketCard({
    market,
    program,
    wallet,
    connection,
    onTrade
}: {
    market: Market;
    program: Program<Idl> | null;
    wallet: ReturnType<typeof useAnchorWallet>;
    connection: ReturnType<typeof useConnection>["connection"];
    onTrade: () => void;
}) {
    const [showTrade, setShowTrade] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [tradeOutcome, setTradeOutcome] = useState<"YES" | "NO">("YES");
    const [amount, setAmount] = useState("0.1"); // Amount in SOL
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const { yesPrice, noPrice } = calculatePrice(market);
    const yesPercent = Math.round(yesPrice * 100);
    const noPercent = Math.round(noPrice * 100);

    // Calculate the calculated risk
    const calculatedRisk = market.event_type === 'on_time'
        ? Math.round((1 - (market.win_probability || 0.5)) * 100)
        : Math.round((market.win_probability || 0.5) * 100);

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return "TBD";
        const date = new Date(dateStr);
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const getEventBadge = (eventType: string) => {
        const badges: Record<string, { label: string; class: string }> = {
            on_time: { label: "On Time", class: "badge-success" },
            delay_30_min: { label: "Delay 30m", class: "badge-warning" },
            delay_1_hour: { label: "Delay 1h", class: "badge-warning" },
            cancellation: { label: "Cancel", class: "badge-danger" },
        };
        return badges[eventType] || { label: eventType, class: "badge-warning" };
    };

    // On-Chain Trade via Anchor Program
    const handleTrade = async () => {
        if (!wallet || !program) {
            setMessage("Connect wallet first");
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            // Use flight_iata as the market ID for on-chain lookup
            const marketId = market.flight_iata;

            // Find the market PDA
            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(marketId)],
                program.programId
            );

            // Check if market exists on-chain
            const marketAccount = await connection.getAccountInfo(marketPda);
            if (!marketAccount) {
                setMessage(`Market not on-chain yet. Please initialize: ${marketId}`);
                setLoading(false);
                return;
            }

            // Find the position PDA
            const [positionPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("position"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
                program.programId
            );

            // Convert SOL to lamports
            const lamports = new BN(parseFloat(amount) * LAMPORTS_PER_SOL);

            // Determine outcome
            const outcomeVal = tradeOutcome === "YES" ? { yes: {} } : { no: {} };

            // Execute buy transaction
            await program.methods
                .buy(outcomeVal, lamports)
                .accounts({
                    market: marketPda,
                    position: positionPda,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc();

            setMessage(`Bought ${amount} SOL of ${tradeOutcome}!`);

            // Refresh after trade
            setTimeout(() => {
                onTrade();
                setShowTrade(false);
                setMessage(null);
            }, 2500);

        } catch (error: any) {
            console.error("Trade error:", error);
            if (error.message?.includes("MarketNotActive") || error.message?.includes("6000")) {
                setMessage("Market is closed or resolved");
            } else if (error.message?.includes("Signature")) {
                setMessage("Transaction cancelled");
            } else {
                setMessage(`Error: ${error.message?.slice(0, 50) || "Trade failed"}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const badge = getEventBadge(market.event_type);
    const estimatedCost = parseFloat(amount) || 0;
    const isResolved = market.status === 'resolved';

    return (
        <>
            <div className={`glass-card flight-card p-5 rounded-2xl flex flex-col ${isResolved ? 'opacity-70' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`badge ${badge.class}`}>{badge.label}</span>
                        {isResolved && (
                            <span className="badge bg-white/10 text-white/60">Resolved</span>
                        )}
                    </div>
                    {/* Calculated Risk Badge */}
                    <div className={`text-xs font-semibold px-2 py-1 rounded ${calculatedRisk >= 70 ? 'bg-red-500/20 text-red-400' :
                        calculatedRisk >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                        }`}>
                        {calculatedRisk}% Risk
                    </div>
                </div>

                {/* Flight Info - Clickable */}
                <button
                    onClick={() => setShowDetailsModal(true)}
                    className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity group"
                >
                    <span className="mono text-2xl font-bold text-[var(--fs-accent)] group-hover:underline">
                        {market.departure_airport}
                    </span>
                    <div className="flex-1 h-[2px] bg-gradient-to-r from-[var(--fs-accent)] via-white/20 to-[var(--fs-accent)] relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                            </svg>
                        </div>
                    </div>
                    <span className="mono text-2xl font-bold text-[var(--fs-accent)] group-hover:underline">
                        {market.arrival_airport}
                    </span>
                </button>

                {/* Flight Details & Volume */}
                <div className="flex items-center justify-between text-sm mb-3">
                    <button
                        onClick={() => setShowDetailsModal(true)}
                        className="mono text-white font-semibold hover:text-[var(--fs-accent)] hover:underline transition-colors"
                    >
                        {market.flight_iata}
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-[var(--fs-accent)] font-bold mono">
                            ◎ {formatVolume(market.volume)}
                        </span>
                        <span className="text-[var(--fs-muted)]">volume</span>
                    </div>
                </div>

                {/* Scheduled Time */}
                <div className="text-sm text-[var(--fs-muted)] mb-3">
                    Departs {formatTime(market.scheduled_departure)}
                </div>

                {/* Question */}
                <p className="text-sm text-white/90 mb-4 line-clamp-2 font-medium">
                    {market.question}
                </p>

                {/* Price Buttons */}
                {!showTrade ? (
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                        <button
                            onClick={() => {
                                if (!isResolved) {
                                    setTradeOutcome("YES");
                                    setShowTrade(true);
                                }
                            }}
                            disabled={isResolved}
                            className={`py-3 rounded-xl bg-[var(--fs-success)]/20 border border-[var(--fs-success)]/40 transition-colors ${isResolved ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--fs-success)]/30'
                                }`}
                        >
                            <div className="text-xs text-[var(--fs-muted)] mb-1">YES</div>
                            <div className="mono text-lg font-bold text-[var(--fs-success)]">
                                {yesPercent}¢
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                if (!isResolved) {
                                    setTradeOutcome("NO");
                                    setShowTrade(true);
                                }
                            }}
                            disabled={isResolved}
                            className={`py-3 rounded-xl bg-[var(--fs-danger)]/20 border border-[var(--fs-danger)]/40 transition-colors ${isResolved ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--fs-danger)]/30'
                                }`}
                        >
                            <div className="text-xs text-[var(--fs-muted)] mb-1">NO</div>
                            <div className="mono text-lg font-bold text-[var(--fs-danger)]">
                                {noPercent}¢
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="mt-auto">
                        {/* Trade Panel */}
                        <div className="bg-[var(--fs-primary)]/50 rounded-xl p-4 mb-3">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-white">Buy {tradeOutcome}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center mono"
                                    />
                                    <span className="text-xs text-[var(--fs-muted)]">SOL</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--fs-muted)]">You Pay</span>
                                <span className="mono text-white font-bold">
                                    ◎ {estimatedCost.toFixed(4)} SOL
                                </span>
                            </div>
                        </div>

                        {message && (
                            <div className={`text-sm text-center mb-3 ${message.includes("Bought") ? "text-[var(--fs-success)]" : "text-[var(--fs-danger)]"
                                }`}>
                                {message}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowTrade(false)}
                                className="py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTrade}
                                disabled={loading || !wallet}
                                className={`py-2 rounded-xl text-sm font-bold transition-colors ${tradeOutcome === "YES"
                                    ? "bg-[var(--fs-success)] text-[var(--fs-primary)]"
                                    : "bg-[var(--fs-danger)] text-white"
                                    } ${loading || !wallet ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"}`}
                            >
                                {loading ? "..." : `Buy ${tradeOutcome}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Flight Details Modal */}
            <FlightDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                flight={{
                    flight_id: market.flight_iata,
                    route: `${market.departure_airport}-${market.arrival_airport}`,
                    scheduled_departure: market.scheduled_departure || "Upcoming",
                    disruption_probability: market.event_type === 'on_time'
                        ? 1 - (market.win_probability || 0.5)
                        : (market.win_probability || 0.5),
                    disruption_type: market.event_type,
                    status: market.status,
                }}
                market={market}
            />
        </>
    );
}
