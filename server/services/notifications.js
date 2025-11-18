// Notification service for sending email and SMS notifications
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');

// SendGrid configuration
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ Notifications service using SendGrid');
} else {
  console.warn('⚠️  SENDGRID_API_KEY not found - email notifications will not work');
}

// Twilio configuration for SMS
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

/**
 * Send notification when a new application is submitted
 * @param {Object} camp - Camp object (should have owner populated)
 * @param {Object} applicant - Applicant user object
 * @param {Object} application - Application object
 */
async function sendApplicationNotification(camp, applicant, application) {
  try {
    // Determine recipient email: use contactEmail or fall back to owner email
    let recipientEmail = camp.contactEmail;
    
    if (!recipientEmail && camp.owner) {
      // If owner is populated, use owner's email
      recipientEmail = camp.owner.email || camp.owner.campEmail;
      console.log(`⚠️  Camp ${camp.name || camp.campName} has no contactEmail, using owner email: ${recipientEmail}`);
    }

    // Send email notification to camp lead if we have a recipient
    if (recipientEmail) {
      // Ensure camp has contactEmail for the email function
      const campWithEmail = { ...camp, contactEmail: recipientEmail };
      await sendEmailNotification(campWithEmail, applicant, application);
      console.log(`✅ Email notification sent to ${recipientEmail}`);
    } else {
      console.warn(`⚠️  Cannot send email notification for camp ${camp.name || camp.campName} - no email found`);
      console.warn(`⚠️  Camp contactEmail: ${camp.contactEmail}, Owner populated: ${!!camp.owner}`);
    }

    // Send welcome email to applicant when they submit an application
    try {
      await sendApplicationWelcomeEmail(applicant);
      console.log(`✅ Application welcome email sent to ${applicant.email}`);
    } catch (emailError) {
      console.error('⚠️  Failed to send application welcome email (application was still created):', emailError);
      // Don't throw - we don't want to fail the application submission if email fails
    }

    // Send SMS notification if phone number is provided
    if (camp.contactPhone) {
      await sendSMSNotification(camp, applicant, application);
    }

  } catch (error) {
    console.error('❌ Error sending application notifications:', error);
    console.error('Camp data:', {
      id: camp._id,
      name: camp.name || camp.campName,
      contactEmail: camp.contactEmail,
      hasOwner: !!camp.owner
    });
  }
}

/**
 * Send email notification to camp administrators
 */
async function sendEmailNotification(camp, applicant, application) {
  const mailOptions = {
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
      name: process.env.SENDGRID_FROM_NAME || 'G8Road'
    },
    to: camp.contactEmail,
    subject: `New Application to ${camp.name || camp.campName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏕️ G8Road CRM</h1>
          <p style="color: white; margin: 10px 0 0 0;">New Camp Application</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">New Application Received!</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #FF6B35; margin-top: 0;">Camp: ${camp.name || camp.campName}</h3>
            
            <div style="margin-bottom: 15px;">
              <strong>Applicant:</strong> ${applicant.firstName} ${applicant.lastName}<br>
              <strong>Email:</strong> ${applicant.email}<br>
              <strong>Applied:</strong> ${new Date(application.appliedAt).toLocaleDateString()}
            </div>
            
            <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h4 style="margin-top: 0; color: #333;">Application Details:</h4>
              <p><strong>Motivation:</strong></p>
              <p style="margin-left: 20px; font-style: italic;">"${application.applicationData.motivation}"</p>
              
              ${application.applicationData.experience ? `
                <p><strong>Experience:</strong></p>
                <p style="margin-left: 20px;">${application.applicationData.experience}</p>
              ` : ''}
              
              ${application.applicationData.skills && application.applicationData.skills.length > 0 ? `
                <p><strong>Skills:</strong> ${application.applicationData.skills.join(', ')}</p>
              ` : ''}
            </div>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/camp/applications/${application._id}" 
               style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Review Application
            </a>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p>This is an automated notification from G8Road CRM. 
            Please log in to your camp dashboard to review and respond to this application.</p>
          </div>
        </div>
      </div>
    `,
    text: `New Application to ${camp.campName || camp.name}\n\nApplicant: ${applicant.firstName} ${applicant.lastName}\nEmail: ${applicant.email}\n\nPlease log in to your camp dashboard to review this application.\n\n${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`
  };

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  Cannot send email - SENDGRID_API_KEY not configured');
      return;
    }
    await sgMail.send(mailOptions);
    console.log(`✅ Email notification sent to ${camp.contactEmail} via SendGrid`);
  } catch (error) {
    console.error('❌ Error sending email notification:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
  }
}

/**
 * Send SMS notification to camp administrators
 */
async function sendSMSNotification(camp, applicant, application) {
  if (!twilioClient) {
    console.warn('⚠️  Twilio not configured - SMS notifications disabled');
    return;
  }

  const message = `🏕️ New application to ${camp.name || camp.campName}!\n\n` +
    `Applicant: ${applicant.firstName} ${applicant.lastName}\n` +
    `Applied: ${new Date(application.appliedAt).toLocaleDateString()}\n\n` +
    `Review at: ${process.env.CLIENT_URL || 'http://localhost:3000'}/camp/applications/${application._id}`;

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: camp.contactPhone
    });
    console.log(`✅ SMS notification sent to ${camp.contactPhone} via Twilio`);
  } catch (error) {
    console.error('❌ Error sending SMS notification:', error);
  }
}

