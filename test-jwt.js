const jwt = require('jsonwebtoken');

// Test JWT generation
const testJWT = () => {
  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    console.log('🔑 JWT Secret exists:', !!process.env.JWT_SECRET);
    console.log('🔑 Using secret:', secret.substring(0, 10) + '...');
    
    const token = jwt.sign({ userId: 123 }, secret, { expiresIn: '7d' });
    console.log('✅ JWT generated successfully');
    console.log('🎫 Token length:', token.length);
    
    // Verify the token
    const decoded = jwt.verify(token, secret);
    console.log('✅ JWT verified successfully');
    console.log('📋 Decoded payload:', decoded);
    
  } catch (error) {
    console.error('❌ JWT Error:', error.message);
  }
};

testJWT();
