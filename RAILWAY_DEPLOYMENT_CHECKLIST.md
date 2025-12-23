# 🚀 Railway Deployment Checklist - Complete Setup Guide

## 📋 Required Environment Variables for Railway

### ✅ **CRITICAL (App Won't Start Without These)**

```bash
# Database Connection (Required)
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Authentication Secrets (Required - Generate Random Strings)
SESSION_SECRET=your-session-secret-minimum-32-characters-long-random-string
JWT_SECRET=your-jwt-secret-minimum-32-characters-long-random-string

# OpenAI API (Required for AI Features)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Environment
NODE_ENV=production
```

---

### 🔧 **RECOMMENDED (Email Notifications)**

```bash
# Gmail SMTP Configuration
senderEmail=your-email@gmail.com
senderName=Your Medical Practice Name
appPassword=xxxx xxxx xxxx xxxx

# Daily Patient List Recipients (Up to 3 emails)
daily_patient_list_email_1=doctor@yourpractice.com
daily_patient_list_email_2=admin@yourpractice.com
daily_patient_list_email_3=reception@yourpractice.com

# Enable notification system
ENABLE_NOTIFICATIONS=true
```

**How to Get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to https://myaccount.google.com/apppasswords
4. Generate app password for "Mail"
5. Copy the 16-character password (spaces don't matter)

---

### 💰 **OPTIONAL (Cost Savings - Highly Recommended)**

```bash
# Google Gemini AI (Saves $139/month on AI costs)
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ENABLE_GEMINI_AI=true

# Get Gemini API Key:
# 1. Go to https://aistudio.google.com/app/apikey
# 2. Click "Create API Key"
# 3. Copy the key (starts with AIza...)
```

---

### 🎙️ **OPTIONAL (Live Transcription in Telemedicine)**

```bash
# Deepgram API (For live voice transcription)
DEEPGRAM_API_KEY=your-deepgram-api-key

# Get Deepgram API Key:
# 1. Sign up at https://deepgram.com/
# 2. Get $200 free credit
# 3. Copy API key from dashboard
```

---

### 📱 **OPTIONAL (SMS Notifications)**

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
ENABLE_SMS=true

# Get Twilio Credentials:
# 1. Sign up at https://www.twilio.com/try-twilio
# 2. Get free trial ($15 credit)
# 3. Copy Account SID, Auth Token, and Phone Number
```

---

### 🖼️ **OPTIONAL (File Upload Storage)**

```bash
# Cloudinary Configuration (For image/file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Get Cloudinary Credentials:
# 1. Sign up at https://cloudinary.com/
# 2. Free tier: 25GB storage, 25GB bandwidth
# 3. Copy credentials from dashboard
```

---

## 🎯 **Recommended Configurations**

### **Option A: Minimal Setup (Just Get Started)**

```bash
# Required Only
DATABASE_URL=postgresql://...
SESSION_SECRET=generate-random-32-char-string
JWT_SECRET=generate-random-32-char-string
OPENAI_API_KEY=sk-...
NODE_ENV=production

# Result: Basic medical scribe working, no notifications, higher AI costs
```

---

### **Option B: Balanced Setup (Recommended for Most Users)**

```bash
# Required
DATABASE_URL=postgresql://...
SESSION_SECRET=generate-random-32-char-string
JWT_SECRET=generate-random-32-char-string
OPENAI_API_KEY=sk-...
NODE_ENV=production

# Email Notifications
senderEmail=your-email@gmail.com
senderName=Your Practice Name
appPassword=xxxx xxxx xxxx xxxx
daily_patient_list_email_1=doctor@practice.com
ENABLE_NOTIFICATIONS=true

# Cost Savings (Gemini AI)
GEMINI_API_KEY=AIza...
ENABLE_GEMINI_AI=true

# Live Transcription
DEEPGRAM_API_KEY=your-key

# Result: Full email notifications, AI cost savings ($139/month), live transcription
# Monthly Cost: ~$68 (vs $204 without Gemini)
```

---

### **Option C: Full Featured (Everything Enabled)**

```bash
# All from Option B, PLUS:

# SMS Notifications
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
ENABLE_SMS=true

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Result: All features enabled, maximum functionality
# Monthly Cost: ~$72 (includes SMS)
```

---

## 🔐 **How to Generate Secrets**

### **SESSION_SECRET and JWT_SECRET**

**Method 1: Node.js (Recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: 64-character random string
```

**Method 2: OpenSSL**
```bash
openssl rand -hex 32
# Output: 64-character random string
```

**Method 3: Online Generator**
```
https://randomkeygen.com/
# Use "CodeIgniter Encryption Keys" section
```

**Copy the output and use it for SESSION_SECRET and JWT_SECRET (use different values for each)**

---

## 📊 **Railway Deployment Steps**

### **Step 1: Prepare Local Code**

```bash
# Make sure all changes are committed
cd /home/user/webapp
git status

# Should show: "nothing to commit, working tree clean"
```

### **Step 2: Push to GitHub**

```bash
# Configure git credentials (if not already done)
git config --global user.name "YourName"
git config --global user.email "your-email@example.com"

# Push to GitHub
git push origin main
```

### **Step 3: Deploy to Railway**

**Option A: Via GitHub Integration (Recommended)**

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository: `Pablodd1/AIMedicalscriberjas`
5. Railway will auto-detect Node.js and start deployment

**Option B: Via Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Deploy
railway up
```

### **Step 4: Add Environment Variables in Railway**

1. In Railway dashboard, click your project
2. Click "Variables" tab
3. Add each variable from your chosen configuration (Option A/B/C above)
4. Click "Add" for each variable

**Quick Add (Bulk Import)**:
```
Click "Raw Editor" in Railway Variables tab
Paste all variables in this format:

DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret
JWT_SECRET=your-secret
OPENAI_API_KEY=sk-...
NODE_ENV=production
senderEmail=your-email@gmail.com
...etc
```

5. Click "Save" - Railway will auto-redeploy with new variables

---

## 🗄️ **Database Setup (Neon PostgreSQL)**

### **If You Don't Have a Database Yet:**

1. Go to https://neon.tech/
2. Sign up (free tier available)
3. Click "Create Project"
4. Project name: `medical-scribe-db`
5. Region: Choose closest to your users (US East recommended)
6. Click "Create Project"

### **Get Connection String:**

1. In Neon dashboard, click your project
2. Go to "Connection Details"
3. Copy "Connection string"
4. **Format**: `postgresql://username:password@host:port/database?sslmode=require`

### **Add to Railway:**

```bash
DATABASE_URL=postgresql://username:password@ep-xx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### **Run Database Migrations (If Needed):**

```bash
# In Railway dashboard, go to your project
# Click "Deployments" -> "View Logs"
# Check if migrations ran automatically

# If not, run manually via Railway CLI:
railway run npm run db:push
```

---

## ✅ **Post-Deployment Checklist**

### **1. Verify Deployment**

```bash
# Check Railway logs
# In Railway dashboard: Deployments -> View Logs

# Look for these messages:
✅ "Server running on port XXXX"
✅ "Database connected"
✅ "✅ Gemini AI initialized" (if GEMINI_API_KEY set)
✅ "✅ Automated notification system initialized" (if email configured)
```

### **2. Test Basic Functionality**

1. **Visit your Railway URL**: `https://your-app.up.railway.app`
2. **Test Login**: 
   - Username: `admin` / Password: `admin123`
   - OR Username: `doctor` / Password: `doctor123`
3. **Check Dashboard**: Should load without errors

### **3. Test Email Notifications (If Configured)**

1. Login to dashboard
2. Go to Settings -> Notifications
3. Click "Send Test Email"
4. Check your email inbox
5. Click "Send Daily Patient List Now"
6. Check configured recipient emails

### **4. Test AI Features**

1. Create a test patient
2. Create a consultation
3. Generate SOAP notes
4. Verify AI responses are working

### **5. Monitor Resource Usage**

```bash
# In Railway dashboard:
# Click "Metrics" tab

# Check:
✅ Memory usage: Should be 150-250MB (with optimizations)
✅ CPU usage: Should be <50% normally
✅ No error spikes in logs
```

---

## 🐛 **Troubleshooting Common Issues**

### **Issue 1: "Cannot connect to database"**

**Solutions:**
```bash
# Check DATABASE_URL format
# Must include ?sslmode=require at the end
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Test connection in Railway CLI:
railway run npx drizzle-kit push

# Check Neon dashboard - database should be "Active"
```

### **Issue 2: "OpenAI API Error"**

**Solutions:**
```bash
# Verify API key format (starts with sk-)
OPENAI_API_KEY=sk-proj-...

# Check OpenAI account has credits
# Go to https://platform.openai.com/usage

# Check Railway logs for specific error message
```

### **Issue 3: "Email not sending"**

**Solutions:**
```bash
# Verify Gmail app password (not regular password)
# Must enable 2-Step Verification first

# Check Railway logs for email errors

# Test email settings in dashboard:
# Settings -> Notifications -> Send Test Email

# Verify sender email and app password are correct
```

### **Issue 4: "Deployment failed"**

**Solutions:**
```bash
# Check Railway build logs for errors

# Common fixes:
# 1. Ensure package.json has correct scripts
# 2. Verify all dependencies are in package.json
# 3. Check Node.js version compatibility

# Manually trigger redeploy:
# Railway dashboard -> Deployments -> Redeploy
```

### **Issue 5: "App crashes after startup"**

**Solutions:**
```bash
# Check Railway logs for error stack trace

# Common causes:
# 1. Missing required environment variables
# 2. Database connection timeout
# 3. Port binding issues (Railway handles this automatically)

# Verify all REQUIRED variables are set:
railway variables

# Should show: DATABASE_URL, SESSION_SECRET, JWT_SECRET, OPENAI_API_KEY
```

---

## 💰 **Cost Breakdown (Monthly)**

### **Railway Hosting**

```
Hobby Plan: $5/month
- 512MB RAM
- Shared CPU
- 100GB bandwidth
- Perfect for 50-100 users

Pro Plan: $20/month (if needed later)
- 8GB RAM
- Dedicated CPU
- Unlimited bandwidth
- Scales to 500+ users
```

### **Neon PostgreSQL**

```
Free Tier: $0/month
- 0.5GB storage
- 20 concurrent connections
- Perfect for small-medium practices

Pro Tier: $20/month (if needed)
- 10GB storage
- 50 concurrent connections
- Better performance
```

### **AI Services (With Hybrid Approach)**

```
OpenAI (SOAP notes only): $11.50/month (500 consultations)
Gemini (Visual + Intake): $16.80/month (saves $140/month vs OpenAI-only)
Deepgram (Live transcription): $26/month (500 consultations @ $0.0043/min)

Total AI: ~$54/month
WITHOUT Gemini: ~$194/month (68% more expensive!)
```

### **Optional Services**

```
Gmail: $0 (free tier) or $6/month (Google Workspace for custom domain)
Twilio SMS: $3.75/month (500 appointments, 2 SMS each)
Cloudinary: $0 (free tier, 25GB storage)
```

### **TOTAL MONTHLY COST**

```
Minimal Setup (Option A): 
  Railway + Neon + OpenAI = $210/month

Recommended Setup (Option B):
  Railway + Neon + OpenAI + Gemini + Deepgram + Gmail = $85/month
  (Saves $125/month vs minimal!)

Full Setup (Option C):
  All Option B + SMS = $89/month
  (Saves $121/month vs minimal!)
```

**Key Insight**: Using Gemini SAVES you money while adding features! 🎉

---

## 📈 **Scaling Guidelines**

### **When to Upgrade Railway Plan**

```
Current Users: 50-100 concurrent -> Hobby Plan ($5/month) ✅
100-200 concurrent -> Pro Plan ($20/month)
200-500 concurrent -> Pro Plan + Optimizations
500+ concurrent -> Consider microservices split
```

### **When to Upgrade Database**

```
Storage >0.4GB -> Upgrade Neon to Pro
Connections >15/20 -> Upgrade to Pro (50 connections)
Query times >500ms -> Add database indexes + consider Redis
```

### **Performance Monitoring**

```bash
# Check Railway metrics weekly
# Look for:
✅ Memory usage trending upward (add more RAM)
✅ CPU usage >70% sustained (upgrade plan)
✅ Response times increasing (optimize or scale)
✅ Database connections near limit (upgrade Neon)
```

---

## 🎯 **Quick Start Commands**

### **Deploy Everything (Step-by-Step)**

```bash
# 1. Generate secrets
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

echo "SESSION_SECRET=$SESSION_SECRET"
echo "JWT_SECRET=$JWT_SECRET"

# 2. Copy these secrets

# 3. Go to Railway dashboard
# https://railway.app/dashboard

# 4. Add all environment variables from Option B above

# 5. Railway will auto-deploy

# 6. Visit your app URL (shown in Railway dashboard)

# 7. Login with admin/admin123

# 8. Test features

# Done! 🎉
```

---

## 🔗 **Useful Links**

```
Railway Dashboard: https://railway.app/dashboard
Neon Dashboard: https://console.neon.tech/
GitHub Repo: https://github.com/Pablodd1/AIMedicalscriberjas

Gmail App Passwords: https://myaccount.google.com/apppasswords
Gemini API Keys: https://aistudio.google.com/app/apikey
Deepgram Dashboard: https://console.deepgram.com/
Twilio Console: https://console.twilio.com/
OpenAI Platform: https://platform.openai.com/

Random Key Generator: https://randomkeygen.com/
```

---

## ✨ **Summary: Minimum to Get Started**

```bash
# ABSOLUTE MINIMUM (5 variables):
DATABASE_URL=postgresql://...               # From Neon
SESSION_SECRET=$(openssl rand -hex 32)      # Generate
JWT_SECRET=$(openssl rand -hex 32)          # Generate (different from above)
OPENAI_API_KEY=sk-...                       # From OpenAI
NODE_ENV=production                         # Set to production

# Add these to Railway Variables -> Save -> App auto-deploys ✅
```

**That's it! Your app will be live in ~5 minutes! 🚀**

---

**Created**: December 23, 2024  
**Status**: Ready for Deployment  
**Next Step**: Add variables to Railway and deploy!
