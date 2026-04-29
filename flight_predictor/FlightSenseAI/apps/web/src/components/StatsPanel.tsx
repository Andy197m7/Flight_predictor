"use client";

interface StatsPanelProps {
    totalFlights: number;
    highRisk: number;
    monitoring: number;
    totalVolume: number; // In SOL
}

export function StatsPanel({
    totalFlights,
    highRisk,
    monitoring,
    totalVolume,
}: StatsPanelProps) {
    const stats = [
        {
            label: "Flights Tracked",
            value: totalFlights,
            icon: "✈️",
            color: "var(--fs-accent)",
        },
        {
            label: "Total Volume",
            value: `${totalVolume.toFixed(2)} SOL`,
            icon: "📊",
            color: "var(--fs-success)",
        },
        {
            label: "High Risk",
            value: highRisk,
            icon: "🚨",
            color: "var(--fs-danger)",
        },
        {
            label: "Watching",
            value: monitoring,
            icon: "👁️",
            color: "var(--fs-warning)",
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {stats.map((stat) => (
                <div key={stat.label} className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{stat.icon}</span>
                        <span className="text-sm text-[var(--fs-muted)]">{stat.label}</span>
                    </div>
                    <div
                        className="mono text-3xl font-bold"
                        style={{ color: stat.color }}
                    >
                        {stat.value}
                    </div>
                </div>
            ))}
        </div>
    );
}
