const db = require('./server/database/databaseAdapter');
const bcrypt = require('bcryptjs');

async function debugLogin() {
  try {
    console.log('🔍 Debugging login...');
    
    // Find user
    const user = await db.findUser({ email: 'mudskipperscafe@gmail.com' });
    console.log('👤 User found:', !!user);
    if (user) {
      console.log('📧 Email:', user.email);
      console.log('🔐 Password hash:', user.password);
      console.log('👑 Account type:', user.accountType);
      console.log('✅ Is active:', user.isActive);
      
      // Test password comparison
      const testPassword = 'weh0809';
      console.log('🔑 Testing password:', testPassword);
      
      const isValid = await db.comparePassword(user, testPassword);
      console.log('✅ Password valid:', isValid);
      
      if (!isValid) {
        // Try to hash the password and compare manually
        console.log('🔍 Manual password test...');
        const manualTest = await bcrypt.compare(testPassword, user.password);
        console.log('✅ Manual test result:', manualTest);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugLogin();
