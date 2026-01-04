# CRITICAL: Camp Photo Upload Architecture Issue

## Problem

The `PhotoUpload` component in `CampProfile.tsx` is calling the **wrong API endpoint** for camp photos.

**Current Flow (BROKEN):**
```
User clicks "Change Photo" in CampProfile
    ↓
PhotoUpload component calls apiService.uploadProfilePhoto(file)
    ↓
API request: POST /upload/profile-photo  ← WRONG! This is for USER profile photos
    ↓
Updates user.profilePhoto field  ← WRONG! Should update camp.photos
    ↓
❌ ERROR: Authorization checks fail or wrong data is saved
```

**What SHOULD happen:**
```
User clicks "Change Photo" in CampProfile
    ↓
Component uploads to camp-specific endpoint OR
    ↓
Photo URL added to local state (campData.photos)
    ↓
User clicks "Save"
    ↓
PUT /camps/:campId with photos array
    ↓
✅ Camp photos saved correctly
```

---

## Root Cause

**File:** `client/src/components/profile/PhotoUpload.tsx` (line 62)

```tsx
const response = await apiService.uploadProfilePhoto(file);  ← HARDCODED
```

This component **always** calls the user profile photo endpoint, regardless of context.

---

## Business Requirement

**For camp profile photo upload, authorization must be:**
- ✅ User is authenticated
- ✅ User has access to edit camp profile (camp account OR roster member with edit rights)
- ❌ NOT requiring "Camp Lead role"

---

## Solution Options

### Option A: Make PhotoUpload Context-Aware (RECOMMENDED)

Add a prop to specify the upload context and endpoint:

```tsx
interface PhotoUploadProps {
  profilePhoto?: string;
  photos?: string[];
  onPhotoChange?: (photoUrl: string) => void;
  onPhotosChange?: (photos: string[]) => void;
  isEditing: boolean;
  context?: 'user' | 'camp';  // NEW
  campId?: string;  // NEW (required if context === 'camp')
}

const uploadPhoto = async (file: File) => {
  // ... 
  
  let response;
  if (context === 'camp' && campId) {
    // Upload to camp photos endpoint
    response = await apiService.uploadCampPhoto(campId, file);
  } else {
    // Upload to user profile photo endpoint
    response = await apiService.uploadProfilePhoto(file);
  }
  
  // ...
};
```

### Option B: Create Separate CampPhotoUpload Component

Create a dedicated component for camp photos that uses the correct endpoint.

### Option C: Make Photos Part of Camp Save (SIMPLEST FOR NOW)

Don't upload photos separately - convert to base64 or upload inline when saving camp profile.

---

## Immediate Fix Needed

The `/upload/profile-photo` endpoint should NOT be used for camp photos. We need to:

1. Either use `/upload/camp-photo/:campId` endpoint (requires `requireCampAccount` middleware - already fixed)
2. Or make photos part of the camp profile update (inline with form data)

---

## Current Authorization State

**User Profile Photo Endpoint:** `/upload/profile-photo`
- ✅ Requires: `authenticateToken`
- ✅ Updates: `user.profilePhoto`

**Camp Photo Endpoint:** `/upload/camp-photo/:campId`
- ✅ Requires: `authenticateToken` + `requireCampAccount`
- ✅ Authorization: Camp account (own camp) OR admin
- ✅ Updates: `camp.photos[]`

**Camp Profile Update:** `/camps/:campId` (PUT)
- ✅ Requires: `authenticateToken` + `canAccessCamp`
- ✅ Authorization: Camp account OR roster member (camp-lead, project-lead)
- ✅ Updates: All camp fields including `photos[]`

---

## Recommended Action

**Immediate:** Make `PhotoUpload` component context-aware (Option A)

**Why:** 
- Cleanest solution
- Maintains separation of concerns
- Proper authorization per endpoint
- Reusable component

---

**Status:** ⚠️ CRITICAL BUG - Camp photo upload calls wrong endpoint  
**Impact:** Camp profile editing blocked by authorization error  
**Priority:** HIGH - Blocks core functionality

