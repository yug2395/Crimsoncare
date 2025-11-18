from fastapi import FastAPI, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from database import get_connection
import os
import requests
from jose import jwt, JWTError
from datetime import datetime, timedelta
from urllib.parse import urlencode
from dotenv import load_dotenv

# ================================================================
# LOAD ENVIRONMENT VARIABLES (safe, no hardcoded secrets)
# ================================================================
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = "http://127.0.0.1:8000/auth/google/callback"

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# WhatsApp alert service
from alerts import start_alerts_in_background


# ================================================================
# FASTAPI CONFIG
# ================================================================
app = FastAPI()

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "CrimsonCare backend running successfully"}


# ================================================================
# AUTH FUNCTIONS
# ================================================================
def create_access_token(data: dict):
    data_copy = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    data_copy["exp"] = expire
    return jwt.encode(data_copy, SECRET_KEY, algorithm=ALGORITHM)


@app.get("/auth/google/login")
def google_login():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline"
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url=auth_url)


@app.get("/auth/google/callback")
def google_callback(code: str = None, error: str = None):
    if error or not code:
        return RedirectResponse("http://127.0.0.1:5500/frontend/login.html?error=google_auth_failed")

    try:
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }

        token_json = requests.post("https://oauth2.googleapis.com/token", data=token_data).json()
        access_token = token_json.get("access_token")

        if not access_token:
            return RedirectResponse("http://127.0.0.1:5500/frontend/login.html?error=token_failed")

        userinfo = requests.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        ).json()

        email = userinfo.get("email")
        if not email:
            return RedirectResponse("http://127.0.0.1:5500/frontend/login.html?error=invalid_email")

        jwt_token = create_access_token({"email": email})

        return RedirectResponse(f"http://127.0.0.1:5500/frontend/information.html?token={jwt_token}")

    except Exception:
        return RedirectResponse("http://127.0.0.1:5500/frontend/login.html?error=auth_exception")


