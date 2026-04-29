# AeroPredict

**Decentralized flight delay prediction markets built on Solana**

## The Problem

Flight delays create major economic loss across the United States every year. Airlines rely on internal systems that struggle to adjust to fast changes like weather, congestion, and operational issues. Passengers lose time, miss connections, and face uncertainty. There is no strong incentive system that rewards accurate forecasting, so prediction quality stays limited.

## The Approach

AeroPredict turns flight prediction into a market driven system.

Users trade on whether a flight will be delayed or on time by buying **YES** or **NO** positions. Market prices update with every trade and reflect the crowd’s probability estimate. When traders find incorrect pricing, they act on it, which improves overall accuracy.

- **Airlines** gain real time external forecasts  
- **Travelers** make better planning decisions  
- **Traders** profit from strong predictions  

---

## Quick Start

### Requirements

- Node.js 18 or newer  
- Phantom Wallet browser extension  

### Installation

```bash
git clone https://github.com/your-repo/AeroPredict.git
cd AeroPredict
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Environment Variables

Create a file at `apps/web/.env.local` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PREDICTION_API=http://localhost:8000
```

---

## Wallet Setup

### 1. Install Phantom
Go to https://phantom.app and create a wallet.

### 2. Enable Devnet
Open Phantom settings. Turn on developer mode. Select Solana Devnet.

### 3. Get Test SOL

```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

### 4. Connect and Trade

1. Open the app  
2. Click "Select Wallet"  
3. Choose Phantom and approve  
4. Trade **YES** or **NO** on flights  

---

## How the Market Works

| Action        | Meaning                                              |
|---------------|------------------------------------------------------|
| **Buy YES**   | You expect the flight to be delayed or cancelled     |
| **Buy NO**    | You expect the flight to be on time                  |
| **Price**     | Shows probability, 0.70 equals 70 percent chance     |
| **Payout**    | Winners receive funds after the result is confirmed  |

---

## Features

- **Live Markets** for individual flights  
- **Dynamic Pricing** based on trades  
- **ML Risk Scores** using weather and history  
- **Portfolio Tracking** for positions and returns  
- **Admin Controls** for managing markets  
- **Risk Alerts** for high disruption flights  

---

## Tech Stack

| Layer       | Technology                         |
|------------|-----------------------------------|
| Frontend   | Next.js, React, TailwindCSS       |
| Blockchain | Solana, Anchor framework          |
| Backend    | Python                            |
| Database   | Supabase                          |
| Wallet     | Phantom, Solana Wallet Adapter    |
| Data       | Aviation and weather APIs         |

---

## System Flow

1. Create a market for a scheduled flight  
2. Users place trades based on expected outcome  
3. Prices update in real time from activity and model signals  
4. Flight result finalizes the market  
5. Winning positions receive payouts on chain  

---

## License

MIT
