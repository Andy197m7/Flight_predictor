"use client";

import { Header } from "./Header";

interface PredictionHeaderProps {
    lastUpdate?: Date | null;
    onRefresh: () => void;
}

export function PredictionHeader({ lastUpdate, onRefresh }: PredictionHeaderProps) {
    return (
        <Header>
            {/* Last Update */}
            {lastUpdate && (
                <div className="text-sm text-[var(--fs-muted)]">
                    <span className="hidden sm:inline">Last updated: </span>
                    <span className="mono">
                        {lastUpdate.toLocaleTimeString()}
                    </span>
                </div>
            )}

            {/* Refresh Button */}
            <button
                onClick={onRefresh}
                className="px-4 py-2 glass-card hover:bg-white/10 transition-colors flex items-center gap-2 text-sm"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                </svg>
                <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Status Indicator */}
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--fs-success)] animate-pulse"></div>
                <span className="text-xs text-[var(--fs-muted)] hidden sm:inline">Live</span>
            </div>
        </Header>
    );
}
