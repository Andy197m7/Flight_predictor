"use client";

import { useState, useEffect, useRef } from "react";
import { Market } from "@/lib/supabase";

interface PriceHistoryPoint {
    time: string;
    timestamp: number;
    likelihood: number;
}

interface FlightDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    flight: {
        flight_id: string;
        route: string;
        scheduled_departure: string;
        disruption_probability: number;
        disruption_type: string;
        status?: string;
    } | null;
    market?: Market | null;
}

export function FlightDetailsModal({ isOpen, onClose, flight, market }: FlightDetailsModalProps) {
    const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
    const [hoveredPoint, setHoveredPoint] = useState<PriceHistoryPoint | null>(null);
    const [mouseX, setMouseX] = useState<number | null>(null);
    const graphRef = useRef<HTMLDivElement>(null);

    // Generate mock price history data (in production, fetch from API)
    useEffect(() => {
        if (!flight) return;

        // Generate synthetic price history based on current probability
        const now = Date.now();
        const points: PriceHistoryPoint[] = [];
        const baseProb = flight.disruption_probability;

        for (let i = 23; i >= 0; i--) {
            const timestamp = now - i * 3600000; // hourly intervals
            const date = new Date(timestamp);
            // Add some random variation around the current probability
            const variation = (Math.random() - 0.5) * 0.2;
            const likelihood = Math.max(0.05, Math.min(0.95, baseProb + variation * (i / 24)));

            points.push({
                time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                timestamp,
                likelihood: likelihood * 100,
            });
        }

        // Last point should be current probability
        points[points.length - 1] = {
            time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            timestamp: now,
            likelihood: baseProb * 100,
        };

        setPriceHistory(points);
    }, [flight]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!graphRef.current || priceHistory.length === 0) return;

        const rect = graphRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const relativeX = x / rect.width;
        const index = Math.min(
            Math.floor(relativeX * priceHistory.length),
            priceHistory.length - 1
        );

        if (index >= 0 && index < priceHistory.length) {
            setHoveredPoint(priceHistory[index]);
            setMouseX(x);
        }
    };

    const handleMouseLeave = () => {
        setHoveredPoint(null);
        setMouseX(null);
    };

    if (!isOpen || !flight) return null;

    const [departure, arrival] = flight.route.includes("-")
        ? flight.route.split("-")
        : [flight.route.slice(0, 3), flight.route.slice(-3)];

    const calculatedRisk = Math.round(flight.disruption_probability * 100);
    const riskLevel = calculatedRisk >= 70 ? "High" : calculatedRisk >= 40 ? "Medium" : "Low";
    const riskColor = calculatedRisk >= 70 ? "text-red-400" : calculatedRisk >= 40 ? "text-yellow-400" : "text-green-400";

    // Generate SVG path for the line chart
    const generatePath = () => {
        if (priceHistory.length === 0) return "";

        const width = 100;
        const height = 100;
        const padding = 5;

        const maxLikelihood = Math.max(...priceHistory.map(p => p.likelihood), 100);
        const minLikelihood = Math.min(...priceHistory.map(p => p.likelihood), 0);
        const range = maxLikelihood - minLikelihood || 1;

        const points = priceHistory.map((point, index) => {
            const x = padding + (index / (priceHistory.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((point.likelihood - minLikelihood) / range) * (height - 2 * padding);
            return `${x},${y}`;
        });

        return `M ${points.join(" L ")}`;
    };

    const generateAreaPath = () => {
        if (priceHistory.length === 0) return "";

        const width = 100;
        const height = 100;
        const padding = 5;

        const maxLikelihood = Math.max(...priceHistory.map(p => p.likelihood), 100);
        const minLikelihood = Math.min(...priceHistory.map(p => p.likelihood), 0);
        const range = maxLikelihood - minLikelihood || 1;

        const points = priceHistory.map((point, index) => {
            const x = padding + (index / (priceHistory.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((point.likelihood - minLikelihood) / range) * (height - 2 * padding);
            return `${x},${y}`;
        });

        const firstX = padding;
        const lastX = padding + ((priceHistory.length - 1) / (priceHistory.length - 1)) * (width - 2 * padding);

        return `M ${firstX},${height - padding} L ${points.join(" L ")} L ${lastX},${height - padding} Z`;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === "Upcoming") return "Upcoming";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    const getDisruptionLabel = () => {
        switch (flight.disruption_type) {
            case "cancellation":
                return "Cancellation";
            case "delay_2hr_6hr":
                return "Major Delay (2-6hr)";
            case "delay_30min_2hr":
                return "Minor Delay (30min-2hr)";
            case "on_time":
                return "On Time";
            default:
                return flight.disruption_type;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-[var(--fs-primary)] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
                >
                    <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="mono text-2xl font-bold text-[var(--fs-accent)]">
                            {flight.flight_id}
                        </span>
                        <span className={`badge ${flight.status === "Resolved" ? "badge-success" : "badge-warning"}`}>
                            {flight.status || "Active"}
                        </span>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="mono text-xl font-semibold text-white">{departure}</span>
                            <svg className="w-5 h-5 text-[var(--fs-accent)]" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                            </svg>
                            <span className="mono text-xl font-semibold text-white">{arrival}</span>
                        </div>
                    </div>

                    {/* Date */}
                    <p className="text-sm text-[var(--fs-muted)]">
                        {formatDate(flight.scheduled_departure)}
                    </p>
                </div>

                {/* Metrics Section */}
                <div className="p-6 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-[var(--fs-muted)] uppercase tracking-wider mb-4">
                        Flight Metrics
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Calculated Risk */}
                        <div className="glass-card p-4 rounded-xl">
                            <p className="text-xs text-[var(--fs-muted)] mb-1">Calculated Risk</p>
                            <p className={`text-2xl font-bold mono ${riskColor}`}>
                                {calculatedRisk}%
                            </p>
                            <p className={`text-xs ${riskColor}`}>{riskLevel} Risk</p>
                        </div>

                        {/* Event Type */}
                        <div className="glass-card p-4 rounded-xl">
                            <p className="text-xs text-[var(--fs-muted)] mb-1">Event Type</p>
                            <p className="text-lg font-semibold text-white">
                                {getDisruptionLabel()}
                            </p>
                        </div>

                        {/* Market Status */}
                        <div className="glass-card p-4 rounded-xl">
                            <p className="text-xs text-[var(--fs-muted)] mb-1">Market Status</p>
                            <p className="text-lg font-semibold text-white">
                                {flight.status || "Active"}
                            </p>
                        </div>

                        {/* Additional market info if available */}
                        {market && (
                            <>
                                <div className="glass-card p-4 rounded-xl">
                                    <p className="text-xs text-[var(--fs-muted)] mb-1">Total Volume</p>
                                    <p className="text-lg font-semibold text-[var(--fs-accent)] mono">
                                        {market.volume.toFixed(2)} SOL
                                    </p>
                                </div>
                                <div className="glass-card p-4 rounded-xl">
                                    <p className="text-xs text-[var(--fs-muted)] mb-1">YES Pool</p>
                                    <p className="text-lg font-semibold text-green-400 mono">
                                        {market.yes_pool.toFixed(4)} SOL
                                    </p>
                                </div>
                                <div className="glass-card p-4 rounded-xl">
                                    <p className="text-xs text-[var(--fs-muted)] mb-1">NO Pool</p>
                                    <p className="text-lg font-semibold text-red-400 mono">
                                        {market.no_pool.toFixed(4)} SOL
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Price History Graph */}
                <div className="p-6">
                    <h3 className="text-sm font-semibold text-[var(--fs-muted)] uppercase tracking-wider mb-4">
                        Price History (Likelihood)
                    </h3>

                    <div
                        ref={graphRef}
                        className="relative h-64 bg-white/5 rounded-xl p-4 cursor-crosshair overflow-hidden"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        {/* Hover Info Box */}
                        {hoveredPoint && mouseX !== null && (
                            <div
                                className="absolute top-4 z-10 bg-[var(--fs-primary)] border border-white/20 rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                                style={{
                                    left: Math.min(mouseX, (graphRef.current?.clientWidth || 300) - 120),
                                }}
                            >
                                <p className="text-xs text-[var(--fs-muted)]">{hoveredPoint.time}</p>
                                <p className={`text-lg font-bold mono ${hoveredPoint.likelihood >= 70 ? "text-red-400" : hoveredPoint.likelihood >= 40 ? "text-yellow-400" : "text-green-400"}`}>
                                    {hoveredPoint.likelihood.toFixed(1)}%
                                </p>
                            </div>
                        )}

                        {/* Vertical Hover Line */}
                        {mouseX !== null && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-white/30 pointer-events-none"
                                style={{ left: mouseX }}
                            />
                        )}

                        {/* SVG Chart */}
                        <svg
                            viewBox="0 0 100 100"
                            className={`w-full h-full transition-opacity duration-200 ${hoveredPoint ? "opacity-50" : "opacity-100"}`}
                            preserveAspectRatio="none"
                        >
                            {/* Grid Lines */}
                            <line x1="5" y1="25" x2="95" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                            <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                            <line x1="5" y1="75" x2="95" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

                            {/* Area Fill */}
                            <path
                                d={generateAreaPath()}
                                fill="url(#gradient)"
                                opacity="0.3"
                            />

                            {/* Line */}
                            <path
                                d={generatePath()}
                                fill="none"
                                stroke="var(--fs-accent)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />

                            {/* Gradient Definition */}
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="var(--fs-accent)" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="var(--fs-accent)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Y-Axis Labels */}
                        <div className="absolute left-2 top-4 text-xs text-[var(--fs-muted)]">100%</div>
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[var(--fs-muted)]">50%</div>
                        <div className="absolute left-2 bottom-4 text-xs text-[var(--fs-muted)]">0%</div>

                        {/* X-Axis Labels */}
                        <div className="absolute bottom-2 left-4 text-xs text-[var(--fs-muted)]">-24h</div>
                        <div className="absolute bottom-2 right-4 text-xs text-[var(--fs-muted)]">Now</div>
                    </div>

                    {/* Current Value */}
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm text-[var(--fs-muted)]">Current Likelihood</span>
                        <span className={`text-xl font-bold mono ${calculatedRisk >= 70 ? "text-red-400" : calculatedRisk >= 40 ? "text-yellow-400" : "text-green-400"}`}>
                            {calculatedRisk}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
