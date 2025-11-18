// ==================== AUTHENTICATION HELPERS ====================

// Get JWT token from localStorage
function getToken() {
    return localStorage.getItem('crimsoncare_token');
}

// Set JWT token in localStorage
function setToken(token) {
    localStorage.setItem('crimsoncare_token', token);
}

// Remove JWT token
function logout() {
    localStorage.removeItem('crimsoncare_token');
    localStorage.removeItem('crimsoncare_email');
    window.location.href = 'login.html';
}

// Get user email from token
async function getUserEmail() {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`http://127.0.0.1:8000/verify_token?token=${token}`);
        const data = await response.json();
        if (data.valid) {
            localStorage.setItem('crimsoncare_email', data.email);
            return data.email;
        }
        return null;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
}

// Check if user is authenticated, redirect to login if not
async function requireAuth() {
    const email = await getUserEmail();
    if (!email) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Check if user exists in database by email
async function checkUserExists(email) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/get_donor_by_email?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        return data.exists || false;
    } catch (error) {
        console.error('Error checking user existence:', error);
        return false;
    }
}

// Check and populate donor information if exists
async function checkAndPopulateDonor() {
    const email = localStorage.getItem('crimsoncare_email') || await getUserEmail();
    if (!email) {
        window.location.href = 'login.html';
        return;
    }

    const loadingMsg = document.getElementById('loading-message');
    const form = document.getElementById('user-form');
    const subtitle = document.getElementById('page-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const editBtn = document.getElementById('edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    if (loadingMsg) loadingMsg.style.display = 'block';
    if (form) form.style.display = 'none';

    try {
        const response = await fetch(`http://127.0.0.1:8000/get_donor_by_email?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (loadingMsg) loadingMsg.style.display = 'none';
        if (form) form.style.display = 'block';

        if (data.exists) {
            // User exists - SET TO READ-ONLY MODE
            const donor = data.donor;
            if (subtitle) subtitle.textContent = `Welcome back, ${donor.full_name}! View and edit your information below.`;

            // Populate form fields
            document.getElementById('fullName').value = donor.full_name || '';
            document.getElementById('email').value = donor.email || '';
            document.getElementById('phone').value = donor.phone_number || '';
            document.getElementById('bloodGroup').value = donor.blood_group || '';
            document.getElementById('dob').value = donor.date_of_birth || '';
            document.getElementById('gender').value = donor.gender || '';
            document.getElementById('address').value = donor.full_address || '';
            document.getElementById('city').value = donor.city || '';
            document.getElementById('state').value = donor.state || '';
            document.getElementById('pincode').value = donor.pincode || '';
            document.getElementById('lastDonationDate').value = donor.last_donation_date || '';
            document.getElementById('medicalConditions').value = donor.medical_conditions || '';

            // Set form to READ-ONLY by default
            setFormReadOnly(true);

            // Email is always readonly
            document.getElementById('email').setAttribute('readonly', true);

            // Show Edit button, hide Submit and Cancel buttons
            if (editBtn) {
                editBtn.style.display = 'inline-block';
                editBtn.onclick = function () { toggleEditMode(true); };
            }
            if (submitBtn) submitBtn.style.display = 'none';
            if (cancelEditBtn) cancelEditBtn.style.display = 'none';
            if (cancelEditBtn) {
                cancelEditBtn.onclick = function () { toggleEditMode(false); };
            }
        } else {
            // New user - NORMAL REGISTRATION MODE
            if (subtitle) subtitle.textContent = 'Complete your donor registration to save lives!';
            document.getElementById('email').value = email;
            document.getElementById('email').setAttribute('readonly', true);

            // Show Submit button for new user
            if (submitBtn) submitBtn.style.display = 'inline-block';
            if (editBtn) editBtn.style.display = 'none';
            if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        }

        // Show logout button
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            logoutBtn.onclick = logout;
        }

    } catch (error) {
        console.error('Error fetching donor info:', error);
        if (loadingMsg) loadingMsg.style.display = 'none';
        if (form) form.style.display = 'block';
        alert('Error loading your information. Please try again.');
    }
}

// Set form fields to read-only or editable
function setFormReadOnly(isReadOnly) {
    const formFields = [
        'fullName', 'phone', 'bloodGroup', 'dob', 'gender', 'address',
        'city', 'state', 'pincode', 'lastDonationDate', 'medicalConditions'
    ];

    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            if (isReadOnly) {
                field.setAttribute('readonly', true);
                field.setAttribute('disabled', true);
                field.style.backgroundColor = '#f0f0f0';
                field.style.cursor = 'not-allowed';
            } else {
                field.removeAttribute('readonly');
                field.removeAttribute('disabled');
                field.style.backgroundColor = '';
                field.style.cursor = '';
            }
        }
    });

    // Disable/Enable map and search input
    const mapSearchInput = document.getElementById('donor-search-input');
    const donorMap = document.getElementById('donor-map');

    if (mapSearchInput) {
        if (isReadOnly) {
            mapSearchInput.setAttribute('disabled', true);
            mapSearchInput.style.backgroundColor = '#f0f0f0';
            mapSearchInput.style.cursor = 'not-allowed';
            mapSearchInput.style.opacity = '0.6';
            mapSearchInput.style.pointerEvents = 'none';
        } else {
            mapSearchInput.removeAttribute('disabled');
            mapSearchInput.style.backgroundColor = '';
            mapSearchInput.style.cursor = '';
            mapSearchInput.style.opacity = '1';
            mapSearchInput.style.pointerEvents = 'auto';
        }
    }

    if (donorMap) {
        if (isReadOnly) {
            donorMap.style.opacity = '0.5';
            donorMap.style.pointerEvents = 'none';
            donorMap.style.backgroundColor = '#f0f0f0';
        } else {
            donorMap.style.opacity = '1';
            donorMap.style.pointerEvents = 'auto';
            donorMap.style.backgroundColor = '';
        }
    }
}

// Toggle between edit and view mode
function toggleEditMode(isEditing) {
    const submitBtn = document.getElementById('submit-btn');
    const editBtn = document.getElementById('edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    if (isEditing) {
        // ENABLE EDITING
        setFormReadOnly(false);
        submitBtn.style.display = 'inline-block';
        submitBtn.textContent = 'Update Information';
        editBtn.style.display = 'none';
        cancelEditBtn.style.display = 'inline-block';
        console.log('✏️ Edit mode enabled');
    } else {
        // DISABLE EDITING - BACK TO READ-ONLY
        setFormReadOnly(true);
        submitBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';
        cancelEditBtn.style.display = 'none';

        // Reload data to discard changes
        checkAndPopulateDonor();
        console.log('👁️ View mode enabled');
    }
}

// ==================== END AUTHENTICATION HELPERS ====================

// Mock Data
let urgentRequests = [
    {
        id: 1,
        name: 'Rajesh Kumar',
        phone: '+91-9876543210',
        address: '45 MG Road, Dehradun',
        bloodGroup: 'O+',
        urgency: 'Critical',
        distance: '2.3 km'
    },
    {
        id: 2,
        name: 'Priya Sharma',
        phone: '+91-9876543211',
        address: '12 Rajpur Road, Dehradun',
        bloodGroup: 'A+',
        urgency: 'Urgent',
        distance: '3.1 km'
    },
    {
        id: 3,
        name: 'Amit Singh',
        phone: '+91-9876543212',
        address: '78 Clock Tower, Dehradun',
        bloodGroup: 'B+',
        urgency: 'Moderate',
        distance: '4.5 km'
    },
    {
        id: 4,
        name: 'Neha Verma',
        phone: '+91-9876543213',
        address: '23 Saharanpur Road, Dehradun',
        bloodGroup: 'AB+',
        urgency: 'Critical',
        distance: '1.8 km'
    }
];

const activeCamps = [
    {
        id: 1,
        campName: 'Doon Hospital Blood Drive',
        organizer: 'Doon Hospital',
        dateTime: '2025-11-10 09:00 AM',
        address: '15 Rajpur Road, Dehradun',
        contact: '+91-135-2712345',
        registerLink: '#'
    },
    {
        id: 2,
        campName: 'Community Health Camp',
        organizer: 'Lions Club Dehradun',
        dateTime: '2025-11-12 10:00 AM',
        address: 'Clock Tower, Dehradun',
        contact: '+91-135-2723456',
        registerLink: '#'
    },
    {
        id: 3,
        campName: 'Red Cross Blood Donation',
        organizer: 'Red Cross Society',
        dateTime: '2025-11-15 08:00 AM',
        address: 'Red Cross Building, Dehradun',
        contact: '+91-135-2734567',
        registerLink: '#'
    }
];

const bloodBanks = [
    {
        id: 1,
        name: 'Doon Hospital Blood Bank',
        address: '15 Rajpur Road, Dehradun, Uttarakhand',
        phone: '+91-135-2712345',
        stockStatus: 'available',
        distance: '2.5 km',
        hours: '24/7'
    },
    {
        id: 2,
        name: 'Max Hospital Blood Bank',
        address: '23 Saharanpur Road, Dehradun, Uttarakhand',
        phone: '+91-135-2723456',
        stockStatus: 'low',
        distance: '3.8 km',
        hours: '8 AM - 8 PM'
    },
    {
        id: 3,
        name: 'AIIMS Rishikesh Blood Bank',
        address: 'Virbhadra Road, Rishikesh, Uttarakhand',
        phone: '+91-135-2734567',
        stockStatus: 'available',
        distance: '21.3 km',
        hours: '24/7'
    },
    {
        id: 4,
        name: 'City Hospital Blood Bank',
        address: '45 MG Road, Dehradun, Uttarakhand',
        phone: '+91-135-2745678',
        stockStatus: 'critical',
        distance: '1.9 km',
        hours: '6 AM - 10 PM'
    },
    {
        id: 5,
        name: 'Himalayan Hospital Blood Bank',
        address: 'Jolly Grant, Dehradun, Uttarakhand',
        phone: '+91-135-2756789',
        stockStatus: 'available',
        distance: '18.7 km',
        hours: '24/7'
    }
];

const leaderboardData = [
    {
        rank: 1,
        user: 'Ravi Sharma',
        donations: 48,
        badges: ['gold', 'silver', 'bronze'],
        lastDonation: '2025-10-15',
        city: 'Dehradun'
    },
    {
        rank: 2,
        user: 'Anjali Gupta',
        donations: 42,
        badges: ['gold', 'silver'],
        lastDonation: '2025-10-28',
        city: 'Dehradun'
    },
    {
        rank: 3,
        user: 'Vikram Singh',
        donations: 38,
        badges: ['gold', 'bronze'],
        lastDonation: '2025-11-01',
        city: 'Rishikesh'
    },
    {
        rank: 4,
        user: 'Priya Mehta',
        donations: 35,
        badges: ['silver', 'bronze'],
        lastDonation: '2025-09-22',
        city: 'Dehradun'
    },
    {
        rank: 5,
        user: 'Arun Kumar',
        donations: 31,
        badges: ['silver'],
        lastDonation: '2025-10-18',
        city: 'Haridwar'
    },
    {
        rank: 6,
        user: 'Neha Verma',
        donations: 28,
        badges: ['bronze'],
        lastDonation: '2025-11-03',
        city: 'Dehradun'
    },
    {
        rank: 7,
        user: 'Rajesh Patel',
        donations: 25,
        badges: ['bronze'],
        lastDonation: '2025-10-05',
        city: 'Mussoorie'
    },
    {
        rank: 8,
        user: 'Kavita Joshi',
        donations: 22,
        badges: [],
        lastDonation: '2025-10-30',
        city: 'Dehradun'
    },
    {
        rank: 9,
        user: 'Sanjay Rawat',
        donations: 19,
        badges: [],
        lastDonation: '2025-09-14',
        city: 'Rishikesh'
    },
    {
        rank: 10,
        user: 'Pooja Negi',
        donations: 17,
        badges: [],
        lastDonation: '2025-10-21',
        city: 'Dehradun'
    }
];

// Contact receiver via WhatsApp
function contactViaWhatsApp(phoneNumber, recipientName) {
    if (phoneNumber === 'N/A' || !phoneNumber) {
        alert('Phone number not available for this recipient');
        return;
    }

    // Clean phone number: remove all non-digit and non-plus characters
    let cleanPhone = phoneNumber.replace(/[^\d+]/g, '');

    // If phone number doesn't start with +, assume it's Indian number and add +91
    if (!cleanPhone.startsWith('+')) {
        // Remove leading 0 if present
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }
        cleanPhone = '+91' + cleanPhone;
    }

    // Create message with context
    const message = `Hi ${recipientName}, I'm a registered blood donor at CrimsonCare and I can help you with your blood donation request. Please let me know how I can assist you.`;

    // WhatsApp web link format: https://wa.me/[PHONENUMBER]?text=[MESSAGE]
    // Note: wa.me uses phone number without the + prefix
    const phoneForWA = cleanPhone.replace('+', '');
    const whatsappUrl = `https://wa.me/${phoneForWA}?text=${encodeURIComponent(message)}`;

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
}

// Load Real Urgent Requests from Backend
async function loadClosestRequests() {
    try {
        // Try both token keys for backward compatibility
        let token = localStorage.getItem('crimsoncare_token') || localStorage.getItem('token');
        console.log('🔍 loadClosestRequests called, token exists:', !!token);

        if (!token) {
            console.log('❌ No token found, showing fake data');
            renderUrgentRequests(); // Show fake data if not logged in
            return;
        }

        // Decode token to get email
        const payload = JSON.parse(atob(token.split('.')[1]));
        const email = payload.email;
        console.log('📧 Decoded email from token:', email);

        if (!email) {
            console.log('❌ No email in token');
            renderUrgentRequests(); // Show fake data
            return;
        }

        // Fetch closest requests from backend
        const apiUrl = `http://127.0.0.1:8000/api/closest_requests?email=${encodeURIComponent(email)}`;
        console.log('📡 Fetching from:', apiUrl);
        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('📥 Response from backend:', data);

        if (data.requests && data.requests.length > 0) {
            // Transform backend data to match UI format
            urgentRequests = data.requests.map((req, index) => ({
                id: req.receiver_id,
                name: req.patient_name,
                phone: req.phone_number || 'N/A',
                address: `${req.hospital || 'Unknown Hospital'}, ${req.city}`.trim(),
                bloodGroup: req.blood_type,
                urgency: req.urgency || 'Moderate',
                distance: `${req.distance_km} km`
            }));
            console.log('✅ Loaded real requests:', urgentRequests);
            renderUrgentRequests();
        } else {
            // No matching requests, show fake data
            console.log('⚠️ No matching blood requests found');
            renderUrgentRequests();
        }
    } catch (error) {
        console.error('❌ Error loading closest requests:', error);
        renderUrgentRequests(); // Fallback to fake data
    }
}

// Render Urgent Requests on Home Page
function renderUrgentRequests() {
    const container = document.getElementById('urgent-requests');
    if (!container) return;

    container.innerHTML = urgentRequests.map(request => `
        <div class="request-tile ${request.urgency.toLowerCase()}" onclick="showRequestDetails(${request.id})">
            <div class="tile-header">
                <div class="tile-name">${request.name}</div>
                <div class="blood-group-badge">${request.bloodGroup}</div>
            </div>
            <div class="tile-info">
                <div>📞 ${request.phone}</div>
                <div>📍 ${request.address}</div>
                <div>🚗 ${request.distance} away</div>
                <span class="urgency-badge ${request.urgency.toLowerCase()}">${request.urgency}</span>
            </div>
        </div>
    `).join('');
}

// Render Active Camps on Home Page
function renderActiveCamps() {
    const container = document.getElementById('active-camps');
    if (!container) return;

    container.innerHTML = activeCamps.map(camp => `
        <div class="camp-tile" onclick="showCampDetails(${camp.id})">
            <div class="tile-header">
                <div class="tile-name">${camp.campName}</div>
            </div>
            <div class="tile-info">
                <div>🏥 ${camp.organizer}</div>
                <div>📅 ${camp.dateTime}</div>
                <div>📍 ${camp.address}</div>
                <div>📞 ${camp.contact}</div>
            </div>
        </div>
    `).join('');
}

// Show Request Details Modal
function showRequestDetails(id) {
    const request = urgentRequests.find(r => r.id === id);
    if (!request) return;

    const modal = document.getElementById('request-modal');
    const detailsContainer = document.getElementById('request-details');

    detailsContainer.innerHTML = `
        <p><strong>Name:</strong> ${request.name}</p>
        <p><strong>Phone:</strong> ${request.phone}</p>
        <p><strong>Address:</strong> ${request.address}</p>
        <p><strong>Blood Group:</strong> ${request.bloodGroup}</p>
        <p><strong>Urgency:</strong> <span class="urgency-badge ${request.urgency.toLowerCase()}">${request.urgency}</span></p>
        <p><strong>Distance:</strong> ${request.distance}</p>
        <div style="margin-top: 20px;">
            <button class="btn btn-primary" onclick="contactViaWhatsApp('${request.phone}', '${request.name}')">Contact Recipient</button>
        </div>
    `;

    modal.style.display = 'block';
}

// Show Camp Details Modal
function showCampDetails(id) {
    const camp = activeCamps.find(c => c.id === id);
    if (!camp) return;

    const modal = document.getElementById('camp-modal');
    const detailsContainer = document.getElementById('camp-details');

    detailsContainer.innerHTML = `
        <p><strong>Camp Name:</strong> ${camp.campName}</p>
        <p><strong>Organizer:</strong> ${camp.organizer}</p>
        <p><strong>Date & Time:</strong> ${camp.dateTime}</p>
        <p><strong>Address:</strong> ${camp.address}</p>
        <p><strong>Contact:</strong> ${camp.contact}</p>
        <div style="margin-top: 20px;">
            <button class="btn btn-primary" onclick="alert('Registration successful!')">Register for Camp</button>
        </div>
    `;

    modal.style.display = 'block';
}

// Render Blood Banks
function renderBloodBanks(banksToRender = bloodBanks) {
    const container = document.getElementById('blood-banks-list');
    if (!container) return;

    container.innerHTML = banksToRender.map(bank => `
        <div class="bank-card">
            <h3>${bank.name}</h3>
            <div class="bank-info">
                <div class="info-item">
                    📍 ${bank.address}
                </div>
                <div class="info-item">
                    📞 ${bank.phone}
                </div>
                <div class="info-item">
                    🚗 ${bank.distance}
                </div>
                <div class="info-item">
                    ⏰ ${bank.hours}
                </div>
            </div>
            <div style="margin-top: 15px;">
                <span class="stock-status ${bank.stockStatus}">
                    ${bank.stockStatus === 'available' ? '✓ Available' :
            bank.stockStatus === 'low' ? '⚠ Low Stock' :
                '⚠ Critical'}
                </span>
            </div>
        </div>
    `).join('');
}

// Search and Filter Blood Banks
function searchBloodBanks() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filteredBanks = bloodBanks.filter(bank =>
        bank.name.toLowerCase().includes(searchTerm) ||
        bank.address.toLowerCase().includes(searchTerm)
    );
    renderBloodBanks(filteredBanks);
}

function filterBloodBanks() {
    const filterValue = document.getElementById('filter-select').value;
    let filteredBanks = bloodBanks;

    if (filterValue !== 'all') {
        filteredBanks = bloodBanks.filter(bank => bank.stockStatus === filterValue);
    }

    renderBloodBanks(filteredBanks);
}

// Render Camps List
function renderCampsList(campsToRender = activeCamps) {
    const container = document.getElementById('camps-list');
    if (!container) return;

    container.innerHTML = campsToRender.map(camp => `
        <div class="camp-card" onclick="showCampDetails(${camp.id})">
            <h3>${camp.campName}</h3>
            <div class="camp-info">
                <div class="info-item">
                    🏥 ${camp.organizer}
                </div>
                <div class="info-item">
                    📅 ${camp.dateTime}
                </div>
                <div class="info-item">
                    📍 ${camp.address}
                </div>
                <div class="info-item">
                    📞 ${camp.contact}
                </div>
            </div>
            <div style="margin-top: 15px;">
                <button class="btn btn-primary" onclick="event.stopPropagation(); alert('Registration successful!')">Register Now</button>
            </div>
        </div>
    `).join('');
}

// Search Camps
function searchCamps() {
    const searchTerm = document.getElementById('search-camps').value.toLowerCase();
    const filteredCamps = activeCamps.filter(camp =>
        camp.campName.toLowerCase().includes(searchTerm) ||
        camp.organizer.toLowerCase().includes(searchTerm) ||
        camp.address.toLowerCase().includes(searchTerm)
    );
    renderCampsList(filteredCamps);
}

// Render Leaderboard
function renderLeaderboard(dataToRender = leaderboardData) {
    const tbody = document.getElementById('leaderboard-tbody');
    if (!tbody) return;

    tbody.innerHTML = dataToRender.map(user => `
        <tr>
            <td class="rank-cell">#${user.rank}</td>
            <td>${user.user}</td>
            <td>${user.donations}</td>
            <td>
                <div class="badges">
                    ${user.badges.map(badge => `<span class="badge ${badge}">${badge[0].toUpperCase()}</span>`).join('')}
                </div>
            </td>
            <td>${user.lastDonation}</td>
            <td>${user.city}</td>
        </tr>
    `).join('');
}

// Sort Leaderboard
let currentSort = { column: null, ascending: true };

function sortLeaderboard(column) {
    if (currentSort.column === column) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.column = column;
        currentSort.ascending = true;
    }

    const sortedData = [...leaderboardData].sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        if (column === 'donations' || column === 'rank') {
            return currentSort.ascending ? aVal - bVal : bVal - aVal;
        } else if (column === 'lastDonation') {
            return currentSort.ascending ?
                new Date(aVal) - new Date(bVal) :
                new Date(bVal) - new Date(aVal);
        } else {
            return currentSort.ascending ?
                aVal.localeCompare(bVal) :
                bVal.localeCompare(aVal);
        }
    });

    renderLeaderboard(sortedData);
}

// Handle User Information Form — backend connected
async function handleUserForm(e) {
    e.preventDefault();

    const form = e.target;

    // Check if donor location is set
    if (!document.getElementById("donor-latitude").value || !document.getElementById("donor-longitude").value) {
        alert("⚠️ Please select your location on the map before submitting!");
        return;
    }

    const formData = new FormData();
    const email = localStorage.getItem('crimsoncare_email') || document.getElementById("email").value;

    formData.append("full_name", document.getElementById("fullName").value);
    formData.append("email", email);
    formData.append("phone_number", formatPhoneNumber(document.getElementById("phone").value));
    formData.append("blood_group", document.getElementById("bloodGroup").value);
    formData.append("date_of_birth", formatDate(document.getElementById("dob").value));
    formData.append("gender", document.getElementById("gender").value);
    formData.append("full_address", document.getElementById("address").value);
    formData.append("city", document.getElementById("city").value);
    formData.append("state", document.getElementById("state").value);
    formData.append("pincode", document.getElementById("pincode").value);
    formData.append("last_donation_date", formatDate(document.getElementById("lastDonationDate").value));
    formData.append("eligible", "Y");
    formData.append("medical_conditions", document.getElementById("medicalConditions").value);
    formData.append("firebase_uid", email); // Store Google email
    formData.append("latitude", document.getElementById("donor-latitude").value);
    formData.append("longitude", document.getElementById("donor-longitude").value);

    try {
        const response = await fetch("http://127.0.0.1:8000/add_donor", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();

        if (response.ok) {
            alert("✅ " + result.message);
            // Redirect to home page after successful registration
            window.location.href = 'index.html';
        } else {
            alert("❌ Error: " + (result.detail || "Something went wrong."));
        }
    } catch (error) {
        console.error("Error:", error);
        alert("⚠️ Could not connect to the server. Please ensure backend is running.");
    }
}

// Helper to format date → DD-MM-YYYY
function formatDate(inputDate) {
    if (!inputDate) return "";
    const date = new Date(inputDate);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper to format phone number with +91 prefix
function formatPhoneNumber(phone) {
    if (!phone) return "";

    // Remove all non-digit and non-plus characters
    let cleanPhone = phone.replace(/[^\d+]/g, '');

    // If already starts with +, return as is
    if (cleanPhone.startsWith('+')) {
        return cleanPhone;
    }

    // Remove leading 0 if present
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Add +91 prefix if not present
    if (!cleanPhone.startsWith('91')) {
        cleanPhone = '91' + cleanPhone;
    }

    // Add + prefix
    return '+' + cleanPhone;
}

// ==================== END BLOOD REQUEST HANDLERS ====================

// Modal Close Functionality
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-close')) {
        e.target.closest('.modal').style.display = 'none';
    }
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Initialize page-specific content
document.addEventListener('DOMContentLoaded', function () {
    // Extract token from URL if present (OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        setToken(token);
        // Remove token from URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Check if user exists in database
        (async () => {
            const email = await getUserEmail();
            if (email) {
                localStorage.setItem('crimsoncare_email', email);
                const userExists = await checkUserExists(email);

                if (userExists) {
                    // Existing user → go to home page
                    console.log('✅ Existing user, redirecting to home');
                    window.location.href = 'index.html';
                } else {
                    // New user → go to registration form
                    console.log('🆕 New user, redirecting to registration form');
                    window.location.href = 'information.html';
                }
            }
        })();
        return;
    }

    // Check authentication for protected pages
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const protectedPages = ['information.html', 'request_blood.html', 'index.html', 'blood-banks.html', 'camps.html', 'leaderboard.html'];

    if (protectedPages.includes(currentPage)) {
        requireAuth().then(isAuthenticated => {
            if (!isAuthenticated) return;

            // Load page-specific content after authentication
            loadPageContent();
        });
    } else {
        loadPageContent();
    }
});

