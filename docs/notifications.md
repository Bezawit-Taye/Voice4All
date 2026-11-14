# Voice4All — Multi-Channel Notification Integration Architecture (Phase 3)

## 1. Overview and Accessibility Rationale

Many learners and jobseekers across Africa and developing regions navigate internet connectivity constraints, expensive cellular data bundles, or reliance on basic mobile devices. The **Voice4All Notification Service** (`backend/src/services/notification.service.js`) addresses these accessibility hurdles through two complementary, low-bandwidth communication channels:

1. **Telegram Bot Channel:** Delivers structured, screen-reader optimized career alerts directly to learner mobile apps or desktop clients with minimal data consumption.
2. **SMS-Compatible Interface:** Formats single-segment, 160-character cellular SMS alerts that work across every feature phone without requiring smartphones, active mobile data, or third-party app installations.

---

## 2. Notification Architecture & Channel Comparison

```mermaid
flowchart TD
    A[New Accessible Opportunity Posted or Learner Alert Triggered] --> B{Notification Dispatcher}
    
    B -->|Channel: Telegram| C[Format Screen-Reader Markdown Alert]
    C --> D{TELEGRAM_BOT_TOKEN in .env?}
    D -->|Yes| E[Dispatch via https://api.telegram.org]
    D -->|No| F[Return Honest Failure & Formatted Preview]
    
    B -->|Channel: SMS| G[Format 160-char GSM-7 / UCS-2 Segment]
    G --> H{Cellular Provider Credentials in .env?}
    H -->|Twilio / Africa's Talking| I[Dispatch to Carrier Network]
    H -->|None (Default)| J[Simulated SMS Adapter: Validates & Logs Delivery]
```

### Channel Technical Specifications

| Parameter | Telegram Channel | SMS Cellular Channel |
| :--- | :--- | :--- |
| **Primary Audience** | Learners with smartphones or laptops; screen reader users | Learners in low-connectivity areas; feature-phone users |
| **Payload Format** | MarkdownV2 with semantic emojis and bulleted hierarchy | Concise plain text with short URLs and opt-out commands |
| **Character Limits** | 4,096 characters | **160 characters** (GSM-7) or **70 characters** (UCS-2 Unicode) |
| **Data Requirement** | Low (few kilobytes) | **Zero mobile data** (cellular voice/SMS network) |
| **Screen-Reader Optimization** | Heading anchors and itemized lists | Clear subject tag `[Voice4All Job]` and direct links |

---

## 3. Telegram Bot Integration Specification

### 3.1 Bot Setup & Configuration
- Set `TELEGRAM_BOT_TOKEN` in `backend/.env` (obtained from `@BotFather`).
- Optional `TELEGRAM_BOT_USERNAME` (e.g. `@Voice4AllJobsBot`).
- When the token is absent or invalid, the service **strictly prevents false delivery claims** and returns an explicit `TELEGRAM_BOT_UNAVAILABLE` status.

### 3.2 Subscription Endpoint
`POST /api/career/notifications/telegram/subscribe`

```json
{
  "chatId": "987654321",
  "username": "AmaraVA",
  "language": "en",
  "preferences": {
    "types": ["remote", "fulltime"],
    "accessibleOnly": true
  }
}
```

### 3.3 Broadcast / Alert Dispatch Endpoint
`POST /api/career/notifications/telegram/broadcast`

#### Request Payload
```json
{
  "jobId": "v4a-job-001",
  "chatId": "987654321"
}
```

#### Successful Live Delivery (`200 OK` with active token)
```json
{
  "success": true,
  "deliveryStatus": "delivered",
  "deliveryAvailable": true,
  "isLiveDelivery": true,
  "messageId": 412,
  "targetChatId": "987654321",
  "timestamp": "2026-11-14T13:30:00.000Z"
}
```

