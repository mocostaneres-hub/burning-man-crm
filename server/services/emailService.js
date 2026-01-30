const { Resend } = require('resend');

// Initialize Resend with API key from environment variables
// CRITICAL: Fail-fast if not configured properly
if (!process.env.RESEND_API_KEY) {
  throw new Error('CRITICAL: RESEND_API_KEY environment variable is required for email service');
}

if (!process.env.RESEND_FROM_EMAIL) {
  throw new Error('CRITICAL: RESEND_FROM_EMAIL environment variable is required for email service');
}

// Validate API key format
if (!process.env.RESEND_API_KEY.startsWith('re_')) {
  throw new Error('CRITICAL: RESEND_API_KEY appears invalid (should start with "re_")');
}

// Warn if using test domain
const fromDomain = process.env.RESEND_FROM_EMAIL.split('@')[1];
if (fromDomain === 'resend.dev') {
  console.warn('⚠️  ═══════════════════════════════════════');
  console.warn('⚠️  WARNING: Using Resend TEST domain (resend.dev)');
  console.warn('⚠️  This is OK for development, but NOT for production');
  console.warn('⚠️  Test domains cannot send real emails');
  console.warn('⚠️  Add and verify your domain at resend.com/domains');
  console.warn('⚠️  ═══════════════════════════════════════');
}

const resend = new Resend(process.env.RESEND_API_KEY);
console.log('✅ Resend initialized successfully');
console.log('📧 Sending emails from:', process.env.RESEND_FROM_EMAIL);

/**
 * Send an email using Resend
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.html - HTML content (optional)
 * @param {string} options.from - Sender email (optional, uses env default)
 * @param {string} options.fromName - Sender name (optional, uses env default)
 * @returns {Promise<Object>} Resend response
 */