function loadPageContent() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Home page - load real closest requests for logged-in users
    console.log('Loading page content for:', currentPage);
    if (currentPage === 'index.html' || currentPage === '') {
        loadClosestRequests();
    }
    renderActiveCamps();

    // Blood Banks page
    if (document.getElementById('blood-banks-list')) {
        renderBloodBanks();
    }

    // Camps page
    if (document.getElementById('camps-list')) {
        renderCampsList();
    }

    // Leaderboard page
    if (document.getElementById('leaderboard-tbody')) {
        renderLeaderboard();
    }

    // User form - check and populate if user exists
    const userForm = document.getElementById('user-form');
    if (userForm) {
        checkAndPopulateDonor();
        userForm.addEventListener('submit', handleUserForm);
    }

    // Set active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ==================== BLOOD REQUEST FUNCTIONS ====================

function updateUrgencyInfo() {
    const urgency = document.getElementById('urgency').value;
    const indicator = document.getElementById('urgency-indicator');

    if (!urgency) {
        indicator.style.display = 'none';
        return;
    }

    indicator.style.display = 'block';

    if (urgency === 'Critical') {
        indicator.style.backgroundColor = '#FEE2E2';
        indicator.style.borderLeft = '4px solid #DC2626';
        indicator.innerHTML = `
        <h4 style="color: #DC2626; margin-bottom: 8px;">🚨 Critical Priority</h4>
        <p style="color: #7F1D1D; font-size: 14px; line-height: 1.6;">
            Your request will be marked as CRITICAL and sent to all matching donors immediately. 
            We recommend also calling our emergency helpline for the fastest response.
        </p>
    `;
    } else if (urgency === 'Urgent') {
        indicator.style.backgroundColor = '#FEF3C7';
        indicator.style.borderLeft = '4px solid #F59E0B';
        indicator.innerHTML = `
        <h4 style="color: #92400E; margin-bottom: 8px;">⚠️ Urgent Priority</h4>
        <p style="color: #78350F; font-size: 14px; line-height: 1.6;">
            Your request will be marked as URGENT and prioritized in donor notifications. 
            Expected response within 24 hours.
        </p>
    `;
    } else if (urgency === 'Moderate') {
        indicator.style.backgroundColor = '#D1FAE5';
        indicator.style.borderLeft = '4px solid #16A34A';
        indicator.innerHTML = `
        <h4 style="color: #065F46; margin-bottom: 8px;">✓ Standard Priority</h4>
        <p style="color: #047857; font-size: 14px; line-height: 1.6;">
            Your request will be posted to our network. Donors in your area will be notified. 
            Expected response within 2-3 days.
        </p>
    `;
    }
}

