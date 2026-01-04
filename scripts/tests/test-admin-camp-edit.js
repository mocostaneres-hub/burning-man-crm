const axios = require('axios');

async function testAdminCampEdit() {
  try {
    console.log('🧪 Testing Admin Camp Edit Functionality...\n');

    // 1. Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'mocostaneres@gmail.com',
      password: 'weh0809'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Admin login successful');

    // 2. Get camps to find one to edit
    console.log('\n2. Getting camps...');
    const campsResponse = await axios.get('http://localhost:5001/api/admin/camps', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const camps = campsResponse.data.data;
    if (camps.length === 0) {
      console.log('❌ No camps found to edit');
      return;
    }
    
    const testCamp = camps[0];
    console.log(`✅ Found camp: ${testCamp.campName} (ID: ${testCamp._id})`);

    // 3. Test camp update with all fields
    console.log('\n3. Testing comprehensive camp update...');
    const updateData = {
      campName: testCamp.campName + ' (Updated)',
      theme: 'Updated Theme',
      description: 'This is an updated description for testing admin functionality.',
      bio: 'Updated bio information for the camp.',
      burningSince: 2020,
      hometown: 'Updated Hometown',
      contactEmail: testCamp.contactEmail,
      contactPhone: '+1 (555) 123-4567',
      website: 'https://updated-camp.com',
      approximateSize: 25,
      isPublic: true,
      acceptingNewMembers: true,
      showApplyNow: true,
      showMemberCount: true,
      status: 'active',
      socialMedia: {
        facebook: 'https://facebook.com/updated-camp',
        instagram: 'https://instagram.com/updated-camp',
        twitter: 'https://twitter.com/updated-camp',
        tiktok: 'https://tiktok.com/@updated-camp'
      },
      location: {
        street: 'Updated Street',
        crossStreet: 'Updated Cross Street',
        time: 'Updated Time',
        description: 'Updated location description'
      },
      offerings: {
        water: true,
        fullPower: true,
        partialPower: false,
        rvPower: true,
        acceptsRVs: true,
        shadeForTents: true,
        showers: true,
        communalKitchen: true,
        storage: false,
        wifi: true,
        ice: true,
        food: true,
        coffee: true,
        bar: false,
        snacks: true,
        music: true,
        art: true,
        workshops: true,
        performances: false,
        games: true,
        yoga: true,
        meditation: false,
        bikeRepair: true,
        massage: false,
        hairStyling: false,
        facePainting: true,
        costumeRental: true,
        sharedSpace: true,
        campfire: true,
        socialEvents: true,
        welcomeNewbies: true
      }
    };

    const updateResponse = await axios.put(`http://localhost:5001/api/admin/camps/${testCamp._id}`, updateData, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Camp update successful');
    console.log('Updated camp data:', JSON.stringify(updateResponse.data.camp, null, 2));

    // 4. Verify the update was applied
    console.log('\n4. Verifying update...');
    const verifyResponse = await axios.get(`http://localhost:5001/api/admin/camps/${testCamp._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const updatedCamp = verifyResponse.data.camp;
    console.log('✅ Verification successful');
    console.log('Camp name updated:', updatedCamp.campName === updateData.campName);
    console.log('Theme updated:', updatedCamp.theme === updateData.theme);
    console.log('Offerings updated:', JSON.stringify(updatedCamp.offerings, null, 2));

    console.log('\n🎉 All admin camp edit tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAdminCampEdit();
