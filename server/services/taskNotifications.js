const { sendEmail } = require('./emailService');
const db = require('../database/databaseAdapter');

/**
 * Get task URL for email links
 */
const getTaskUrl = (taskIdCode) => {
  const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
  return `${clientUrl}/tasks/${taskIdCode}`;
};

/**
 * Fetch user emails from user IDs or user objects
 */
const fetchUserEmails = async (userIdsOrObjects) => {
  if (!userIdsOrObjects || userIdsOrObjects.length === 0) return [];
  
  const emails = await Promise.all(
    userIdsOrObjects.map(async (userItem) => {
      // If it's already a populated user object, use it directly
      if (userItem && typeof userItem === 'object' && userItem.email) {
        return userItem.email;
      }
      // Otherwise, treat it as an ID and look up the user
      const user = await db.findUser({ _id: userItem });
      return user ? user.email : null;
    })
  );
  
  return emails.filter(email => email && email.trim() !== '');
};

/**
 * Send email notification when task is assigned
 */
const sendTaskAssignmentEmail = async (task, newAssigneeIdsOrObjects) => {
  try {
    const emails = await fetchUserEmails(newAssigneeIdsOrObjects);
    if (emails.length === 0) {
      console.log('⚠️  No valid emails found for new assignees');
      return;
    }

    const taskUrl = getTaskUrl(task.taskIdCode);
    
    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: `You have been assigned to task ${task.taskIdCode}: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">📋 Task Assignment</h1>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
              <div style="background: white; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333; margin-top: 0;">Task Assignment Notification</h2>
                <p>You were assigned to task <strong>${task.taskIdCode}</strong>: "${task.title}".</p>
                
                ${task.description ? `<p><strong>Description:</strong> ${task.description.substring(0, 200)}${task.description.length > 200 ? '...' : ''}</p>` : ''}
                
                <div style="margin: 20px 0; text-align: center;">
                  <a href="${taskUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Task</a>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  You can view and manage this task in your dashboard.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `You were assigned to task ${task.taskIdCode}: "${task.title}". Click here to view: ${taskUrl}`
      });
      console.log(`✅ Task assignment email sent to ${email}`);
    }
  } catch (error) {
    console.error('❌ Error sending task assignment email:', error);
  }
};

/**
 * Send email notification when user is added as watcher
 */
const sendTaskWatcherEmail = async (task, newWatcherIdsOrObjects) => {
  try {
    const emails = await fetchUserEmails(newWatcherIdsOrObjects);
    if (emails.length === 0) {
      console.log('⚠️  No valid emails found for new watchers');
      return;
    }

    const taskUrl = getTaskUrl(task.taskIdCode);
    
    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: `You are now watching task ${task.taskIdCode}: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">👀 Task Watch Notification</h1>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
              <div style="background: white; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333; margin-top: 0;">You're Now Watching This Task</h2>
                <p>You were added as a watcher to task <strong>${task.taskIdCode}</strong>: "${task.title}".</p>
                
                ${task.description ? `<p><strong>Description:</strong> ${task.description.substring(0, 200)}${task.description.length > 200 ? '...' : ''}</p>` : ''}
                
                <div style="margin: 20px 0; text-align: center;">
                  <a href="${taskUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Task</a>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  You'll receive notifications when this task is updated.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `You were added as a watcher to task ${task.taskIdCode}: "${task.title}". Click here to view: ${taskUrl}`
      });
      console.log(`✅ Task watcher email sent to ${email}`);
    }
  } catch (error) {
    console.error('❌ Error sending task watcher email:', error);
  }
};

/**
 * Send email notification when task status changes
 */
