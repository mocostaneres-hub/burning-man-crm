# Reset Application Status for Member

## Problem
Member ID `68e73fc6cf9aaf071e461ea0` was previously removed from the Mudskippers roster before the fix was implemented. Their application status is not in a terminal state, preventing re-application.

## Solution
Use the new admin endpoint to reset their application status to "withdrawn".

---

## Option 1: Using the Test Script (Automated)

1. **Update the script with correct admin credentials:**

Edit `reset-application-status-api.js` and update:
```javascript
const ADMIN_EMAIL = 'your-admin-email@example.com';
const ADMIN_PASSWORD = 'your-admin-password';
```

2. **Run the script:**
```bash
node reset-application-status-api.js
```

---

## Option 2: Using cURL (Manual)

### Step 1: Login as Admin
```bash
curl -X POST https://burning-man-crm-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin-email@example.com",
    "password": "your-admin-password"
  }'
```

**Save the `token` from the response!**

### Step 2: Get the Camp ID

The login response will include the admin user object with a `campId` field. Use this campId in the next step.

Example response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "campId": "68e43f61a8f6ec1271586306",
    ...
  }
}
```

### Step 3: Reset the Application Status

Replace `YOUR_TOKEN` with the token from Step 1, and `CAMP_ID` with the campId from Step 2:

```bash
curl -X PATCH https://burning-man-crm-production.up.railway.app/api/applications/reset/68e73fc6cf9aaf071e461ea0/CAMP_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Option 3: Using Postman or Similar API Client

1. **Login:**
   - Method: `POST`
   - URL: `https://burning-man-crm-production.up.railway.app/api/auth/login`
   - Body (JSON):
     ```json
     {
       "email": "your-admin-email@example.com",
       "password": "your-admin-password"
     }
     ```
   - Copy the `token` and `campId` from response

2. **Reset Application:**
   - Method: `PATCH`
   - URL: `https://burning-man-crm-production.up.railway.app/api/applications/reset/68e73fc6cf9aaf071e461ea0/{campId}`
   - Headers:
     - `Authorization: Bearer {token}`
     - `Content-Type: application/json`

---

## Expected Response

If successful, you should see:
```json
{
  "message": "Reset complete. 1 application(s) updated to withdrawn status.",
  "totalApplications": 1,
  "updatedCount": 1,
  "applications": [
    {
      "_id": "...",
      "status": "withdrawn",
      "appliedAt": "..."
    }
  ]
}
```

---

## Verification

After running the reset:

1. Log in as the member (ID: `68e73fc6cf9aaf071e461ea0`)
2. Navigate to the Mudskippers camp page
3. The "Apply Now" button should be visible and functional
4. Submitting a new application should work without the "already applied" error

---

## Member Details

- **Member ID:** `68e73fc6cf9aaf071e461ea0`
- **Camp:** Mudskippers
- **Issue:** Previous application status preventing re-application
- **Solution:** Reset status to "withdrawn" using admin endpoint

---

## API Endpoint Documentation

**Endpoint:** `PATCH /api/applications/reset/:applicantId/:campId`

**Access:** Admin only

**Purpose:** Reset application status to "withdrawn" for members who were removed from roster before the fix was implemented

**Parameters:**
- `applicantId`: User/Member ID
- `campId`: Camp ID

**Headers:**
- `Authorization: Bearer {admin-token}`

**Response:**
- Summary of applications found
- Count of applications updated
- List of applications with their statuses