const sendEmail = async ({
  to,
  subject,
  text = '',
  html = '',
  from = process.env.RESEND_FROM_EMAIL || 'noreply@g8road.com',
  fromName = process.env.RESEND_FROM_NAME || 'G8Road'
}) => {
  try {
    // This check is now redundant (init throws if missing) but kept for safety
    if (!process.env.RESEND_API_KEY) {
      throw new Error('Resend API key is not configured');
    }
    
    // Additional validation
    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new Error('Email recipient (to) is required');
    }
    
    if (!subject || subject.trim() === '') {
      throw new Error('Email subject is required');
    }
    
    if (!html && !text) {
      throw new Error('Email must have either HTML or text content');
    }

    // Resend requires from to be in "Name <email>" format or just email
    const fromEmail = fromName ? `${fromName} <${from}>` : from;

    console.log(`📧 Sending email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);

    const response = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || 'This email requires HTML support',
      html: html || text
    });

    console.log('✅ Email sent successfully');
    console.log('📧 Email ID:', response.data?.id);
    return response;
  } catch (error) {
    console.error('❌ ═══════════════════════════════════════');
    console.error('❌ RESEND EMAIL SEND FAILURE');
    console.error('❌ ═══════════════════════════════════════');
    console.error('Error Message:', error.message);
    console.error('Error Name:', error.name);
    console.error('HTTP Status:', error.statusCode);
    if (error.response) {
      console.error('Resend Response:', JSON.stringify(error.response, null, 2));
    }
    console.error('Email Details:');
    console.error('  To:', Array.isArray(to) ? to.join(', ') : to);
    console.error('  From:', process.env.RESEND_FROM_EMAIL);
    console.error('  Subject:', subject);
    console.error('❌ ═══════════════════════════════════════');
    throw error;
  }
};

/**
 * Send application status notification
 */
const sendApplicationStatusEmail = async (user, camp, status) => {
  const statusMessages = {
    approved: {
      subject: `🎉 Your application to ${camp.name} has been approved!`,
      html: `
        <h2>Congratulations!</h2>
        <p>Hi ${user.firstName},</p>
        <p>Great news! Your application to join <strong>${camp.name}</strong> has been approved.</p>
        <p>You can now access your camp roster and participate in all camp activities.</p>
        <p><a href="${process.env.CLIENT_URL || 'https://g8road.com'}/camps/${camp.slug}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Camp Profile</a></p>
        <p>See you on the playa! 🔥</p>
      `
    },
    rejected: {
      subject: `Application Update: ${camp.name}`,
      html: `
        <h2>Application Status Update</h2>
        <p>Hi ${user.firstName},</p>
        <p>Thank you for your interest in <strong>${camp.name}</strong>.</p>
        <p>Unfortunately, your application was not approved at this time. This may be due to capacity limits or specific camp requirements.</p>
        <p>We encourage you to explore other camps on G8Road!</p>
        <p><a href="${process.env.CLIENT_URL || 'https://g8road.com'}/camps" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Explore Camps</a></p>
      `
    },
    pending: {
      subject: `Application Received: ${camp.name}`,
      html: `
        <h2>Application Received</h2>
        <p>Hi ${user.firstName},</p>
        <p>Thank you for applying to <strong>${camp.name}</strong>!</p>
        <p>Your application is currently under review. The camp leads will get back to you soon.</p>
        <p>You can check your application status anytime in your dashboard.</p>
        <p><a href="${process.env.CLIENT_URL || 'https://g8road.com'}/applications" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View My Applications</a></p>
      `
    }
  };

  const emailContent = statusMessages[status] || statusMessages.pending;

  return sendEmail({
    to: user.email,
    subject: emailContent.subject,
    html: emailContent.html
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL || 'https://g8road.com'}/reset-password/${resetToken}`;

  return sendEmail({
    to: user.email,
    subject: 'Password Reset Request - G8Road',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.firstName || 'there'},</p>
      <p>You requested to reset your password for your G8Road account.</p>
      <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
      <p><a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>If you didn't request this, please ignore this email.</p>
      <p style="color: #666; font-size: 12px;">Link: ${resetUrl}</p>
    `
  });
};

/**
 * Send welcome email to new users
 */
const sendWelcomeEmail = async (user) => {
  const applicantFirstName = user.firstName || '';
  const applicantLastName = user.lastName || '';
  const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
  
  return sendEmail({
    to: user.email,
    subject: 'Welcome to G8Road: Your Camp Management & Connection Hub!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px;">🏕️ Welcome to G8Road!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">Your Camp Management & Connection Hub</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background: #f9f9f9;">
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hey ${applicantFirstName} ${applicantLastName},</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              We're absolutely thrilled to welcome you to the G8Road community—the platform built by Camp Leads, for Camp Leads and Burners everywhere. Whether you're here to run the show or just find your home on the playa, G8Road is where the magic happens!
            </p>
          </div>

          <!-- For Camp Leads Section -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #FF6B35; margin-top: 0; font-size: 20px;">🛠️ For Camp Leads: Manage the Chaos</h3>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 10px 0;">
              Your days of juggling Google Sheets are over. As a Camp Lead, you now have access to powerful CRM tools to conquer your camp operations:
            </p>
            <ul style="color: #333; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li><strong>Set Up Your Profile:</strong> Go customize your Camp Profile. This is the first step before any burner can apply!</li>
              <li><strong>Review Applications:</strong> Check your Application Queue to see who is applying to your camp.</li>
              <li><strong>Build Your Roster:</strong> Approve members, and their information automatically populates your official Camp Roster.</li>
              <li><strong>Coordinate:</strong> Start planning logistics and assigning roles (features coming soon!).</li>
            </ul>
          </div>

          <!-- For Camp Members Section -->
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #FF6B35; margin-top: 0; font-size: 20px;">🔥 For Camp Members (Burners): Find Your Home</h3>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 10px 0;">
              Looking for your perfect placement at Black Rock City? We make connecting easy:
            </p>
            <ul style="color: #333; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li><strong>Complete Your Profile:</strong> Add your bio, skills, and Burning Man experience to make your applications shine.</li>
              <li><strong>Explore Camps:</strong> Browse our directory to find your perfect camp community.</li>
              <li><strong>Apply to Camps:</strong> Easily submit applications and connect with camp leads directly through the system.</li>
            </ul>
          </div>

          <!-- First Step CTA -->
          <div style="background: #FFF3E0; padding: 20px; border-radius: 8px; border-left: 4px solid #FF6B35; margin-bottom: 20px;">
            <h3 style="color: #FF6B35; margin-top: 0; font-size: 18px;">🎯 Your First Step:</h3>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 10px 0;">
              Head to g8road.com and complete your personal profile to unlock the full platform features!
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${clientUrl}" 
                 style="background: #FF6B35; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                Visit G8Road
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 10px 0;">
              We can't wait to see what you build.
            </p>
            <p style="color: #666; font-size: 14px; margin: 15px 0 5px 0;">
              See you in the dust,
            </p>
            <p style="color: #666; font-size: 14px; margin: 5px 0;">
              The G8Road Team
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Welcome to G8Road: Your Camp Management & Connection Hub!

Hey ${applicantFirstName} ${applicantLastName},

We're absolutely thrilled to welcome you to the G8Road community—the platform built by Camp Leads, for Camp Leads and Burners everywhere. Whether you're here to run the show or just find your home on the playa, G8Road is where the magic happens!

🛠️ For Camp Leads: Manage the Chaos

Your days of juggling Google Sheets are over. As a Camp Lead, you now have access to powerful CRM tools to conquer your camp operations:

- Set Up Your Profile: Go customize your Camp Profile. This is the first step before any burner can apply!
- Review Applications: Check your Application Queue to see who is applying to your camp.
- Build Your Roster: Approve members, and their information automatically populates your official Camp Roster.
- Coordinate: Start planning logistics and assigning roles (features coming soon!).

🔥 For Camp Members (Burners): Find Your Home

Looking for your perfect placement at Black Rock City? We make connecting easy:

- Complete Your Profile: Add your bio, skills, and Burning Man experience to make your applications shine.
- Explore Camps: Browse our directory to find your perfect camp community.
- Apply to Camps: Easily submit applications and connect with camp leads directly through the system.

🎯 Your First Step:

Head to g8road.com and complete your personal profile to unlock the full platform features!

We can't wait to see what you build.

See you in the dust,

The G8Road Team
`
  });
};

