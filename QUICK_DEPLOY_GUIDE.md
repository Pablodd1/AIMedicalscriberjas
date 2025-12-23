# ⚡ Quick Deploy Guide - Get Live in 10 Minutes

## 🚀 **3 Simple Steps to Deploy**

### **STEP 1: Generate Secrets (30 seconds)**

Run these commands to generate random secrets:

```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET (run again for different value)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy both outputs** - you'll need them in Step 2.

---

### **STEP 2: Add Variables to Railway (5 minutes)**

1. Go to https://railway.app/dashboard
2. Click your project (or create new from GitHub)
3. Click **"Variables"** tab
4. Click **"Raw Editor"**
5. **Paste this template** (fill in your values):

```bash
# ========================================
# REQUIRED (App won't start without these)
# ========================================

# Database (Get from https://neon.tech/)
DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/database?sslmode=require

# Secrets (Use values from Step 1)
SESSION_SECRET=paste-your-generated-secret-here
JWT_SECRET=paste-your-other-generated-secret-here

# OpenAI (Get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-openai-key-here

# Environment
NODE_ENV=production

# ========================================
# RECOMMENDED (Email Notifications)
# ========================================

# Gmail Settings (Get app password from https://myaccount.google.com/apppasswords)
senderEmail=your-email@gmail.com
senderName=Your Practice Name
appPassword=xxxx xxxx xxxx xxxx

# Daily patient list recipients
daily_patient_list_email_1=doctor@yourpractice.com
daily_patient_list_email_2=admin@yourpractice.com

# Enable notifications
ENABLE_NOTIFICATIONS=true

# ========================================
# OPTIONAL (Save $139/month on AI costs!)
# ========================================

# Google Gemini AI (Get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ENABLE_GEMINI_AI=true

# Deepgram Live Transcription (Get from https://deepgram.com/)
DEEPGRAM_API_KEY=your-deepgram-key

# ========================================
# OPTIONAL (SMS Notifications)
# ========================================

# Twilio (Get from https://console.twilio.com/)
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
# ENABLE_SMS=true
```

6. Click **"Save"**
7. Railway will automatically redeploy (takes ~3 minutes)

---

### **STEP 3: Test Your Deployment (2 minutes)**

1. **Find Your URL**:
   - In Railway dashboard, click "Deployments"
   - Copy the URL (like: `https://your-app.up.railway.app`)

2. **Open Your App**:
   - Visit the URL in your browser
   - Should see the login page

3. **Login**:
   - Username: `admin`
   - Password: `admin123`
   
   OR
   
   - Username: `doctor`
   - Password: `doctor123`

4. **Test Features**:
   - ✅ Dashboard loads
   - ✅ Create a test patient
   - ✅ Generate SOAP note
   - ✅ Send test email (Settings → Notifications)

**Done! Your app is live! 🎉**

---

## 🔑 **Where to Get API Keys**

### **Neon Database** (Required - FREE)
```
1. Go to https://neon.tech/
2. Sign up (free tier)
3. Create project: "medical-scribe-db"
4. Copy "Connection string"
5. Paste as DATABASE_URL in Railway
```

### **OpenAI** (Required - ~$11/month)
```
1. Go to https://platform.openai.com/
2. Sign up
3. Add payment method
4. Go to API Keys: https://platform.openai.com/api-keys
5. Click "Create new secret key"
6. Copy key (starts with sk-)
7. Paste as OPENAI_API_KEY in Railway
```

### **Gmail App Password** (Recommended - FREE)
```
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to https://myaccount.google.com/apppasswords
4. App: Mail, Device: Other (Medical Scribe)
5. Click "Generate"
6. Copy 16-character password
7. Paste as appPassword in Railway
```

### **Google Gemini** (Optional - Saves $139/month!)
```
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy key (starts with AIza...)
4. Paste as GEMINI_API_KEY in Railway
5. Set ENABLE_GEMINI_AI=true
```

