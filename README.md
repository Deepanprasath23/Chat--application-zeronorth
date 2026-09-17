# Real-Time Chat Application

A complete, production-ready real-time chat application built for technical assessment. Features one-to-one messaging, group conversations, online/offline presence detection, message history persistence in PostgreSQL (with SQLite fallback), JWT authentication (compatible with Supabase Auth), and native WebSockets.

---

## Tech Stack

- **Frontend:** React (Vite), React Router DOM, Axios, Lucide React, Custom CSS
- **Backend:** Python 3.10+, FastAPI, Uvicorn, WebSockets
- **Database & ORM:** PostgreSQL (Supabase-hosted or local), SQLAlchemy 2.0, Alembic migrations
- **Authentication:** JWT (supports Supabase Auth JWT verification & standalone local JWT)
- **Testing:** Pytest, HTTPX TestClient, WebSockets Test Client

---

## Key Features

1. **User Authentication:** Registration, Login, Session Persistence, and Token Verification.
2. **1-on-1 Real-Time Messaging:** Direct messaging between users with instant delivery via WebSockets.
3. **Group Conversations:** Multi-user group creation, member additions, and group broadcast messaging.
4. **Online/Offline Presence:** Real-time presence detection and status badges (`user_online` / `user_offline`).
5. **Multi-Tab Connection Handling:** Multi-connection tracking per user (opening multiple browser tabs updates presence correctly).
6. **Persistent History:** Messages and conversation metadata stored in PostgreSQL.
7. **Authorization & Security:** Conversation membership validation ensures users can only read/send messages in their own chats.
8. **Typing Indicators:** Real-time user typing status broadcasting.
9. **Responsive UI:** Clean dark theme chat UI with loading, empty, and error states.

---

## Directory Structure

```
Chat application/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py         # Settings & environment variables
│   │   │   ├── database.py       # SQLAlchemy engine & session factory
│   │   │   ├── dependencies.py   # Auth dependencies & get_current_user
│   │   │   └── security.py       # Password hashing & JWT decoding
│   │   ├── models/               # SQLAlchemy ORM models (User, Conversation, Member, Message)
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── routers/              # REST API endpoints (Auth, Users, Conversations, Messages)
│   │   ├── websocket/            # ConnectionManager & WebSocket router (/ws)
│   │   └── main.py               # FastAPI entry point & CORS configuration
│   ├── alembic/                  # Alembic migration scripts
│   ├── tests/                    # Pytest test suite (Auth, Conversations, Messages, WebSockets)
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                  # Axios HTTP client with JWT interceptor
│   │   ├── context/              # AuthContext & WebSocketContext
│   │   ├── components/           # Auth, Sidebar, ChatWindow, Modals, Avatars
│   │   ├── pages/                # ChatPage layout
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .env.example
├── .gitignore
└── README.md
```

---

## Environment Variables

Copy `.env.example` to `.env` in the root or `backend` folder:

```env
PROJECT_NAME="Real-Time Chat Application"
API_V1_STR="/api"
JWT_SECRET="super-secret-jwt-key-change-in-production-12345"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# PostgreSQL Database (Supabase or Local)
# DATABASE_URL="postgresql://postgres.user:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
DATABASE_URL="sqlite:///./chat_app.db"

# Optional Supabase Auth Integration
SUPABASE_URL=""
SUPABASE_KEY=""
SUPABASE_JWT_SECRET=""

CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

---

## Setup & Running Instructions

### 1. Backend Setup

1. Navigate to the `backend` folder:

   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:

   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Run Database Migrations:

   ```bash
   alembic upgrade head
   ```

   Migration `002_enable_rls` enables RLS for `users`, `conversations`,
   `conversation_members`, and `messages`. The backend validates its local JWT
   and sets the transaction-local PostgreSQL setting `app.user_id`; the
   policies use that value for membership checks. Keep `DATABASE_URL` on the
   server. The frontend must use the FastAPI API and must not connect directly
   to Supabase tables.

5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend server will run at `http://127.0.0.1:8000` (API docs at `http://127.0.0.1:8000/docs`).

---

### 2. Frontend Setup

1. Open a new terminal and navigate to the `frontend` folder:

   ```bash
   cd frontend
   ```

2. Install npm dependencies:

   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application UI will open at `http://localhost:5173`.

---

## Running Tests

To run the complete automated backend test suite (covering Auth, Conversations, Authorization, and WebSockets):

```bash
cd backend
.\venv\Scripts\python -m pytest
```

