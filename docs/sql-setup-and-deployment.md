# HYA Tech SQL Setup And Deployment Guide

## Local MySQL Setup

1. Create the database and tables:

```bash
mysql -u root -p < server/database/schema.sql
```

2. Create `server/.env`:

```env
DB_CLIENT=mysql
PORT=5000
CLIENT_ORIGIN=http://localhost:5174
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=hyatech_user
MYSQL_PASSWORD=replace-with-strong-password
MYSQL_DATABASE=hyatech_db
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
MAX_RESUME_BYTES=5242880
```

3. Install dependencies:

```bash
npm --prefix server install
npm --prefix client install
```

4. Seed first admin:

```bash
npm --prefix server run seed:sql
```

5. Run app:

```bash
npm run dev
```

## Production Deployment

Recommended production topology:

```text
Frontend: Vercel / Netlify / static host
Backend: Render / Railway / VPS / Docker
Database: Managed MySQL 8
File uploads: Local disk only for single-server deployments; object storage recommended for scale
```

Backend environment:

```env
NODE_ENV=production
DB_CLIENT=mysql
CLIENT_ORIGIN=https://your-frontend-domain.com
JWT_SECRET=long-random-production-secret
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_USER=hyatech_user
MYSQL_PASSWORD=strong-password
MYSQL_DATABASE=hyatech_db
RATE_LIMIT_MAX=300
ALLOW_LOCAL_STORE=false
```

Frontend environment:

```env
VITE_API_URL=https://your-api-domain.com/api
```

Backend commands:

```bash
npm install
npm start
```

Frontend commands:

```bash
npm install
npm run build
```

Output directory:

```text
client/dist
```

## Security Checklist

- Use a 32+ character `JWT_SECRET`.
- Use MySQL users with least privilege.
- Keep `ALLOW_LOCAL_STORE=false` in production.
- Restrict `CLIENT_ORIGIN` to the real frontend domain.
- Terminate HTTPS at the host/load balancer.
- Back up MySQL daily.
- Store uploads in object storage when using multiple backend instances.
- Rotate admin credentials after initial seed.
