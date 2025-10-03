# 🚀 G8Road CRM Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All features tested locally
- [ ] No compilation errors
- [ ] Environment variables configured
- [ ] Database connection tested

### 2. Security
- [ ] JWT secret is strong and unique
- [ ] No sensitive data in code
- [ ] Environment variables properly set
- [ ] HTTPS configured

### 3. Domain Setup
- [ ] Domain g8road.com registered
- [ ] DNS configured
- [ ] SSL certificate ready

## 🚀 Deployment Options

### Option 1: Vercel (Easiest) ⭐
**Time**: 15 minutes
**Cost**: Free tier available
**Setup**:
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod`
3. Add environment variables in dashboard
4. Connect domain

### Option 2: Netlify + Railway
**Time**: 30 minutes
**Cost**: Free tier available
**Setup**:
1. Deploy frontend to Netlify
2. Deploy backend to Railway
3. Connect both services

### Option 3: DigitalOcean VPS
**Time**: 1 hour
**Cost**: $5/month
**Setup**:
1. Create droplet
2. Install Node.js/Nginx
3. Deploy manually
4. Setup SSL

## 📋 Environment Variables Needed

### Required:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
NODE_ENV=production
```

### Optional:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
CLOUDINARY_CLOUD_NAME=...
```

## 🔧 Database Setup

### MongoDB Atlas (Recommended):
1. Create account at mongodb.com/cloud
2. Create free cluster
3. Get connection string
4. Add to environment variables

## 🌐 Domain Configuration

### DNS Records:
```
A Record: @ → [Your server IP or Vercel IP]
CNAME: www → g8road.com
```

### SSL:
- Vercel: Automatic
- VPS: Let's Encrypt certificate

## 🚨 Post-Deployment Testing

### Test These Features:
- [ ] User registration/login
- [ ] Camp creation
- [ ] Application submission
- [ ] Task management
- [ ] File uploads (if using Cloudinary)
- [ ] Email notifications (if configured)

## 📊 Monitoring

### Setup:
- [ ] Error tracking (Sentry)
- [ ] Analytics (Google Analytics)
- [ ] Uptime monitoring (UptimeRobot)
- [ ] Database monitoring

## 🔄 Maintenance

### Regular Tasks:
- [ ] Database backups
- [ ] Security updates
- [ ] Performance monitoring
- [ ] User feedback collection

## 🆘 Troubleshooting

### Common Issues:
1. **Environment variables not loading**: Check deployment platform settings
2. **Database connection failed**: Verify MongoDB URI
3. **Build fails**: Check Node.js version compatibility
4. **Domain not working**: Verify DNS propagation (can take 24-48 hours)

## 📞 Support

If you need help with deployment:
1. Check deployment logs
2. Verify environment variables
3. Test database connectivity
4. Review domain DNS settings

---

**Ready to deploy?** Choose your preferred method and follow the detailed guide in `deploy-setup.md`!

