require('dotenv').config();
const mailer = require('nodemailer')

var transporter = mailer.createTransport({
	service: 'gmail',
	auth: {
	  user: process.env.emailAddress,
	  pass: process.env.emailToken
	}
  });

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