const fs = require('fs');
const path = require('path');

// Read the current mock data
const mockDataPath = path.join(__dirname, 'server/database/mockData.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

// Add sample global offerings
mockData.globalOfferings = [
  [12000001, {
    "_id": 12000001,
    "name": "Coffee",
    "icon": "CheckCircle",
    "description": "Fresh coffee and espresso drinks",
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  }],
  [12000002, {
    "_id": 12000002,
    "name": "WiFi",
    "icon": "Home",
    "description": "High-speed internet access",
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  }],
  [12000003, {
    "_id": 12000003,
    "name": "Music",
    "icon": "Home",
    "description": "Live music and DJ sets",
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  }]
];

// Add sample camp categories
mockData.campCategories = [
  [13000001, {
    "_id": 13000001,
    "name": "Art & Music",
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  }],
  [13000002, {
    "_id": 13000002,
    "name": "Food & Drinks",
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  }],
  [13000003, {
    "_id": 13000003,
    "name": "Wellness & Healing",
    "createdAt": new Date().toISOString(),
    "updatedAt": new Date().toISOString()
  }]
];

// Write the updated data back
fs.writeFileSync(mockDataPath, JSON.stringify(mockData, null, 2));
console.log('✅ Sample data added successfully!');
console.log('📊 Added 3 global offerings and 3 camp categories');