#### Honest Failure Response (`200 OK` when token is unavailable)
```json
{
  "success": false,
  "deliveryStatus": "unavailable",
  "deliveryAvailable": false,
  "isLiveDelivery": false,
  "error": "TELEGRAM_BOT_UNAVAILABLE",
  "message": "Telegram delivery unavailable: TELEGRAM_BOT_TOKEN is not configured in .env. Real message was not transmitted to Telegram servers.",
  "formattedMessage": "🔔 *Voice4All Accessible Career Alert*\n\n💼 *Role:* Executive Virtual Assistant...",
  "instructions": "To enable live delivery, register a bot with @BotFather and set TELEGRAM_BOT_TOKEN in your backend .env."
}
```

---

## 4. SMS-Compatible Notification Interface Specification

### 4.1 160-Character Segment Constraint Policy
Standard cellular SMS operates on 140-byte transmission units:
- **GSM-7 Encoding (English):** Up to 160 characters per single SMS message segment. Messages exceeding 160 characters split into multi-part concatenated segments, increasing carrier costs and delivery latency.
- **UCS-2 Encoding (Amharic / Ethiopic Unicode):** 16-bit encoding limits each SMS segment to 70 characters.

Voice4All implements a deterministic segment calculator and compression engine ensuring all standard job alerts fit within targeted limits:

#### English Compressed Template (≤ 160 chars)
```text
[Voice4All Job] Executive Virtual Ass... at AfriTech. Screen-reader ok. Remote. Apply/Draft: v4a.alx/j/v4a-job-001 Msg STOP to unsub
```
*Length: 132 characters (1 segment).*

#### Amharic Template (UCS-2)
```text
[Voice4All] ዋና ሥራ አስፈጻሚ ቨርቹዋል ረዳት (አፍሪቴክ)። የርቀት ሥራ። ስክሪን አንባቢ ይደገፋል። ዝርዝር: v4a.alx/j/v4a-job-001 ማቆም: STOP
```
*Length: 106 characters (2 segments).*

### 4.2 SMS Endpoints

#### Preview & Segment Calculation: `POST /api/career/notifications/sms/preview`
```json
{
  "jobId": "v4a-job-001",
  "lang": "en"
}
```
**Response:**
```json
{
  "success": true,
  "jobId": "v4a-job-001",
  "language": "en",
  "provider": "SimulatedSmsAdapter",
  "isLiveConfigured": false,
  "text": "[Voice4All Job] Executive Virtual Ass... at AfriTech. Screen-reader ok. Remote. Apply/Draft: v4a.alx/j/v4a-job-001 Msg STOP to unsub",
  "charCount": 132,
  "maxPerSegment": 160,
  "segments": 1,
  "isSingleSegment": true,
  "encoding": "GSM-7 (Standard English)",
  "complianceNotice": "Compliant with standard single-segment 160-character limit."
}
```

#### Phone Subscription: `POST /api/career/notifications/sms/subscribe`
```json
{
  "phoneNumber": "+251911223344",
  "language": "am"
}
```

#### Dispatch / Test Send: `POST /api/career/notifications/sms/send`
```json
{
  "jobId": "v4a-job-001",
  "phoneNumber": "+251911223344",
  "lang": "en"
}
```
**Response (Simulated Adapter):**
```json
{
  "success": true,
  "messageId": "SMS-1794659200-842",
  "phoneNumber": "+251911223344",
  "deliveryStatus": "simulated_adapter_delivery",
  "isLiveDelivery": false,
  "provider": "SimulatedSmsAdapter",
  "disclaimer": "SIMULATED DELIVERY: No live SMS credentials found in .env. Alert was formatted and validated against carrier constraints, but no cellular transmission occurred.",
  "segmentCount": 1,
  "messageText": "[Voice4All Job] Executive Virtual Ass... at AfriTech. Screen-reader ok. Remote. Apply/Draft: v4a.alx/j/v4a-job-001 Msg STOP to unsub"
}
```

---

## 5. Carrier Integration Adapter Architecture

The `NotificationService` features a pluggable carrier interface:

```javascript
const adapter = getSmsProviderConfig();
// Evaluates in order:
// 1. Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
// 2. Africa's Talking (AFRICASTALKING_USERNAME, AFRICASTALKING_API_KEY)
// 3. SimulatedSmsAdapter (Default fallback with honest simulation labeling)
```

Production teams can plug in active Twilio or Africa's Talking credentials without changing route or controller contracts.
