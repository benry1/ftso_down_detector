import { exec, ExecException } from "child_process";

require('dotenv').config();
const twilio = require('twilio');
const mailer = require('nodemailer')
const twilioClient = new twilio(process.env.twilioAccount, process.env.twilioToken);

var transporter = mailer.createTransport({
	service: 'gmail',
	auth: {
	  user: process.env.emailAddress,
	  pass: process.env.emailToken
	}
  });

export async function sendTextAlert(message: string, phone:string) {
	twilioClient.messages
          .create({
	            body: message,
	            to: phone,
	            from: '+12058439728',
   			});
}

export async function sendEmailAlert(message: string, email:string) {
	//@ts-ignore
	transporter.sendMail({from: process.env.emailAddress, to: email, subject: "FTSO Provider Alert", text: message}, (error, info) => {
		if (error) {
			console.log(error);
		} else {
			console.log("Sent alert email to ", email)
		}
	})
}

export function doRestart() {
	console.log("Restarting provider...")
	var x = exec("pm2 restart provider")
	console.log("Result: " + x)
}