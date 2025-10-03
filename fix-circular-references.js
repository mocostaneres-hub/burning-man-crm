const fs = require('fs');
const path = require('path');

async function fixCircularReferences() {
  try {
    console.log('🔧 Fixing circular references in mock database...');
    
    const dataFile = path.join(__dirname, 'server/database/mockData.json');
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    let fixed = false;
    
    // Fix camps with circular references in actionHistory
    if (data.camps) {
      for (const [key, camp] of Object.entries(data.camps)) {
        if (camp.actionHistory && Array.isArray(camp.actionHistory)) {
          camp.actionHistory = camp.actionHistory.map(action => {
            // Remove any circular references in changes
            if (action.changes && action.changes.actionHistory) {
              const { actionHistory, ...safeChanges } = action.changes;
              return { ...action, changes: safeChanges };
            }
            return action;
          });
          fixed = true;
        }
      }
    }
    
    // Fix users with circular references in actionHistory
    if (data.users) {
      for (const [key, user] of Object.entries(data.users)) {
        if (user.actionHistory && Array.isArray(user.actionHistory)) {
          user.actionHistory = user.actionHistory.map(action => {
            // Remove any circular references in changes
            if (action.changes && action.changes.actionHistory) {
              const { actionHistory, ...safeChanges } = action.changes;
              return { ...action, changes: safeChanges };
            }
            return action;
          });
          fixed = true;
        }
      }
    }
    
    if (fixed) {
      // Write the fixed data back
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
      console.log('✅ Fixed circular references in mock database');
    } else {
      console.log('ℹ️  No circular references found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing circular references:', error.message);
  }
}

fixCircularReferences();

