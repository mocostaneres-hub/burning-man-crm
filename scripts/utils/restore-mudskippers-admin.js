/**
 * Restore System Admin Features for Mudskippers Camp
 * 
 * This script ensures the Mudskippers camp account has proper admin access
 */

const mongoose = require('mongoose');

// Inline require models to avoid path issues on Railway
const userSchema = new mongoose.Schema({}, { strict: false });
const campSchema = new mongoose.Schema({}, { strict: false });
const adminSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', userSchema);
const Camp = mongoose.model('Camp', campSchema);
const Admin = mongoose.model('Admin', adminSchema);

async function restoreMudskippersAdmin() {
  try {
    // Connect to MongoDB using environment variable
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable not set');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the Mudskippers camp
    const camp = await Camp.findOne({ 
      $or: [
        { _id: new mongoose.Types.ObjectId('68e43f61a8f6ec1271586306') },
        { name: /mudskippers/i }
      ]
    });
    
    console.log('\n🏕️ CAMP INFO:');
    if (!camp) {
      console.log('  ❌ Mudskippers camp not found!');
      await mongoose.disconnect();
      return;
    }
    
    console.log('  ✅ Found camp:', camp.name);
    console.log('  Camp ID:', camp._id);
    console.log('  Owner ID:', camp.owner);

    // Find the owner user
    const owner = await User.findById(camp.owner);
    console.log('\n👤 OWNER USER INFO:');
    if (!owner) {
      console.log('  ❌ Owner user not found!');
      await mongoose.disconnect();
      return;
    }
    
    console.log('  ✅ Found owner:', owner.email);
    console.log('  Current Account Type:', owner.accountType);
    console.log('  User ID:', owner._id);
    console.log('  campId in user:', owner.campId);

    // Check current account type
    if (owner.accountType === 'admin') {
      console.log('\n  ✅ User already has admin account type!');
    } else {
      console.log('\n  ⚠️  User account type is:', owner.accountType);
      console.log('  🔄 Updating to admin account type...');
      
      owner.accountType = 'admin';
      await owner.save();
      
      console.log('  ✅ Updated account type to admin!');
    }

    // Ensure campId is set
    if (!owner.campId || owner.campId.toString() !== camp._id.toString()) {
      console.log('\n  🔄 Setting campId in user record...');
      owner.campId = camp._id;
      await owner.save();
      console.log('  ✅ campId set to:', camp._id);
    }

    // Check for Admin collection record
    console.log('\n🔐 CHECKING ADMIN RECORD:');
    let adminRecord = await Admin.findOne({ user: owner._id });
    
    if (adminRecord) {
      console.log('  ✅ Admin record exists');
      console.log('  Admin ID:', adminRecord._id);
      console.log('  Role:', adminRecord.role);
      console.log('  Is Active:', adminRecord.isActive);
      
      if (!adminRecord.isActive) {
        console.log('  🔄 Activating admin record...');
        adminRecord.isActive = true;
        await adminRecord.save();
        console.log('  ✅ Admin record activated!');
      }
    } else {
      console.log('  ⚠️  No Admin record found');
      console.log('  🔄 Creating admin record...');
      
      adminRecord = new Admin({
        user: owner._id,
        role: 'super-admin',
        permissions: {
          userManagement: true,
          campManagement: true,
          systemSettings: true,
          analytics: true,
          support: true
        },
        isActive: true,
        createdAt: new Date()
      });
      
      await adminRecord.save();
      console.log('  ✅ Admin record created!');
      console.log('  Admin ID:', adminRecord._id);
    }

    console.log('\n✅ RESTORATION COMPLETE!');
    console.log('\n📋 SUMMARY:');
    console.log('  Camp:', camp.name);
    console.log('  Owner Email:', owner.email);
    console.log('  Account Type:', owner.accountType);
    console.log('  Camp ID:', owner.campId);
    console.log('  Admin Record:', adminRecord ? 'Active' : 'None');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

restoreMudskippersAdmin();

