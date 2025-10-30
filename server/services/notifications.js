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
 * @param {Object} camp - Camp object
 * @param {Object} applicant - Applicant user object
 * @param {Object} application - Application object
 */
async function sendApplicationNotification(camp, applicant, application) {
  try {
    // Send email notification
    if (camp.contactEmail) {
      await sendEmailNotification(camp, applicant, application);
    }

    // Send SMS notification if phone number is provided
    if (camp.contactPhone) {
      await sendSMSNotification(camp, applicant, application);
    }

    console.log(`Notifications sent for new application to ${camp.campName}`);
  } catch (error) {
    console.error('Error sending application notifications:', error);
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
    subject: `New Application to ${camp.campName || camp.name} - G8Road CRM`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏕️ G8Road CRM</h1>
          <p style="color: white; margin: 10px 0 0 0;">New Camp Application</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">New Application Received!</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #FF6B35; margin-top: 0;">Camp: ${camp.campName}</h3>
            
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

  const message = `🏕️ New application to ${camp.campName || camp.name}!\n\n` +
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
    subject: `🎉 Welcome to ${camp.campName || camp.name}! - G8Road CRM`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
          <p style="color: white; margin: 10px 0 0 0;">You've been accepted!</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Welcome to ${camp.campName}!</h2>
          
          <p>Dear ${applicant.firstName},</p>
          
          <p>Great news! Your application to join <strong>${camp.campName}</strong> has been approved! 
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
    subject: `Application Update - ${camp.campName || camp.name} - G8Road CRM`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏕️ G8Road CRM</h1>
          <p style="color: white; margin: 10px 0 0 0;">Application Update</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Application Status Update</h2>
          
          <p>Dear ${applicant.firstName},</p>
          
          <p>Thank you for your interest in joining <strong>${camp.campName}</strong>. 
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

module.exports = {
  sendApplicationNotification,
  sendApplicationStatusNotification
};
