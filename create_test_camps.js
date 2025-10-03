const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

// Camp themes and data
const campThemes = [
  'Art & Music', 'Food & Drinks', 'Workshop & Education', 'Performance & Theater', 
  'Wellness & Healing', 'Technology & Innovation', 'Community & Social', 'Adventure & Sports',
  'Sustainability & Environment', 'Cultural Exchange', 'Spiritual & Meditation', 'Party & Entertainment',
  'Family & Kids', 'Bike & Transportation', 'Medical & Safety', 'Volunteer & Service',
  'Art Car & Mutant Vehicle', 'Temple & Sacred Space', 'Fire & Pyrotechnics', 'Sound & DJ'
];

const hometowns = [
  'San Francisco, CA', 'Los Angeles, CA', 'Seattle, WA', 'Portland, OR', 'Denver, CO',
  'Austin, TX', 'Chicago, IL', 'New York, NY', 'Boston, MA', 'Miami, FL',
  'Phoenix, AZ', 'Las Vegas, NV', 'Salt Lake City, UT', 'Nashville, TN', 'Atlanta, GA',
  'Minneapolis, MN', 'Detroit, MI', 'Philadelphia, PA', 'Washington, DC', 'Orlando, FL'
];

const playaLocations = [
  '2:00 & A', '3:30 & B', '4:15 & C', '5:45 & D', '6:30 & E',
  '7:15 & F', '8:00 & G', '9:45 & H', '10:30 & I', '11:15 & J',
  '12:00 & K', '1:30 & L', '2:45 & M', '3:15 & N', '4:30 & O'
];

const socialPlatforms = [
  'facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com'
];

// Generate random data
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomOfferings() {
  const offerings = {
    // Infrastructure
    water: Math.random() > 0.3,
    fullPower: Math.random() > 0.7,
    partialPower: Math.random() > 0.5,
    rvPower: Math.random() > 0.8,
    acceptsRVs: Math.random() > 0.7,
    shadeForTents: Math.random() > 0.2,
    showers: Math.random() > 0.6,
    communalKitchen: Math.random() > 0.7,
    storage: Math.random() > 0.8,
    wifi: Math.random() > 0.9,
    ice: Math.random() > 0.4,
    
    // Food & Drink
    food: Math.random() > 0.4,
    coffee: Math.random() > 0.3,
    bar: Math.random() > 0.6,
    snacks: Math.random() > 0.5,
    
    // Activities & Entertainment
    music: Math.random() > 0.2,
    art: Math.random() > 0.3,
    workshops: Math.random() > 0.6,
    performances: Math.random() > 0.7,
    games: Math.random() > 0.5,
    yoga: Math.random() > 0.8,
    meditation: Math.random() > 0.9,
    
    // Services
    bikeRepair: Math.random() > 0.8,
    massage: Math.random() > 0.9,
    hairStyling: Math.random() > 0.9,
    facePainting: Math.random() > 0.8,
    costumeRental: Math.random() > 0.9,
    
    // Community
    sharedSpace: Math.random() > 0.3,
    campfire: Math.random() > 0.6,
    socialEvents: Math.random() > 0.4,
    welcomeNewbies: Math.random() > 0.5,
  };
  return offerings;
}

