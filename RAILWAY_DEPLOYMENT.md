# Railway Deployment Guide for AI Medical Scriber

This guide will help you deploy your AI Medical Scriber application to Railway.app with your existing Neon PostgreSQL database.

## Prerequisites

1. **GitHub Account** - Your code should be pushed to GitHub
2. **Railway Account** - Sign up at https://railway.app (free to start)
3. **Neon Database** - You already have this configured
4. **API Keys** - OpenAI, Deepgram, Cloudinary (if using)

---

## Step-by-Step Deployment

### Step 1: Sign Up for Railway

1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your GitHub account
4. You'll get **$5 in free credits** to start

### Step 2: Create New Project

1. Click "New Project" button
2. Select "Deploy from GitHub repo"
3. Choose your repository: `Pablodd1/AIMedicalscriberjas`
4. Select the `main` branch
5. Click "Deploy Now"

Railway will automatically:
- Detect it's a Node.js app
- Install dependencies
- Build your application
- Start the server

### Step 3: Configure Environment Variables

Click on your deployed service, then go to "Variables" tab. Add these variables:

#### Required Variables

```bash
# Database (Use your existing Neon database)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Authentication Secrets (Generate random 32+ character strings)
SESSION_SECRET=your-session-secret-min-32-chars-make-it-random
JWT_SECRET=your-jwt-secret-min-32-chars-make-it-random

# OpenAI API (Required for AI features)
OPENAI_API_KEY=sk-your-openai-api-key

# Node Environment
NODE_ENV=production

# Port (Railway sets this automatically, but you can set it)
PORT=5000
```

#### Optional Variables (if you use these features)

```bash
# Deepgram (for medical transcription)
DEEPGRAM_API_KEY=your-deepgram-api-key

# Cloudinary (for file storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email Settings (SendGrid or SMTP)
SENDGRID_API_KEY=your-sendgrid-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Stripe (if using payments)
STRIPE_SECRET_KEY=sk_test_your-stripe-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-key
```

### Step 4: Generate Secure Secrets

For `SESSION_SECRET` and `JWT_SECRET`, generate random strings:

**Option 1 - Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2 - Using OpenSSL:**
```bash
openssl rand -hex 32
```

**Option 3 - Online Generator:**
- Go to https://www.uuidgenerator.net/
- Generate two different UUIDs
- Use them for SESSION_SECRET and JWT_SECRET

### Step 5: Get Your Neon Database URL

1. Go to https://neon.tech
2. Log in to your account
3. Select your database project
4. Click "Connection Details"
5. Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
6. Paste this as your `DATABASE_URL` in Railway

### Step 6: Wait for Deployment

Railway will automatically:
- Build your application (takes 2-5 minutes)
- Deploy to production
- Provide you with a public URL

### Step 7: Access Your Application

1. Go to "Settings" tab in Railway
2. Scroll to "Domains" section
3. Click "Generate Domain"
4. Railway will give you a URL like: `https://your-app-name.up.railway.app`
5. Click the URL to access your deployed application!

### Step 8: Initialize Database

After first deployment, visit:
```
https://your-app-name.up.railway.app/api/setup
```

This will create the default admin accounts:
- **Admin:** username: `admin`, password: `admin123`
- **Provider:** username: `provider`, password: `provider123`
- **Doctor:** username: `doctor`, password: `doctor123`

**⚠️ IMPORTANT:** Change these passwords immediately after first login!

---

## Monitoring & Logs

### View Logs
1. Go to your Railway project
2. Click on your service
3. Click "Deployments" tab
4. Click "View Logs" to see real-time server logs

### Check Build Status
- Green checkmark = Deployment successful
- Red X = Deployment failed (check logs for errors)
- Yellow dot = Building/Deploying

### Monitor Usage
- Click "Usage" tab to see:
  - CPU usage
  - Memory usage
  - Network bandwidth
  - Credits consumed

---

## Common Issues & Solutions

### Issue 1: Build Fails

**Error:** `Module not found` or `Cannot find package`

**Solution:**
```bash
# Make sure all dependencies are in package.json, not just devDependencies
# Check that you committed node_modules to .gitignore
```

### Issue 2: Database Connection Error

**Error:** `Error: Connection terminated` or `ECONNREFUSED`

**Solution:**
- Verify DATABASE_URL is correct
- Check that Neon database is active
- Ensure `?sslmode=require` is at the end of the URL

### Issue 3: Port Binding Error

**Error:** `Port already in use` or `EADDRINUSE`

**Solution:**
Your app should use Railway's PORT environment variable. Update `server/index.ts`:

```typescript
const port = process.env.PORT || 5000;
```