async function handleBloodRequest(e) {
    e.preventDefault();

    const form = document.getElementById("request-blood-form");

    // Check if receiver location is set
    if (!document.getElementById("receiver-latitude").value || !document.getElementById("receiver-longitude").value) {
        alert("⚠️ Please select your location on the map before submitting!");
        return;
    }

    const formData = new FormData(form);

    // Format phone number with +91 prefix
    formData.set("your_phone_number", formatPhoneNumber(document.getElementById("contact-phone").value));

    try {
        const response = await fetch("http://127.0.0.1:8000/add_receiver", {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            const donorMessage = result.donor_message || "";
            alert(`✅ ${result.message}\n\n${donorMessage}\n\nPatient: ${formData.get("patient_name")}\nBlood Type: ${formData.get("blood_type_needed")}\nUrgency: ${formData.get("urgency_level")}`);
            form.reset();
            setTimeout(() => window.location.href = "index.html", 2000);
        } else {
            console.log(result);
            alert("❌ Error: " + (result.detail || JSON.stringify(result)));
        }
    } catch (error) {
        console.error(error);
        alert("⚠️ Could not connect to the backend. Ensure FastAPI is running.");
    }
}

// ==================== MAP INITIALIZATION FUNCTIONS ====================

// Initialize map for donor registration (information.html)
function initDonorMap() {
    const mapElement = document.getElementById('donor-map');
    if (!mapElement) return;

    // Center on India
    const map = L.map('donor-map').setView([20.5937, 78.9629], 5);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add geocoder search control with proper initialization
    try {
        L.Control.Geocoder.nominatim().addTo(map);
    } catch (e) {
        console.log('Geocoder loaded:', e);
    }

    // Create draggable marker
    let marker = L.marker([20.5937, 78.9629], {
        draggable: true,
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);

    // Update location on marker drag
    function updateDonorLocation() {
        const lat = marker.getLatLng().lat;
        const lng = marker.getLatLng().lng;
        document.getElementById('donor-latitude').value = lat.toFixed(6);
        document.getElementById('donor-longitude').value = lng.toFixed(6);
        document.getElementById('donor-coords').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        document.getElementById('donor-location-status').style.display = 'block';
    }

    marker.on('dragend', updateDonorLocation);

    // Update marker on map click
    map.on('click', function (e) {
        marker.setLatLng(e.latlng);
        updateDonorLocation();
    });

    // Try to get user's location via geolocation API
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 12);
                marker.setLatLng([lat, lng]);
                updateDonorLocation();
            },
            function (error) {
                console.log('Geolocation denied or error:', error);
                // User will manually select location or search
            }
        );
    }

    // Add search functionality for donor
    const donorSearchInput = document.getElementById('donor-search-input');
    if (donorSearchInput) {
        donorSearchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = this.value;
                if (query.trim()) {
                    searchLocation(query, map, marker, function () { updateDonorLocation(); });
                }
            }
        });
    }
}

