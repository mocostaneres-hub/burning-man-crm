/**
 * Field Name Mapper
 * Maps technical field names to human-readable display names
 * Used in audit logs and admin interfaces
 */

const fieldNameMap = {
  // Member/User fields
  'firstName': 'First Name',
  'lastName': 'Last Name',
  'email': 'Email',
  'phoneNumber': 'Phone Number',
  'playaName': 'Playa Name',
  'city': 'City',
  'yearsBurned': 'Years Burned',
  'bio': 'Bio',
  'profilePhoto': 'Profile Photo',
  'hasTicket': 'Has Ticket',
  'hasVehiclePass': 'Has Vehicle Pass',
  'arrivalDate': 'Arrival Date',
  'departureDate': 'Departure Date',
  'interestedInEAP': 'Interested in EAP',
  'interestedInStrike': 'Interested in Strike',
  'skills': 'Skills',
  'socialMedia': 'Social Media',
  'isActive': 'Account Status',
  
  // Camp fields
  'name': 'Camp Name',
  'campName': 'Camp Name',
  'description': 'Description',
  'theme': 'Theme',
  'hometown': 'Hometown',
  'burningSince': 'Burning Since',
  'contactEmail': 'Contact Email',
  'website': 'Website',
  'selectedPerks': 'Shared Amenities',
  'categories': 'Categories',
  'isPubliclyVisible': 'Profile Visibility',
  'acceptingApplications': 'Accepting Applications',
  'isActive': 'Camp Status',
  'status': 'Status',
  'location': 'Location',
  'socialMedia.facebook': 'Facebook',
  'socialMedia.instagram': 'Instagram',
  'socialMedia.twitter': 'Twitter',
  'socialMedia.tiktok': 'TikTok',
  
  // Application fields
  'applicationStatus': 'Application Status',
  'application': 'Application',
  'roster': 'Roster',
  'rosterName': 'Roster Name',
  'duesStatus': 'Dues Status',
  'emails': 'Email Addresses',
  
  // Roster override fields
  'playaName': 'Playa Name',
  'yearsBurned': 'Years Burned',
  'skills': 'Skills',
  'hasTicket': 'Has Ticket',
  'hasVehiclePass': 'Has Vehicle Pass',
  'interestedInEAP': 'Interested in EAP',
  'interestedInStrike': 'Interested in Strike',
  'arrivalDate': 'Arrival Date',
  'departureDate': 'Departure Date',
  'city': 'City',
  'state': 'State'
};

/**
 * Get human-readable field name
 * @param {string} field - Technical field name
 * @returns {string} - Human-readable display name
 */
function getFieldDisplayName(field) {
  return fieldNameMap[field] || field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Format field value for display
 * @param {any} value - Field value
 * @param {string} field - Field name
 * @returns {string} - Formatted display value
 */
function formatFieldValue(value, field) {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(none)';
    }
    return value.join(', ');
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return String(value);
}

module.exports = {
  getFieldDisplayName,
  formatFieldValue,
  fieldNameMap
};