const sendTaskStatusChangeEmail = async (task, oldStatus, newStatus) => {
  try {
    // Get all recipients: assignees and watchers
    const recipientIds = [
      ...(task.assignedTo || []),
      ...(task.watchers || [])
    ];
    
    const emails = await fetchUserEmails(recipientIds);
    if (emails.length === 0) {
      console.log('⚠️  No valid emails found for status change notification');
      return;
    }

    const taskUrl = getTaskUrl(task.taskIdCode);
    
    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: `Status updated for ${task.taskIdCode}: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">🔄 Status Update</h1>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
              <div style="background: white; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333; margin-top: 0;">Task Status Changed</h2>
                <p>The status for task <strong>${task.taskIdCode}</strong>: "${task.title}" has been updated.</p>
                
                <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 5px 0;"><strong>Previous Status:</strong> ${oldStatus || 'N/A'}</p>
                  <p style="margin: 5px 0;"><strong>New Status:</strong> ${newStatus}</p>
                </div>
                
                <div style="margin: 20px 0; text-align: center;">
                  <a href="${taskUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Task</a>
                </div>
              </div>
            </div>
          </div>
        `,
        text: `The status for task ${task.taskIdCode}: "${task.title}" has been updated to "${newStatus}". Click here to view: ${taskUrl}`
      });
      console.log(`✅ Task status change email sent to ${email}`);
    }
  } catch (error) {
    console.error('❌ Error sending task status change email:', error);
  }
};

/**
 * Send email notification when task is closed
 */
const sendTaskClosedEmail = async (task) => {
  try {
    // Get all recipients: assignees and watchers
    const recipientIds = [
      ...(task.assignedTo || []),
      ...(task.watchers || [])
    ];
    
    const emails = await fetchUserEmails(recipientIds);
    if (emails.length === 0) {
      console.log('⚠️  No valid emails found for task closed notification');
      return;
    }

    const taskUrl = getTaskUrl(task.taskIdCode);
    
    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: `Task Closed: ${task.taskIdCode}: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">✅ Task Closed</h1>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
              <div style="background: white; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333; margin-top: 0;">Task Completed</h2>
                <p>The task <strong>${task.taskIdCode}</strong>: "${task.title}" has been marked as closed.</p>
                
                <div style="margin: 20px 0; text-align: center;">
                  <a href="${taskUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Task</a>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  Great work! 🎉
                </p>
              </div>
            </div>
          </div>
        `,
        text: `The task ${task.taskIdCode}: "${task.title}" has been marked as closed. Click here to view: ${taskUrl}`
      });
      console.log(`✅ Task closed email sent to ${email}`);
    }
  } catch (error) {
    console.error('❌ Error sending task closed email:', error);
  }
};

/**
 * Send email notification when new comment is added
 */
const sendTaskCommentEmail = async (task, commentText, commentAuthor) => {
  try {
    // Get all recipients: assignees and watchers, but exclude the comment author
    const recipientIds = [
      ...(task.assignedTo || []),
      ...(task.watchers || [])
    ].filter(id => id.toString() !== commentAuthor._id.toString());
    
    const emails = await fetchUserEmails(recipientIds);
    if (emails.length === 0) {
      console.log('⚠️  No valid emails found for comment notification');
      return;
    }

    const taskUrl = getTaskUrl(task.taskIdCode);
    const authorName = commentAuthor.firstName && commentAuthor.lastName 
      ? `${commentAuthor.firstName} ${commentAuthor.lastName}`
      : commentAuthor.email || 'Someone';
    
    for (const email of emails) {
      await sendEmail({
        to: email,
        subject: `New Comment on ${task.taskIdCode}: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">💬 New Comment</h1>
            </div>
            
            <div style="padding: 20px; background: #f9f9f9;">
              <div style="background: white; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333; margin-top: 0;">New Comment on Task</h2>
                <p>A new comment was added to task <strong>${task.taskIdCode}</strong>: "${task.title}".</p>
                
                <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #FF6B35;">
                  <p style="margin: 5px 0 10px 0;"><strong>${authorName}</strong> commented:</p>
                  <p style="margin: 0; color: #333;">${commentText}</p>
                </div>
                
                <div style="margin: 20px 0; text-align: center;">
                  <a href="${taskUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Task & Reply</a>
                </div>
              </div>
            </div>
          </div>
        `,
        text: `A new comment was added to task ${task.taskIdCode}: "${task.title}": "${commentText}". Click here to view: ${taskUrl}`
      });
      console.log(`✅ Task comment email sent to ${email}`);
    }
  } catch (error) {
    console.error('❌ Error sending task comment email:', error);
  }
};

module.exports = {
  sendTaskAssignmentEmail,
  sendTaskWatcherEmail,
  sendTaskStatusChangeEmail,
  sendTaskClosedEmail,
  sendTaskCommentEmail
};