// Initialize map for blood request (request_blood.html)
function initReceiverMap() {
    const mapElement = document.getElementById('receiver-map');
    if (!mapElement) return;

    // Center on India
    const map = L.map('receiver-map').setView([20.5937, 78.9629], 5);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add geocoder search control with proper initialization
    try {
        L.Control.Geocoder.nominatim().addTo(map);
    } catch (e) {
        console.log('Geocoder loaded:', e);
    }

    // Create draggable marker
    let marker = L.marker([20.5937, 78.9629], {
        draggable: true,
        icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    }).addTo(map);

    // Update location on marker drag
    function updateReceiverLocation() {
        const lat = marker.getLatLng().lat;
        const lng = marker.getLatLng().lng;
        document.getElementById('receiver-latitude').value = lat.toFixed(6);
        document.getElementById('receiver-longitude').value = lng.toFixed(6);
        document.getElementById('receiver-coords').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        document.getElementById('receiver-location-status').style.display = 'block';
    }

    marker.on('dragend', updateReceiverLocation);

    // Update marker on map click
    map.on('click', function (e) {
        marker.setLatLng(e.latlng);
        updateReceiverLocation();
    });

    // Try to get user's location via geolocation API
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 12);
                marker.setLatLng([lat, lng]);
                updateReceiverLocation();
            },
            function (error) {
                console.log('Geolocation denied or error:', error);
                // User will manually select location or search
            }
        );
    }

    // Add search functionality for receiver
    const receiverSearchInput = document.getElementById('receiver-search-input');
    if (receiverSearchInput) {
        receiverSearchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = this.value;
                if (query.trim()) {
                    searchLocation(query, map, marker, function () { updateReceiverLocation(); });
                }
            }
        });
    }
}

