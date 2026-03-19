<p align="center">
  <img src="https://img.shields.io/badge/Finmate-Personal_Finance_Companion-58A6FF?style=for-the-badge&labelColor=0D1117" alt="Finmate" />
</p>

<h1 align="center">Finmate</h1>

<p align="center">
  <strong>A full-stack financial companion app with expense tracking, real-time chat, gamification, and AI-powered insights.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Screenshots

> Replace with your own screenshots.

| Dashboard | Expenses | Chat |
|-----------|----------|------|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Expenses](docs/screenshots/expenses.png) | ![Chat](docs/screenshots/chat.png) |

| Bills & Reminders | Achievements | AI Assistant |
|-------------------|--------------|--------------|
| ![Bills](docs/screenshots/bills.png) | ![Achievements](docs/screenshots/achievements.png) | ![AI](docs/screenshots/ai-assistant.png) |

---

## Features

### Financial Management
- **Expense Tracking** — Create, edit, delete expenses with category, date, and description. Filter by category, date range, or keyword with pagination.
- **Monthly Budgets** — Set spending limits per category and track progress against actual spending.
- **Bill Reminders** — Recurring bill tracker with configurable frequencies (daily, weekly, biweekly, monthly, quarterly, yearly, one-time). Record payments, skip cycles, and auto-add to expenses.
- **Expense Splitting** — Split expenses with friends using equal, exact, or percentage methods. Track settlements within groups.
- **CSV Export** — Export your expenses to CSV for external analysis.
- **Statistics & Analytics** — Spending breakdown charts by category (pie chart) and monthly trends (bar chart) via Recharts.

### Social & Communication
- **Real-Time Chat** — Direct and group messaging powered by Socket.io. Supports text, images, GIFs (Giphy), voice messages, emoji reactions, and reply threads.
- **Voice & Video Calls** — Peer-to-peer WebRTC calls with TURN server support for NAT traversal.
- **Friends System** — Search users, send/accept/reject friend requests, block/unblock users.
- **Read Receipts & Typing Indicators** — Real-time presence with online status tracking.
- **Message Editing & Deletion** — Edit messages within a 15-minute window, soft-delete messages.
- **Chat Customization** — Per-conversation themes and wallpapers.

### Gamification
- **XP & Levels** — Earn experience points for logging expenses, maintaining streaks, and hitting milestones.
- **Badges** — Unlock achievements across categories: streak, budget, logging, social, milestone, and special.
- **Monthly Challenges** — Time-limited challenges with progress tracking and XP rewards.
- **Leaderboard** — Compete with friends on XP rankings.

### AI & Scanning
- **AI Financial Assistant** — Chat with Google Gemini for personalized financial advice and insights.
- **Receipt Scanner** — OCR-powered receipt scanning via Tesseract.js to auto-extract expense data.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React 18, TypeScript 5, Tailwind CSS 3.4, Framer Motion |
| **Backend** | Next.js API Routes, Custom Node.js Server, Socket.io 4.8 |
| **Database** | PostgreSQL (25+ tables, Neon compatible) |
| **Real-Time** | Socket.io (chat, typing, presence), WebRTC via simple-peer (calls) |
| **Auth** | JWT (jsonwebtoken + jose), bcryptjs, HttpOnly cookie refresh tokens |
| **AI** | Google Generative AI (Gemini) |
| **OCR** | Tesseract.js 7 |
| **Charts** | Recharts 3.8 |
| **Other** | date-fns, uuid, sharp (image processing), canvas-confetti, Giphy SDK |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **PostgreSQL** 12+ (tested with Neon serverless)
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/mMahabub/finmate.git
cd finmate

# Install dependencies
npm install
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

