const https = require('https');
const fs = require('fs');
const path = require('path');

// Create a simple self-signed certificate for development
const { execSync } = require('child_process');

// Generate self-signed certificate if it doesn't exist
const certPath = path.join(__dirname, 'localhost.pem');
const keyPath = path.join(__dirname, 'localhost-key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.log('Generating self-signed certificate for HTTPS...');
  try {
    execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/C=US/ST=CA/L=San Francisco/O=G8Road/OU=Development/CN=localhost"`, { stdio: 'inherit' });
    console.log('Certificate generated successfully!');
  } catch (error) {
    console.error('Failed to generate certificate. Please install OpenSSL or try the alternative solution.');
    process.exit(1);
  }
}

// Read the certificate files
const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

// Start HTTPS server
const server = https.createServer(options, (req, res) => {
  // Redirect to the React development server
  res.writeHead(302, {
    'Location': 'http://localhost:3000' + req.url
  });
  res.end();
});

const PORT = 3443;
server.listen(PORT, () => {
  console.log(`HTTPS server running on https://localhost:${PORT}`);
  console.log('This will redirect to your React app on http://localhost:3000');
  console.log('Please update your Google Cloud Console to include:');
  console.log(`https://localhost:${PORT}`);
});
