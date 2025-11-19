exports.SendCarWinNotification = (
  username,
  email,
  carName,
  carId,
  bidAmount,
  userId,
  carImage
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Congratulations - You Won!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; max-width: 600px; margin: 40px auto; background-color: #ffffff; border-collapse: collapse; border: 1px solid #e5e5e5;">
        <!-- Header -->
        <tr>
            <td style="padding: 40px 40px 30px; border-bottom: 1px solid #e5e5e5;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #000000;">
                    Nationwide-Motors-LLC
                </h1>
            </td>
        </tr>
        
        <!-- Congratulations -->
        <tr>
            <td style="padding: 40px 40px 20px;">
                <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #000000;">
                    Congratulations, ${username}!
                </h2>
                <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #666666;">
                    You won the bid for your selected vehicle.
                </p>
            </td>
        </tr>
        
        ${
          carImage
            ? `
        <!-- Car Image -->
        <tr>
            <td style="padding: 0 40px 30px;">
                <img src="${carImage.fileurl}" alt="${carName}" style="width: 100%; height: auto; display: block; border-radius: 4px;">
            </td>
        </tr>
        `
            : ""
        }
        
        <!-- Vehicle Details -->
        <tr>
            <td style="padding: 0 40px 30px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #666666; font-size: 14px;">Car Name</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #000000; font-size: 14px; text-align: right; font-weight: 500;">${carName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #666666; font-size: 14px;">Car ID</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #000000; font-size: 14px; text-align: right; font-weight: 500;">#${carId}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #666666; font-size: 14px;">Winning Bid</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; color: #000000; font-size: 16px; text-align: right; font-weight: 600;">$${bidAmount.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; color: #666666; font-size: 14px;">User ID</td>
                        <td style="padding: 12px 0; color: #000000; font-size: 14px; text-align: right; font-weight: 500;">${userId}</td>
                    </tr>
                </table>
            </td>
        </tr>
        
        <!-- Next Steps -->
        <tr>
            <td style="padding: 0 40px 30px;">
                <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
                    Your invoice is now available on your dashboard. Please complete the purchase process to proceed.
                </p>
                <a href="https://Nationwide-Motors-llc.com/dashboard/" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-size: 14px; font-weight: 500;">
                    View Dashboard
                </a>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="padding: 30px 40px; background-color: #fafafa; border-top: 1px solid #e5e5e5; text-align: center;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #999999;">
                    © 2024 Nationwide-Motors-LLC. All rights reserved.<br>
                    This is an automated message, please do not reply.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};

// Example usage:
// const emailHTML = exports.SendCarWinNotification(
//   "JohnDoe",
//   "john@example.com",
//   "2024 Tesla Model S",
//   "CAR12345",
//   45000,
//   "USER789",
//   "https://example.com/car-image.jpg"
// );
