# G8Road CRM Deployment Guide

## 🚀 Quick Deployment Steps

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy from your project directory:**
   ```bash
   cd /Users/mauricio/burning-man-crm
   vercel --prod
   ```

4. **Set Environment Variables in Vercel Dashboard:**
   - Go to your project settings
   - Add these environment variables:
     ```
     MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/g8road-crm
     JWT_SECRET=your-super-secret-jwt-key-here
     JWT_EXPIRE=7d
     NODE_ENV=production
     PORT=5001
     
     # OAuth (optional)
     GOOGLE_CLIENT_ID=your-google-client-id
     GOOGLE_CLIENT_SECRET=your-google-client-secret
     
     # Email (optional)
     EMAIL_SERVICE=gmail
     EMAIL_USER=your-email@gmail.com
     EMAIL_PASS=your-app-password
     
     # Cloudinary (optional)
     CLOUDINARY_CLOUD_NAME=your-cloud-name
     CLOUDINARY_API_KEY=your-api-key
     CLOUDINARY_API_SECRET=your-api-secret
     ```

5. **Connect your domain:**
   - In Vercel dashboard, go to Domains
   - Add g8road.com
   - Update DNS records as instructed

### Option 2: Netlify + Railway

#### Frontend (Netlify):
1. Connect your GitHub repo to Netlify
2. Build settings:
   - Build command: `cd client && npm run build`
   - Publish directory: `client/build`
3. Add environment variables:
   ```
   REACT_APP_API_URL=https://your-railway-app.railway.app/api
   ```

#### Backend (Railway):
1. Connect GitHub repo to Railway
2. Add environment variables (same as Vercel)
3. Railway will auto-deploy

### Option 3: DigitalOcean VPS

1. **Create a Droplet** ($5/month):
   - Ubuntu 22.04
   - 1GB RAM, 1 CPU, 25GB SSD

2. **SSH into your server:**
   ```bash
   ssh root@your-server-ip
   ```

3. **Install Node.js and dependencies:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx
   ```

4. **Clone and setup your app:**
   ```bash
   git clone https://github.com/yourusername/g8road-crm.git
   cd g8road-crm
   npm run install-all
   npm run build
   ```

5. **Setup PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name "g8road-crm"
   pm2 startup
   pm2 save
   ```

6. **Setup Nginx reverse proxy:**
   ```bash
   sudo nano /etc/nginx/sites-available/g8road.com
   ```
   
   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name g8road.com www.g8road.com;
       
       location / {
           root /path/to/g8road-crm/client/build;
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:5001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. **Enable the site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/g8road.com /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 🔧 Database Setup

### MongoDB Atlas (Recommended):
1. Create account at mongodb.com/cloud
2. Create a cluster (free tier available)
3. Get connection string
4. Add to environment variables

### Alternative - Railway MongoDB:
1. Add MongoDB service to Railway
2. Get connection string from Railway dashboard

## 📝 Domain Configuration

### For Vercel:
- Add domain in Vercel dashboard
- Update DNS A records to point to Vercel

### For VPS:
- Point your domain's A record to your server IP
- Setup SSL with Let's Encrypt:
  ```bash
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d g8road.com -d www.g8road.com
  ```

## 🚨 Important Notes

1. **Update API URLs**: Make sure your frontend points to the correct backend URL
2. **Environment Variables**: Never commit sensitive data to Git
3. **Database**: Consider upgrading from mock database to MongoDB for production
4. **SSL**: Always use HTTPS in production
5. **Backups**: Setup regular database backups

## 💰 Cost Estimate

- **Vercel**: Free tier (hobby $20/month for custom domains)
- **Netlify + Railway**: Both have generous free tiers
- **DigitalOcean**: $5/month + domain registration
- **MongoDB Atlas**: Free tier available

## 🔄 Continuous Deployment

Once setup, every push to your main branch will automatically deploy!

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```