/**
 * Send notification when application status changes
 */
async function sendApplicationStatusNotification(application, applicant, camp, newStatus) {
  try {
    if (newStatus === 'approved') {
      await sendApprovalNotification(applicant, camp);
    } else if (newStatus === 'rejected') {
      await sendRejectionNotification(applicant, camp);
    }
  } catch (error) {
    console.error('Error sending status notification:', error);
  }
}

/**
 * Send approval notification to applicant
 */
async function sendApprovalNotification(applicant, camp) {
  const mailOptions = {
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
      name: process.env.SENDGRID_FROM_NAME || 'G8Road'
    },
    to: applicant.email,
    subject: `🎉 Welcome to ${camp.name || camp.campName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
          <p style="color: white; margin: 10px 0 0 0;">You've been accepted!</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Welcome to ${camp.name || camp.campName}!</h2>
          
          <p>Dear ${applicant.firstName},</p>
          
          <p>Great news! Your application to join <strong>${camp.name || camp.campName}</strong> has been approved! 
          We're excited to have you as part of our camp community.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #4CAF50; margin-top: 0;">Next Steps:</h3>
            <ul>
              <li>Check your camp dashboard for important updates</li>
              <li>Review camp guidelines and expectations</li>
              <li>Connect with fellow camp members</li>
              <li>Prepare for an amazing G8Road experience!</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" 
               style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Congratulations ${applicant.firstName}! You've been accepted to ${camp.campName || camp.name}. Go to your dashboard to learn more: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`
  };

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  Cannot send email - SENDGRID_API_KEY not configured');
      return;
    }
    await sgMail.send(mailOptions);
    console.log(`✅ Approval notification sent to ${applicant.email} via SendGrid`);
  } catch (error) {
    console.error('❌ Error sending approval notification:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
  }
}

/**
 * Send rejection notification to applicant
 */
async function sendRejectionNotification(applicant, camp) {
  const mailOptions = {
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
      name: process.env.SENDGRID_FROM_NAME || 'G8Road'
    },
    to: applicant.email,
    subject: `Application Update - ${camp.name || camp.campName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏕️ G8Road CRM</h1>
          <p style="color: white; margin: 10px 0 0 0;">Application Update</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Application Status Update</h2>
          
          <p>Dear ${applicant.firstName},</p>
          
          <p>Thank you for your interest in joining <strong>${camp.name || camp.campName}</strong>. 
          After careful consideration, we have decided not to move forward with your application at this time.</p>
          
          <p>This decision was not easy, as we received many qualified applications. 
          We encourage you to continue exploring other amazing camps in our community.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/camps" 
               style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Explore Other Camps
            </a>
          </div>
          
          <p>Thank you again for your interest, and we wish you the best in finding your perfect camp!</p>
          
          <p>Best regards,<br>
          The ${camp.campName || camp.name} Team</p>
        </div>
      </div>
    `,
    text: `Thank you for your application to ${camp.campName || camp.name}. After careful consideration, we have decided not to move forward at this time. We encourage you to explore other camps: ${process.env.CLIENT_URL || 'http://localhost:3000'}/camps`
  };

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  Cannot send email - SENDGRID_API_KEY not configured');
      return;
    }
    await sgMail.send(mailOptions);
    console.log(`✅ Rejection notification sent to ${applicant.email} via SendGrid`);
  } catch (error) {
    console.error('❌ Error sending rejection notification:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
  }
}

/**
 * Send welcome email to applicant when they submit an application
 */
async function sendApplicationWelcomeEmail(applicant) {
  const userFirstName = applicant.firstName || 'there';
  const profileUrl = `${process.env.CLIENT_URL || 'https://g8road.com'}/user/profile`;

  const mailOptions = {
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@g8road.com',
      name: process.env.SENDGRID_FROM_NAME || 'G8Road'
    },
    to: applicant.email,
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
            <h2 style="color: #333; margin-top: 0; font-size: 24px;">Hey ${userFirstName},</h2>
            
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
              Click the link below and complete your personal profile to unlock the full platform features!
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${profileUrl}" 
                 style="background: #FF6B35; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                Complete Your Profile
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

Hey ${userFirstName},

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

Click the link below and complete your personal profile to unlock the full platform features!

${profileUrl}

We can't wait to see what you build.

See you in the dust,

The G8Road Team
`
  };

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  Cannot send email - SENDGRID_API_KEY not configured');
      return;
    }
    await sgMail.send(mailOptions);
    console.log(`✅ Application welcome email sent to ${applicant.email} via SendGrid`);
  } catch (error) {
    console.error('❌ Error sending application welcome email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw error;
  }
}

module.exports = {
  sendApplicationNotification,
  sendApplicationStatusNotification
};
