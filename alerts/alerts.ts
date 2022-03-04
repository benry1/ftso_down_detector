const twilio = require('twilio');
const twilioClient = new twilio(process.env.twilioAccount, process.env.twilioToken);

export async function sendTextAlert(message: string, phone:string) {
	twilioClient.messages
          .create({
	            body: message,
	            to: phone,
	            from: '+12058439728',
   			});
}

//TODO: Email Alerts
export async function sendEmailAlert(message: string, email:string) {

}