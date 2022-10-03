const JSONdb = require("simple-json-db")

const express = require('express')
const path = require('path');
const cors = require('cors')
const watchingdb = new JSONdb(path.join(__dirname, "../data/watching.json"))
const settingsdb = new JSONdb(path.join(__dirname, '../data/settings.json'))



/*
* Let users set and update settings for their address
* Only plaintext authentication - NOT MEANT TO BE SECURE!
* Just to prevent some jackhead from overwriting your settings
*/
function initWebserver() {
    const app = express();

    app.use(express.json())
    app.use(cors())
    app.options('*', cors())

    app.post('/register', async (req, resp) => {
        try {
            req = req.body
            var responseMsg = setOrUpdateAddressSettings(req.address, req.alertAfter, req.email, req.phone, req.password)
            resp.status(200).send(responseMsg)
        } catch {
            resp.status(501).send()
        }
    })

    app.listen(3000, () => {
        console.log("Server is running on 3000")
    })
}

function setOrUpdateAddressSettings(address, alertAfter, email, phone, pass) {
    var watchList = watchingdb.get('addresses');
    console.log(watchList)
    if (watchList.includes(address)) {
        var addrPassword = settingsdb.get(address)["password"]
        if (addrPassword != pass) {
            return "Not authorized"
        }
    } else {
        watchList.push(address)
        watchingdb.set('addresses', watchList);
    }
    var settings = {}
    settings['email'] = email;
    settings['phone'] = phone;
    settings['alertAfter'] = alertAfter;
    settings['password'] = pass
    settingsdb.set(address, settings);
    return "Success"
}

initWebserver()


//TODO: Should support:
//   - Opt-out of messages