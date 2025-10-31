const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key from environment variables
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized successfully');
} else {
  console.warn('⚠️  SENDGRID_API_KEY not found in environment variables');
}

/**
 * Send an email using SendGrid
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.html - HTML content (optional)
 * @param {string} options.from - Sender email (optional, uses env default)
 * @param {string} options.fromName - Sender name (optional, uses env default)
 * @returns {Promise<Object>} SendGrid response
 */
const sendEmail = async ({
  to,
  subject,
  text = '',
  html = '',
  from = process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
  fromName = process.env.SENDGRID_FROM_NAME || 'G8Road'
}) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key is not configured');
    }

    const msg = {
      to,
      from: {
        email: from,
        name: fromName
      },
      subject,
      text: text || 'This email requires HTML support',
      html: html || text
    };

    console.log(`📧 Sending email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);

    const response = await sgMail.send(msg);
    console.log('✅ Email sent successfully');
    return response;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error.response) {
      console.error('SendGrid Error Response:', error.response.body);
    }
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
 * Send test email (for SendGrid verification)
 */
const sendTestEmail = async (to) => {
  return sendEmail({
    to,
    subject: 'Test Email from G8Road - SendGrid Integration',
    html: `
      <h2>🎉 SendGrid Integration Successful!</h2>
      <p>This is a test email from your G8Road CRM application.</p>
      <p>If you're seeing this, your SendGrid integration is working perfectly!</p>
      <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
    `,
    text: 'Test email from G8Road CRM. SendGrid integration is working!'
  });
};

module.exports = {
  sendEmail,
  sendApplicationStatusEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendRosterInviteEmail,
  sendTestEmail
};