async function createCampProfiles() {
  const camps = [];
  const loginCredentials = [];
  
  console.log('Creating 20 diverse camp profiles...');
  
  for (let i = 1; i <= 20; i++) {
    const theme = getRandomElement(campThemes);
    const hometown = getRandomElement(hometowns);
    const playaLocation = getRandomElement(playaLocations);
    const burningSince = getRandomNumber(2010, 2023);
    const approximateSize = getRandomNumber(8, 150);
    
    // Generate unique email
    const email = `camp${i.toString().padStart(2, '0')}@burningman.test`;
    const password = `camp${i}pass`;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate camp name based on theme
    const campName = `${theme} Collective`;
    
    // Generate slug
    const slug = `camp-${i}-${theme.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    
    // Generate social media links
    const socialMedia = {};
    if (Math.random() > 0.3) {
      socialMedia.facebook = `https://${getRandomElement(socialPlatforms)}/${campName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }
    if (Math.random() > 0.4) {
      socialMedia.instagram = `https://${getRandomElement(socialPlatforms)}/${campName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }
    
    // Generate descriptions
    const descriptions = {
      short: `${theme} camp bringing amazing experiences to the playa since ${burningSince}.`,
      long: `Welcome to ${campName}! We're a dedicated group of burners passionate about ${theme.toLowerCase()}. Since ${burningSince}, we've been creating unforgettable experiences on the playa. Our camp offers a unique blend of community, creativity, and connection. Join us for an amazing week of ${theme.toLowerCase()} and make memories that will last a lifetime!`
    };
    
    const camp = {
      _id: 2000000 + i,
      campName: campName,
      slug: slug,
      description: descriptions.short,
      bio: descriptions.long,
      theme: theme,
      burningSince: burningSince,
      hometown: hometown,
      contactEmail: email,
      website: Math.random() > 0.7 ? `https://${campName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : undefined,
      socialMedia: socialMedia,
      location: {
        street: playaLocation,
        crossStreet: `Between ${getRandomNumber(2, 10)}:00 & ${getRandomNumber(2, 10)}:30`,
        time: `${getRandomNumber(8, 22)}:00 - ${getRandomNumber(10, 23)}:00`,
        description: `Located at ${playaLocation}, look for our ${theme.toLowerCase()} themed setup!`
      },
      offerings: generateRandomOfferings(),
      approximateSize: approximateSize,
      isPublic: Math.random() > 0.2, // 80% public
      acceptingNewMembers: Math.random() > 0.3, // 70% accepting
      showApplyNow: Math.random() > 0.4, // 60% show apply button
      showMemberCount: Math.random() > 0.3, // 70% show member count
      photos: [
        `https://picsum.photos/800/600?random=${i}`,
        `https://picsum.photos/800/600?random=${i + 100}`,
        `https://picsum.photos/800/600?random=${i + 200}`
      ],
      primaryPhotoIndex: 0,
      status: 'active',
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
      updatedAt: new Date()
    };
    
    // Create user account
    const user = {
      _id: 1000000 + i,
      email: email,
      password: hashedPassword,
      accountType: 'camp',
      campName: campName,
      isActive: true,
      isVerified: true,
      createdAt: camp.createdAt,
      updatedAt: new Date()
    };
    
    camps.push(camp);
    loginCredentials.push({
      'Camp #': i,
      'Camp Name': campName,
      'Theme': theme,
      'Email': email,
      'Password': password,
      'Burning Since': burningSince,
      'Hometown': hometown,
      'Playa Location': playaLocation,
      'Approximate Size': approximateSize,
      'Is Public': camp.isPublic ? 'Yes' : 'No',
      'Accepting Members': camp.acceptingNewMembers ? 'Yes' : 'No',
      'Show Apply Button': camp.showApplyNow ? 'Yes' : 'No',
      'Show Member Count': camp.showMemberCount ? 'Yes' : 'No',
      'Website': camp.website || 'N/A',
      'Facebook': socialMedia.facebook || 'N/A',
      'Instagram': socialMedia.instagram || 'N/A'
    });
    
    console.log(`Created camp ${i}: ${campName} (${theme})`);
  }
  
  return { camps, loginCredentials };
}

async function updateMockDatabase() {
  try {
    const { camps, loginCredentials } = await createCampProfiles();
    
    // Read existing mock data
    const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
    const existingData = JSON.parse(await fs.readFile(mockDataPath, 'utf8'));
    
    // Add new users and camps
    const newUsers = [];
    for (let i = 0; i < camps.length; i++) {
      const hashedPassword = await bcrypt.hash(`camp${i + 1}pass`, 12);
      newUsers.push([
        `camp${(i + 1).toString().padStart(2, '0')}@burningman.test`,
        {
          _id: 1000000 + i + 1,
          email: `camp${(i + 1).toString().padStart(2, '0')}@burningman.test`,
          password: hashedPassword,
          accountType: 'camp',
          campName: camps[i].campName,
          isActive: true,
          isVerified: true,
          createdAt: camps[i].createdAt,
          updatedAt: new Date()
        }
      ]);
    }
    
    const newCamps = camps.map((camp, i) => [
      camp._id.toString(),
      camp
    ]);
    
    // Update the collections
    existingData.users.push(...newUsers);
    existingData.camps.push(...newCamps);
    
    // Update ID counters
    existingData.meta = existingData.meta || {};
    existingData.meta.lastUserId = Math.max(...newUsers.map(u => u[1]._id));
    existingData.meta.lastCampId = Math.max(...newCamps.map(c => c[1]._id));
    
    // Write back to file
    await fs.writeFile(mockDataPath, JSON.stringify(existingData, null, 2));
    
    console.log('\n✅ Successfully created 20 camp profiles!');
    console.log('📊 Login credentials:');
    console.table(loginCredentials);
    
    // Create CSV file
    const csvContent = [
      'Camp #,Camp Name,Theme,Email,Password,Burning Since,Hometown,Playa Location,Approximate Size,Is Public,Accepting Members,Show Apply Button,Show Member Count,Website,Facebook,Instagram',
      ...loginCredentials.map(row => 
        `"${row['Camp #']}","${row['Camp Name']}","${row['Theme']}","${row['Email']}","${row['Password']}","${row['Burning Since']}","${row['Hometown']}","${row['Playa Location']}","${row['Approximate Size']}","${row['Is Public']}","${row['Accepting Members']}","${row['Show Apply Button']}","${row['Show Member Count']}","${row['Website']}","${row['Facebook']}","${row['Instagram']}"`
      )
    ].join('\n');
    
    await fs.writeFile('camp_login_credentials.csv', csvContent);
    console.log('\n📄 CSV file created: camp_login_credentials.csv');
    
    return loginCredentials;
    
  } catch (error) {
    console.error('Error creating camp profiles:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  updateMockDatabase()
    .then(() => {
      console.log('\n🎉 All done! Restart your server to see the new camp profiles.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateMockDatabase, createCampProfiles };