```env
# Database (PostgreSQL / Neon)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Auth Secrets (generate with: openssl rand -hex 32)
JWT_SECRET=your-jwt-secret-here
NEXTAUTH_SECRET=your-nextauth-secret-here

# App URL
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Giphy API (optional — enables GIF support in chat)
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-api-key

# Google Gemini AI (optional — enables AI assistant)
GEMINI_API_KEY=your-gemini-api-key

# TURN Server (optional — enables WebRTC calls across NAT/firewalls)
# NEXT_PUBLIC_TURN_URL=turn:a.relay.metered.ca:443?transport=tcp
# NEXT_PUBLIC_TURN_USERNAME=your-username
# NEXT_PUBLIC_TURN_CREDENTIAL=your-credential
```

### Database Setup

Run the migration SQL to create all tables, indexes, and seed data:

```bash
psql $DATABASE_URL -f src/migrations/complete-setup.sql
```

### Running the App

```bash
# Development (starts custom server with Socket.io on port 3000)
npm run dev

# Production build
npm run build
npm start
```

The app runs on `http://localhost:3000` with the custom server (`server.js`) that integrates Socket.io alongside Next.js.

---

## Project Structure

```
finmate/
├── server.js                    # Custom Node.js server (Next.js + Socket.io)
├── next.config.js
├── .env.example                 # Environment variable template
├── src/
│   ├── app/
│   │   ├── page.tsx             # Dashboard (summary cards, charts, recent activity)
│   │   ├── layout.tsx           # Root layout with auth & socket providers
│   │   ├── login/               # Sign in
│   │   ├── signup/              # Create account
│   │   ├── expenses/
│   │   │   ├── page.tsx         # Expense list with filters & pagination
│   │   │   ├── add/page.tsx     # Add new expense
│   │   │   └── [id]/edit/       # Edit expense
│   │   ├── bills/page.tsx       # Bill reminders with pay/skip actions
│   │   ├── budget/page.tsx      # Budget management per category
│   │   ├── chat/page.tsx        # Real-time chat (DMs, groups, WebRTC calls)
│   │   ├── friends/page.tsx     # Friend management & search
│   │   ├── achievements/page.tsx # Badges, challenges, leaderboard
│   │   ├── statistics/page.tsx  # Spending analytics & charts
│   │   ├── ai-assistant/page.tsx # Gemini AI chat
│   │   ├── scan/page.tsx        # Receipt OCR scanner
│   │   ├── analytics/page.tsx   # Advanced analytics
│   │   ├── notifications/page.tsx
│   │   ├── settings/page.tsx    # Profile, currency, password, account deletion
│   │   └── api/                 # 60+ API routes
│   │       ├── auth/            # login, signup, logout, refresh, forgot/reset password
│   │       ├── expenses/        # CRUD, stats, export
│   │       ├── bills/           # CRUD, pay, skip, upcoming
│   │       ├── budgets/         # CRUD
│   │       ├── friends/         # request, accept, reject, search, block
│   │       ├── conversations/   # CRUD, messages, members, theme, wallpaper
│   │       ├── messages/        # edit, delete, read, reactions, search
│   │       ├── calls/           # WebRTC call initiation
│   │       ├── gamification/    # stats, badges, challenges, leaderboard
│   │       ├── ai/              # chat, insight
│   │       ├── receipts/        # scan (OCR)
│   │       ├── notifications/   # list, mark read
│   │       ├── user/            # profile, change-password, account deletion
│   │       ├── gifs/            # search, trending (Giphy)
│   │       ├── upload/          # voice messages, wallpapers
│   │       ├── analytics/       # spending analytics
│   │       └── health/          # health check
│   ├── context/
│   │   ├── AuthContext.tsx      # JWT auth state & user session
│   │   ├── SocketContext.tsx    # Socket.io connection & online status
│   │   └── CallContext.tsx      # WebRTC call state management
│   ├── hooks/
│   │   ├── useExpenses.ts       # Expense data fetching & stats
│   │   ├── useBudgets.ts        # Budget management
│   │   ├── useSocket.ts         # Socket event listeners
│   │   ├── useWebRTC.ts         # Peer connections & media streams
│   │   ├── useCallManager.ts    # Call initiation & management
│   │   ├── useGamification.ts   # Achievement data
│   │   ├── useCurrency.ts       # Currency selection & formatting
│   │   └── useTheme.ts          # Chat theme customization
│   ├── components/
│   │   ├── dashboard/           # SummaryCards, CategoryPieChart, MonthlyBarChart
│   │   ├── expenses/            # ExpenseList, ExpenseForm
│   │   ├── chat/                # ChatWindow, MessageBubble, CallUI
│   │   ├── ui/                  # Reusable UI components
│   │   └── layout/              # Sidebar, Navbar
│   ├── lib/
│   │   ├── db.ts                # PostgreSQL pool (pg) with query helpers
│   │   ├── auth.ts              # Password hashing, JWT generation
│   │   ├── apiAuth.ts           # API route authentication middleware
│   │   ├── apiClient.ts         # Frontend fetch wrapper with auth
│   │   ├── formatCurrency.ts    # Currency formatting utilities
│   │   └── constants.ts
│   ├── types/
│   │   └── expense.ts           # TypeScript type definitions
│   └── migrations/
│       └── complete-setup.sql   # Full schema (25+ tables with indexes & seeds)
└── public/                      # Static assets
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new account |
| POST | `/api/auth/login` | Sign in (returns JWT) |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | List expenses (filter by category, date, search; paginated) |
| POST | `/api/expenses` | Create expense |
| GET | `/api/expenses/:id` | Get expense detail |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/expenses/stats` | Monthly spending statistics |
| GET | `/api/expenses/export` | Export expenses to CSV |