@app.get("/verify_token")
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {"valid": True, "email": payload.get("email")}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.get("/get_donor_by_email")
def get_donor_by_email(email: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT donor_id, full_name, email, phone_number, blood_group,
                   TO_CHAR(date_of_birth, 'YYYY-MM-DD'),
                   gender, full_address, city, state, pincode,
                   TO_CHAR(last_donation_date, 'YYYY-MM-DD'),
                   eligible, medical_conditions
            FROM donors WHERE email = :1
        """, [email])

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            return {"exists": False}

        return {
            "exists": True,
            "donor": {
                "donor_id": row[0],
                "full_name": row[1],
                "email": row[2],
                "phone_number": row[3],
                "blood_group": row[4],
                "date_of_birth": row[5],
                "gender": row[6],
                "full_address": row[7],
                "city": row[8],
                "state": row[9],
                "pincode": row[10],
                "last_donation_date": row[11],
                "eligible": row[12],
                "medical_conditions": row[13]
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# DONOR ROUTE
# ================================================================
@app.post("/add_donor")
def add_donor(
    full_name: str = Form(...),
    email: str = Form(...),
    phone_number: str = Form(...),
    blood_group: str = Form(...),
    date_of_birth: str = Form(...),
    gender: str = Form(...),
    full_address: str = Form(...),
    city: str = Form(...),
    state: str = Form(...),
    pincode: str = Form(...),
    last_donation_date: str = Form(None),
    eligible: str = Form("Y"),
    medical_conditions: str = Form(None),
    firebase_uid: str = Form(None),
    latitude: str = Form(None),
    longitude: str = Form(None)
):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT donor_id FROM donors WHERE email = :1", [email])
        exists = cursor.fetchone()

        if exists:
            cursor.execute("""
                UPDATE donors SET
                    full_name=:1, phone_number=:2, blood_group=:3,
                    date_of_birth=TO_DATE(:4, 'DD-MM-YYYY'),
                    gender=:5, full_address=:6, city=:7, state=:8, pincode=:9,
                    last_donation_date=TO_DATE(:10, 'DD-MM-YYYY'),
                    eligible=:11, medical_conditions=:12, firebase_uid=:13,
                    latitude=:14, longitude=:15
                WHERE email=:16
            """, [
                full_name, phone_number, blood_group, date_of_birth, gender,
                full_address, city, state, pincode, last_donation_date,
                eligible, medical_conditions, firebase_uid,
                latitude, longitude, email
            ])
            message = "Donor updated successfully!"
        else:
            cursor.execute("""
                INSERT INTO donors (
                    firebase_uid, full_name, email, phone_number, blood_group,
                    date_of_birth, gender, full_address, city, state, pincode,
                    last_donation_date, eligible, medical_conditions,
                    latitude, longitude
                )
                VALUES (
                    :1, :2, :3, :4, :5,
                    TO_DATE(:6, 'DD-MM-YYYY'),
                    :7, :8, :9, :10, :11,
                    TO_DATE(:12, 'DD-MM-YYYY'),
                    :13, :14, :15, :16
                )
            """, [
                firebase_uid, full_name, email, phone_number, blood_group,
                date_of_birth, gender, full_address, city, state, pincode,
                last_donation_date, eligible, medical_conditions,
                latitude, longitude
            ])
            message = "Donor added successfully!"

        conn.commit()
        cursor.close()
        conn.close()

        return {"message": message}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# RECEIVER ROUTE with WHATSAPP ALERTS
# ================================================================
@app.post("/add_receiver")
def add_receiver(
    patient_name: str = Form(...),
    relation_to_patient: str = Form(None),
    blood_type_needed: str = Form(...),
    units_needed: int = Form(...),
    urgency_level: str = Form(...),
    your_name: str = Form(...),
    your_phone_number: str = Form(...),
    your_email: str = Form(...),
    hospital_name: str = Form(None),
    complete_address: str = Form(None),
    city: str = Form(...),
    state: str = Form(None),
    pincode: str = Form(None),
    additional_information: str = Form(None),
    latitude: str = Form(None),
    longitude: str = Form(None)
):
    urgency_map = {
        "Low": "LOW",
        "Moderate": "LOW",
        "Urgent": "MEDIUM",
        "Critical": "HIGH",
    }
    urgency_db = urgency_map.get(urgency_level, "LOW")

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO receivers (
                patient_name, relation_to_patient, blood_type_needed, units_needed,
                urgency_level, your_name, your_phone_number, your_email,
                hospital_name, complete_address, city, state, pincode,
                additional_information, date_request_initiated, latitude, longitude
            )
            VALUES (
                :1, :2, :3, :4, :5, :6, :7, :8,
                :9, :10, :11, :12, :13,
                :14, SYSDATE, :15, :16
            )
        """, [
            patient_name, relation_to_patient, blood_type_needed, units_needed,
            urgency_db, your_name, your_phone_number, your_email,
            hospital_name, complete_address, city, state, pincode,
            additional_information, latitude, longitude
        ])

        cursor.execute("""
        SELECT receiver_id FROM (
            SELECT receiver_id FROM receivers
            WHERE your_phone_number=:1 AND patient_name=:2
            ORDER BY date_request_initiated DESC
        ) WHERE ROWNUM = 1
        """, [your_phone_number, patient_name])

        row = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()

        donor_count = start_alerts_in_background(row[0]) if row else 0

        return {
            "message": "Blood request submitted!",
            "donor_count": donor_count,
            "donor_message": f"Your request was sent to {donor_count} donors."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# Gemini Chatbot Route
# ================================================================
@app.post("/api/gemini_chat")
async def gemini_chat(request: Request):
    try:
        import google.generativeai as genai

        body = await request.json()
        user_message = body.get("message", "")

        if not user_message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API Key not configured")

        genai.configure(api_key=GEMINI_API_KEY)

        system_prompt = """
You are CrimsonCare Assistant. Provide helpful and polite answers about:
- blood donation
- health screening
- blood bank info
- emergencies  
"""

        model = genai.GenerativeModel("gemini-2.5-flash")
        chat = model.start_chat(history=[])

        response = chat.send_message(system_prompt + "\nUser: " + user_message)

        return {"success": True, "response": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
