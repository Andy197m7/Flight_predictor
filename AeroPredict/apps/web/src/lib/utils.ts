/**
 * Utility functions for the FlightSense frontend.
 */

/**
 * Format a date as a relative time string (e.g., "in 2 hours").
 */
export function formatDistanceToNow(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
        const absMins = Math.abs(diffMins);
        if (absMins < 60) return `${absMins}m ago`;
        if (absMins < 1440) return `${Math.round(absMins / 60)}h ago`;
        return `${Math.round(absMins / 1440)}d ago`;
    }

    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffMins < 1440) return `in ${Math.round(diffMins / 60)}h`;
    return `in ${Math.round(diffMins / 1440)}d`;
}

/**
 * Format a number as a percentage string.
 */
export function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

/**
 * Classify disruption probability into risk levels.
 */
export function getRiskLevel(probability: number): "low" | "medium" | "high" {
    if (probability >= 0.65) return "high";
    if (probability >= 0.30) return "medium";
    return "low";
}

/**
 * Get a human-readable label for disruption types.
 */
export function getDisruptionLabel(type: string): string {
    const labels: Record<string, string> = {
        cancellation: "Cancellation Risk",
        delay_2hr_6hr: "Major Delay (2-6h)",
        delay_30min_2hr: "Minor Delay (30m-2h)",
    };
    return labels[type] || "Unknown";
}