### Bills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills` | List bill reminders |
| POST | `/api/bills` | Create bill reminder |
| PUT | `/api/bills/:id` | Update bill |
| DELETE | `/api/bills/:id` | Delete bill |
| POST | `/api/bills/:id/pay` | Record payment |
| POST | `/api/bills/:id/skip` | Skip payment cycle |
| GET | `/api/bills/upcoming` | Upcoming bills |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List budgets |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |

### Friends
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/friends` | List accepted friends |
| POST | `/api/friends/request` | Send friend request |
| GET | `/api/friends/requests` | Pending incoming requests |
| POST | `/api/friends/accept/:id` | Accept friend request |
| POST | `/api/friends/reject/:id` | Reject friend request |
| GET | `/api/friends/search` | Search users by name/email |
| POST | `/api/friends/block` | Block user |

### Conversations & Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create group conversation |
| GET | `/api/conversations/:id/messages` | Get messages |
| PUT | `/api/messages/:id` | Edit message (15-min window) |
| DELETE | `/api/messages/:id` | Soft-delete message |
| POST | `/api/messages/:id/reactions` | Add emoji reaction |
| GET | `/api/messages/search` | Search messages |

### Gamification
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gamification/stats` | User XP, level, streak |
| GET | `/api/gamification/badges` | All badges with progress |
| GET | `/api/gamification/challenges` | Current month challenges |
| GET | `/api/gamification/leaderboard` | Friend leaderboard |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/chat` | Chat with Gemini AI |
| POST | `/api/ai/insight` | Get AI financial insight |
| POST | `/api/receipts/scan` | OCR receipt scanning |
| GET | `/api/analytics` | Spending analytics |
| GET | `/api/health` | Health check |

---

## Real-Time Features

The custom `server.js` integrates Socket.io with Next.js for:

| Event | Description |
|-------|-------------|
| `message_new` | Real-time message delivery |
| `user_status` | Online/offline presence |
| `typing` | Typing indicators |
| `call_initiate` | WebRTC call signaling |
| `call_signal` | ICE candidate / SDP exchange |

Socket connections are authenticated via JWT verification.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please follow the existing code style and include appropriate tests for new features.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contact

**Mohammad Mahabub Alam**

- Email: [mohammad.alam9212@gmail.com](mailto:mohammad.alam9212@gmail.com)
- GitHub: [github.com/mMahabub](https://github.com/mMahabub)
