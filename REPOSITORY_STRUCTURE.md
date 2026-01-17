# Repository Structure

## Overview
This document describes the organized structure of the G8Road CRM repository after cleanup and reorganization.

## Directory Structure

```
burning-man-crm/
├── client/                          # React frontend application
│   ├── src/                         # Source code
│   │   ├── components/              # Reusable UI components
│   │   ├── contexts/                # React contexts (Auth, Socket)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── pages/                   # Page components
│   │   ├── services/                # API service layer
│   │   ├── types/                   # TypeScript type definitions
│   │   └── utils/                   # Frontend utilities
│   ├── public/                      # Static assets
│   └── build/                       # Production build output
│
├── server/                          # Express backend application
│   ├── database/                    # Database adapters and mock data
│   │   ├── databaseAdapter.js       # MongoDB/mock database abstraction
│   │   ├── mockDatabase.js          # Mock database implementation
│   │   └── mockData.json            # Mock data for development
│   ├── middleware/                  # Express middleware
│   │   └── auth.js                  # Authentication & authorization
│   ├── models/                      # Mongoose models
│   ├── routes/                      # API route handlers
│   ├── services/                    # Business logic services
│   │   ├── emailService.js          # Email sending (SendGrid)
│   │   ├── notifications.js         # Notification system
│   │   ├── activityLogger.js        # Activity tracking
│   │   ├── permanentDeletionService.js  # Account deletion
│   │   └── taskNotifications.js     # Task-related notifications
│   ├── startup/                     # Startup scripts
│   │   └── fixCampsMissingOwners.js # Repair script for camp owners
│   ├── utils/                       # Utility functions
│   │   ├── campHelpers.js           # Camp-related utilities
│   │   ├── fieldNameMapper.js       # Field name mapping
│   │   ├── permissionHelpers.js     # Permission checking
│   │   ├── slugGenerator.js         # URL slug generation
│   │   └── taskIdGenerator.js       # Task ID generation
│   └── index.js                     # Server entry point
│
├── docs/                            # Documentation
│   ├── fixes/                       # Bug fix documentation (22 files)
│   │   ├── MUDSKIPPERS_ADMIN_LIST_FIX.md
│   │   ├── CAMP_ADMIN_PHOTO_UPLOAD_FIX.md
│   │   ├── OAUTH_LOGIN_FIX.md
│   │   └── ... (other fix documentation)
│   ├── guides/                      # Implementation guides (14 files)
│   │   ├── QUICK_START.md
│   │   ├── DEVELOPMENT_GUIDELINES.md
│   │   ├── SENDGRID_SETUP.md
│   │   └── ... (other guides)
│   ├── deployment/                  # Deployment documentation (7 files)
│   │   ├── DEPLOYMENT_CHECKLIST.md
│   │   ├── RAILWAY_DEPLOY_TRIGGER.md
│   │   └── ... (other deployment docs)
│   └── *.md                         # High-level documentation
│       ├── IMPLEMENTATION_SUMMARY.md
│       ├── PERMISSION_AUDIT_REPORT.md
│       ├── VERIFICATION_COMPLETE.md
│       └── ... (other summaries)
│
├── scripts/                         # Utility and maintenance scripts
│   ├── migrations/                  # Database migration scripts (14 files)
│   │   ├── migrate-add-campid.js
│   │   ├── migrate-faqs-to-database.js
│   │   ├── migrate-url-slugs.js
│   │   └── ... (other migrations)
│   ├── tests/                       # Test scripts and test utilities (40 files)
│   │   ├── test-login.js
│   │   ├── test-api-endpoints.js
│   │   ├── check-mongo-users.js
│   │   └── ... (other tests)
│   ├── utils/                       # Utility scripts (37 files)
│   │   ├── fix-duplicate-users.js
│   │   ├── repair-camp-owners.js
│   │   ├── create-admin.js
│   │   └── ... (other utilities)
│   └── maintenance/                 # Shell scripts for maintenance (9 files)
│       ├── start-servers.sh
│       ├── restart-dev-servers.sh
│       ├── build-production.sh
│       └── ... (other shell scripts)
│
├── data/                            # Data files and exports
│   ├── burningman_2025_camps.csv
│   ├── camp_login_credentials.csv
│   ├── mock-users.csv
│   ├── migration.log
│   └── extract-burning-man-emails.py
│
├── package.json                     # Node.js dependencies and scripts
├── README.md                        # Main project README
├── env.example                      # Environment variables template
├── Procfile                         # Heroku/Railway process file
├── railway.json                     # Railway deployment config
├── nixpacks.toml                    # Nixpacks build config
├── vercel.json                      # Vercel deployment config
└── requirements.txt                 # Python dependencies (if any)
```

