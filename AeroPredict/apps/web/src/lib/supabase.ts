/**
 * Supabase Client - Singleton client for Supabase database operations.
 * Used for real-time subscriptions and direct database queries from frontend.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a single supabase client for interacting with your database
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Database types for TypeScript
export interface Market {
    id: string;
    flight_iata: string;
    departure_airport: string;
    arrival_airport: string;
    scheduled_departure: string | null;
    event_type: string;
    question: string;
    description: string | null;
    yes_pool: number;
    no_pool: number;
    volume: number;
    status: string;
    resolved_outcome: string | null;
    win_probability: number | null;
    weather_risk_score: number | null;
    created_at: string;
    updated_at: string;
}

export interface Wallet {
    wallet_address: string;
    balance: number;
    locked_balance: number;
    created_at: string;
    updated_at: string;
}

export interface Position {
    id: string;
    wallet_address: string;
    market_id: string;
    outcome: 'YES' | 'NO';
    shares: number;
    avg_price: number;
    created_at: string;
    updated_at: string;
    market?: Market;
}

export interface Order {
    id: string;
    wallet_address: string;
    market_id: string;
    side: 'buy' | 'sell';
    outcome: 'YES' | 'NO';
    shares: number;
    price: number;
    cost: number;
    status: string;
    created_at: string;
}

export interface WeatherPrediction {
    id: string;
    airport_code: string;
    prediction_date: string;
    forecast_period: string | null;
    temperature_f: number | null;
    wind_speed_mph: number | null;
    wind_direction: string | null;
    precipitation_probability: number | null;
    weather_condition: string | null;
    disruption_risk_score: number | null;
    created_at: string;
}

// Helper functions
export function calculatePrice(market: Market): { yesPrice: number; noPrice: number } {
    const total = market.yes_pool + market.no_pool;
    if (total === 0) return { yesPrice: 0.5, noPrice: 0.5 };
    return {
        yesPrice: market.no_pool / total,
        noPrice: market.yes_pool / total,
    };
}

export function formatSol(amount: number): string {
    return `${amount.toFixed(4)} SOL`;
}

export function formatVolume(volume: number): string {
    if (volume >= 1000) {
        return `${(volume / 1000).toFixed(1)}K SOL`;
    }
    return `${volume.toFixed(2)} SOL`;
}
