"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, setProvider, BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PredictionHeader } from "@/components/PredictionHeader";
import { supabase, Market } from "@/lib/supabase";
import { FlightDetailsModal } from "@/components/FlightDetailsModal";
import idl from "@/lib/idl.json";

const PROGRAM_ID = new PublicKey(idl.address);

interface MarketWithChainStatus extends Market {
    onChain: boolean;
    checking: boolean;
}

// Mock at-risk flights for demo purposes
const mockAtRiskFlights: MarketWithChainStatus[] = [
    {
        id: "mock-risk-1",
        flight_iata: "SW2847",
        departure_airport: "DEN",
        arrival_airport: "PHX",
        scheduled_departure: new Date(Date.now() + 3600000 * 4).toISOString(), // 4 hours from now
        event_type: "delay_30_min",
        question: "Will SW2847 from DEN to PHX be delayed by 30+ minutes?",
        description: "Severe weather conditions in Denver area",
        yes_pool: 2.1,
        no_pool: 0.4,
        volume: 2.5,
        status: "active",
        resolved_outcome: null,
        win_probability: 0.84, // High risk - 84%
        weather_risk_score: 0.78,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onChain: true,
        checking: false,
    },
    {
        id: "mock-risk-2",
        flight_iata: "AA1192",
        departure_airport: "ORD",
        arrival_airport: "BOS",
        scheduled_departure: new Date(Date.now() + 3600000 * 2).toISOString(), // 2 hours from now
        event_type: "cancellation",
        question: "Will AA1192 from ORD to BOS be cancelled?",
        description: "Winter storm warning in Chicago",
        yes_pool: 1.9,
        no_pool: 0.3,
        volume: 2.2,
        status: "active",
        resolved_outcome: null,
        win_probability: 0.86, // High risk - 86%
        weather_risk_score: 0.92,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onChain: true,
        checking: false,
    },
    {
        id: "mock-risk-3",
        flight_iata: "UA567",
        departure_airport: "EWR",
        arrival_airport: "SFO",
        scheduled_departure: new Date(Date.now() + 3600000 * 6).toISOString(), // 6 hours from now
        event_type: "on_time",
        question: "Will UA567 from EWR to SFO arrive on time?",
        description: "Air traffic control delays at Newark",
        yes_pool: 0.5,
        no_pool: 1.8,
        volume: 2.3,
        status: "active",
        resolved_outcome: null,
        win_probability: 0.22, // Low on-time probability = high disruption risk
        weather_risk_score: 0.35,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onChain: true,
        checking: false,
    },
    {
        id: "mock-risk-4",
        flight_iata: "DL892",
        departure_airport: "JFK",
        arrival_airport: "MIA",
        scheduled_departure: new Date(Date.now() + 3600000 * 3).toISOString(), // 3 hours from now
        event_type: "delay_1_hour",
        question: "Will DL892 from JFK to MIA be delayed by 1+ hour?",
        description: "Ground stop at JFK due to fog",
        yes_pool: 1.6,
        no_pool: 0.35,
        volume: 1.95,
        status: "active",
        resolved_outcome: null,
        win_probability: 0.82, // High risk - 82%
        weather_risk_score: 0.68,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onChain: true,
        checking: false,
    },
];

