const mongoose = require('mongoose');
require('dotenv').config();

// FAQ Schema
const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'General',
      'Account Management',
      'Camp Management',
      'Applications',
      'Tasks',
      'Members',
      'Technical Support',
      'Billing'
    ]
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  audience: {
    type: String,
    required: true,
    enum: ['both', 'camps', 'members', 'homepage'],
    default: 'both'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const FAQ = mongoose.model('FAQ', faqSchema);

// Static FAQ data from the frontend component
const generalFAQData = [
  {
    question: "What is this platform?",
    answer: "This is a comprehensive platform designed to help you find and connect with G8Road camps, discover events and experiences, and build lasting relationships within the burner community. Whether you're looking to join a camp or manage one, we've got you covered.",
    category: "General",
    order: 1
  },
  {
    question: "How do I find camps to join?",
    answer: "Browse our camp directory to discover amazing camps that match your interests, values, and G8Road goals. Each camp profile shows their mission, activities, requirements, and what they're looking for in members.",
    category: "General",
    order: 2
  },
  {
    question: "How do I apply to join a camp?",
    answer: "Once you find a camp you're interested in, you can apply directly through the platform. Share your skills, interests, and what you can contribute to make your application stand out to camp leaders.",
    category: "Applications",
    order: 3
  },
  {
    question: "What information should I include in my application?",
    answer: "Be honest about your G8Road experience, skills you can contribute, availability during the event, and what you're hoping to get out of joining the camp. Include relevant experience with art, cooking, construction, or other valuable skills.",
    category: "Applications",
    order: 4
  },
  {
    question: "How do I create a camp profile?",
    answer: "To create a camp profile, go to your dashboard and click 'Create Camp'. Fill out all the required information including camp name, contact email, and Playa location.",
    category: "Camp Management",
    order: 5
  },
  {
    question: "How do I add members to my camp?",
    answer: "You can add members by going to the 'Manage Members' section in your dashboard. Click 'Add Member' and fill out their information.",
    category: "Camp Management",
    order: 6
  },
  {
    question: "Can I edit my camp profile after creating it?",
    answer: "Yes! You can edit your camp profile at any time by going to 'Your Camp' in the navigation menu.",
    category: "Camp Management",
    order: 7
  },
  {
    question: "How long does it take to hear back from camps?",
    answer: "Response times vary by camp, but most camps try to respond within a few days to a week. If you don't hear back, you can send a follow-up message or apply to other camps that interest you.",
    category: "Applications",
    order: 8
  },
  {
    question: "Can I apply to multiple camps?",
    answer: "Yes! You can apply to multiple camps to increase your chances of finding the right fit. Just be transparent with camps if you're accepted by multiple and need to make a decision.",
    category: "Applications",
    order: 9
  },
  {
    question: "What if I'm new to G8Road?",
    answer: "Many camps welcome newcomers! Look for camps that specifically mention being newbie-friendly or that offer orientation programs. Don't be afraid to mention your new status in applications - enthusiasm and willingness to learn are valuable qualities.",
    category: "General",
    order: 10
  },
  {
    question: "How do I discover events and experiences?",
    answer: "Use our events calendar to find workshops, art installations, performances, and community events happening throughout G8Road week. You can filter by type, time, location, and interests.",
    category: "General",
    order: 11
  },
  {
    question: "How do I contact support?",
    answer: "You can contact our support team using the contact form on the Help page. We typically respond within 24 hours.",
    category: "Technical Support",
    order: 12
  },
  {
    question: "What if I forget my password?",
    answer: "Click 'Forgot your password?' on the login page and enter your email address. We'll send you a link to reset your password.",
    category: "Account Management",
    order: 13
  },
  {
    question: "Is my information secure?",
    answer: "Absolutely. We use industry-standard security practices to protect your information. Your personal details are only shared with camps you choose to apply to, and you control what information is visible.",
    category: "Technical Support",
    order: 14
  }
];

const campFAQData = [
  {
    question: "What is this platform?",
    answer: "This is a comprehensive platform designed specifically for G8Road camps to manage their rosters, recruit members, organize volunteer shifts, handle EAP assignments, and build their community. It's built by burners, for burners.",
    category: "General",
    order: 1
  },
  {
    question: "How is this different from other camp management tools?",
    answer: "Our platform is specifically designed for G8Road camps with features like EAP assignments, orientation calls, mapping tools, and shopping lists. We understand the unique needs of burner communities and have built features that address real camp management challenges.",
    category: "General",
    order: 2
  },
  {
    question: "Can I use this for both personal and camp accounts?",
    answer: "Yes! You can create either a personal account (to join camps as a member) or a camp account (to manage your camp). Each email address can only be used for one account type to maintain clear separation between personal and camp management.",
    category: "Account Management",
    order: 3
  },
  {
    question: "What are the different account types and roles?",
    answer: "We have two account types: Personal (for individual burners) and Camp (for camp management). Within camps, there are three roles: Camp Lead (full administrative access), Project Lead (manages specific projects and team members), and Camp Member (basic access with ability to request role changes).",
    category: "Account Management",
    order: 4
  },
  {
    question: "How do I sign up with Google or Apple?",
    answer: "OAuth sign-in is available for personal accounts only. When you select 'Personal Account' during registration, you'll see Google and Apple sign-in buttons. This allows for quick registration using your existing accounts while maintaining security.",
    category: "Account Management",
    order: 5
  },
  {
    question: "What features are available for camp management?",
    answer: "Camp accounts have access to member roster management, role assignments, volunteer shift scheduling, EAP (Emergency Action Plan) assignments, orientation call scheduling, camp mapping tools, collaborative shopping lists, video meetings, and comprehensive analytics.",
    category: "Camp Management",
    order: 6
  },
  {
    question: "How do volunteer shifts work?",
    answer: "Camp leads can create volunteer shifts for various camp activities (setup, teardown, kitchen duty, etc.). Members can sign up for shifts, and the system tracks participation. This helps ensure fair distribution of camp responsibilities.",
    category: "Camp Management",
    order: 7
  },
  {
    question: "What are EAP assignments?",
    answer: "EAP (Emergency Action Plan) assignments help camps prepare for emergencies by assigning specific roles and responsibilities to members. This includes first aid responders, evacuation coordinators, communication leads, and other critical roles.",
    category: "Camp Management",
    order: 8
  },
  {
    question: "Can I schedule orientation calls for new members?",
    answer: "Yes! Camp leads can schedule orientation calls to onboard new members. The system integrates with video calling platforms to help new members understand camp culture, rules, and expectations before the event.",
    category: "Camp Management",
    order: 9
  },
  {
    question: "How does the mapping feature work?",
    answer: "The mapping feature allows camps to create and share their camp layout, including tent locations, common areas, kitchen setup, and other important landmarks. This helps members navigate the camp and plan their setup.",
    category: "Camp Management",
    order: 10
  },
  {
    question: "Are shopping lists collaborative?",
    answer: "Yes! Camp members can contribute to shared shopping lists for camp supplies, food, equipment, and other necessities. The system tracks who's bringing what to avoid duplication and ensure nothing is forgotten.",
    category: "Camp Management",
    order: 11
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use industry-standard security practices including encrypted data transmission, secure authentication, and regular security audits. Your camp's sensitive information is protected and only accessible to authorized members.",
    category: "Technical Support",
    order: 12
  },
  {
    question: "Can I export my camp data?",
    answer: "Yes, camp leads can export member rosters, shift schedules, and other camp data in various formats (CSV, PDF) for backup purposes or to use with other tools.",
    category: "Camp Management",
    order: 13
  },
  {
    question: "What if I need help or have questions?",
    answer: "We have a comprehensive help system, and our support team is made up of experienced burners who understand camp management challenges. You can reach out through the platform or email us directly.",
    category: "Technical Support",
    order: 14
  },
  {
    question: "Is there a mobile app?",
    answer: "The platform is fully responsive and works great on mobile devices. We're also planning dedicated mobile apps for iOS and Android to provide an even better mobile experience for camp management on the go.",
    category: "Technical Support",
    order: 15
  }
];

const memberFAQData = [
  {
    question: "What is this platform?",
    answer: "This is a community platform designed to help you find and connect with G8Road camps, discover events and experiences, and build lasting relationships within the burner community.",
    category: "General",
    order: 1
  },
  {
    question: "How do I find camps to join?",
    answer: "Browse our camp directory to discover amazing camps that match your interests, values, and G8Road goals. Each camp profile shows their mission, activities, requirements, and what they're looking for in members.",
    category: "General",
    order: 2
  },
  {
    question: "How do I apply to join a camp?",
    answer: "Once you find a camp you're interested in, you can apply directly through the platform. Share your skills, interests, and what you can contribute to make your application stand out to camp leaders.",
    category: "Applications",
    order: 3
  },
  {
    question: "What information should I include in my application?",
    answer: "Be honest about your G8Road experience, skills you can contribute, availability during the event, and what you're hoping to get out of joining the camp. Include any relevant experience with art, cooking, construction, or other valuable skills.",
    category: "Applications",
    order: 4
  },
  {
    question: "How long does it take to hear back from camps?",
    answer: "Response times vary by camp, but most camps try to respond within a few days to a week. If you don't hear back, you can send a follow-up message or apply to other camps that interest you.",
    category: "Applications",
    order: 5
  },
  {
    question: "Can I apply to multiple camps?",
    answer: "Yes! You can apply to multiple camps to increase your chances of finding the right fit. Just be transparent with camps if you're accepted by multiple and need to make a decision.",
    category: "Applications",
    order: 6
  },
  {
    question: "How do I discover events and experiences?",
    answer: "Use our events calendar to find workshops, art installations, performances, and community events happening throughout G8Road week. You can filter by type, time, location, and interests.",
    category: "General",
    order: 7
  },
  {
    question: "Can I message camps directly?",
    answer: "Yes! Our messaging system allows you to communicate directly with camp leaders to ask questions, learn more about their community, and discuss your potential fit with the camp.",
    category: "General",
    order: 8
  },
  {
    question: "What if I'm new to G8Road?",
    answer: "Many camps welcome newcomers! Look for camps that specifically mention being newbie-friendly or that offer orientation programs. Don't be afraid to mention your new status in applications - enthusiasm and willingness to learn are valuable qualities.",
    category: "General",
    order: 9
  },
  {
    question: "How do I know if a camp is right for me?",
    answer: "Read their camp profile thoroughly, check out their social media, and ask questions about their values, activities, and expectations. Consider what you want to contribute and experience during your G8Road week.",
    category: "General",
    order: 10
  },
  {
    question: "Can I create my own events or workshops?",
    answer: "Yes! Once you're part of a camp, you can collaborate with your campmates to create and promote events, workshops, or art projects that you'd like to share with the community.",
    category: "General",
    order: 11
  },
  {
    question: "How do I stay updated on camp activities?",
    answer: "Use our messaging system and calendar features to stay connected with your camp. Camps often share updates about meetings, preparation activities, and event planning through the platform.",
    category: "General",
    order: 12
  },
  {
    question: "What if I need to change my plans?",
    answer: "Life happens! If your situation changes, communicate openly with your camp as soon as possible. Most camps understand that plans can change and will work with you to find solutions.",
    category: "General",
    order: 13
  },
  {
    question: "Is my personal information secure?",
    answer: "Absolutely. We use industry-standard security practices to protect your information. Your personal details are only shared with camps you choose to apply to, and you control what information is visible.",
    category: "Technical Support",
    order: 14
  },
  {
    question: "How do I get help if I have questions?",
    answer: "Use our help center and messaging system to get support. Our team is made up of experienced burners who understand the community and can help guide you through the process.",
    category: "Technical Support",
    order: 15
  }
];

async function migrateFAQs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm');
    console.log('Connected to MongoDB');

    // Find an admin user to use as the creator
    const User = mongoose.model('User', new mongoose.Schema({
      firstName: String,
      lastName: String,
      email: String,
      accountType: String
    }));
    
    const adminUser = await User.findOne({ accountType: 'admin' });
    if (!adminUser) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`Using admin user: ${adminUser.firstName} ${adminUser.lastName}`);

    // Clear existing FAQs
    await FAQ.deleteMany({});
    console.log('Cleared existing FAQs');

    // Migrate general FAQs with homepage audience
    const generalFAQs = generalFAQData.map(faq => ({
      ...faq,
      audience: 'homepage',
      createdBy: adminUser._id
    }));
    await FAQ.insertMany(generalFAQs);
    console.log(`Migrated ${generalFAQs.length} general FAQs with homepage audience`);

    // Migrate camp FAQs with camps audience
    const campFAQs = campFAQData.map(faq => ({
      ...faq,
      audience: 'camps',
      createdBy: adminUser._id
    }));
    await FAQ.insertMany(campFAQs);
    console.log(`Migrated ${campFAQs.length} camp FAQs with camps audience`);

    // Migrate member FAQs with members audience
    const memberFAQs = memberFAQData.map(faq => ({
      ...faq,
      audience: 'members',
      createdBy: adminUser._id
    }));
    await FAQ.insertMany(memberFAQs);
    console.log(`Migrated ${memberFAQs.length} member FAQs with members audience`);

    console.log('FAQ migration completed successfully!');
    
    // Show summary
    const totalFAQs = await FAQ.countDocuments();
    const homepageCount = await FAQ.countDocuments({ audience: 'homepage' });
    const campCount = await FAQ.countDocuments({ audience: 'camps' });
    const memberCount = await FAQ.countDocuments({ audience: 'members' });
    
    console.log('\nSummary:');
    console.log(`Total FAQs: ${totalFAQs}`);
    console.log(`Homepage FAQs: ${homepageCount}`);
    console.log(`Camp FAQs: ${campCount}`);
    console.log(`Member FAQs: ${memberCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateFAQs();
