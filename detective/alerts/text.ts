require('dotenv').config();
const twilio = require('twilio');
const twilioClient = new twilio(process.env.twilioAccount, process.env.twilioToken);

export async function sendTextAlert(message: string, phone:string) {
	twilioClient.messages
          .create({
	            body: message,
	            to: phone,
	            from: process.env.twilioNumber,
   			});
}
