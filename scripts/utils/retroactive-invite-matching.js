require('dotenv').config();
const mongoose = require('mongoose');
const MemberApplication = require('./server/models/MemberApplication');
const Invite = require('./server/models/Invite');
const User = require('./server/models/User');

async function retroactiveInviteMatching() {
  try {
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Find all applications
    const applications = await MemberApplication.find({})
      .populate('applicant', 'email')
      .lean();
    
    console.log(`📊 Found ${applications.length} total applications`);
    
    let matchedCount = 0;
    let alreadyMatchedCount = 0;
    let noInviteCount = 0;
    
    for (const application of applications) {
      if (!application.applicant || !application.applicant.email) {
        console.log(`⚠️  Skipping application ${application._id} - no applicant email`);
        continue;
      }
      
      const email = application.applicant.email;
      const campId = application.camp;
      
      // Check if this application already has an invite token
      if (application.inviteToken) {
        // Check if invite is already marked as applied
        const invite = await Invite.findOne({ token: application.inviteToken, campId });
        if (invite && invite.status === 'applied') {
          alreadyMatchedCount++;
          continue;
        }
      }
      
      // Find pending or sent invites for this email and camp
      const invites = await Invite.find({
        recipient: email,
        campId: campId,
        status: { $in: ['pending', 'sent'] }
      }).sort({ createdAt: -1 }); // Most recent first
      
      if (invites.length > 0) {
        const invite = invites[0]; // Use most recent invite
        
        console.log(`🎟️  Matching application ${application._id} (${email}) to invite ${invite._id}`);
        
        // Update invite to 'applied' status
        await Invite.updateOne(
          { _id: invite._id },
          {
            $set: {
              status: 'applied',
              appliedBy: application.applicant._id,
              appliedAt: application.appliedAt || application.createdAt
            }
          }
        );
        
        // Update application with invite token if it doesn't have one
        if (!application.inviteToken) {
          await MemberApplication.updateOne(
            { _id: application._id },
            { $set: { inviteToken: invite.token } }
          );
        }
        
        matchedCount++;
        console.log(`✅ Matched! Invite ${invite._id} → Application ${application._id}`);
      } else {
        noInviteCount++;
        console.log(`ℹ️  No pending invite found for ${email} in camp ${campId}`);
      }
    }
    
    console.log('\n📊 Retroactive Matching Complete!');
    console.log(`✅ Newly matched: ${matchedCount}`);
    console.log(`ℹ️  Already matched: ${alreadyMatchedCount}`);
    console.log(`ℹ️  No invite found: ${noInviteCount}`);
    console.log(`📋 Total processed: ${applications.length}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
retroactiveInviteMatching();

