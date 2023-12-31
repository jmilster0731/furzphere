const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK with your credentials and region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Create an instance of the S3 service
const s3 = new AWS.S3();

// Export the S3 client for use in other modules
module.exports = s3;
