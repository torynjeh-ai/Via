# NjangiPay

Digital Njangi (rotating savings group) platform for Cameroon. Backend API + Web Dashboard + Mobile App (React Native).

## Features

- Phone-based auth with OTP verification (Twilio)
- JWT authentication
- Create/join Njangi groups
- Automated payout queue with trust-score weighting
- MTN Mobile Money & Orange Money integration
- Push notifications (Firebase)
- PostgreSQL database

## Tech Stack

**Backend:** Node.js, Express, PostgreSQL, JWT, Twilio, Firebase Admin  
**Web:** React, Vite, React Router, Axios  
**Mobile:** React Native, Expo (SDK 52)

## Setup

### 1. Install Dependencies

```bash
npm install
cd web && npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — random 32+ character string
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Firebase credentials (optional, for push notifications)

### 3. Database Setup

```bash
npm run db:migrate
```

Or manually:
```bash
psql -U postgres -d njangipay -f schema.sql
```

### 4. Run

**Backend:**
```bash
npm run dev
```

**Web Dashboard:**
```bash
npm run web
```

**Mobile App:**
```bash
cd mobile
npm install --legacy-peer-deps
npx expo start --lan
```

## API Endpoints

```
POST   /auth/register
POST   /auth/verify-otp
POST   /auth/login

GET    /users/me
PATCH  /users/me
GET    /users/me/groups
GET    /users/me/notifications

GET    /groups
POST   /groups
GET    /groups/:id
POST   /groups/:id/join
POST   /groups/:id/start
POST   /groups/:id/contribute
GET    /groups/:id/payouts
GET    /groups/:id/contributions
```

## Test Account

- Phone: `+237651954823`
- Password: `admin123`
- Role: admin

## License

MIT
