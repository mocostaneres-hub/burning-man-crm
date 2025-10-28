const db = require('./server/database/databaseAdapter');

// FAQ data to add
const faqData = [
  {
    question: "What is this platform?",
    answer: "This is a comprehensive platform designed to help you find and connect with G8Road camps, discover events and experiences, and build lasting relationships within the burner community. Whether you're looking to join a camp or manage one, we've got you covered.",
    category: "General",
    order: 1,
    audience: "homepage"
  },
  {
    question: "How do I find camps to join?",
    answer: "Browse our camp directory to discover amazing camps that match your interests, values, and G8Road goals. Each camp profile shows their mission, activities, requirements, and what they're looking for in members.",
    category: "General",
    order: 2,
    audience: "homepage"
  },
  {
    question: "How do I apply to join a camp?",
    answer: "Once you find a camp you're interested in, you can apply directly through the platform. Share your skills, interests, and what you can contribute to make your application stand out to camp leaders.",
    category: "Applications",
    order: 3,
    audience: "homepage"
  },
  {
    question: "What information should I include in my application?",
    answer: "Be honest about your G8Road experience, skills you can contribute, availability during the event, and what you're hoping to get out of joining the camp. Include relevant experience with art, cooking, construction, or other valuable skills.",
    category: "Applications",
    order: 4,
    audience: "homepage"
  },
  {
    question: "How do I create a camp profile?",
    answer: "To create a camp profile, go to your dashboard and click 'Create Camp'. Fill out all the required information including camp name, contact email, and Playa location.",
    category: "Camp Management",
    order: 5,
    audience: "homepage"
  },
  {
    question: "How do I add members to my camp?",
    answer: "You can add members by going to the 'Manage Members' section in your dashboard. Click 'Add Member' and fill out their information.",
    category: "Camp Management",
    order: 6,
    audience: "homepage"
  },
  {
    question: "Can I edit my camp profile after creating it?",
    answer: "Yes! You can edit your camp profile at any time by going to 'Your Camp' in the navigation menu.",
    category: "Camp Management",
    order: 7,
    audience: "homepage"
  },
  {
    question: "How long does it take to hear back from camps?",
    answer: "Response times vary by camp, but most camps try to respond within a few days to a week. If you don't hear back, you can send a follow-up message or apply to other camps that interest you.",
    category: "Applications",
    order: 8,
    audience: "homepage"
  },
  {
    question: "Can I apply to multiple camps?",
    answer: "Yes! You can apply to multiple camps to increase your chances of finding the right fit. Just be transparent with camps if you're accepted by multiple and need to make a decision.",
    category: "Applications",
    order: 9,
    audience: "homepage"
  },
  {
    question: "What if I'm new to G8Road?",
    answer: "Many camps welcome newcomers! Look for camps that specifically mention being newbie-friendly or that offer orientation programs. Don't be afraid to mention your new status in applications - enthusiasm and willingness to learn are valuable qualities.",
    category: "General",
    order: 10,
    audience: "homepage"
  },
  {
    question: "How do I discover events and experiences?",
    answer: "Use our events calendar to find workshops, art installations, performances, and community events happening throughout G8Road week. You can filter by type, time, location, and interests.",
    category: "General",
    order: 11,
    audience: "homepage"
  },
  {
    question: "How do I contact support?",
    answer: "You can contact our support team using the contact form on the Help page. We typically respond within 24 hours.",
    category: "Technical Support",
    order: 12,
    audience: "homepage"
  },
  {
    question: "What if I forget my password?",
    answer: "Click 'Forgot your password?' on the login page and enter your email address. We'll send you a link to reset your password.",
    category: "Account Management",
    order: 13,
    audience: "homepage"
  },
  {
    question: "Is my information secure?",
    answer: "Absolutely. We use industry-standard security practices to protect your information. Your personal details are only shared with camps you choose to apply to, and you control what information is visible.",
    category: "Technical Support",
    order: 14,
    audience: "homepage"
  }
];

async function addFAQs() {
  try {
    console.log('🚀 Adding FAQs directly to mock database...');
    
    // Get admin user ID
    const adminUser = await db.findUser({ email: 'mudskipperscafe@gmail.com' });
    if (!adminUser) {
      console.error('❌ Admin user not found');
      return;
    }
    
    console.log('👤 Using admin user:', adminUser.firstName, adminUser.lastName);
    
    // Add each FAQ
    let successCount = 0;
    for (const faq of faqData) {
      try {
        const faqWithCreator = {
          ...faq,
          createdBy: adminUser._id
        };
        
        const createdFAQ = await db.createFAQ(faqWithCreator);
        console.log(`✅ Created FAQ: ${faq.question.substring(0, 50)}...`);
        successCount++;
      } catch (error) {
        console.log(`❌ Failed to create FAQ: ${faq.question.substring(0, 50)}... - ${error.message}`);
      }
    }
    
    console.log(`\n📊 Summary: Created ${successCount} out of ${faqData.length} FAQs`);
    
    // Verify the FAQs were added
    const allFAQs = await db.findFAQs();
    const homepageFAQs = allFAQs.filter(faq => faq.audience === 'homepage');
    
    console.log(`📋 Total FAQs in database: ${allFAQs.length}`);
    console.log(`🏠 Homepage FAQs: ${homepageFAQs.length}`);
    
    console.log('\n🎉 FAQ migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addFAQs();
