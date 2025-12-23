# 📧 Email & SMS Notification System - Complete Setup Guide

## 🎯 Overview

This medical scribe application now includes a **comprehensive automated notification system** that coordinates:

1. **📧 Email Notifications** - Automated appointment confirmations, reminders, and daily patient lists
2. **📱 SMS Notifications** - Text message confirmations and reminders via Twilio
3. **⏰ Automated Scheduling** - Cron jobs for daily 7:00 AM patient lists and appointment reminders
4. **🎛️ Dashboard Settings** - Easy configuration interface for email/SMS settings

---

## ✨ Key Features

### 1. Automated Daily Patient List (7:00 AM)
- **Frequency**: Every day at 7:00 AM (configurable timezone)
- **Recipients**: Up to 3 configurable email addresses from dashboard
- **Content**: 
  - Complete list of today's appointments
  - Grouped by doctor
  - Patient details (name, phone, email)
  - Appointment times
  - Status indicators
  - Professional HTML formatting

### 2. Appointment Confirmations
- **Trigger**: Immediately when appointment is created
- **Channels**: Email + SMS
- **Content**: Appointment date, time, patient name, notes
- **Patient Response**: SMS confirmations ("Reply YES to confirm")

### 3. Appointment Reminders (24 Hours Before)
- **Trigger**: 9:00 AM daily for next-day appointments
- **Channels**: Email + SMS
- **Content**: Reminder with appointment details

### 4. Email Templates
- ✅ Appointment Confirmation
- ✅ Appointment Reminder
- ✅ Appointment Cancellation
- ✅ Appointment Rescheduled
- ✅ Daily Patient List

---

## 🛠️ Setup Instructions

### **Step 1: Email Configuration (Gmail)**

