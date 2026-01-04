const path = require('path');
const fs = require('fs').promises;

async function testLoadData() {
  const dataFile = path.join(__dirname, 'server/database/mockData.json');
  console.log('Data file path:', dataFile);
  
  try {
    const data = await fs.readFile(dataFile, 'utf8');
    console.log('File read successfully, size:', data.length);
    
    const parsed = JSON.parse(data);
    console.log('JSON parsed successfully');
    console.log('Users count:', parsed.users ? parsed.users.length : 0);
    console.log('Camps count:', parsed.camps ? parsed.camps.length : 0);
    console.log('Members count:', parsed.members ? parsed.members.length : 0);
    console.log('Rosters count:', parsed.rosters ? parsed.rosters.length : 0);
    
    // Test the Map conversion
    const usersMap = new Map(parsed.users || []);
    console.log('Users Map size:', usersMap.size);
    
    const rostersMap = new Map(parsed.rosters || []);
    console.log('Rosters Map size:', rostersMap.size);
    
    if (rostersMap.size > 0) {
      const firstRoster = rostersMap.values().next().value;
      console.log('First roster:', firstRoster);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLoadData();

