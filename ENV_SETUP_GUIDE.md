# 🔐 Environment Setup Guide

## Required API Keys for New Features

### 1. Deepgram API Key (Live Transcription)

**Purpose:** Real-time speech-to-text transcription during telemedicine consultations

**How to Get:**
1. Visit https://deepgram.com
2. Click "Sign Up" (free tier available)
3. Verify your email
4. Navigate to Dashboard → API Keys
5. Click "Create a Key"
6. Name it "Medical Scribe Production"
7. Copy the API key

**Add to Railway Environment:**
1. Go to Railway dashboard: https://railway.app
2. Select your project: `AIMedicalscriberjas`
3. Click on your service
4. Go to "Variables" tab
5. Click "+ New Variable"
6. Name: `DEEPGRAM_API_KEY`
7. Value: Paste your Deepgram API key
8. Click "Add"
9. Railway will automatically redeploy

**Free Tier:**
- $200 in free credits
- ~45 hours of transcription
- Perfect for small-medium practices

**Paid Plans (when you scale):**
- Growth: $0.0043/minute (~$0.26/hour)
- Enterprise: Custom pricing
- HIPAA BAA available: https://deepgram.com/hipaa

---

### 2. OpenAI API Key (Already Configured)

**Purpose:** 
- SOAP note generation
- AI visual health assessment (GPT-4o Vision)
- Doctor Helper Smart

**Already set:** ✅ Your OpenAI key is configured in Railway

**To verify:**
1. Go to Railway dashboard
2. Check "Variables" tab
3. Look for `OPENAI_API_KEY`
4. If missing, add your OpenAI key from https://platform.openai.com

---

## Local Development Setup

If running locally, create a `.env` file in the project root:

```bash
# Database
DATABASE_URL=your_neon_database_url

# AI Services
OPENAI_API_KEY=sk-...your-key...
DEEPGRAM_API_KEY=...your-key...

# Email (optional)
RESEND_API_KEY=re_...your-key...

# Cloudinary (optional - for media storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Session Secret
SESSION_SECRET=random-secret-at-least-32-characters
```

**Security:**
- Never commit `.env` to git
- `.env` is already in `.gitignore`
- Use different keys for dev/staging/production

---

## Verify Configuration

After adding `DEEPGRAM_API_KEY`:

1. **Check Railway Logs:**
   ```
   Railway Dashboard → Deployments → View Logs
   ```
   Look for: `✅ Deepgram live transcription started`

2. **Test Transcription:**
   - Start a telemedicine consultation
   - Click "Start Live Transcription"
   - Speak into microphone
   - Verify real-time transcript appears

3. **Check Costs:**
   - Deepgram Dashboard → Usage
   - Monitor minutes used
   - Set up billing alerts

---

## Cost Monitoring

### Deepgram:
- **Dashboard:** https://console.deepgram.com
- **Usage:** Real-time usage tracking
- **Alerts:** Set budget alerts
- **Estimate:** ~$0.26/hour per consultation

### OpenAI:
- **Dashboard:** https://platform.openai.com/usage
- **Usage:** Check API usage
- **Limits:** Set monthly budget cap
- **Estimate:** 
  - GPT-4o SOAP notes: ~$0.05 per note
  - GPT-4o Vision: ~$0.01 per image analysis

### Total Monthly Cost Estimate:
| Practice Size | Consultations/Month | Deepgram | OpenAI | Total |
|---------------|-------------------|----------|--------|-------|
| Small (100 patients) | 100 | $26 | $15 | $41 |
| Medium (500 patients) | 500 | $130 | $75 | $205 |
| Large (2000 patients) | 2000 | $520 | $300 | $820 |

**ROI:** Time saved on documentation pays for itself 10x+

---

## Troubleshooting

### "Transcription service not configured" Error:
✅ **Solution:** Add `DEEPGRAM_API_KEY` to Railway environment variables

### "Failed to start live transcription" Error:
1. Check Deepgram API key is valid
2. Verify credits are available in Deepgram account
3. Check Railway logs for detailed error

### "No OpenAI API key configured" Error:
1. Verify `OPENAI_API_KEY` in Railway variables
2. Check OpenAI account has credits
3. Verify key has not expired

### Live Transcript Not Appearing:
1. Check browser console for errors
2. Verify microphone permissions granted
3. Check WebSocket connection is active
4. Ensure audio is being transmitted

---

## Security Best Practices

### API Key Management:
✅ Store in environment variables (not in code)
✅ Use different keys for dev/production
✅ Rotate keys every 90 days
✅ Monitor usage for unauthorized access
✅ Set spending limits on all services

### HIPAA Compliance:
✅ Sign Deepgram BAA (Business Associate Agreement)
✅ Sign OpenAI DPA (Data Processing Agreement)
✅ Enable audit logging
✅ Encrypt data in transit (WSS/HTTPS)
✅ Regularly review access logs

---

## Next Steps

1. ✅ Add `DEEPGRAM_API_KEY` to Railway
2. ⏳ Wait for automatic redeploy (~2 minutes)
3. ✅ Test live transcription in telemedicine
4. ✅ Monitor costs in first week
5. ✅ Scale up as needed

**Your system is now ready for live transcription and AI visual health assessment!** 🚀