// Generic location search function using Nominatim
function searchLocation(query, map, marker, callback) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);

                map.setView([lat, lng], 13);
                marker.setLatLng([lat, lng]);

                if (callback) callback();
            } else {
                alert('❌ Location not found. Try a different search term.');
            }
        })
        .catch(error => {
            console.error('Search error:', error);
            alert('⚠️ Error searching location. Check your internet connection.');
        });
}

// ==================== CHAT WIDGET FUNCTIONS ====================

// Toggle chat widget visibility
function toggleChatWidget() {
    const chatWindow = document.getElementById('chat-window');
    const toggleBtn = document.getElementById('chat-toggle-btn');

    if (chatWindow.style.display === 'none' || !chatWindow.style.display) {
        chatWindow.style.display = 'flex';
        toggleBtn.style.display = 'none';
    } else {
        chatWindow.style.display = 'none';
        toggleBtn.style.display = 'flex';
    }
}

// Handle Enter key press in chat input
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Send chat message to Gemini
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const messagesContainer = document.getElementById('chat-messages');
    const sendBtn = document.querySelector('.chat-send-btn');

    const userMessage = input.value.trim();
    if (!userMessage) return;

    // Add user message to chat
    addChatMessage(userMessage, 'user');
    input.value = '';

    // Disable send button while processing
    sendBtn.disabled = true;

    // Add typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-message bot-message';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(typingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/gemini_chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage })
        });

        const data = await response.json();

        // Remove typing indicator
        document.getElementById('typing-indicator')?.remove();

        if (response.ok && data.success) {
            addChatMessage(data.response, 'bot');
        } else {
            // Show detailed error message
            const errorMsg = data.detail || data.message || 'Sorry, I encountered an error. Please try again.';
            addChatMessage(`❌ ${errorMsg}`, 'bot');
            console.error('API Error:', data);
        }
    } catch (error) {
        console.error('Chat error:', error);
        document.getElementById('typing-indicator')?.remove();
        addChatMessage('⚠️ Connection error. Please check if the backend is running.', 'bot');
    } finally {
        sendBtn.disabled = false;
    }
}

// Add message to chat window
function addChatMessage(text, sender) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender === 'user' ? 'user-message' : 'bot-message'}`;

    const avatar = sender === 'user' ? '👤' : '🤖';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${text.replace(/\n/g, '<br>')}</p>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