Expected output:

```
======================== 7 passed in 3.59s ========================
```

---

## API & WebSocket Specification

### REST Endpoints

| Method | Endpoint                           | Description                     | Auth Required |
| ------ | ---------------------------------- | ------------------------------- | ------------- |
| `POST` | `/api/auth/register`               | Register new user account       | No            |
| `POST` | `/api/auth/login`                  | Log in and receive JWT token    | No            |
| `GET`  | `/api/auth/me`                     | Fetch active user profile       | Yes           |
| `GET`  | `/api/users`                       | Search/list users for messaging | Yes           |
| `GET`  | `/api/conversations`               | List user's conversations       | Yes           |
| `POST` | `/api/conversations/direct`        | Get or create 1-on-1 chat       | Yes           |
| `POST` | `/api/conversations/group`         | Create group chat               | Yes           |
| `POST` | `/api/conversations/{id}/members`  | Add members to group chat       | Yes           |
| `GET`  | `/api/conversations/{id}/messages` | Retrieve message history        | Yes           |

### WebSocket Endpoint (`/ws?token=<JWT_TOKEN>`)

#### Inbound Client Messages:

- **Send Message:**
  ```json
  {
    "type": "send_message",
    "conversation_id": 1,
    "content": "Hello World!"
  }
  ```
- **Typing Status:**
  ```json
  {
    "type": "typing",
    "conversation_id": 1,
    "is_typing": true
  }
  ```

#### Outbound Server Events:

- **New Message:** `{"type": "new_message", "payload": { "conversation_id": 1, "message": {...} }}`
- **Presence Update:** `{"type": "presence_update", "payload": { "user_id": 2, "is_online": true }}`
- **Typing Status:** `{"type": "typing_status", "payload": { "conversation_id": 1, "user_id": 2, "is_typing": true }}`

---

## Deployment Guide (Supabase & Cloud)

1. Set up a PostgreSQL database project on [Supabase](https://supabase.com).
2. Retrieve your database connection string and set `DATABASE_URL="postgresql://..."` in your environment.
3. Run `alembic upgrade head` to apply all database tables and indexes.
4. Deploy the FastAPI backend on Railway, Render, or AWS App Runner.
5. Deploy the React Vite frontend on Vercel, Netlify, or Cloudflare Pages.

### RLS and Supabase dashboard requirements

- Run `alembic upgrade head` against the production Supabase database.
- Use a server-only PostgreSQL connection in `DATABASE_URL`. PostgreSQL owners
  and service roles bypass ordinary RLS, so the FastAPI membership checks remain
  mandatory for this architecture.
- Never put `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_JWT_SECRET`, or a service
  role key in frontend environment variables. `SUPABASE_KEY` is not required by
  the current frontend.
- This app uses local integer-user JWTs, not Supabase Auth UUID identity. Direct
  Supabase Data API requests therefore match no application policy. Do not
  enable direct table access until a deliberate UUID-to-user mapping and
  corresponding policies are added.

## Online Deployment

The repository includes `render.yaml` for the FastAPI/WebSocket backend. A
simple production setup is:

1. In Supabase, copy the server-side PostgreSQL connection string and keep the
   password private. The pooler connection is usually preferable for hosted
   services.
2. In Render, create a Blueprint from this repository. Set `DATABASE_URL` to
   the Supabase PostgreSQL URL and `CORS_ORIGINS` to the final frontend URL,
   such as `https://your-chat.vercel.app`. Render runs `alembic upgrade head`
   before starting the API.
3. Deploy `frontend` as a Vercel project with **Root Directory** set to
   `frontend`, framework preset `Vite`, and these production variables:

   ```env
   VITE_API_URL=https://your-backend.onrender.com/api
   VITE_WS_URL=wss://your-backend.onrender.com/ws
   ```

4. Replace the temporary frontend URL in Render's `CORS_ORIGINS` with the
   actual Vercel URL, then redeploy the backend. WebSockets must use `wss://`
   when the frontend uses HTTPS.

Never add `DATABASE_URL`, `JWT_SECRET`, Supabase service-role keys, or database
passwords to Vercel or to any `VITE_*` variable. Vite exposes `VITE_*` values
to the browser.

### Free hosting notes

The free setup uses Supabase Free, Render Free, and Vercel Hobby. Render Free
services sleep after inactivity, so the first request can take up to a minute
and active WebSocket connections will be interrupted when the service sleeps.
This is suitable for demos and small personal projects, but not guaranteed
24/7 production uptime.
