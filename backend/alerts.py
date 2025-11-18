# backend/alerts.py
import threading
import datetime
import os
import math
from database import get_connection
from twilio.rest import Client

# Get Twilio credentials from environment variables
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")

# Initialize Twilio client
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    twilio_client = None
    print("⚠️ Twilio credentials not found in environment variables!")


def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(float(lat1))
    lat2_rad = math.radians(float(lat2))
    delta_lat = math.radians(float(lat2) - float(lat1))
    delta_lon = math.radians(float(lon2) - float(lon1))
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    distance = R * c
    
    return distance


def get_compatible_blood_types(blood_type_needed):
    """
    Return list of blood types that can donate to the required blood type.
    O- can donate to anyone, so logic depends on what blood type is needed.
    """
    compatibility = {
        "O+": ["O+", "O-"],
        "O-": ["O-"],
        "A+": ["A+", "A-", "O+", "O-"],
        "A-": ["A-", "O-"],
        "B+": ["B+", "B-", "O+", "O-"],
        "B-": ["B-", "O-"],
        "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        "AB-": ["A-", "B-", "AB-", "O-"]
    }
    return compatibility.get(blood_type_needed, [])


def send_whatsapp_message(phone_number, message):
    """
    Send a WhatsApp message using Twilio API.
    Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER env vars
    """
    if not twilio_client or not TWILIO_WHATSAPP_NUMBER:
        print(f"❌ Twilio not configured!")
        print(f"   - Client exists: {twilio_client is not None}")
        print(f"   - WhatsApp number: {TWILIO_WHATSAPP_NUMBER}")
        return False
    
    try:
        # Format phone number for Twilio WhatsApp
        formatted_number = f"whatsapp:+91{phone_number}" if not phone_number.startswith("+") else f"whatsapp:{phone_number}"
        
        print(f"📤 Sending to: {formatted_number}")
        print(f"📤 From: {TWILIO_WHATSAPP_NUMBER}")
        
        message_obj = twilio_client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            body=message,
            to=formatted_number
        )
        
        print(f"✅ WhatsApp message sent to {phone_number} (SID: {message_obj.sid})")
        return True
            
    except Exception as e:
        print(f"❌ Error sending WhatsApp message to {phone_number}:")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Error: {str(e)}")
        return False


def match_and_alert_donors(receiver_id):
    """Main matching logic — finds all eligible donors within 25km radius and notifies them.
    Returns the count of donors alerted.
    """
    import time
    
    print(f"\n🔍 Starting donor matching for receiver_id: {receiver_id}")
    
    conn = get_connection()
    cursor = conn.cursor()

    # ✅ Fetch receiver details (including coordinates)
    cursor.execute("""
        SELECT patient_name, blood_type_needed, urgency_level, hospital_name, city, state,
               your_phone_number, complete_address, latitude, longitude
        FROM receivers WHERE receiver_id = :1
    """, [receiver_id])
    receiver = cursor.fetchone()
    if not receiver:
        print(f"❌ Receiver {receiver_id} not found in database.")
        cursor.close()
        conn.close()
        return 0

    patient_name, blood_type, urgency, hospital_name, city, state, your_phone_number, complete_address, receiver_lat, receiver_lon = receiver
    print(f"✅ Found receiver: {patient_name}, Blood: {blood_type}, Urgency: {urgency}, State: {state}")
    print(f"📍 Receiver location: {receiver_lat}, {receiver_lon}")

    # ✅ Find matching donors (no geographic filter yet - we'll filter in Python)
    compatible_types = get_compatible_blood_types(blood_type)
    print(f"🩸 Compatible blood types for {blood_type}: {compatible_types}")
    
    placeholders = ','.join([f":{i}" for i in range(1, len(compatible_types) + 1)])
    cursor.execute(f"""
        SELECT full_name, phone_number, last_donation_date, latitude, longitude
        FROM donors
        WHERE blood_group IN ({placeholders})
        AND state = :{len(compatible_types) + 1}
        AND (last_donation_date IS NULL OR last_donation_date <= SYSDATE - 90)
        AND eligible = 'Y'
    """, compatible_types + [state])

    all_donors = cursor.fetchall()
    cursor.close()
    conn.close()

    if not all_donors:
        print(f"⚠️ No eligible donors found for blood types {compatible_types} in {state}")
        return 0

    print(f"🩸 Found {len(all_donors)} eligible donor(s) before distance filter")

    # ✅ Filter donors by 25km radius
    nearby_donors = []
    RADIUS_KM = 25
    
    for donor in all_donors:
        donor_name, phone, last_donation, donor_lat, donor_lon = donor
        
        # Skip if coordinates are missing
        if not donor_lat or not donor_lon or not receiver_lat or not receiver_lon:
            print(f"⚠️ Skipping {donor_name}: missing coordinates")
            continue
        
        # Calculate distance
        distance = calculate_distance(receiver_lat, receiver_lon, donor_lat, donor_lon)
        
        if distance <= RADIUS_KM:
            nearby_donors.append((donor_name, phone, last_donation, distance))
            print(f"✅ {donor_name} is {distance:.2f}km away (within {RADIUS_KM}km)")
        else:
            print(f"⚠️ {donor_name} is {distance:.2f}km away (outside {RADIUS_KM}km radius)")
    
    if not nearby_donors:
        print(f"⚠️ No donors found within {RADIUS_KM}km radius")
        return 0

    print(f"✅ Found {len(nearby_donors)} donor(s) within {RADIUS_KM}km radius")

    # ✅ Send personalized messages with delay between each
    for idx, (donor_name, phone, last_donation, distance) in enumerate(nearby_donors, 1):
        message = (
            f"🩸 *CrimsonCare Blood Request Alert*\n\n"
            f"Dear {donor_name},\n\n"
            f"A request has been made for *{blood_type}* blood by *{patient_name}*.\n\n"
            f"🏥 Hospital: {hospital_name}\n"
            f"📍 Address: {complete_address}, {city}, {state}\n"
            f"📏 Distance: {distance:.2f}km from you\n"
            f"⚡ Urgency Level: {urgency}\n\n"
            f"📞 Contact Requester: {your_phone_number}\n\n"
            f"Please respond if you are available to donate.\n"
            f"Thank you for being a life saver ❤️"
        )

        print(f"📤 Sending message {idx}/{len(nearby_donors)} to {donor_name}...")
        success = send_whatsapp_message(phone, message)
        
        if success:
            print(f"   ✅ Delivered to {donor_name}")
        else:
            print(f"   ❌ Failed for {donor_name}")
        
        # Add 2-second delay between messages to avoid rate limiting
        if idx < len(nearby_donors):
            time.sleep(2)
    
    print(f"✅ Alert cycle completed for {len(nearby_donors)} donor(s)\n")
    return len(nearby_donors)


def start_alerts_in_background(receiver_id):
    """Run donor alerts in a background thread (non-blocking)."""
    result = match_and_alert_donors(receiver_id)
    return result