export default function AdminPage() {
    const wallet = useAnchorWallet();
    const { connection } = useConnection();
    const [marketId, setMarketId] = useState("");
    const [initialPrice, setInitialPrice] = useState("0.5");
    const [loading, setLoading] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [markets, setMarkets] = useState<MarketWithChainStatus[]>([]);
    const [initProgress, setInitProgress] = useState("");
    const [selectedFlight, setSelectedFlight] = useState<MarketWithChainStatus | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const program = useMemo(() => {
        if (!wallet) return null;
        const provider = new AnchorProvider(
            connection,
            wallet,
            AnchorProvider.defaultOptions()
        );
        setProvider(provider);
        return new Program(idl as Idl, provider);
    }, [connection, wallet]);

    // Fetch markets and check on-chain status
    const fetchMarketsWithStatus = useCallback(async () => {
        const { data } = await supabase
            .from("markets")
            .select("*")
            .order("win_probability", { ascending: false });

        if (!data) return;

        // Check each market's on-chain status
        const marketsWithStatus: MarketWithChainStatus[] = await Promise.all(
            data.map(async (market) => {
                let onChain = false;
                try {
                    const [marketPda] = PublicKey.findProgramAddressSync(
                        [Buffer.from("market"), Buffer.from(market.flight_iata)],
                        PROGRAM_ID
                    );
                    const account = await connection.getAccountInfo(marketPda);
                    onChain = account !== null;
                } catch (e) {
                    // Not on chain or error
                }
                return { ...market, onChain, checking: false };
            })
        );

        // Add mock at-risk flights for demo purposes
        const allMarkets = [...marketsWithStatus, ...mockAtRiskFlights];
        setMarkets(allMarkets);
    }, [connection]);

    useEffect(() => {
        fetchMarketsWithStatus();
        const interval = setInterval(fetchMarketsWithStatus, 60000);
        return () => clearInterval(interval);
    }, [fetchMarketsWithStatus]);

    const handleCreateMarket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!program || !wallet) {
            setMessage("Please connect your wallet");
            return;
        }

        try {
            setLoading(true);
            setMessage("Creating market...");

            // initial_prob_bps is a u16 in basis points (0-10000)
            const probBps = Math.round(parseFloat(initialPrice) * 10000);

            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(marketId)],
                program.programId
            );

            await program.methods
                .initializeMarket(marketId, probBps)
                .accounts({
                    market: marketPda,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc();

            setMessage(`Success! Market created: ${marketPda.toString()}`);
            setMarketId("");
            fetchMarketsWithStatus();
        } catch (err: any) {
            console.error(err);
            setMessage(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Initialize a single market on-chain
    const initializeMarket = async (flightIata: string, winProb: number) => {
        if (!program || !wallet) return false;

        try {
            const initialPrice = winProb || 0.5;
            // initial_prob_bps is a u16 in basis points (0-10000)
            const probBps = Math.round(initialPrice * 10000);

            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(flightIata)],
                program.programId
            );

            await program.methods
                .initializeMarket(flightIata, probBps)
                .accounts({
                    market: marketPda,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                } as any)
                .rpc();

            return true;
        } catch (err: any) {
            console.error(`Failed to init ${flightIata}:`, err);
            return false;
        }
    };

    // Bulk initialize all markets not yet on-chain
    const handleBulkInitialize = async () => {
        if (!program || !wallet) {
            setMessage("Connect wallet first");
            return;
        }

        const notOnChain = markets.filter(m => !m.onChain);
        if (notOnChain.length === 0) {
            setMessage("All markets are already on-chain!");
            return;
        }

        setBulkLoading(true);
        let success = 0;
        let failed = 0;

        for (let i = 0; i < notOnChain.length; i++) {
            const market = notOnChain[i];
            setInitProgress(`Initializing ${i + 1}/${notOnChain.length}: ${market.flight_iata}`);

            const result = await initializeMarket(market.flight_iata, market.win_probability || 0.5);
            if (result) {
                success++;
            } else {
                failed++;
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }

        setInitProgress("");
        setBulkLoading(false);
        setMessage(`Bulk init complete: ${success} success, ${failed} failed`);
        fetchMarketsWithStatus();
    };

    const handleFlightClick = (market: MarketWithChainStatus) => {
        setSelectedFlight(market);
        setShowDetailsModal(true);
    };

    const onChainCount = markets.filter(m => m.onChain).length;
    const offChainCount = markets.filter(m => !m.onChain).length;

    // At Risk flights: active, on-chain markets with high risk
    // For delay/cancellation events: likelihood > 70%
    // For on-time events: likelihood < 30% (meaning disruption is likely)
    const atRiskFlights = markets.filter(m => {
        if (!m.onChain || m.status !== 'active') return false;
        const prob = m.win_probability || 0;
        if (m.event_type === 'on_time') {
            // On-time market: low probability means high disruption risk
            return prob < 0.3;
        } else {
            // Delay/cancellation market: high probability means high risk
            return prob > 0.7;
        }
    });

    return (
        <div className="min-h-screen bg-[var(--fs-bg)] text-white">
            <PredictionHeader lastUpdate={new Date()} onRefresh={() => { }} />

            <main className="max-w-5xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

                {/* On-Chain Status Summary */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="glass-card p-4 rounded-xl text-center">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">Total Markets</p>
                        <p className="text-2xl font-bold text-white mono">{markets.length}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl text-center">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">On-Chain</p>
                        <p className="text-2xl font-bold text-green-400 mono">{onChainCount}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl text-center">
                        <p className="text-xs text-[var(--fs-muted)] mb-1">Not On-Chain</p>
                        <p className="text-2xl font-bold text-yellow-400 mono">{offChainCount}</p>
                    </div>
                </div>

                {/* At Risk Section */}
                {atRiskFlights.length > 0 && (
                    <div className="glass-card p-6 rounded-xl mb-8 border border-red-500/30">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                            <h2 className="text-xl font-semibold text-red-400">At Risk Flights</h2>
                            <span className="badge badge-danger">{atRiskFlights.length} flights</span>
                        </div>
                        <p className="text-sm text-[var(--fs-muted)] mb-4">
                            These active markets have a high calculated risk (&gt;70% for delays/cancellations, &lt;30% for on-time).
                        </p>
                        <div className="grid gap-3">
                            {atRiskFlights.map((market) => {
                                const riskPercent = Math.round((market.win_probability || 0) * 100);
                                const displayRisk = market.event_type === 'on_time'
                                    ? 100 - riskPercent  // For on-time, show disruption risk
                                    : riskPercent;

                                return (
                                    <button
                                        key={market.id}
                                        onClick={() => handleFlightClick(market)}
                                        className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <span className="mono font-bold text-white">{market.flight_iata}</span>
                                            <span className="text-sm text-[var(--fs-muted)]">
                                                {market.departure_airport} → {market.arrival_airport}
                                            </span>
                                            <span className={`badge text-xs ${
                                                market.event_type === 'on_time' ? 'badge-success' :
                                                market.event_type === 'cancellation' ? 'badge-danger' : 'badge-warning'
                                            }`}>
                                                {market.event_type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-red-400 font-bold mono">{displayRisk}% Risk</span>
                                            <svg className="w-4 h-4 text-[var(--fs-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Bulk Initialize Button */}
                {offChainCount > 0 && (
                    <div className="glass-card p-6 rounded-xl mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-white">Sync Markets to Solana</h3>
                            <p className="text-sm text-[var(--fs-muted)]">
                                {offChainCount} markets need to be initialized on-chain for trading
                            </p>
                            {initProgress && (
                                <p className="text-sm text-[var(--fs-accent)] mt-2 mono">{initProgress}</p>
                            )}
                        </div>
                        <button
                            onClick={handleBulkInitialize}
                            disabled={bulkLoading || !wallet}
                            className={`px-6 py-3 rounded-xl font-bold transition-all ${bulkLoading || !wallet
                                ? "bg-white/10 text-white/50 cursor-not-allowed"
                                : "bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90"
                                }`}
                        >
                            {bulkLoading ? "Syncing..." : `Initialize ${offChainCount} Markets`}
                        </button>
                    </div>
                )}

                {/* Markets & On-Chain Status */}
                <div className="glass-card p-8 rounded-xl mb-8">
                    <h2 className="text-xl font-semibold mb-6">Markets & On-Chain Status</h2>
                    <p className="text-sm text-[var(--fs-muted)] mb-4">
                        Markets must be initialized on-chain before users can trade. Click on a flight to view details.
                    </p>

                    {markets.length === 0 ? (
                        <p className="text-[var(--fs-muted)]">No markets available</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-3 px-2">Status</th>
                                        <th className="text-left py-3 px-2">Flight</th>
                                        <th className="text-left py-3 px-2">Route</th>
                                        <th className="text-left py-3 px-2">Event</th>
                                        <th className="text-right py-3 px-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {markets.slice(0, 20).map((market) => {
                                        return (
                                            <tr key={market.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="py-3 px-2">
                                                    {market.onChain ? (
                                                        <span className="text-green-400">On-Chain</span>
                                                    ) : (
                                                        <span className="text-yellow-400">Pending</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-2">
                                                    <button
                                                        onClick={() => handleFlightClick(market)}
                                                        className="mono font-medium text-[var(--fs-accent)] hover:underline"
                                                    >
                                                        {market.flight_iata}
                                                    </button>
                                                </td>
                                                <td className="py-3 px-2">
                                                    {market.departure_airport} → {market.arrival_airport}
                                                </td>
                                                <td className="py-3 px-2">
                                                    <span className={`badge text-xs ${market.event_type === 'on_time' ? 'badge-success' :
                                                        market.event_type === 'cancellation' ? 'badge-danger' : 'badge-warning'
                                                        }`}>
                                                        {market.event_type}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-right">
                                                    {!market.onChain && (
                                                        <button
                                                            onClick={() => {
                                                                setMarketId(market.flight_iata);
                                                                setInitialPrice(String(market.win_probability || 0.5));
                                                            }}
                                                            className="text-xs text-[var(--fs-accent)] hover:underline"
                                                        >
                                                            Init
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Create Market Section */}
                <div className="glass-card p-8 rounded-xl mb-8">
                    <h2 className="text-xl font-semibold mb-6">Initialize New Market</h2>
                    <form onSubmit={handleCreateMarket} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-[var(--fs-muted)]">Market ID</label>
                            <input
                                type="text"
                                value={marketId}
                                onChange={(e) => setMarketId(e.target.value)}
                                placeholder="e.g. AA123-ON_TIME-001"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--fs-accent)] transition-colors"
                                required
                            />
                            <p className="text-xs text-[var(--fs-muted)] mt-2">
                                Format: FLIGHT-TYPE-UUID (e.g., UA456-DELAY-838)
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2 text-[var(--fs-muted)]">Initial Probability (YES Price)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="0.99"
                                value={initialPrice}
                                onChange={(e) => setInitialPrice(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--fs-accent)] transition-colors"
                                required
                            />
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm ${message.includes("Success") ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !wallet}
                            className={`w-full py-3 rounded-lg font-semibold transition-all ${loading || !wallet
                                ? "bg-white/10 text-white/50 cursor-not-allowed"
                                : "bg-gradient-to-r from-[var(--fs-accent)] to-[var(--fs-primary)] hover:opacity-90 glow-accent"
                                }`}
                        >
                            {loading ? "Creating..." : "Initialize Market"}
                        </button>
                    </form>
                </div>

                {/* Resolve Market Section */}
                <div className="glass-card p-8 rounded-xl">
                    <h2 className="text-xl font-semibold mb-6">Resolve Market</h2>
                    <ResolveMarketForm program={program} wallet={wallet} setMessage={setMessage} setLoading={setLoading} loading={loading} />
                </div>
            </main>

            {/* Flight Details Modal */}
            {selectedFlight && (
                <FlightDetailsModal
                    isOpen={showDetailsModal}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedFlight(null);
                    }}
                    flight={{
                        flight_id: selectedFlight.flight_iata,
                        route: `${selectedFlight.departure_airport}-${selectedFlight.arrival_airport}`,
                        scheduled_departure: selectedFlight.scheduled_departure || "Upcoming",
                        disruption_probability: selectedFlight.event_type === 'on_time'
                            ? 1 - (selectedFlight.win_probability || 0.5)
                            : (selectedFlight.win_probability || 0.5),
                        disruption_type: selectedFlight.event_type,
                        status: selectedFlight.status,
                    }}
                    market={selectedFlight}
                />
            )}
        </div>
    );
}

function ResolveMarketForm({ program, wallet, setMessage, setLoading, loading }: any) {
    const [marketId, setMarketId] = useState("");
    const [outcome, setOutcome] = useState("1"); // 1 = Yes, 2 = No

    const handleResolve = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!program || !wallet) return;

        try {
            setLoading(true);
            setMessage("Resolving market...");

            const [marketPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("market"), Buffer.from(marketId)],
                program.programId
            );

            // Outcome enum: Undecided=0, Yes=1, No=2
            const outcomeObj = parseInt(outcome) === 1 ? { yes: {} } : { no: {} };

            await program.methods
                .resolve(outcomeObj)
                .accounts({
                    market: marketPda,
                    authority: wallet.publicKey,
                } as any)
                .rpc();

            setMessage(`Success! Market resolved to ${parseInt(outcome) === 1 ? "YES" : "NO"}`);
            setMarketId("");
        } catch (err: any) {
            console.error(err);
            setMessage(`Error resolving: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleResolve} className="space-y-6">
            <div>
                <label className="block text-sm font-medium mb-2 text-[var(--fs-muted)]">Market ID</label>
                <input
                    type="text"
                    value={marketId}
                    onChange={(e) => setMarketId(e.target.value)}
                    placeholder="e.g. UA456-DELAY-838"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--fs-accent)] transition-colors"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-[var(--fs-muted)]">Outcome</label>
                <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--fs-accent)] transition-colors"
                >
                    <option value="1">YES (Event Occurred)</option>
                    <option value="2">NO (Event Did Not Occur)</option>
                </select>
            </div>

            <button
                type="submit"
                disabled={loading || !wallet}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${loading || !wallet
                    ? "bg-white/10 text-white/50 cursor-not-allowed"
                    : "bg-white/10 hover:bg-white/20 border border-white/10"
                    }`}
            >
                {loading ? "Resolving..." : "Resolve Market"}
            </button>
        </form>
    );
}
