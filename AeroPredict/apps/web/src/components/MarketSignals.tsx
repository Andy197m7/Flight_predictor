"use client";

interface PolymarketEvent {
    market_id: string;
    question: string;
    outcome_prices: Record<string, number>;
    volume: number;
    category: string;
}

interface MarketSignalsProps {
    markets: PolymarketEvent[];
}

export function MarketSignals({ markets }: MarketSignalsProps) {
    if (markets.length === 0) return null;

    return (
        <section className="mb-10">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-[var(--fs-accent)]"></div>
                <h2 className="text-xl font-semibold text-white">
                    Prediction Market Signals
                </h2>
                <span className="px-3 py-1 rounded-full bg-[var(--fs-accent)]/10 text-[var(--fs-accent)] text-xs font-medium">
                    Polymarket
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {markets.map((market) => {
                    const yesPrice = market.outcome_prices["Yes"] || 0;
                    const probability = Math.round(yesPrice * 100);

                    return (
                        <div key={market.market_id} className="glass-card p-5">
                            {/* Category Badge */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="px-2 py-1 rounded bg-white/5 text-xs capitalize text-[var(--fs-muted)]">
                                    {market.category}
                                </span>
                                <span className="mono text-sm text-[var(--fs-accent)]">
                                    ${(market.volume / 1000).toFixed(0)}k vol
                                </span>
                            </div>

                            {/* Question */}
                            <p className="text-sm text-white/90 mb-4 line-clamp-2">
                                {market.question}
                            </p>

                            {/* Probability */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--fs-muted)]">
                                    Market Probability
                                </span>
                                <span
                                    className={`mono text-lg font-bold ${probability >= 50
                                            ? "text-[var(--fs-warning)]"
                                            : "text-[var(--fs-success)]"
                                        }`}
                                >
                                    {probability}%
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-2 h-1.5 rounded-full bg-[var(--fs-primary-light)]">
                                <div
                                    className={`h-full rounded-full transition-all ${probability >= 50
                                            ? "bg-gradient-to-r from-[var(--fs-warning)] to-[var(--fs-danger)]"
                                            : "bg-gradient-to-r from-[var(--fs-success)] to-[var(--fs-accent)]"
                                        }`}
                                    style={{ width: `${probability}%` }}
                                ></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
