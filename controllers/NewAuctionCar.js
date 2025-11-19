const ErrorHandler = require("../utils/error");
const cloudinary = require("cloudinary").v2;
const Car = require("../models/Car");
const VehicleFeature = require("../models/VehicleFeatures");
const Bid = require("../models/Bid");
const User = require("../models/User");
const { updateHighestBid } = require("../services/firebaseService");
const mongoose = require("mongoose");
const { notifyUsers } = require("./Notification");
const cron = require("node-cron");

/**
 * Create / update a bid for a car
 */
exports.CreateBidding = async (req, res, next) => {
  let session;

  try {
    const { bidAmount } = req.body;
    const { carId: car_id, userId: user_id } = req.params;

    // Basic validation (no session yet)
    if (!car_id || !user_id || bidAmount === undefined || bidAmount === null) {
      return next(new ErrorHandler("All fields are required", 400));
    }

    if (
      !mongoose.isValidObjectId(car_id) ||
      !mongoose.isValidObjectId(user_id)
    ) {
      return next(new ErrorHandler("Invalid car or user ID", 400));
    }

    const numericBidAmount = Number(bidAmount);
    if (!Number.isFinite(numericBidAmount) || numericBidAmount <= 0) {
      return next(new ErrorHandler("Invalid bid amount", 400));
    }

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    const car = await Car.findById(car_id).session(session);
    const user = await User.findById(user_id).session(session);

    if (!car) {
      throw new ErrorHandler("Car not found", 404);
    }

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const isProfileCompleted = user.isProfileCompleted;

    if (!isProfileCompleted) {
      // profile incomplete is not an "error", return 200 but clean up transaction
      await session.abortTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Profile is not completed.",
        data: {
          isProfileCompleted,
        },
      });
    }

    // Auction status/time validation
    const now = new Date();

    if (car.status === "draft" || car.status === "past") {
      throw new ErrorHandler("Car is not live", 400);
    }

    if (now > new Date(car.endTime) || car.status === "past") {
      throw new ErrorHandler("Car Auction has ended", 400);
    }

    if (now < new Date(car.startTime) || car.status === "draft") {
      throw new ErrorHandler("Car Auction has not started yet", 400);
    }

    // If Buy Now is enabled, prevent bids above Buy Now price
    if (car?.buyNow?.isBuyNow) {
      const buyNowPrice = Number(car.buyNow.buyNowPrice);
      if (Number.isFinite(buyNowPrice) && numericBidAmount > buyNowPrice) {
        throw new ErrorHandler(
          `Bid amount should not be greater than ${buyNowPrice}`,
          400
        );
      }
    }

    // Active bids limit per user
    // const activeBidsForUser = await Bid.find({
    //   user_id,
    //   status: "active",
    // }).session(session);

    // if (activeBidsForUser.length >= 2) {
    //   throw new ErrorHandler(
    //     "New clients are allowed to participate in maximum 2 auctions simultaneous.",
    //     400
    //   );
    // }

    // Minimum required bid calculation
    const baseAmount =
      car.highestBid != null ? Number(car.highestBid) : Number(car.price);
    const minDiff = Number(car.minimumBidDifference || 0);
    const minRequiredBid = baseAmount + minDiff;

    // Require bid >= minRequiredBid
    if (numericBidAmount < minRequiredBid) {
      throw new ErrorHandler(
        `Bid amount should be at least ${minRequiredBid}`,
        400
      );
    }

    // Check if user already has an active bid on this car
    const activeBidForThisCar = await Bid.findOne({
      user_id,
      car_id,
      status: "active",
    }).session(session);

    if (activeBidForThisCar) {
      // Append new bid to existing bid document
      activeBidForThisCar.bids.push({
        bidAmount: numericBidAmount,
        bid_time: new Date(),
      });

      activeBidForThisCar.status = "active";

      // Update car
      car.highestBid = numericBidAmount;
      car.highestBidder = user_id;
      car.bidTime = new Date();
      car.totalBids += 1;

      await Promise.all([
        car.save({ session }),
        activeBidForThisCar.save({ session }),
      ]);

      // Notify users (title, carId, bidAmount, userId, imageUrl)
      await notifyUsers(
        car.name,
        car_id,
        numericBidAmount,
        user_id,
        car.images?.[0] || ""
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Bid updated successfully",
      });
    }

    // No active bid yet → create new bid document
    const newBidArr = await Bid.create(
      [
        {
          car_id,
          user_id,
          bids: [{ bidAmount: numericBidAmount, bid_time: new Date() }],
          status: "active",
        },
      ],
      { session }
    );

    const newBid = newBidArr[0];

    // Update car & user with bid references
    if (!Array.isArray(car.bids)) car.bids = [];
    car.bids.push({ bidId: newBid._id });

    car.highestBid = numericBidAmount;
    car.highestBidder = user_id;
    car.bidTime = new Date();
    car.totalBids += 1;

    if (!Array.isArray(user.biddingHistory)) user.biddingHistory = [];
    user.biddingHistory.push({ bidId: newBid._id });

    await Promise.all([car.save({ session }), user.save({ session })]);

    // Notify
    await notifyUsers(
      car.name,
      car_id,
      numericBidAmount,
      user_id,
      car.images?.[0] || ""
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Bid placed successfully",
      data: { bid: newBid, isProfileCompleted },
    });
  } catch (err) {
    console.log(err);
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (e) {
        console.error("Error aborting transaction:", e);
      }
      session.endSession();
    }
    next(err);
  }
};


