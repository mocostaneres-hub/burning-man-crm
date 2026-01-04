const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

async function fixCampData() {
  try {
    // Read existing mock data
    const mockDataPath = path.join(__dirname, 'server', 'database', 'mockData.json');
    const existingData = JSON.parse(await fs.readFile(mockDataPath, 'utf8'));
    
    console.log('Current data structure:');
    console.log('Users:', existingData.users.length);
    console.log('Camps:', existingData.camps.length);
    
    // Generate 20 new camp profiles
    const newUsers = [];
    const newCamps = [];
    
    for (let i = 1; i <= 20; i++) {
      const theme = [
        'Art & Music', 'Food & Drinks', 'Workshop & Education', 'Performance & Theater', 
        'Wellness & Healing', 'Technology & Innovation', 'Community & Social', 'Adventure & Sports',
        'Sustainability & Environment', 'Cultural Exchange', 'Spiritual & Meditation', 'Party & Entertainment',
        'Family & Kids', 'Bike & Transportation', 'Medical & Safety', 'Volunteer & Service',
        'Art Car & Mutant Vehicle', 'Temple & Sacred Space', 'Fire & Pyrotechnics', 'Sound & DJ'
      ][i - 1];
      
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
      
      const email = `camp${i.toString().padStart(2, '0')}@burningman.test`;
      const password = `camp${i}pass`;
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const campName = `${theme} Collective`;
      const slug = `camp-${i}-${theme.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      // Create user
      const user = [
        email,
        {
          _id: 1000000 + i,
          email: email,
          password: hashedPassword,
          accountType: 'camp',
          campName: campName,
          isActive: true,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Create camp
      const camp = [
        (2000000 + i).toString(),
        {
          _id: 2000000 + i,
          campName: campName,
          slug: slug,
          description: `${theme} camp bringing amazing experiences to the playa since ${2010 + i}.`,
          bio: `Welcome to ${campName}! We're a dedicated group of burners passionate about ${theme.toLowerCase()}. Since ${2010 + i}, we've been creating unforgettable experiences on the playa.`,
          theme: theme,
          burningSince: 2010 + i,
          hometown: hometowns[i - 1],
          contactEmail: email,
          website: Math.random() > 0.7 ? `https://${campName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : undefined,
          socialMedia: {
            facebook: Math.random() > 0.5 ? `https://facebook.com/${campName.toLowerCase().replace(/[^a-z0-9]/g, '')}` : undefined,
            instagram: Math.random() > 0.5 ? `https://instagram.com/${campName.toLowerCase().replace(/[^a-z0-9]/g, '')}` : undefined
          },
          location: {
            street: playaLocations[i - 1],
            crossStreet: `Between ${2 + (i % 8)}:00 & ${2 + (i % 8)}:30`,
            time: `${8 + (i % 14)}:00 - ${10 + (i % 13)}:00`,
            description: `Located at ${playaLocations[i - 1]}, look for our ${theme.toLowerCase()} themed setup!`
          },
          offerings: {
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
            food: Math.random() > 0.4,
            coffee: Math.random() > 0.3,
            bar: Math.random() > 0.6,
            snacks: Math.random() > 0.5,
            music: Math.random() > 0.2,
            art: Math.random() > 0.3,
            workshops: Math.random() > 0.6,
            performances: Math.random() > 0.7,
            games: Math.random() > 0.5,
            yoga: Math.random() > 0.8,
            meditation: Math.random() > 0.9,
            bikeRepair: Math.random() > 0.8,
            massage: Math.random() > 0.9,
            hairStyling: Math.random() > 0.9,
            facePainting: Math.random() > 0.8,
            costumeRental: Math.random() > 0.9,
            sharedSpace: Math.random() > 0.3,
            campfire: Math.random() > 0.6,
            socialEvents: Math.random() > 0.4,
            welcomeNewbies: Math.random() > 0.5
          },
          approximateSize: 20 + (i * 5),
          isPublic: Math.random() > 0.2,
          acceptingNewMembers: Math.random() > 0.3,
          showApplyNow: Math.random() > 0.4,
          showMemberCount: Math.random() > 0.3,
          photos: [
            `https://picsum.photos/800/600?random=${i}`,
            `https://picsum.photos/800/600?random=${i + 100}`,
            `https://picsum.photos/800/600?random=${i + 200}`
          ],
          primaryPhotoIndex: 0,
          status: 'active',
          owner: 1000000 + i,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      newUsers.push(user);
      newCamps.push(camp);
    }
    
    // Add new data to existing data
    existingData.users.push(...newUsers);
    existingData.camps.push(...newCamps);
    
    // Write back to file
    await fs.writeFile(mockDataPath, JSON.stringify(existingData, null, 2));
    
    console.log(`\n✅ Successfully added ${newUsers.length} new camp profiles!`);
    console.log(`Total users: ${existingData.users.length}`);
    console.log(`Total camps: ${existingData.camps.length}`);
    
    // Create login credentials CSV
    const csvContent = [
      'Camp #,Camp Name,Theme,Email,Password,Burning Since,Hometown,Playa Location,Approximate Size,Is Public,Accepting Members,Show Apply Button,Show Member Count',
      ...newCamps.map((camp, i) => {
        const campData = camp[1];
        const userData = newUsers[i][1];
        return `"${i + 1}","${campData.campName}","${campData.theme}","${userData.email}","camp${i + 1}pass","${campData.burningSince}","${campData.hometown}","${campData.location.street}","${campData.approximateSize}","${campData.isPublic ? 'Yes' : 'No'}","${campData.acceptingNewMembers ? 'Yes' : 'No'}","${campData.showApplyNow ? 'Yes' : 'No'}","${campData.showMemberCount ? 'Yes' : 'No'}"`;
      })
    ].join('\n');
    
    await fs.writeFile('camp_login_credentials.csv', csvContent);
    console.log('\n📄 CSV file created: camp_login_credentials.csv');
    
  } catch (error) {
    console.error('Error fixing camp data:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  fixCampData()
    .then(() => {
      console.log('\n🎉 All done! Restart your server to see the new camp profiles.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixCampData };
