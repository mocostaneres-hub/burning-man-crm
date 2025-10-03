// Quick script to fix Skips camp photo
const fs = require('fs');

// Read the mock database file
const dbPath = '/Users/mauricio/burning-man-crm/server/database/mockData.json';
const mockData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('Available camps:', mockData.camps?.map(([id, camp]) => camp.campName) || 'No camps found');

// Find the Skips camp in the camps array (it's stored as [id, camp] pairs)
const skipsCampEntry = mockData.camps?.find(([id, camp]) => camp.campName === 'Skips');
const skipsCamp = skipsCampEntry ? skipsCampEntry[1] : null;

if (skipsCamp) {
  // Update with a working image URL
  skipsCamp.photos = ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop'];
  skipsCamp.primaryPhotoIndex = 0;
  
  // Write back to file
  fs.writeFileSync(dbPath, JSON.stringify(mockData, null, 2));
  console.log('✅ Fixed Skips camp photo!');
} else {
  console.log('❌ Skips camp not found');
}
