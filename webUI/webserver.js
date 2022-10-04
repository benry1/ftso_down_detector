const express = require('express')
const path = require('path');
const cors = require('cors')
require('dotenv').config()
const { MongoClient } = require('mongodb');

let mongo;
let addressSettings;
let nodeSettings;



/*
* Let users set and update settings for their address
* Only plaintext authentication - NOT MEANT TO BE SECURE!
* Just to prevent some jackhead from overwriting your settings
*/
async function initWebserver() {
    await initializeMongo()
    const app = express();

    app.use(express.json())
    app.use(cors())
    app.options('*', cors())

    app.get('/', async (req, resp) => { 
        resp.sendFile(path.join(__dirname, '/index.html'));
    })

    app.post('/registerProvider', async (req, resp) => {
        try {
            req = req.body
            var responseMsg = await setOrUpdateAddressSettings(req.address, req.alertAfter, req.maxAlerts, req.email, req.phone, req.password)
            resp.status(200).send(responseMsg)
        } catch {
            resp.status(501).send()
        }
    })

    app.post('/registerNode', async (req, resp) => {
        try {
            req = req.body
            var responseMsg = await setOrUpdateNodeSettings(req.ip, req.minPeers, req.maxAlerts, req.health, req.port, req.email, req.phone, req.password)
            resp.status(200).send(responseMsg)
        } catch (e) {
            console.log(e)
            resp.status(501).send()
        }
    })

    app.post('/unsubscribeProvider', async (req, resp) => {
        try {
            var responseMsg = await unsubscribeAddress(req.body.address, req.body.password)
            resp.status(200).send(responseMsg)
        } catch {
            resp.status(501).send()
        }
    })

    app.post('/unsubscribeNode', async (req, resp) => {
        try {
            var responseMsg = await unsubscribeNode(req.body.ip, req.body.password)
            resp.status(200).send(responseMsg)
        } catch { 
            resp.status(501).send()
        }
    })

    app.listen(3000, () => {
        console.log("Server is running on 3000")
    })
}


/*
*       Address Setting Helpers
*
*/

async function authorizeAddress(address, pass) {
    var settings = await getAddressSettings(address)
    return null == settings || settings.password == pass
}

async function setOrUpdateAddressSettings(address, alertAfter, maxAlerts, email, phone, pass) {
    if (await authorizeAddress(address, pass)) {
        addProviderSettings(address, alertAfter, maxAlerts, email, phone, pass)
        return "Success"
    } else {
        return "Unauthorized"
    }
}

async function unsubscribeAddress(address, pass) {
    if (await authorizeAddress(address, pass)) {
        removeProviderSettings(address)
        return "Success"
    } else {
        return "Unauthorized"
    }
}

/*
*   Node Setting Helpers
*
*/

async function authorizeNode(ip, pass) {
    var settings = await getNodeSettings(ip)
    return null == settings || settings.password == pass
}

async function setOrUpdateNodeSettings(ip, maxAlerts, minPeers, health, port, email, phone, password) {
    if (await authorizeNode(ip, password)) {
        addNodeSettings(ip, port, health, email, phone, minPeers, maxAlerts, password)
        return "Success"
    } else {
        return "Unauthorized"
    }
}

async function unsubscribeNode(ip, pass) {
    if (await authorizeNode(ip, pass)) {
        removeNodeSettings(ip)
        return "Success"
    } else {
        return "Unauthorized"
    }
}

/*
*   Mongo Connection Helpers
*
*/

async function initializeMongo() {
    mongo = new MongoClient(process.env.mongoURI)
    await mongo.connect()
    addressSettings = mongo.db(process.env.dbName).collection("providerSettings")
    nodeSettings    = mongo.db(process.env.dbName).collection("nodeSettings") 
}


async function addProviderSettings(address, alertAfter, maxAlerts, email, phone, password) {
    try {
        await addressSettings.findOneAndUpdate({address: address}, {$set: {address: address, alertAfter: alertAfter, email: email, phone: phone, maxAlerts: maxAlerts, password: password}}, {upsert:true})
    } catch (e) {
        console.error("[MONGODB] Failed to add or modify provider settings...",e)
    }
}

async function addNodeSettings(ip, port, health, email, phone, minPeers, maxAlerts, password) {
    try {
        await nodeSettings.findOneAndUpdate({ip: ip}, {$set: {ip: ip, port: port, health: health, minPeers: minPeers, email: email, phone: phone, maxAlerts: maxAlerts, password: password}}, {upsert:true})
    } catch (e) {
        console.error("[MONGODB] Failed to add or modify node settings...",e)
    }
}

async function getAddressSettings(address) {
    try {
        return (await addressSettings.findOne({address: address}))
    } catch (e) {
        console.error("[MONGODB] Failed to read provider watchlist: ", e)
    }
    return null
}

async function getNodeSettings(ip) {
    try {
        return (await nodeSettings.findOne({ip: ip}))
    } catch (e) {
        console.error("[MONGODB] Failed to read provider watchlist: ", e)
    }
    return null
}

async function removeProviderSettings(address) {
    try {
        await addressSettings.deleteOne({address: address})
    } catch (e) {
        console.error("[MONGODB] Failed to delete provider settings...",e)
    }
}

async function removeNodeSettings(ip) {
    try {
        console.log(ip)
        await nodeSettings.deleteOne({ip: ip})
    } catch (e) {
        console.error("[MONGODB] Failed to delete node settings...",e)
    }
}

initWebserver()