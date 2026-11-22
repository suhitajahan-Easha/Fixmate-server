# FixMate Backend – Repair Service Management API

## Project Overview

The FixMate Backend is a RESTful API built with Node.js, Express.js, and MongoDB for the FixMate Smart Device & Home Appliance Repair Service Platform.

It handles authentication verification, user management, repair service management, booking operations, role-based authorization, dashboard statistics, and Stripe payment processing.

The backend provides secure APIs for three types of users: Customers, Technicians, and Admins.

## Live API URL

**Backend:** https://fixmate-server-zigh.vercel.app

**Frontend:** https://fixmate-client-9.vercel.app/

## Admin Credentials

- **Email:** `mahbub@gmail.com`
- **Password:** `Mahbub200`


## Technologies Used

- Node.js
- Express.js
- MongoDB
- Better Auth
- JSON Web Token (JWT)
- Stripe
- Vercel
- ImgBB

## Key Features

### 1. Authentication & Authorization
- JWT verification using Better Auth JWKS.
- Role-based authorization for Customers, Technicians, and Admins.
- Protected API endpoints.
- Secure access to role-specific operations.

### 2. User Management
- Retrieve and manage user information.
- Manage user roles.
- Admin user management.
- Profile information management.

### 3. Service Management
- Create repair services as a Technician.
- Retrieve available and approved services.
- Update and manage technician-owned services.
- Admin approval and rejection of submitted services.
- Control service availability.

### 4. Booking Management
- Create repair requests as a Customer.
- Prevent duplicate active bookings for the same service.
- Prevent technicians from booking their own services.
- Retrieve bookings based on user roles.
- Allow technicians to manage booking progress.
- Allow customers to cancel eligible requests.
- Update booking status and final service amount.

### 5. Stripe Payment Integration
- Create Stripe Checkout sessions.
- Support pay-after-service payments.
- Allow payment only for completed bookings.
- Verify Stripe payment sessions.
- Prevent duplicate payment records.
- Update booking payment status after successful verification.
- Store transaction and payment information.

### 6. Dashboard Statistics
- Admin dashboard statistics.
- Technician dashboard statistics.
- Customer dashboard statistics.
- Recent users, services, and booking information.

## API Functionalities

| Module | Main Operations |
|---|---|
| Authentication | JWT verification and role authorization |
| Users | User retrieval and management |
| Services | Create, read, update, and delete services |
| Bookings | Create, read, update, and cancel bookings |
| Payments | Create Checkout sessions and verify payments |
| Admin | User management, service moderation, statistics |
| Dashboard | Role-based statistics and summaries |

## Database Collections

The backend uses MongoDB with the following main collections:

- `user` – User information and roles.
- `services` – Repair service information.
- `bookings` – Customer repair requests and booking status.
- `payments` – Verified payment and transaction records.

Better Auth also manages its own authentication-related collections.

## Important NPM Packages

| Package | Purpose |
|---|---|
| `express` | Backend API framework |
| `mongodb` | MongoDB database integration |
  `better-auth` | Authentication |
| `@better-auth/jwt` | Better Auth JWT plugin |
| `jose` | JWT verification using JWKS |
| `stripe` | Stripe payment integration |
| `cors` | Cross-origin resource sharing |
| `dotenv` | Environment variable management |


## Environment Variables

Create a `.env` file in the backend root directory.

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=your_frontend_url
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

Add any other environment variables required by your actual backend configuration.

**Important:** Never commit your `.env` file or expose secret keys in a public repository.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/suhitajahan-Easha/Fixmate-server
cd your-backend-folder
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file and configure your MongoDB connection, frontend URL, Stripe keys, and other required environment variables.

### 4. Run the Backend Server

```bash
node index.js
```

Or, if your project uses a development script:

```bash
nodemon
```

## Deployment

The backend is deployed on **Vercel**.

Live API: https://fixmate-server-zigh.vercel.app

## Developer

**Suhita Jahan Easha**

- GitHub: https://github.com/suhitajahan-Easha
- LinkedIn: https://www.linkedin.com/in/suhita-jahan-easha/

---

**FixMate Backend – Powering Reliable Repair Service Management.**