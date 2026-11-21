# 🛡️ SENTINAL – Smart Personal Safety & Emergency Response System

**SENTINAL** is an integrated personal safety and emergency-response ecosystem designed to protect individuals through wearable technology, real-time location tracking, automated emergency alerts, and centralized monitoring.

The project combines a **touch-activated ESP32 SOS safety bracelet** with **SafeWalk**, an installable Progressive Web Application (PWA), to create a connected safety platform that helps individuals request assistance, share their live journeys, and receive timely emergency support.

Unlike conventional safety applications that depend entirely on users manually activating an emergency button, SENTINAL introduces proactive journey monitoring. If a user fails to confirm their safe arrival within the expected time, the system automatically generates a missed check-in alert and notifies the monitoring system.

The platform also includes a dedicated police monitoring dashboard, email notifications, journey tracking, and an integrated drug-prevention awareness chatbot developed under the **TOOFAN initiative**.

## 🚀 Key Features

### 1. Smart SOS Safety Bracelet
- ESP32-based wearable emergency alert device.
- Touch-activated SOS trigger for quick emergency reporting.
- GPS-based location sharing.
- Secure HTTPS communication with the central backend.
- Incident status monitoring and police acknowledgement feedback.
- Designed to request assistance without requiring the user to unlock their smartphone.

### 2. SafeWalk – Smart Journey Tracking
- Installable Progressive Web App (PWA).
- User registration and authentication.
- Start and monitor a safe journey.
- Real-time GPS location updates every 15 seconds.
- Live route visualization using Leaflet and OpenStreetMap.
- Customizable journey duration and destination.
- Safe arrival confirmation.
- Journey extension functionality.
- One-second press-and-hold SOS activation.
- Automatic missed check-in detection with server-side deadline enforcement.

### 3. Automated Emergency Response
- Automatically generates emergency incidents when a journey expires without confirmation.
- Sends email notifications to registered users.
- Provides Google Maps location links when GPS coordinates are available.
- Tracks emergency status: ACTIVE, ACKNOWLEDGED, and CANCELLED.
- Displays police acknowledgement on the user's device.
- Server-side monitoring continues even when the user's phone is locked or offline.

### 4. Police Monitoring Dashboard
- Centralized emergency monitoring interface.
- Real-time incident updates with automatic refresh.
- Live emergency statistics and status cards.
- Incoming SOS alert notifications.
- Incident acknowledgement functionality.
- Interactive map displaying user locations.
- Live journey tracking and route visualization.
- Incident history with search and filtering.
- Emergency sound notifications.
- Test SOS functionality for system verification.

### 5. Scheduled Trip Management
- Schedule journeys in advance.
- Select departure time, travel duration, and destination.
- Automated trip reminders.
- In-app notifications, vibration, and system notifications.
- Email reminders through server-side scheduling.
- Start scheduled journeys manually with one tap.

### 6. SENTINAL Assistant – Drug Prevention Chatbot
An integrated educational chatbot designed to support the project's social-awareness initiative.

Topics include:
- Drug abuse awareness and addiction prevention.
- Understanding the risks of common substances.
- Peer pressure and strategies to say no.
- Recognizing warning signs of substance abuse.
- Helping friends and supporting recovery.
- Overdose awareness and emergency first aid.
- Drug-related legal awareness.
- Personal safety and safe travel practices.
- Operation TOOFAN awareness.

The chatbot operates directly in the browser without requiring an external API key.

## 🏗️ System Architecture

SENTINAL uses a centralized architecture that connects the wearable device, smartphone application, cloud backend, database, and police dashboard.

**System workflow:**

1. The ESP32 bracelet or SafeWalk application generates an emergency or journey event.
2. The event is transmitted securely to the Google Apps Script backend.
3. The backend validates the request and processes the action.
4. Emergency and journey information is stored in Google Sheets.
5. Automated email notifications are triggered when required.
6. The police dashboard retrieves and displays updated information.
7. Police acknowledgement is communicated back to the user.

## 🛠️ Technologies Used

| Category | Technologies |
|---|---|
| Microcontroller | ESP32 |
| Programming | C++, JavaScript |
| Web Development | HTML5, CSS3, JavaScript |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Hosting | Netlify |
| Maps | Leaflet.js, OpenStreetMap |
| Location Tracking | GPS, Geolocation API |
| PWA | Service Workers, Web App Manifest |
| Notifications | MailApp, Browser Notifications |
| Security | Session Tokens, SHA-256, Secret Validation |
| Automation | Apps Script Time-Based Triggers |

## 🗄️ Database Structure

The system uses a centralized Google Sheets database consisting of five primary data tables:

- **Users:** Account information and authentication records.
- **SOS Incidents:** Emergency alerts, incident status, and location details.
- **Journeys:** Journey information, expected arrival, and current status.
- **Journey Points:** GPS coordinates recorded during journey tracking.
- **Trips:** Scheduled journeys and reminder information.

## 🔐 Security & Reliability

- Separate authentication secrets for the wearable and smartphone application.
- Password hashing with salted SHA-256.
- Session-based authentication with expiration.
- Server-side journey deadline verification.
- Script locking to protect concurrent database operations.
- Input sanitization to reduce formula injection risks.
- Safe DOM rendering to reduce cross-site scripting risks.
- Graceful handling of email delivery failures.
- Offline-tolerant PWA architecture.

## 🌍 Social Impact

SENTINAL is developed with the vision of making personal safety more accessible through affordable technology.

By combining wearable emergency activation, journey monitoring, automated escalation, and drug-prevention education, the project aims to address multiple aspects of personal safety.

The integration of the TOOFAN awareness initiative further extends the project beyond emergency response by promoting education, prevention, and responsible decision-making.

## 🔮 Future Enhancements

- Native Android application with reliable background GPS tracking.
- Push notifications and multiple trusted emergency contacts.
- Malayalam language support.
- Enhanced police authentication and access control.
- Stronger password hashing algorithms.
- AI-powered safety and awareness assistant.
- Emergency hotspot visualization and analytics.
- Unified live-location synchronization between the bracelet and smartphone.
- Improved wearable hardware integration.

## ⚠️ Disclaimer

SENTINAL is an educational prototype developed for demonstration and research purposes. It is not an officially deployed emergency-response service and does not replace emergency services such as India's **112 emergency helpline**.

GPS accuracy, internet connectivity, browser permissions, and email delivery can affect system performance. The current prototype requires further security hardening and real-world validation before operational deployment.

## 👨‍💻 Project Vision

**One Touch. One Journey. One Connected Safety System.**

SENTINAL aims to transform personal safety from a reactive emergency button into a proactive, connected safety ecosystem.

*Designed and developed with the vision of using Robotics, IoT, and Web Technologies to build a safer and more connected society.*
