// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

export function sendEmailAlert(message: string, subject: string, to: string): Promise<boolean> {
// Create sendEmail params 
var params = {
  Destination: { 
    ToAddresses: [
      to
    ]
  },
  Message: {
    Body: { 
      Text: {
       Charset: "UTF-8",
       Data: message
      }
     },
     Subject: {
      Charset: 'UTF-8',
      Data: `[${process.env.network}] ${subject}`
     }
    },
  Source: process.env.sender,
  ReplyToAddresses: [
     process.env.sender,
  ],
};

// Create the promise and SES service object
var sendPromise = new AWS.SES({region: 'us-east-2'}).sendEmail(params).promise();

// Handle promise's fulfilled/rejected states
return sendPromise.then(
  function(data) {
    console.log(data.MessageId);
    return true
  }).catch(
    function(err) {
    console.error(err, err.stack);
    return false
  });
}
