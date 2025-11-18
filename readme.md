# CrimsonCare - Blood Donation Management System

## Quick Start

### Backend Setup
```powershell
cd backend
pip install fastapi uvicorn cx_Oracle google-generativeai python-dotenv twilio
uvicorn app:app --reload --port 8000
```

### Frontend Setup
```powershell
cd frontend
python -m http.server 5500
```

Access the website at `http://localhost:5500`

---

## Features

### Core Features
- **Blood Request Matching**: Finds compatible donors within 25km radius using Haversine distance
- **Google OAuth Login**: Secure authentication with JWT tokens
- **Interactive Maps**: Leaflet.js integration for location selection
- **WhatsApp Contact**: Direct WhatsApp messaging to blood receivers
- **Smart User Routing**: Existing users → Home page, New users → Registration form
- **Edit Mode**: Existing donors can view/edit their profile with read-only protection
- **Phone Auto-formatting**: Automatically adds +91 prefix to Indian phone numbers
- **AI Chatbot**: Google Gemini-powered assistant for blood donation queries
- **Twilio WhatsApp Alerts**: Automated notifications to matching donors

### Additional Features
- Blood type compatibility checking
- Urgency level indicators (Low, Medium, High)
- Leaderboard for top donors
- Blood donation camps information
- Donation eligibility tracking
- Responsive design for mobile devices

---

## Configuration

### Database Setup (Oracle 11g)
- **User**: `crimsoncare`
- **Password**: `crimson123`
- **Tables**: `donors`, `receivers` (with auto-incrementing IDs via sequences)
- **Schemas**: Include latitude/longitude columns for location-based matching

### Environment Variables
Create `backend/.env` file:
```
GEMINI_API_KEY=your_api_key_here
```
Get API key from: https://makersuite.google.com/app/apikey

### Twilio Configuration
Update in `backend/app.py` (lines 14-16):
```python
TWILIO_ACCOUNT_SID = "your_account_sid"
TWILIO_AUTH_TOKEN = "your_auth_token"
TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"
```

---

## Technologies Used

**Backend:**
- FastAPI (Python web framework)
- cx_Oracle (Oracle database driver)
- Google Generative AI (Gemini 2.5 Flash)
- Twilio API (WhatsApp messaging)
- python-dotenv (Environment variables)

**Frontend:**
- Vanilla JavaScript
- Leaflet.js (Interactive maps)
- Nominatim API (Geocoding)
- HTML5/CSS3 (Responsive UI)

---

## Key Workflows

### User Registration
1. Login with Google OAuth
2. System checks if email exists in database
3. New users → Registration form, Existing users → Home page
4. Fill form with map-based location selection
5. Phone numbers auto-formatted to +91XXXXXXXXXX

### Blood Request
1. Login required
2. Fill blood request form with patient details
3. Select location on map
4. System finds compatible donors within 25km
5. Sends WhatsApp alerts via Twilio

### AI Chatbot
1. Click floating chat button (bottom-right)
2. Ask questions about blood donation
3. Gemini AI provides contextual answers
4. Available on all pages

---

## Troubleshooting

**Backend won't start:**
- Check Oracle database is running
- Verify `crimsoncare` user credentials
- Install missing packages: `pip install -r requirements.txt`

**Chatbot not responding:**
- Verify `GEMINI_API_KEY` in `.env` file
- Check API key validity at Google AI Studio
- Ensure `google-generativeai` package installed

**WhatsApp alerts not sending:**
- Verify Twilio credentials in `app.py`
- Check Twilio account balance
- Confirm WhatsApp sandbox setup

**Map not loading:**
- Check internet connection (Leaflet CDN required)
- Verify browser allows geolocation
- Clear browser cache

---

**Project Structure:**
```
CrimsonCare/
├── backend/
│   ├── app.py              # Main FastAPI application
│   ├── alerts.py           # WhatsApp alert system
│   ├── database.py         # Database utilities
│   ├── .env                # Environment variables (not committed)
│   └── .env.example        # Template for .env
└── frontend/
    ├── index.html          # Home page
    ├── information.html    # Registration form
    ├── request_blood.html  # Blood request form
    ├── login.html          # Login page
    ├── script.js           # All JavaScript logic
    └── styles.css          # All styling
```