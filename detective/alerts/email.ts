/*
*
*   Alas - none of this is working. Good luck.
*
*/

require('dotenv').config();

const {authenticate} = require('@google-cloud/local-auth');
const MailComposer = require('nodemailer/lib/mail-composer');
const {google} = require('googleapis');
const path = require('path');

/*
 *    Begin Authorization Code
 *    One-time run to get valid token (i think)
 *
 * 
 */ 

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'detective/tokens/token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'detective/tokens/credentials.json');

var lastTokenRefreshTime = 0;

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}


/*
 *
 *      End of authorization code.
 *      I believe you only have to run that once, to get a valid token.
 * 
 */ 

const tokens = require('../tokens/token.json');
const credentials = require("../tokens/credentials.json")
const { client_secret, client_id, redirect_uris } = credentials.installed;

const fs = require('fs').promises;

const getGmailService = async () => {
  if (Date.now() - lastTokenRefreshTime > 60 * 60 * 1000) {
    lastTokenRefreshTime = Date.now();
    await authorize();
  }
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  return gmail;
};


const encodeMessage = (message) => {
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const createMail = async (options) => {
  const mailComposer = new MailComposer(options);
  const message = await mailComposer.compile().build();
  return encodeMessage(message);
};

async function sendMail(options) {
  const gmail = await getGmailService();
  const rawMessage = await createMail(options);
  return await gmail.users.messages.send({
    userId: 'me',
    resource: {
      raw: rawMessage,
    },
  });
};

export async function sendEmailAlert(message:string, subject:string, email:string) {
  try {
    var options = {
      to: email,
      subject: subject,
      text: message
    }
    await sendMail(options)
  } catch (e) {
    console.log("[ERROR][EMAIL] Email failed")
  }
}