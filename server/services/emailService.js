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
  return sendEmail({
    to: user.email,
    subject: 'Welcome to G8Road! 🔥',
    html: `
      <h1>Welcome to G8Road!</h1>
      <p>Hi ${user.firstName},</p>
      <p>We're excited to have you join our Burning Man community!</p>
      <p>G8Road is your hub for connecting with camps, managing rosters, and coordinating with your camp family.</p>
      <h3>Get Started:</h3>
      <ul>
        <li>Complete your profile</li>
        <li>Explore camps in our directory</li>
        <li>Apply to join a camp or create your own</li>
      </ul>
      <p><a href="${process.env.CLIENT_URL || 'https://g8road.com'}/profile" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Your Profile</a></p>
      <p>See you on the playa! 🌈</p>
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

