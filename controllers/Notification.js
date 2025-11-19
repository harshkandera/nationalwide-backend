const ErrorHandler = require("../utils/error");
const Car = require("../models/Car");
const User = require("../models/User");
const mongoose = require("mongoose");
const Bid = require("../models/Bid");
const Notification = require("../models/Notification");
const { sendPushNotification } = require("../utils/fcmNotification");



exports.notifyUsers = async (title, carId, bidAmount, userId, imageUrl) => {
  try {
    const message = bidAmount;

    const link = `/browse_auctions/car_details/${carId}`;

    const bids = await Bid.find({ car_id: carId });

    const userIds = bids
      .map(bid => bid.user_id)
      .filter(id => id.toString() !== userId);

    const users = await User.find({ _id: { $in: userIds } });

    // Create notification in DB for each user
    await Promise.all(
      users.map(async (user) => {
        const notification = await Notification.create({
          title,
          body: message,
          link,
          image: imageUrl.fileurl,
        });

        user.notifications.push(notification._id);
        await user.save();
      })
    );

    // ✅ SAFE PUSH NOTIFICATIONS
    await Promise.all(
      users.map(async (user) => {
        if (!user.fcmToken) {
          console.log(`Skipping user (no FCM token): ${user.email}`);
          return;
        }

        try {
          await sendPushNotification(
            user.fcmToken,
            title,
            message,
            imageUrl.fileurl
          );
        } catch (err) {
          console.error(
            `FCM error for user ${user.email}:`,
            err.message || err
          );
        }
      })
    );

  } catch (err) {
    console.error("Error notifying users:", err);
  }
};

  exports.GetUserNotifications = async (req, res) => {
    const userId = req.params.userId; 

    try {
        // Fetch user and populate notifications
        const user = await User.findById(userId).populate('notifications');

        // Check if user exists
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        res.status(200).json({
            success: true,
            data:user.notifications
        });
    } catch (error) {
        console.error('Error fetching user notifications:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


// Mark notification as read
// Mark multiple notifications as read
exports.MarkNotificationAsRead = async (req, res) => {
  const { userId } = req.params;
  const { notificationIds } = req.body; // Expecting an array of notification IDs

  try {
      // Update the isRead field for multiple notifications
      const notifications = await Notification.updateMany(
          { _id: { $in: notificationIds } },
          { isRead: true },
          { new: true }
      );

      // Check if any notifications were updated
      if (notifications.nModified === 0) {
          return res.status(404).json({
              success: false,
              message: 'No notifications found to mark as read.'
          });
      }

      // Send a success response
      res.status(200).json({
          success: true,
          message: 'Notifications marked as read.',
          data: notifications
      });
  } catch (error) {
      console.error('Error marking multiple notifications as read:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// Delete multiple notifications
exports.DeleteNotification = async (req, res) => {
  const { userId } = req.params;
  const { notificationIds } = req.body; // Expecting an array of notification IDs

  try {
      // Find the user and remove the notification IDs from the user's notifications array
      const user = await User.findByIdAndUpdate(
          userId,
          { $pull: { notifications: { $in: notificationIds } } },
          { new: true }
      );

      // Check if user exists
      if (!user) {
          return res.status(404).json({
              success: false,
              message: 'User not found.'
          });
      }

      // Delete the notification documents
      await Notification.deleteMany({ _id: { $in: notificationIds } });

      // Send a success response
      res.status(200).json({
          success: true,
          message: 'Notifications deleted successfully.'
      });
  } catch (error) {
      console.error('Error deleting multiple notifications:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