## Key Files and Their Purpose

### Root Configuration Files
- **package.json** - Node.js project metadata, dependencies, and npm scripts
- **env.example** - Template for environment variables (copy to .env)
- **Procfile** - Defines process types for Railway/Heroku deployment
- **railway.json** - Railway-specific deployment configuration
- **nixpacks.toml** - Build configuration for Railway Nixpacks
- **vercel.json** - Vercel deployment configuration (if using Vercel)

### Server Entry Points
- **server/index.js** - Main Express server entry point
- **server/routes/** - All API endpoint definitions
- **server/models/** - Mongoose schema definitions

### Client Entry Points
- **client/src/index.tsx** - React application entry point
- **client/src/App.tsx** - Root React component
- **client/public/index.html** - HTML template

## NPM Scripts

Available commands (from package.json):

```bash
npm run dev           # Start both server and client in development mode
npm run server        # Start backend server only (with nodemon)
npm run client        # Start frontend client only
npm run build         # Build production frontend
npm run start         # Start production server
npm run install-all   # Install dependencies for both client and server
```

## Documentation Categories

### Fixes (`docs/fixes/`)
Contains detailed documentation of bugs that were fixed, including:
- Root cause analysis
- Code changes
- Verification steps
- 22 documented fixes covering authentication, authorization, photo uploads, routing, etc.

### Guides (`docs/guides/`)
Step-by-step implementation guides including:
- Quick start guide
- OAuth setup (Google)
- SendGrid email configuration
- Development guidelines
- Theme and styling guides

### Deployment (`docs/deployment/`)
Deployment-related documentation:
- Deployment checklists
- Railway configuration
- Production debugging
- Environment setup

## Scripts Organization

### Migrations (`scripts/migrations/`)
Database schema migrations and data transformations:
- Camp ID migrations
- FAQ migrations
- URL slug generation
- Application status updates

### Tests (`scripts/tests/`)
Test scripts for various features:
- Authentication tests
- API endpoint tests
- Roster system tests
- Profile update tests

### Utils (`scripts/utils/`)
One-off utility scripts:
- Data fixes (duplicate users, roster issues)
- Account management (create admins, reset passwords)
- Data generation (mock users, test camps)

### Maintenance (`scripts/maintenance/`)
Shell scripts for development workflow:
- Server startup scripts
- Build scripts
- Environment setup scripts

## Data Files (`data/`)

Contains CSV exports, logs, and data scripts:
- Camp data exports
- Login credentials (for development)
- Migration logs
- Email extraction scripts

## Development Workflow

1. **Initial Setup**:
   ```bash
   npm run install-all
   cp env.example .env
   # Edit .env with your configuration
   ```

2. **Development**:
   ```bash
   npm run dev  # Starts both frontend and backend
   ```

3. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

4. **Running Migrations**:
   ```bash
   node scripts/migrations/migrate-<migration-name>.js
   ```

5. **Running Tests**:
   ```bash
   node scripts/tests/test-<test-name>.js
   ```

## Important Notes

### Server Routes
All backend API routes are in `server/routes/`. Key routes include:
- **auth.js** - Authentication (login, register)
- **camps.js** - Camp management
- **rosters.js** - Roster management
- **applications.js** - Member applications
- **admin.js** - Admin operations

### Database Abstraction
The `server/database/databaseAdapter.js` provides an abstraction layer that supports both:
- MongoDB (production)
- Mock database (development)

### Authentication
Authentication is handled in `server/middleware/auth.js` with multiple strategies:
- JWT tokens
- Google OAuth
- Apple OAuth (configured)

### Email Service
Email notifications use SendGrid via `server/services/emailService.js`. Configuration is in environment variables.

## Cleanup Summary

**Files Reorganized**: ~140+ files moved into organized directories
**Documentation**: 60+ markdown files organized into logical categories
**Scripts**: 90+ scripts organized by purpose (migrations, tests, utils)
**No Files Deleted**: All files preserved, just reorganized for better maintainability

## Verification

All imports and references have been verified. No code changes were made to:
- Server routes or models
- Client components or pages
- Service files or utilities

The reorganization only moved:
- Documentation files → `docs/`
- Script files → `scripts/`
- Data files → `data/`

No runtime behavior was changed.


