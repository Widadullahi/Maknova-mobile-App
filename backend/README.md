# Real Estate API

Custom Flask backend for the Real Estate Management Platform.

## Stack

- Flask
- PyMySQL
- Raw SQL queries with parameter binding
- MySQL
- JWT authentication

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Create the database, then apply SQL files in `migrations/` in order.

```sql
CREATE DATABASE real_estate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Run the API:

```bash
python run.py
```

Health check:

```txt
GET http://localhost:4959/health
```
