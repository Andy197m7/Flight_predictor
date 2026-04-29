# FlightSense

**Decentralized flight delay prediction markets on Solana**

## The Problem

Flight delays cost the US economy **$33 billion annually**. Airlines struggle with prediction accuracy, passengers lose billions in productivity, and the aviation industry lacks real-time, crowd-sourced intelligence.

## Our Solution

What if we could turn flight delay prediction into a profit-driven prediction market?

By creating tradable markets on Solana, we incentivize hedge funds, quant traders, and data scientists to pour resources into perfecting aviation forecasting. The result?

- **Airlines** get free, hyper-accurate predictions from the crowd
- **Passengers** make better travel decisions
- **Traders** profit from their research

Everyone wins.

---

## Quick Start

### Prerequisites

- Node.js 18+
- [Phantom Wallet](https://phantom.app/) browser extension

### Installation

```bash
# Clone the repo
git clone https://github.com/your-repo/FlightSenseAI.git
cd FlightSenseAI

# Install dependencies
npm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file in `apps/web/` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Solana RPC (Devnet)
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com

# Prediction API (optional)
NEXT_PUBLIC_PREDICTION_API=http://localhost:8000
```

---

## Using with Phantom Wallet

### 1. Install Phantom
Download from [phantom.app](https://phantom.app/) and create a wallet.

### 2. Switch to Devnet
- Open Phantom → Settings → Developer Settings
- Enable "Testnet Mode"
- Select "Solana Devnet"

### 3. Get Test SOL
```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```
Or use [solfaucet.com](https://solfaucet.com/)

### 4. Connect & Trade
1. Click "Select Wallet" on FlightSense
2. Choose Phantom and approve connection
3. Browse markets and trade YES/NO on flight outcomes

---

## How It Works

| Action | Description |
|--------|-------------|
| **Buy YES** | Bet the flight will be delayed/cancelled |
| **Buy NO** | Bet the flight will be on time |
| **Price** | Reflects crowd's probability estimate (65¢ = 65% chance) |
| **Payout** | Winners receive 1 SOL per share |

---

## Features

- **Real-time Markets** — Live prices from Solana
- **Flight Details** — Click any flight for risk analysis + price history
- **Calculated Risk** — ML-powered disruption probability
- **Portfolio Tracking** — View positions and P/L
- **Admin Dashboard** — Market management (password: `americanairlines`)
- **At Risk Alerts** — Admins see high-risk flights (>70% disruption probability) with actionable insights to prepare for delays and cancellations

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TailwindCSS |
| Blockchain | Solana, Anchor Framework |
| Database | Supabase |
| Wallet | Phantom (via Solana Wallet Adapter) |

---

## License

MIT