#### 1.1 Generate Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Click **Select app** → Choose **Mail**
5. Click **Select device** → Choose **Other (Custom name)**
6. Enter name: "Medical Scribe Platform"
7. Click **Generate**
8. **Copy the 16-character password** (spaces don't matter)

#### 1.2 Add to Railway Environment Variables

```bash
# In Railway Dashboard → Your Project → Variables
senderEmail=your-email@gmail.com
senderName=Your Medical Practice Name
appPassword=xxxx xxxx xxxx xxxx  # The 16-char app password from step 1.1

# Daily Patient List Recipients (configure in dashboard later)
daily_patient_list_email_1=doctor1@practice.com
daily_patient_list_email_2=admin@practice.com
daily_patient_list_email_3=reception@practice.com
```

### **Step 2: SMS Configuration (Twilio) - OPTIONAL**

#### 2.1 Sign Up for Twilio

1. Go to: https://www.twilio.com/try-twilio
2. Sign up for free trial ($15 credit)
3. Verify your phone number
4. Get a Twilio phone number

#### 2.2 Get Twilio Credentials

1. From Twilio Console: https://console.twilio.com/
2. Copy these values:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Phone Number**: `+1XXXXXXXXXX`

#### 2.3 Add to Railway Environment Variables

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

### **Step 3: Configure Notification Settings in Dashboard**

1. **Log in to your medical scribe platform**
2. Navigate to **Settings** → **Notifications** (or `/notification-settings`)
3. **Email Settings Tab**:
   - Enter sender email (same as Railway env)
   - Enter sender name
   - Enter app password (shows masked in UI)
   - **Configure 3 daily patient list recipients**
   - Click **Save Email Settings**
4. **SMS Settings Tab** (if using Twilio):
   - Enter Twilio Account SID
   - Enter Twilio Auth Token
   - Enter Twilio Phone Number (format: +1XXXXXXXXXX)
   - Click **Save SMS Settings**
5. **Test Notifications**:
   - Click **Send Test Email**
   - Click **Send Test SMS** (if configured)
   - Click **Send Daily Patient List Now** (for testing)

---

## 📅 Automated Schedule

The system runs two cron jobs:

```javascript
// 1. Daily Patient List - 7:00 AM every day
cron.schedule('0 7 * * *', sendDailyPatientList);

// 2. Appointment Reminders - 9:00 AM every day (for next day)
cron.schedule('0 9 * * *', sendTomorrowReminders);
```

### Change Timezone

Edit `/server/notification-scheduler.ts`:

```javascript
cron.schedule('0 7 * * *', async () => {
  await sendDailyPatientList();
}, {
  timezone: 'America/New_York' // Change to your timezone
});
```

**Common Timezones:**
- `'America/New_York'` - Eastern Time
- `'America/Chicago'` - Central Time
- `'America/Denver'` - Mountain Time
- `'America/Los_Angeles'` - Pacific Time
- `'UTC'` - Universal Time

---

## 🔧 API Endpoints

### Email Settings

```bash
# Get email settings
GET /api/notifications/email
Authorization: Bearer <token>

# Save email settings
POST /api/notifications/email
Authorization: Bearer <token>
Content-Type: application/json

{
  "senderEmail": "noreply@practice.com",
  "senderName": "Medical Practice",
  "appPassword": "xxxx xxxx xxxx xxxx",
  "daily_patient_list_email_1": "doctor@practice.com",
  "daily_patient_list_email_2": "admin@practice.com",
  "daily_patient_list_email_3": "reception@practice.com"
}
```

### SMS Settings

```bash
# Get SMS settings
GET /api/notifications/sms
Authorization: Bearer <token>

# Save SMS settings
POST /api/notifications/sms
Authorization: Bearer <token>
Content-Type: application/json

{
  "twilio_account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "twilio_auth_token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "twilio_phone_number": "+1XXXXXXXXXX"
}
```

### Manual Triggers (Testing)

```bash
# Send test SMS
POST /api/notifications/test-sms
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+1XXXXXXXXXX"
}

# Manually send daily patient list (for testing)
POST /api/notifications/send-daily-list-now
Authorization: Bearer <token>
```

---

## 💰 Cost Analysis

### Email (Gmail)
- **Cost**: FREE (using Gmail app passwords)
- **Limits**: 
  - 500 emails/day (Gmail free account)
  - 2000 emails/day (Google Workspace)
- **Recommendation**: Use Google Workspace ($6/user/month) for professional domain

### SMS (Twilio)
- **Free Trial**: $15 credit
- **Pricing**:
  - SMS (USA): $0.0075/message
  - SMS (Canada): $0.0075/message
  - MMS: $0.02/message
- **Monthly Cost Estimates**:
  - 100 appointments/month: ~$0.75/month (2 SMS per appointment)
  - 500 appointments/month: ~$3.75/month
  - 1000 appointments/month: ~$7.50/month

### Total Monthly Cost (500 Appointments)
- Email: $0 (Gmail) or $6 (Google Workspace)
- SMS: $3.75
- **TOTAL: $3.75 - $9.75/month**

---

## 📊 Daily Patient List Email Example

### Subject
```
📅 Daily Patient List - Monday, December 23, 2024
```

### Body (HTML)
```html
📅 Daily Patient List
Monday, December 23, 2024

Total Appointments: 8

-----------------------------------

👨‍⚕️ Dr. John Smith (5 appointments)

Time        Patient Name        Contact                         Reason                  Status
9:00 AM     Jane Doe            📞 (555) 123-4567              Annual Checkup          CONFIRMED
                                📧 jane@email.com
10:30 AM    Bob Johnson         📞 (555) 987-6543              Follow-up               SCHEDULED
                                📧 bob@email.com
...

👨‍⚕️ Dr. Sarah Johnson (3 appointments)
...
```

---

## 🔒 Security & HIPAA Compliance

### Email Security
- ✅ Gmail uses TLS encryption for all emails
- ✅ App passwords are more secure than regular passwords
- ✅ Passwords masked in dashboard UI
- ✅ PHI is encrypted in transit

### SMS Security
- ✅ Twilio is HIPAA-compliant (BAA available)
- ✅ Messages encrypted in transit
- ✅ No PHI stored in Twilio logs (when configured)
- ⚠️ **IMPORTANT**: Sign Twilio BAA for HIPAA compliance

### Best Practices
1. **Sign Business Associate Agreements (BAA)**:
   - Google Workspace BAA (if using workspace)
   - Twilio BAA (required for HIPAA)
2. **Limit PHI in SMS**:
   - Use patient first name only
   - Don't include diagnosis/treatment details
   - Just confirmation/reminder information
3. **Secure Storage**:
   - API keys stored in Railway environment variables
   - Never commit secrets to Git

---

## 🧪 Testing Checklist

### Email Testing
- [ ] Send test email from dashboard
- [ ] Verify sender name appears correctly
- [ ] Check email lands in inbox (not spam)
- [ ] Test daily patient list manually
- [ ] Verify all 3 recipients receive daily list

### SMS Testing
- [ ] Send test SMS from dashboard
- [ ] Verify correct sender phone number
- [ ] Test appointment confirmation SMS
- [ ] Test appointment reminder SMS
- [ ] Verify delivery to patient phone

### Cron Job Testing
- [ ] Check server logs for cron initialization
- [ ] Wait for 7:00 AM and verify daily patient list sent
- [ ] Create appointment for tomorrow and verify reminder at 9:00 AM
- [ ] Check Railway logs for cron execution

---

## 🐛 Troubleshooting

### Emails Not Sending

**Issue**: Email settings configured but emails not sending

**Solutions**:
1. Check Gmail app password is correct (no spaces needed)
2. Verify 2-Step Verification is enabled on Google account
3. Check Railway logs: `railway logs`
4. Test with simple test email first
5. Check spam folder

### SMS Not Sending

**Issue**: SMS configured but not delivering

**Solutions**:
1. Verify Twilio credentials are correct
2. Check Twilio account has credit remaining
3. Verify phone number format: `+1XXXXXXXXXX` (include country code)
4. For free trial: Verify recipient number in Twilio console
5. Check Twilio logs for delivery status

### Daily Patient List Not Sending at 7:00 AM

**Issue**: Cron job not running

**Solutions**:
1. Check server logs for scheduler initialization message
2. Verify timezone is correct in `notification-scheduler.ts`
3. Test manually: Click "Send Daily Patient List Now" in dashboard
4. Ensure Railway dyno is always running (not sleeping)
5. Check cron syntax: `0 7 * * *` = 7:00 AM daily

### No Recipients Configured

**Issue**: "No recipient emails configured for daily patient list"

**Solutions**:
1. Navigate to Settings → Notifications
2. Configure at least 1 email address for daily patient list
3. Click Save Email Settings
4. Test with "Send Daily Patient List Now"

---

## 📱 Dashboard UI

### Frontend Component Created
Location: `/client/src/pages/notification-settings.tsx`

**Features**:
- ✅ Email settings form (sender, password, recipients)
- ✅ SMS settings form (Twilio credentials)
- ✅ Test buttons for email & SMS
- ✅ Manual daily list trigger
- ✅ Password masking for security
- ✅ Form validation
- ✅ Success/error toast notifications

### Navigation
Add to your main navigation:
```tsx
<Link to="/notification-settings">
  <Settings className="mr-2" />
  Notification Settings
</Link>
```

---

## 🎯 Next Steps

### Phase 1: Basic Setup (DONE ✅)
- [x] Email notification system
- [x] SMS integration (Twilio)
- [x] Cron scheduler
- [x] Dashboard settings page
- [x] API endpoints

### Phase 2: Advanced Features (Coming Soon)
- [ ] Two-way SMS responses (patient confirms via SMS)
- [ ] Custom email templates editor
- [ ] Multi-language support for notifications
- [ ] Patient preference management (opt-in/opt-out)
- [ ] Notification history/logs
- [ ] Analytics dashboard (delivery rates, open rates)

### Phase 3: Integration
- [ ] Integration with calendar sync
- [ ] Webhook support for external systems
- [ ] Slack/Teams notifications for staff
- [ ] Push notifications (mobile app)

---

## 📚 Code Structure

```
/server
  ├── notification-scheduler.ts      # Main scheduler + email/SMS logic
  ├── routes/
  │   ├── notification-settings.ts   # API endpoints for settings
  │   └── email.ts                   # Email templates & sending
  └── routes.ts                       # Router registration

/client/src/pages
  └── notification-settings.tsx       # Dashboard UI component
```

---

## 🔗 Related Documentation

- [TELEMEDICINE_AI_ENHANCEMENTS.md](./TELEMEDICINE_AI_ENHANCEMENTS.md) - AI features in telemedicine
- [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) - Environment variables setup
- [OPENAI_VS_GEMINI_COMPARISON.md](./OPENAI_VS_GEMINI_COMPARISON.md) - AI model comparison

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review Railway logs: `railway logs`
3. Check Twilio logs: https://console.twilio.com/us1/monitor/logs/sms
4. Check Gmail settings: https://myaccount.google.com/apppasswords

---

**Last Updated**: December 23, 2024  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
