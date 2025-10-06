# Camp Invite Feature

This directory contains the components for the Camp Invite feature, which allows camp administrators to send invitations to potential members via email or SMS.

## Components

### InviteMembersModal
- **Purpose**: Modal for sending invitations to multiple recipients
- **Features**: 
  - Multi-recipient input (comma, space, or newline separated)
  - Email/SMS method selection
  - Real-time template preview
  - Input validation
  - Success/error handling
- **Usage**: Accessible to both members and camp leads

### InviteTemplateEditor
- **Purpose**: Component for editing invitation templates
- **Features**:
  - Separate templates for email and SMS
  - Real-time validation for required placeholders
  - Live preview with sample data
  - Role protection (Camp Leads only)
- **Usage**: Integrated into Camp Profile page

## Integration Points

### Navigation
- Added "Invites" link to camp account navigation
- Only visible to camp accounts

### Routing
- `/camp/invites` - Invite tracking page (Camp Leads only)

### Dashboard
- Added "Invites" tile for camp accounts

### Camp Profile
- Integrated InviteTemplateEditor as a new section

## API Endpoints

- `GET /api/camps/:campId/invites/template` - Get templates
- `PUT /api/camps/:campId/invites/template` - Update templates  
- `POST /api/invites` - Send invitations
- `GET /api/camps/:campId/invites` - Track invitations

## Template Placeholders

Templates must include:
- `{{campName}}` - Replaced with camp name
- `{{link}}` - Replaced with application link

## Mock Integration

The feature works with the existing mock database and logs invitation details to the console for development purposes.
