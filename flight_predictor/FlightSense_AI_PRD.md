# FlightSense AI
## Product Requirements Document

**Predictive Disruption Intelligence Platform**

American Airlines Hackathon Challenge | Version 1.0 | January 2025

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Target Users & Personas](#4-target-users--personas)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture](#7-system-architecture)
8. [Data Sources & API Integrations](#8-data-sources--api-integrations)
9. [User Flows](#9-user-flows)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Risk Analysis & Mitigations](#12-risk-analysis--mitigations)
13. [Competitive Differentiation](#13-competitive-differentiation)
14. [Future Roadmap](#14-future-roadmap)
15. [Appendices](#15-appendices)

---

## 1. Executive Summary

### The Big Idea

> **FlightSense AI leverages prediction market signals and alternative data sources to detect flight disruptions before traditional systems, enabling proactive passenger engagement through AI-powered voice outreach that instantly resolves rebooking and compensation—transforming a historically reactive, frustrating process into a seamless, anticipatory experience.**

**Project Scope:** This solution addresses the American Airlines hackathon challenge by improving passenger experience, employee efficiency, and operational performance through predictive intelligence.

### Key Value Propositions

- **Earlier Detection:** Identify potential disruptions 2-6 hours before traditional monitoring systems
- **Proactive Resolution:** Contact passengers before they check their phones or arrive at the airport
- **Frictionless Experience:** One phone call handles rebooking, compensation, and alternatives
- **Reduced Call Center Load:** Automated outreach prevents inbound support surge during disruptions
- **Data-Driven Insights:** Aggregated prediction market intelligence reveals systemic patterns

### Core Components Integration

| Component | Function | Origin |
|-----------|----------|--------|
| **Prediction Engine** | Aggregates prediction market and alternative data to generate disruption probability scores | Novel Development |
| **TalkTuahAirlines** | Multilingual AI voice assistant for proactive passenger outreach and task execution | TAMUHack 2025 |
| **Flock** | Disruption resolution platform offering itineraries, hotel vouchers, and car rentals | TAMUHack 2025 |

---

## 2. Problem Statement

### 2.1 Industry Context

Flight disruptions represent one of the most significant pain points in commercial aviation. In the United States alone, approximately 20% of all flights experience delays or cancellations, affecting millions of passengers annually and costing airlines billions in compensation, rebooking, and reputational damage.

| Metric | Annual Impact | Source |
|--------|---------------|--------|
| Flight Disruption Rate | ~20% of all US flights | DOT Statistics |
| Estimated Annual Cost to Airlines | $8.3 billion | Airlines for America |
| Customer Satisfaction Drop | 35% decrease after disruption | J.D. Power Study |
| Social Media Complaints | 4.2M tweets annually | Aviation Analytics |
| Average Resolution Time | 47 minutes per passenger | Industry Average |

### 2.2 Current State Pain Points

#### For Passengers
- **Reactive Notification:** Passengers often learn about disruptions through unofficial channels or upon airport arrival
- **Long Wait Times:** Call center queues spike during weather events, with hold times exceeding 2+ hours
- **Complex Rebooking:** Navigating alternative flights, compensation, and accommodations requires multiple touchpoints
- **Information Asymmetry:** Passengers lack visibility into why disruptions occur and what options exist
- **Language Barriers:** Non-English speakers face additional friction in understanding and resolving issues

#### For Employees
- **Surge Overwhelm:** Gate agents and call center staff face simultaneous demand from hundreds of affected passengers
- **Repetitive Tasks:** Agents manually explain the same information and process similar rebookings repeatedly
- **Emotional Labor:** Dealing with frustrated passengers during disruptions leads to burnout
- **Limited Tools:** Current systems don't enable proactive outreach at scale

#### For Operations
- **Delayed Response:** Traditional monitoring systems detect disruptions only after they're confirmed
- **Resource Misallocation:** Without advance warning, crew and equipment repositioning is reactive
- **Data Silos:** Weather, maintenance, crew scheduling, and booking systems don't share predictive signals
- **Missed Revenue:** Empty seats on alternative flights while affected passengers wait in queues

### 2.3 The Prediction Gap

> **Core Insight:** Traditional airline operations rely on deterministic data—weather radar, maintenance logs, crew schedules. But disruptions often emerge from the convergence of probabilistic factors that prediction markets and crowd intelligence capture earlier: labor sentiment, cascading delays, regulatory whispers, and social signals that precede official announcements.

---

## 3. Solution Overview

### 3.1 Product Vision

FlightSense AI transforms flight disruption management from a reactive firefighting exercise into a proactive, predictive, and personalized experience. By detecting disruptions before traditional systems and automatically reaching out to passengers with tailored solutions, we convert moments of frustration into demonstrations of exceptional service.

### 3.2 System Components

#### Component 1: Prediction Engine (Novel)

The prediction engine aggregates signals from multiple alternative data sources to generate disruption probability scores for each flight, route, and airport.

**Primary Data Sources:**
- Polymarket and other prediction market APIs for weather, travel, and event-related markets
- Social media sentiment analysis (Twitter/X, Reddit r/aviation)
- Airport-specific delay propagation models
- Historical pattern matching for similar conditions

**Secondary Data Sources:**
- Traditional weather APIs (NOAA, Weather.com) for validation
- FAA ATCSCC (Air Traffic Control System Command Center) feeds
- American Airlines Flight Engine API for real-time status

#### Component 2: TalkTuahAirlines (Voice AI)

A multilingual, task-oriented AI assistant that proactively contacts passengers via phone call when disruption probability exceeds threshold.

**Capabilities:**
- Natural language conversation in English and Spanish (expandable)
- Proactive outbound calling via Twilio integration
- Real-time flight rebooking through AA systems
- Compensation offer generation based on passenger tier and delay duration
- Warm handoff to human agents when needed

#### Component 3: Flock (Resolution Platform)

A web application that provides comprehensive disruption resolution options, integrated with the voice AI for seamless transitions.

**Features:**
- Alternative flight search and booking with AAdvantage integration
- AI-generated local itineraries for extended delays
- Hotel voucher generation and booking
- Car rental coordination via Turo integration
- AAdvantage points redemption for upgrades and services

### 3.3 Integrated User Journey

| Stage | Traditional Experience | FlightSense Experience |
|-------|------------------------|------------------------|
| **T-6 hours** | Passenger unaware of potential issue | System detects 73% cancellation probability; passenger flagged |
| **T-4 hours** | Weather worsens; no notification sent | AI calls passenger: "Your flight may be affected. Want to explore options?" |
| **T-2 hours** | Official cancellation; mass notification | Passenger already rebooked or has vouchers; no action needed |
| **T-0** | Passenger joins 200-person rebooking queue | Passenger relaxes with hotel voucher or alternative travel plan |
| **T+1 hour** | Still waiting; frustrated tweets | Passenger posts positive experience on social media |

---

## 4. Target Users & Personas

### 4.1 Primary Users

#### Persona 1: The Business Traveler (Marcus)
- **Demographics:** 42, Executive Platinum member, 80+ flights/year
- **Pain Points:** Time is money; missed meetings cost deals; hates uncertainty
- **Needs:** Immediate rebooking to maintain schedule; proactive communication
- **Value Proposition:** *"FlightSense called me 4 hours early. I was on an alternative flight before the cancellation was even announced."*

#### Persona 2: The Family Vacationer (Sofia)
- **Demographics:** 35, Gold member, traveling with 2 children under 10
- **Pain Points:** Managing kids during delays; complex rebooking for family; language barriers (Spanish-speaking)
- **Needs:** Clear options in her language; activities for kids during waits; simplified logistics
- **Value Proposition:** *"They called in Spanish, offered a hotel with a pool, and sent a fun itinerary for the kids. Turned a disaster into an adventure."*

#### Persona 3: The Anxious First-Timer (Jordan)
- **Demographics:** 23, no loyalty status, first solo trip
- **Pain Points:** Doesn't know airline processes; overwhelmed by airport chaos; no app proficiency
- **Needs:** Hand-holding through options; phone-based guidance (no app download required)
- **Value Proposition:** *"I had no idea what to do. The AI walked me through everything on the phone like a helpful friend."*

### 4.2 Secondary Users

#### Internal: Operations Center Staff
- **Use Case:** Dashboard showing prediction signals, automated outreach status, and escalation queue
- **Benefit:** Focus on edge cases while AI handles routine disruptions

#### Internal: Call Center Agents
- **Use Case:** Receive warm handoffs from AI with full conversation context; handle complex situations
- **Benefit:** Reduced call volume; higher-value interactions; better prepared conversations

#### Internal: Revenue Management
- **Use Case:** Early signals enable proactive rebooking to protect high-value passengers
- **Benefit:** Reduce compensation costs; maximize alternative flight utilization

---

## 5. Functional Requirements

### 5.1 Prediction Engine Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | The system shall ingest data from Polymarket API for relevant prediction markets (weather events, airport disruptions, travel-related markets) |
| FR-2 | The system shall aggregate signals from at least 3 alternative data sources to generate disruption probability scores |
| FR-3 | The system shall calculate disruption probability for each monitored flight on a 0-100% scale with confidence interval |
| FR-4 | The system shall update probability scores at minimum every 15 minutes for flights departing within 24 hours |
| FR-5 | The system shall trigger alerts when disruption probability exceeds configurable threshold (default: 65%) |
| FR-6 | The system shall differentiate between delay (30min-2hr), significant delay (2-6hr), and cancellation predictions |
| FR-7 | The system shall maintain historical prediction accuracy logs for model refinement |
| FR-8 | The system shall integrate with AA Flight Engine API to correlate predictions with actual outcomes |

### 5.2 Voice AI Requirements (TalkTuahAirlines)

| ID | Requirement |
|----|-------------|
| FR-9 | The system shall initiate outbound calls to affected passengers when disruption threshold is exceeded |
| FR-10 | The system shall support natural language conversation in English and Spanish at minimum |
| FR-11 | The system shall authenticate passengers using booking reference + last name or loyalty number |
| FR-12 | The system shall present personalized options based on passenger tier, booking class, and preferences |
| FR-13 | The system shall execute flight rebooking directly through AA systems upon passenger confirmation |
| FR-14 | The system shall generate and send hotel/car voucher codes via SMS during the call |
| FR-15 | The system shall provide warm handoff to human agents with full conversation context when requested |
| FR-16 | The system shall handle seat-swapping requests between passengers on the same flight |
| FR-17 | The system shall provide airport navigation guidance (gates, amenities, TSA info) upon request |
| FR-18 | The system shall log all interactions for quality assurance and dispute resolution |

### 5.3 Resolution Platform Requirements (Flock)

| ID | Requirement |
|----|-------------|
| FR-19 | The system shall display a dashboard of user's flights with real-time status and prediction scores |
| FR-20 | The system shall present alternative flight options with AAdvantage integration for fare differences |
| FR-21 | The system shall generate AI-powered local itineraries for delays exceeding 4 hours |
| FR-22 | The system shall integrate hotel booking with automatic voucher application for overnight delays |
| FR-23 | The system shall provide car rental options via Turo API integration |
| FR-24 | The system shall allow AAdvantage points redemption for services (upgrades, lounge access, meals) |
| FR-25 | The system shall send confirmation emails and calendar invites for all bookings |
| FR-26 | The system shall maintain user preferences for future disruption handling |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-1 | Prediction engine shall process incoming data and update scores within 30 seconds |
| NFR-2 | Voice AI shall initiate outbound calls within 5 minutes of threshold breach |
| NFR-3 | Web platform shall load dashboard in under 2 seconds (95th percentile) |
| NFR-4 | System shall handle concurrent outreach to 10,000+ passengers during major weather events |

### 6.2 Reliability

| ID | Requirement |
|----|-------------|
| NFR-5 | System shall maintain 99.9% uptime for prediction engine and voice AI |
| NFR-6 | Prediction accuracy shall exceed 75% for cancellations flagged at 65%+ confidence |
| NFR-7 | Voice AI call completion rate shall exceed 85% (calls answered and resolved) |
| NFR-8 | System shall implement graceful degradation if prediction sources become unavailable |

### 6.3 Security & Compliance

| ID | Requirement |
|----|-------------|
| NFR-9 | All passenger data shall be encrypted at rest and in transit (TLS 1.3) |
| NFR-10 | System shall comply with GDPR, CCPA, and airline industry data protection standards |
| NFR-11 | Voice recordings shall be stored securely with configurable retention policies |
| NFR-12 | PII access shall be logged and auditable |

### 6.4 Usability

| ID | Requirement |
|----|-------------|
| NFR-13 | Voice AI conversations shall feel natural with <500ms response latency |
| NFR-14 | Web platform shall be accessible (WCAG 2.1 AA compliant) |
| NFR-15 | System shall require zero app installation—phone calls and web links only |
| NFR-16 | Elderly and non-tech-savvy users shall complete rebooking via voice alone |

---

## 7. System Architecture

### 7.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLIGHTSENSE AI ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA SOURCES              PREDICTION ENGINE           ACTION LAYER         │
│                                                                             │
│  ┌───────────┐            ┌─────────────────┐        ┌────────────────┐    │
│  │Polymarket │───┐        │                 │        │  TalkTuahAI    │    │
│  │   API     │   │        │  Signal         │───────▶│  Voice Agent   │    │
│  └───────────┘   │        │  Aggregator     │        │  (Twilio +     │    │
│  ┌───────────┐   │        │       +         │        │   ElevenLabs)  │    │
│  │ Weather   │───┼───────▶│  ML Scoring     │        └────────────────┘    │
│  │   APIs    │   │        │  Model          │                │             │
│  └───────────┘   │        │                 │                ▼             │
│  ┌───────────┐   │        └────────┬────────┘        ┌────────────────┐    │
│  │ Social    │───┘                 │                 │    Flock       │    │
│  │ Sentiment │                     │                 │  Resolution    │    │
│  └───────────┘                     ▼                 │   Platform     │    │
│  ┌───────────┐            ┌─────────────────┐        └────────────────┘    │
│  │ AA Flight │◀──────────▶│  Event Queue    │                │             │
│  │ Engine    │            │  (Redis/BullMQ) │◀───────────────┘             │
│  └───────────┘            └─────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Technology Stack (Hackathon-Optimized)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14, React, Tailwind CSS | SSR for performance; familiar stack from Flock; rapid prototyping |
| **Backend API** | Node.js with tRPC or Express | Type-safe APIs; fast iteration; single language across stack |
| **Prediction Engine** | Python with FastAPI | Simple ML inference; easy data manipulation with pandas |
| **Voice AI** | Retell AI + GPT-4 + Twilio + ElevenLabs | Proven stack from TalkTuahAirlines; handles voice complexity |
| **Database** | Supabase (PostgreSQL) or PlanetScale | Free tier; managed service; instant setup; built-in auth |
| **Job Queue** | BullMQ with Redis (Upstash) | Simple background jobs; free tier available; handles async tasks |
| **Deployment** | Vercel (frontend) + Railway (backend) | Zero-config deploys; generous free tiers; instant previews |
| **Monitoring** | Vercel Analytics + Console logs | Built-in; no setup required; sufficient for demo |

### 7.3 Simplified Data Flow

```
1. INGESTION
   ├── Cron job (Vercel) polls Polymarket every 5 min
   ├── Weather API webhook on severe alerts
   └── AA Flight Engine polling for status changes

2. PROCESSING
   ├── FastAPI service normalizes incoming signals
   ├── Simple weighted scoring algorithm (MVP)
   └── Store scores in Supabase with flight_id key

3. TRIGGERING
   ├── Supabase database trigger on probability > 65%
   ├── Publishes job to BullMQ queue
   └── Worker picks up job, queries passenger list

4. ACTION
   ├── TalkTuahAirlines initiates Twilio outbound call
   ├── GPT-4 handles conversation; Retell manages flow
   └── Rebooking actions hit AA Flight Engine API

5. RESOLUTION
   ├── Flock web app receives booking confirmations
   ├── SMS sent with voucher codes via Twilio
   └── Outcomes logged for accuracy tracking
```

### 7.4 Repository Structure

```
flightsense-ai/
├── apps/
│   ├── web/                    # Next.js frontend (Flock dashboard)
│   │   ├── app/
│   │   ├── components/
│   │   └── package.json
│   ├── api/                    # Node.js backend
│   │   ├── routes/
│   │   ├── services/
│   │   └── package.json
│   └── prediction/             # Python prediction engine
│       ├── main.py
│       ├── models/
│       └── requirements.txt
├── packages/
│   ├── shared/                 # Shared types and utilities
│   └── db/                     # Prisma schema and client
├── infrastructure/
│   └── docker-compose.yml      # Local development
├── turbo.json
└── package.json
```

---

## 8. Data Sources & API Integrations

### 8.1 Prediction Market Data

#### Polymarket Integration

Polymarket is a decentralized prediction market platform where users trade on the outcomes of real-world events. Relevant markets for flight disruption prediction include:

- **Weather Events:** Hurricane landfalls, major winter storms, extreme temperature events
- **Transportation:** Airport closure events, FAA ground stops, major airline disruptions
- **Labor:** Airline worker actions, TSA staffing issues
- **Regulatory:** FAA policy changes, airspace restrictions

| API Endpoint | Data Retrieved | Polling Frequency |
|--------------|----------------|-------------------|
| `/markets` | Active markets with current prices (probabilities) | Every 5 minutes |
| `/markets/{id}/history` | Price history for trend analysis | Hourly |
| `/markets/{id}/trades` | Recent trade volume (signal confidence) | Every 15 minutes |

#### Prediction Market Signal Processing

Since Polymarket may not have flight-specific markets, we create proxy signals:

- **Weather proxy:** "Will Hurricane X make landfall in Florida?" → affects all Florida hub flights
- **Event proxy:** "Will Super Bowl have record attendance?" → affects Phoenix airport capacity
- **Labor proxy:** "Will airline workers strike before date?" → affects all carrier flights

The system maps market outcomes to affected routes using a geographic and operational impact matrix.

### 8.2 Additional Data Sources

| Source | Type | Signal Value | API/Method |
|--------|------|--------------|------------|
| NOAA Weather API | Weather | Severe weather probability by region | REST API (free) |
| FAA ATCSCC | Operations | Ground delay programs, airspace closures | XML feed |
| Twitter/X API | Sentiment | Passenger complaints, airport chaos mentions | Streaming API |
| FlightAware | Historical | Route-specific delay patterns | REST API |
| AA Flight Engine | Real-time | Current flight status, crew assignments | Hackathon API |
| Google Places | Amenities | Nearby hotels, restaurants, attractions | REST API |

### 8.3 American Airlines Integration Points

| System | Integration Type | Data/Actions |
|--------|------------------|--------------|
| Flight Engine API | Read/Write | Flight status, passenger manifests, seat availability |
| Reservation System | Write | Execute rebookings, issue vouchers |
| AAdvantage | Read | Loyalty tier, preferences, miles balance |
| Notification Service | Write | Trigger SMS/email confirmations |
| Customer Service | Read/Write | Agent handoff context, case creation |

---

## 9. User Flows

### 9.1 Primary Flow: Proactive Disruption Outreach

This is the core user journey that differentiates FlightSense from traditional disruption handling.

**TRIGGER:** Disruption probability for flight AA1234 exceeds 70%

```
Step 1:  System queries passenger manifest for AA1234 (~180 passengers)
            │
Step 2:  Passengers prioritized by:
            ├── (a) connection risk
            ├── (b) loyalty tier  
            └── (c) special needs flags
            │
Step 3:  TalkTuahAirlines initiates outbound call to first batch (top 50)
            │
Step 4:  Voice AI greeting:
         "Hi [Name], this is American Airlines with an important 
          update about your flight to [Destination]."
            │
Step 5:  AI explains situation:
         "We're monitoring conditions that may affect your departure. 
          I'd like to help you prepare some options in advance."
            │
Step 6:  AI presents options based on passenger profile:
            ├── Option A: Rebook to earlier flight (if available)
            ├── Option B: Rebook to next-day flight with hotel voucher
            ├── Option C: Full refund + travel credit
            └── Option D: Wait and monitor (passenger prefers original)
            │
Step 7:  If rebooking selected → AI executes in real-time:
         "I've confirmed you on flight AA5678 departing at 2:30 PM. 
          You'll receive a confirmation text shortly."
            │
Step 8:  If hotel/car requested → AI generates voucher codes via SMS
            │
Step 9:  If human agent requested → AI provides warm handoff with context
            │
Step 10: Call concludes → outcome logged → next passenger called
```

### 9.2 Secondary Flow: Web-Based Self-Service

For passengers who prefer digital interaction or miss the call.

```
Step 1:  SMS sent with link:
         "AA update for your flight: [short-url]. Review options."
            │
Step 2:  Passenger clicks link, authenticates via booking ref + last name
            │
Step 3:  Flock dashboard shows:
            ├── Current flight status
            ├── Disruption probability meter
            └── Recommended actions
            │
Step 4:  Passenger browses alternative flights
         (filters: time, connections, price difference)
            │
Step 5:  If extended delay → "Make the most of your wait" section
         shows AI-generated local itinerary
            │
Step 6:  Passenger can:
            ├── Book hotel with voucher
            ├── Browse car rentals
            └── Redeem points for lounge access
            │
Step 7:  All selections confirmed via email + calendar integration
```

### 9.3 Edge Case Flow: Airport Navigation Request

```
Step 1:  Passenger calls TalkTuahAirlines number (or continues call)
            │
Step 2:  "I'm at DFW and can't find my new gate."
            │
Step 3:  AI retrieves updated booking → identifies new gate (C27)
            │
Step 4:  AI provides navigation:
         "From your current location near Terminal A, take the Skylink 
          train toward Terminal C. Exit at stop C, gate 27 is to your left."
            │
Step 5:  AI offers additional help:
         "You have 90 minutes until boarding. Would you like 
          restaurant recommendations nearby?"
```

---

## 10. Success Metrics & KPIs

### 10.1 Primary Success Metrics

| Metric | Current Baseline | Target | Measurement Method |
|--------|------------------|--------|-------------------|
| Prediction Accuracy | N/A (new capability) | >75% for high-confidence alerts | Predicted vs. actual disruptions |
| Early Detection Lead Time | 0 hours (reactive only) | 2-6 hours average | Time between alert and official cancellation |
| Proactive Resolution Rate | 0% | >40% of disrupted passengers | Passengers rebooked before official notification |
| Call Answer Rate | N/A | >60% | Outbound calls answered / calls attempted |
| First-Call Resolution | N/A | >80% | Issues resolved without human escalation |
| Customer Satisfaction (CSAT) | 2.1/5 during disruptions | 4.0/5 | Post-interaction survey |

### 10.2 Operational Efficiency Metrics

| Metric | Current Baseline | Target | Business Impact |
|--------|------------------|--------|-----------------|
| Call Center Volume Reduction | 100% (baseline) | -35% during disruptions | $2.5M annual savings |
| Average Handle Time | 12 minutes | 4 minutes (AI-assisted) | 3x agent productivity |
| Rebooking Throughput | ~50/hour per agent | 500+/hour (automated) | 10x capacity during surge |
| Compensation Cost | $45/passenger avg | -20% | Better alternatives reduce claims |
| Social Media Sentiment | -0.3 (negative) | +0.2 (positive) | Brand reputation improvement |

### 10.3 Model Performance Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Precision | True positives / (True positives + False positives) | >70% |
| Recall | True positives / (True positives + False negatives) | >80% |
| F1 Score | Harmonic mean of precision and recall | >0.75 |
| False Positive Rate | Unnecessary alerts that cause passenger concern | <15% |
| Mean Absolute Error | Difference between predicted and actual probability | <10% |

### 10.4 Hackathon Demo Metrics

| Metric | Target for Demo |
|--------|-----------------|
| End-to-end flow completion | 1 successful demo scenario |
| Voice AI response latency | <2 seconds |
| Rebooking API integration | Working with mock/sandbox data |
| Multi-language support | English + Spanish working |

---

## 11. Implementation Roadmap

### 11.1 Hackathon MVP Scope (36 hours)

> **MVP Goal:** Demonstrate end-to-end flow: Prediction signal → Automated call → Successful rebooking for a simulated disruption scenario.

#### Hour 0-8: Foundation

- [ ] Set up monorepo with Next.js frontend + Node.js backend
- [ ] Deploy Supabase database with flight and passenger schemas
- [ ] Integrate Polymarket API (mock data if needed for demo)
- [ ] Connect to AA Flight Engine API (sandbox)
- [ ] Basic auth flow for passenger lookup

#### Hour 8-18: Core Features

- [ ] Build prediction scoring algorithm (rule-based MVP)
- [ ] Implement TalkTuahAirlines voice flow for disruption outreach
- [ ] Create Flock dashboard with flight status and options
- [ ] Wire up rebooking API calls
- [ ] SMS integration for voucher delivery

#### Hour 18-28: Integration

- [ ] Connect prediction engine → event trigger → voice AI
- [ ] Implement passenger prioritization logic
- [ ] Add Spanish language support to voice AI
- [ ] Build simple internal dashboard showing system status
- [ ] Error handling and fallback flows

#### Hour 28-36: Polish & Demo

- [ ] UI/UX refinement and mobile responsiveness
- [ ] Create demo scenario with compelling narrative
- [ ] Prepare presentation and talking points
- [ ] Record backup demo video
- [ ] Load testing and bug fixes

### 11.2 Task Assignment (4-Person Team)

| Person | Primary Focus | Secondary Focus |
|--------|---------------|-----------------|
| **Dev 1** | Prediction Engine (Python/FastAPI) | Data integrations |
| **Dev 2** | Voice AI (TalkTuahAirlines integration) | Twilio/SMS |
| **Dev 3** | Frontend (Flock dashboard) | UI/UX polish |
| **Dev 4** | Backend API + Database | Demo preparation |

### 11.3 Post-Hackathon Roadmap (If Selected)

| Phase | Timeline | Scope |
|-------|----------|-------|
| **Phase 1: Pilot** | Months 1-3 | Deploy on 5 high-disruption routes; gather accuracy data |
| **Phase 2: Expand** | Months 4-6 | Scale to all domestic flights; add 5 languages |
| **Phase 3: Enhance** | Months 7-9 | ML model improvements; crew/equipment predictions |
| **Phase 4: Enterprise** | Months 10-12 | Full AA integration; international expansion |

---

## 12. Risk Analysis & Mitigations

| Risk | Severity | Probability | Mitigation Strategy |
|------|----------|-------------|---------------------|
| **Polymarket lacks flight-specific markets** | Medium | High | Use proxy markets (weather, events); propose internal AA prediction markets for employees |
| **Prediction accuracy too low** | High | Medium | Implement confidence thresholds; escalate uncertain cases to human review; frame as "options" not "alerts" |
| **Passengers annoyed by false positives** | High | Medium | Frame calls as "proactive options" not "cancellation alerts"; clear communication; easy opt-out |
| **Call spam/fraud concerns** | Medium | Low | Authenticate with booking details; allow opt-out; clear AA branding in caller ID |
| **AA API rate limits** | Medium | Medium | Implement caching; batch queries; use webhooks where available |
| **Voice AI misunderstands requests** | Medium | Medium | Always offer human handoff; implement fallback keywords; clear escalation path |
| **Demo failure during presentation** | High | Low | Pre-record backup video; have multiple demo scenarios ready; test extensively |
| **Time crunch—features incomplete** | Medium | High | Prioritize core flow; cut scope early; focus on impressive demo over completeness |

---

## 13. Competitive Differentiation

### 13.1 Why This Approach is Unique

| Differentiator | Traditional Solutions | FlightSense AI |
|----------------|----------------------|----------------|
| **Detection Method** | Deterministic (confirmed events only) | Probabilistic (crowd intelligence + ML) |
| **Timing** | Reactive (after announcement) | Proactive (hours before) |
| **Communication** | Mass notification blast | Personalized outbound calls |
| **Resolution** | Self-service or long queues | AI-executed rebooking in real-time |
| **Channel** | App/website required | Phone call—universal accessibility |
| **Language** | English-first | Multilingual from day one |
| **Data Sources** | Internal systems only | Alternative data (prediction markets, social) |

### 13.2 The Polymarket Innovation

> **Why Prediction Markets?** Prediction markets aggregate information from diverse participants who have financial skin in the game. A hurricane market trader might combine weather models, shipping data, insurance pricing, and on-the-ground reports that no single airline system captures. By treating market prices as probability signals, FlightSense gains access to "the wisdom of the crowd" with built-in incentives for accuracy.

### 13.3 Additional Innovation: Internal AA Prediction Markets

A future enhancement could enable AA employees (gate agents, mechanics, crew schedulers) to participate in internal prediction markets on operational outcomes. This surfaces tacit knowledge—like "that aircraft has been having issues" or "the crew is stretched thin"—that doesn't appear in formal systems.

### 13.4 Hackathon Pitch Angles

1. **"We call passengers before they call us"** — Flips the disruption paradigm
2. **"Crowd intelligence meets airline operations"** — Novel data source angle
3. **"No app required"** — Accessibility/inclusivity angle
4. **"From frustration to delight"** — Customer experience transformation
5. **"3 hackathon projects, 1 integrated solution"** — Shows collaboration and ambition

---

## 14. Future Roadmap

### 14.1 Feature Expansion

- **Crew Disruption Prediction:** Extend model to predict crew-related delays (illness, legality limits)
- **Mechanical Prediction:** Integrate IoT sensor data for predictive maintenance signals
- **Overbooking Intelligence:** Predict no-shows to optimize seat allocation
- **Dynamic Pricing:** Adjust alternative flight pricing based on demand/urgency
- **Loyalty Personalization:** Tailor disruption handling to AAdvantage tier expectations

### 14.2 Platform Expansion

- **International Routes:** Expand prediction coverage to transatlantic/transpacific
- **Partner Airlines:** oneworld alliance integration for codeshare disruptions
- **Airport Partnerships:** Share prediction data with airports for resource planning
- **Travel Insurance:** Integrate with partners for automatic claim initiation

### 14.3 AI Evolution

- **Continuous Learning:** Model retrains on prediction accuracy feedback loop
- **Personalized Predictions:** Factor in individual passenger disruption tolerance
- **Conversational Memory:** Voice AI remembers past interactions for seamless continuity
- **Proactive Upgrades:** Offer seat upgrades when disruption creates opportunity

---

## 15. Appendices

### Appendix A: Database Schema

```sql
-- Core Tables

CREATE TABLE flights (
  flight_id VARCHAR(10) PRIMARY KEY,
  departure_airport CHAR(3),
  arrival_airport CHAR(3),
  scheduled_departure TIMESTAMP,
  actual_status VARCHAR(20) DEFAULT 'scheduled',
  disruption_probability DECIMAL(5,2),
  prediction_confidence DECIMAL(5,2),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE passengers (
  passenger_id SERIAL PRIMARY KEY,
  booking_reference VARCHAR(6),
  flight_id VARCHAR(10) REFERENCES flights(flight_id),
  name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  loyalty_tier VARCHAR(20),
  language_preference CHAR(2) DEFAULT 'en',
  outreach_status VARCHAR(20) DEFAULT 'pending',
  outreach_timestamp TIMESTAMP,
  resolution_type VARCHAR(50)
);

CREATE TABLE prediction_signals (
  signal_id SERIAL PRIMARY KEY,
  source VARCHAR(50),
  market_id VARCHAR(100),
  probability DECIMAL(5,4),
  affected_airports TEXT[],
  affected_routes TEXT[],
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE outreach_logs (
  log_id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES passengers(passenger_id),
  call_timestamp TIMESTAMP,
  call_duration INTEGER,
  outcome VARCHAR(50),
  new_flight_id VARCHAR(10),
  voucher_issued BOOLEAN DEFAULT FALSE,
  transcript_url TEXT
);

-- Indexes
CREATE INDEX idx_flights_departure ON flights(scheduled_departure);
CREATE INDEX idx_flights_probability ON flights(disruption_probability);
CREATE INDEX idx_passengers_flight ON passengers(flight_id);
CREATE INDEX idx_passengers_outreach ON passengers(outreach_status);
```

### Appendix B: Voice AI Script Samples

#### Opening Script (English)

> "Hello, this is American Airlines calling for [Passenger Name]. We're reaching out because we're monitoring conditions that may affect your flight AA[Number] to [Destination] scheduled for [Time]. We want to make sure you have options ahead of time. Do you have a moment to review some alternatives with me?"

#### Opening Script (Spanish)

> "Hola, le llama American Airlines para [Passenger Name]. Nos comunicamos porque estamos monitoreando condiciones que podrían afectar su vuelo AA[Number] a [Destination] programado para [Time]. Queremos asegurarnos de que tenga opciones con anticipación. ¿Tiene un momento para revisar algunas alternativas conmigo?"

#### Rebooking Confirmation

> "Great, I've confirmed you on flight AA[Number] departing at [New Time]. Your seat is [Seat Number] and you'll arrive at [New Arrival Time]. I'm sending a confirmation to your phone now. Is there anything else I can help you with today?"

#### Hotel Voucher Offer

> "Since your rescheduled flight departs tomorrow morning, I'd like to offer you a complimentary hotel stay at the [Hotel Name], which is just 10 minutes from the airport. I can also generate a $50 meal voucher. Would you like me to book that for you?"

#### Human Handoff

> "I understand you'd prefer to speak with a team member. Let me connect you now. I'll share everything we've discussed so you won't need to repeat yourself. Please hold for just a moment."

### Appendix C: API Response Examples

#### Polymarket Market Response
```json
{
  "id": "hurricane-helene-florida-landfall",
  "question": "Will Hurricane Helene make landfall in Florida before Oct 1?",
  "outcomes": ["Yes", "No"],
  "outcomePrices": [0.73, 0.27],
  "volume": 125000,
  "liquidity": 45000,
  "endDate": "2024-10-01T00:00:00Z"
}
```

#### Prediction Score Response
```json
{
  "flight_id": "AA1234",
  "route": "DFW-MIA",
  "scheduled_departure": "2024-09-28T14:30:00Z",
  "disruption_probability": 0.72,
  "confidence": 0.85,
  "factors": [
    {"source": "polymarket", "signal": "hurricane-landfall", "weight": 0.45},
    {"source": "weather-api", "signal": "severe-storm-warning", "weight": 0.35},
    {"source": "historical", "signal": "route-delay-pattern", "weight": 0.20}
  ],
  "recommendation": "proactive_outreach",
  "updated_at": "2024-09-27T10:15:00Z"
}
```

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| **Prediction Market** | A market where participants trade contracts based on the outcomes of future events |
| **Polymarket** | A decentralized prediction market platform built on blockchain technology |
| **Disruption Probability** | A 0-100% score indicating the likelihood of a flight being delayed or cancelled |
| **Proactive Outreach** | Contacting passengers before they're aware of a potential issue |
| **Warm Handoff** | Transferring a call to a human agent with full conversation context |
| **AAdvantage** | American Airlines' frequent flyer loyalty program |
| **Ground Stop** | An FAA directive halting departures to a specific airport |
| **IROP** | Irregular Operations—airline industry term for disruptions |
| **PNR** | Passenger Name Record—the booking reference code |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2025 | FlightSense Team | Initial PRD for hackathon |

---

*— End of Document —*