### Issue 4: Environment Variables Not Loading

**Error:** API keys are undefined

**Solution:**
- Check that all variables are saved in Railway
- Redeploy after adding variables (Railway auto-redeploys)
- Make sure variable names match exactly (case-sensitive)

---

## Custom Domain (Optional)

### Add Your Own Domain

1. Go to "Settings" → "Domains"
2. Click "Custom Domain"
3. Enter your domain (e.g., `app.yourdomain.com`)
4. Add the CNAME record to your DNS provider:
   ```
   CNAME: your-app-name.up.railway.app
   ```
5. Wait for DNS propagation (5-60 minutes)
6. Railway will automatically provision SSL certificate

---

## Cost Management

### Free Tier
- $5 in credits per month (automatically replenishes)
- Sufficient for development and testing
- ~500 hours of runtime

### Usage Optimization
- **Idle Timeout:** Railway sleeps inactive apps (free tier)
- **First request** after sleep takes ~10 seconds to wake up
- **Keep-alive:** For production, consider upgrading to prevent sleep

### Upgrading to Paid Plan

When you need more:
1. Click "Settings" → "Billing"
2. Add payment method
3. Pay-as-you-go: $0.000231/GB-hour memory
4. Typical cost: $5-20/month for production apps

---

## Database Management

### Running Migrations

**Option 1 - Automatic (on deploy):**
Add to `package.json`:
```json
"scripts": {
  "build": "npm run db:push && vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
}
```

**Option 2 - Manual:**
```bash
# From Railway service shell
npm run db:push
```

### Accessing Railway Shell

1. Go to your service in Railway
2. Click "Settings" → "Service Shell"
3. Run commands directly on your deployed app:
   ```bash
   npm run db:push
   npm run db:seed
   ```

---

## Rollback Deployment

If something goes wrong:

1. Go to "Deployments" tab
2. Find the last working deployment (green checkmark)
3. Click the three dots (...)
4. Select "Redeploy"

---

## Environment-Specific Settings

### Production Checklist

- [ ] All environment variables set
- [ ] Database connected and tested
- [ ] SSL certificate active (automatic with Railway)
- [ ] Default passwords changed
- [ ] API keys are production keys (not test keys)
- [ ] Cloudinary configured (if using file uploads)
- [ ] Email service configured (for appointment notifications)
- [ ] Monitoring alerts set up

---

## Performance Tips

1. **Enable Compression**
   - Already configured in Express (gzip)

2. **Database Connection Pooling**
   - Neon handles this automatically

3. **Static File Caching**
   - Railway's CDN handles this

4. **WebSocket Optimization**
   - Works out-of-the-box on Railway
   - No additional configuration needed

---

## Security Checklist

- [ ] Environment variables properly set (not hardcoded)
- [ ] SESSION_SECRET is random and secure (32+ chars)
- [ ] JWT_SECRET is random and secure (32+ chars)
- [ ] DATABASE_URL uses SSL (`?sslmode=require`)
- [ ] Default admin passwords changed
- [ ] CORS configured properly (if needed)
- [ ] Rate limiting enabled (if implemented)

---

## Support & Resources

- **Railway Documentation:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Railway Status:** https://status.railway.app
- **Your App Issues:** https://github.com/Pablodd1/AIMedicalscriberjas/issues

---

## Quick Reference Commands

```bash
# View logs
railway logs

# Restart service
railway restart

# Run database migration
railway run npm run db:push

# Access shell
railway shell

# Deploy manually
git push origin main
```

---

## What Railway Handles Automatically

✅ **SSL Certificates** - Automatic HTTPS  
✅ **Load Balancing** - Automatic scaling  
✅ **Health Checks** - Auto-restart on crashes  
✅ **Logging** - Centralized log management  
✅ **Metrics** - CPU, memory, network monitoring  
✅ **Deployments** - Auto-deploy on git push  
✅ **Rollbacks** - One-click rollback to previous versions  

---

## Next Steps After Deployment

1. **Test all features:**
   - Login system
   - Patient management
   - Appointments
   - Medical notes with AI
   - Telemedicine (video chat)
   - Lab interpreter
   - File uploads

2. **Monitor for errors:**
   - Check logs for any issues
   - Test WebSocket connections
   - Verify database operations

3. **Set up monitoring:**
   - Consider adding error tracking (Sentry)
   - Set up uptime monitoring (UptimeRobot)

4. **Backup strategy:**
   - Neon provides automatic backups
   - Consider exporting critical data regularly

---

## Congratulations! 🎉

Your AI Medical Scriber is now live on Railway!

**Your app URL:** `https://your-app-name.up.railway.app`

Need help? Check the Railway logs or reach out for support.