### **Deepgram** (Optional - Live Transcription)
```
1. Go to https://deepgram.com/
2. Sign up (free $200 credit)
3. Copy API key from dashboard
4. Paste as DEEPGRAM_API_KEY in Railway
```

---

## 💰 **Cost Estimate**

### **Minimal Setup (Just Get Started)**
```
Railway: $5/month
Neon DB: $0/month (free tier)
OpenAI: $11.50/month (500 consultations)
---
TOTAL: $16.50/month
```

### **Recommended Setup (Best Value)**
```
Railway: $5/month
Neon DB: $0/month (free tier)
OpenAI: $11.50/month (SOAP notes only)
Gemini: $16.80/month (visual + intake)
Deepgram: $26/month (live transcription)
Gmail: $0/month (free)
---
TOTAL: $59.30/month
SAVES: $139/month vs OpenAI-only!
```

---

## 🎯 **Minimum Required Variables**

**If you only want to get it working ASAP, just add these 5:**

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=generated-secret-1
JWT_SECRET=generated-secret-2
OPENAI_API_KEY=sk-...
NODE_ENV=production
```

**App will work, but:**
- ❌ No email notifications
- ❌ No SMS
- ❌ No cost savings (expensive AI)
- ❌ No live transcription

**Add email variables to unlock:**
- ✅ Daily patient list emails (7 AM)
- ✅ Appointment confirmations
- ✅ Appointment reminders

**Add Gemini to unlock:**
- ✅ $139/month savings on AI
- ✅ Video analysis capability
- ✅ Same quality for less money

---

## 🐛 **Quick Troubleshooting**

### **Can't connect to database?**
```bash
# Check DATABASE_URL ends with ?sslmode=require
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Verify Neon database is "Active" in dashboard
```

### **OpenAI errors?**
```bash
# Verify API key starts with sk-
# Check you have credits: https://platform.openai.com/usage
# Try generating new API key
```

### **Email not sending?**
```bash
# Use Gmail APP PASSWORD (not your Gmail password!)
# Must enable 2-Step Verification first
# Test in dashboard: Settings -> Notifications -> Send Test Email
```

### **App crashes?**
```bash
# Check Railway logs: Deployments -> View Logs
# Verify all REQUIRED variables are set
# Try redeploying: Deployments -> Redeploy
```

---

## ✅ **Deployment Checklist**

- [ ] Generated SESSION_SECRET and JWT_SECRET
- [ ] Created Neon database
- [ ] Got OpenAI API key
- [ ] Added all required variables to Railway
- [ ] App deployed successfully (check Railway logs)
- [ ] Can access app URL
- [ ] Login works (admin/admin123)
- [ ] Dashboard loads
- [ ] **Optional**: Got Gmail app password
- [ ] **Optional**: Configured email recipients
- [ ] **Optional**: Got Gemini API key for cost savings
- [ ] **Optional**: Got Deepgram key for live transcription
- [ ] Tested basic features (create patient, SOAP note)
- [ ] **Optional**: Tested email notifications

---

## 🎉 **You're Done!**

Your AI Medical Scribe is now:
- ✅ Live on Railway
- ✅ Connected to Neon database
- ✅ Ready to process consultations
- ✅ Generating SOAP notes
- ✅ **Optional**: Sending email notifications
- ✅ **Optional**: Saving $139/month with Gemini
- ✅ **Optional**: Live transcription with Deepgram

**Next Steps:**
1. Change default passwords (admin, doctor, provider)
2. Create your real doctor accounts
3. Start using the system!
4. Monitor Railway metrics weekly

---

**Need help?** Check `RAILWAY_DEPLOYMENT_CHECKLIST.md` for detailed troubleshooting!

**Want to optimize?** Check `PERFORMANCE_OPTIMIZATIONS_APPLIED.md` for tips!

**Total Time to Deploy:** ~10 minutes ⚡

---

*Last Updated: December 23, 2024*