/**
 * Send roster invitation email
 */
const sendRosterInviteEmail = async (user, camp, invitedBy) => {
  return sendEmail({
    to: user.email,
    subject: `You've been invited to join ${camp.name}!`,
    html: `
      <h2>Camp Invitation</h2>
      <p>Hi ${user.firstName},</p>
      <p><strong>${invitedBy.firstName} ${invitedBy.lastName}</strong> has invited you to join the roster for <strong>${camp.name}</strong>!</p>
      <p>Accept this invitation to become part of the camp family and access all camp features.</p>
      <p><a href="${process.env.CLIENT_URL || 'https://g8road.com'}/camps/${camp.slug}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invitation</a></p>
      <p>Excited to have you with us! 🎪</p>
    `
  });
};

/**
 * Send camp invitation email
 * @param {string} recipientEmail - Email address of the recipient
 * @param {Object} camp - Camp object with name/campName
 * @param {Object} sender - User object who sent the invite (optional)
 * @param {string} inviteLink - The invitation link with token
 * @param {string} customMessage - Custom message from template (already has placeholders replaced)
 */
const sendInviteEmail = async (recipientEmail, camp, sender, inviteLink, customMessage = null) => {
  // CLIENT_URL is used for other links in the email (camp profile, etc.)
  // The inviteLink itself is already constructed with CLIENT_URL in the calling code
  const clientUrl = process.env.CLIENT_URL;
  
  // Enforce CLIENT_URL configuration for email links
  if (!clientUrl) {
    console.error('❌ [CRITICAL] CLIENT_URL not set - cannot send invitation email with valid links');
    throw new Error('CLIENT_URL environment variable is required for invitation emails');
  }
  
  const campName = camp.name || camp.campName || 'a camp';
  const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'Camp Lead';
  
  // Use custom message if provided (placeholders already replaced), otherwise use default
  const messageText = customMessage || `Hello! You've been personally invited to apply to join our camp, ${campName}, for Burning Man. Click here to start your application: ${inviteLink}`;
  
  return sendEmail({
    to: recipientEmail,
    subject: `🏕️ You're Invited to Join ${campName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px;">🏕️ Camp Invitation</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 18px;">You've been personally invited!</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px; background: #f9f9f9;">
          <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hello!</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              ${sender ? `<strong>${senderName}</strong> has personally invited you to join <strong>${campName}</strong> for Burning Man!` : `You've been personally invited to join <strong>${campName}</strong> for Burning Man!`}
            </p>
            
            <div style="background: #FFF3E0; padding: 20px; border-radius: 8px; border-left: 4px solid #FF6B35; margin: 20px 0;">
              <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0;">
                ${messageText.includes(inviteLink) ? messageText : `${messageText}<br><br><a href="${inviteLink}" style="color: #FF6B35; font-weight: bold;">${inviteLink}</a>`}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" 
                 style="background: #FF6B35; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                Start Your Application
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
              This invitation link is unique to you and will allow you to apply directly to ${campName}. The link will expire in 7 days.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
            <p style="color: #666; font-size: 14px; margin: 5px 0;">
              See you on the playa! 🔥
            </p>
            <p style="color: #666; font-size: 14px; margin: 5px 0;">
              The G8Road Team
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Camp Invitation - ${campName}

Hello!

${sender ? `${senderName} has personally invited you to join ${campName} for Burning Man!` : `You've been personally invited to join ${campName} for Burning Man!`}

${messageText}

Start your application here: ${inviteLink}

This invitation link is unique to you and will allow you to apply directly to ${campName}. The link will expire in 7 days.

See you on the playa! 🔥

The G8Road Team`
  });
};

/**
 * Send test email (for Resend verification)
 */
const sendTestEmail = async (to) => {
  return sendEmail({
    to,
    subject: 'Test Email from G8Road - Resend Integration',
    html: `
      <h2>🎉 Resend Integration Successful!</h2>
      <p>This is a test email from your G8Road CRM application.</p>
      <p>If you're seeing this, your Resend integration is working perfectly!</p>
      <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
    `,
    text: 'Test email from G8Road CRM. Resend integration is working!'
  });
};

module.exports = {
  sendEmail,
  sendApplicationStatusEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendRosterInviteEmail,
  sendInviteEmail,
  sendTestEmail
};
