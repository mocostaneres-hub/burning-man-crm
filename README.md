# G8Road CRM

A comprehensive web-based CRM system designed specifically for Burning Man camps to manage their rosters, recruit members, manage projects, collaborate with other camps  and build their communities.

## 🌟 Features

### Core Functionality
- **Dual Account System**: Personal and Camp accounts with unique email constraints
- **Camp Management**: Create, edit, and manage camp profiles with photos, social media, and custom signup forms
- **Member Recruitment**: Custom application forms and member management
- **Role-Based Access Control**: Super Admin, Camp Lead, Project Lead, and Camp Member roles
- **Contribution Tracking**: Track work shifts, resources, and member contributions
- **Social Media Integration**: Connect profiles with Instagram, Facebook, Twitter, and more
- **Real-time Communication**: WebSocket support for live updates and messaging

### Account Types
- **Personal Accounts**: Individual burners who can join camps
- **Camp Accounts**: Camps that can manage their roster and recruit members

### Role Hierarchy
1. **Super Admin**: Full system access and back office management
2. **Camp Lead**: Full access to their camp's data and features
3. **Project Lead**: Limited admin access for specific projects within the camp
4. **Camp Member**: Basic access to their own data and camp communications

### Back Office Features
- System-wide analytics and reporting
- User and camp management
- Admin panel with comprehensive controls
- Audit logging and activity monitoring

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd burning-man-crm
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/burning-man-crm
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRE=7d
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   PORT=5000
   NODE_ENV=development
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start both the backend server (port 5000) and frontend development server (port 3000).

## 🏗️ Project Structure

```
burning-man-crm/
├── server/                 # Backend API
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── middleware/        # Custom middleware
│   ├── utils/             # Utility functions
│   └── index.js           # Server entry point
├── client/                # Frontend React app
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
└── package.json           # Root package.json
```

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Socket.io** for real-time features
- **Cloudinary** for image uploads
- **Express Validator** for input validation

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **React Router** for navigation
- **React Hook Form** with Yup validation
- **Axios** for API calls
- **Socket.io Client** for real-time features

## 📱 Mobile App Ready

The API is designed with mobile app compatibility in mind:
- RESTful API architecture
- JWT token-based authentication
- Image upload endpoints
- Real-time WebSocket support
- Comprehensive error handling

## 🎨 Design System

The application features a G8Road-inspired design:
- **Color Palette**: Burning orange (#FF6B35), gold (#FFD700), and dark backgrounds
- **Typography**: Clean, modern fonts with proper hierarchy
- **Components**: Custom-styled Material-UI components
- **Responsive**: Mobile-first design approach

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet.js security headers

## 📊 Database Schema

### Core Models
- **User**: Personal and camp account information
- **Camp**: Camp profiles and settings
- **Member**: Camp membership and role management
- **Admin**: System administration
- **Contributions**: Member contribution tracking
- **Role Changes**: Audit trail for role modifications

## 🚀 Deployment

### Environment Setup
1. Set up MongoDB database
2. Configure Cloudinary for image storage
3. Set environment variables
4. Build the application

### Production Build
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team

## 🔮 Future Features

- Mobile apps (iOS and Android)
- Advanced analytics and reporting
- Integration with G8Road ticketing systems
- Event scheduling and coordination
- Financial tracking and dues management
- Advanced search and filtering
- Push notifications
- Multi-language support

---

**Built with ❤️ for the G8Road community**