/**
 * Cron job to check for ended auctions every 5 minutes
 */


cron.schedule("*/5 * * * *", async () => {
  try {
    const auctions = await Car.find({
      status: "live",
      endTime: { $lte: Date.now() },
    });

    if (auctions.length > 0) {
      await endAuctionsInBulk(auctions);
    }
  } catch (err) {
    console.error("Error during auction check:", err);
  }
});




/**
 * Function to end auctions in bulk and update bid statuses
 * If a session is passed, it will be reused; otherwise, it creates its own.
 */
const endAuctionsInBulk = async (auctions, existingSession = null) => {
  let session = existingSession;

  try {
    if (!session) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const auctionIds = auctions.map((auction) => auction._id);

    await Car.updateMany(
      { _id: { $in: auctionIds } },
      { $set: { status: "past" } },
      { session }
    );

    for (const auction of auctions) {
      const { _id: carId, highestBidder } = auction;

      if (highestBidder) {
        // Mark highest bidder as winner
        await Bid.updateOne(
          { car_id: carId, user_id: highestBidder, status: "active" },
          { $set: { status: "winner" } },
          { session }
        );

        // Mark all other active bids as completed
        await Bid.updateMany(
          {
            car_id: carId,
            user_id: { $ne: highestBidder },
            status: "active",
          },
          { $set: { status: "completed" } },
          { session }
        );
      } else {
        // No highest bidder → mark all active bids as completed
        await Bid.updateMany(
          { car_id: carId, status: "active" },
          { $set: { status: "completed" } },
          { session }
        );
      }
    }

    if (!existingSession) {
      await session.commitTransaction();
      session.endSession();
    }

    console.log(
      `${auctionIds.length} auctions ended. Highest bidders marked as 'winner' and other bids marked as 'completed'.`
    );
  } catch (err) {
    if (!existingSession && session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (e) {
        console.error("Error aborting transaction in endAuctionsInBulk:", e);
      }
      session.endSession();
    }
    console.error("Error ending auctions and updating bid statuses:", err);
    throw err; // rethrow if called inside another transaction
  }
};

/**
 * Buy Now handler
 * Option A: Uses endAuctionsInBulk with the same session to end auction instantly.
 */
exports.BuyNow = async (req, res, next) => {
  let session;

  try {
    const { carId: car_id, userId: user_id } = req.params;

    if (!car_id || !user_id) {
      return next(new ErrorHandler("All fields are required", 400));
    }

    if (
      !mongoose.isValidObjectId(car_id) ||
      !mongoose.isValidObjectId(user_id)
    ) {
      return next(new ErrorHandler("Invalid car or user ID", 400));
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const car = await Car.findById(car_id).session(session);
    const user = await User.findById(user_id).session(session);

    if (!car) {
      throw new ErrorHandler("Car not found", 404);
    }

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    if (!user.isProfileCompleted) {
      await session.abortTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Profile is not completed.",
        data: {
          isProfileCompleted: user.isProfileCompleted,
        },
      });
    }

    if (!car.buyNow?.isBuyNow) {
      throw new ErrorHandler("Buy Now is not enabled for this car", 400);
    }

    const buyNowPrice = Number(car.buyNow.buyNowPrice);
    if (!Number.isFinite(buyNowPrice) || buyNowPrice <= 0) {
      throw new ErrorHandler("Buy Now price is not set", 400);
    }

    const bidAmount = buyNowPrice;

    if (car.status === "draft" || car.status === "past") {
      throw new ErrorHandler("Car is not live", 400);
    }

    const currentTime = new Date();
    if (currentTime > new Date(car.endTime) || car.status === "past") {
      throw new ErrorHandler("Car Auction has ended", 400);
    }

    if (currentTime < new Date(car.startTime) || car.status === "draft") {
      throw new ErrorHandler("Car Auction has not started yet", 400);
    }

    let activeBidForThisCar = await Bid.findOne({
      user_id,
      car_id,
      status: "active",
    }).session(session);

    if (activeBidForThisCar) {
      // Update existing bid document
      activeBidForThisCar.bids.push({
        bidAmount,
        bid_time: new Date(),
      });

      activeBidForThisCar.status = "active";
    } else {
      // Create new bid document
      const newBidArr = await Bid.create(
        [
          {
            car_id,
            user_id,
            bids: [{ bidAmount, bid_time: new Date() }],
            status: "active",
          },
        ],
        { session }
      );
      activeBidForThisCar = newBidArr[0];

      car.bids = car.bids || [];
      car.bids.push({ bidId: activeBidForThisCar._id });

      user.biddingHistory = user.biddingHistory || [];
      user.biddingHistory.push({ bidId: activeBidForThisCar._id });
    }

    // Update car and user
    car.highestBid = bidAmount;
    car.highestBidder = user_id;
    car.bidTime = new Date();
    car.totalBids += 1;

    user.buyNowCount = (user.buyNowCount || 0) + 1;

    await Promise.all([
      car.save({ session }),
      user.save({ session }),
      activeBidForThisCar.save({ session }),
    ]);

    // Notify users
    await notifyUsers(
      car.name,
      car_id,
      bidAmount,
      user_id,
      car.images?.[0] || ""
    );

    // End auction immediately using shared session
    await endAuctionsInBulk([car], session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Car bought successfully",
    });
  } catch (error) {
    if (session) {
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
      } catch (e) {
        console.error("Error aborting transaction in BuyNow:", e);
      }
      session.endSession();
    }
    next(error);
  }
};
