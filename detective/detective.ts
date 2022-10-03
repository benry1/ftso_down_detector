import { providers } from "ethers"
import { NodeHealth, NodeSettings, ProviderHistory, ProviderSettings, Result, RPCHealthResponse } from "./abi/interfaces"
import { sendEmailAlert } from "./alerts/email"
import { sendTelegramAlert } from "./alerts/telegram"
import { sendTextAlert } from "./alerts/text"
import { mongo } from "./utils/global"

const fetch = require('node-fetch')

/*
 *
 *  Main Health Checks
 * 
 */

export async function doCheckSubmits(watchAddresses : ProviderSettings[], latestSeenEpoch : number) {
    //We are only checking CONSECUTIVE misses
    //So ignore all misses after a success is seen.
    var misses     : {[address:string]: number} = {}
    var hasSuccess : {[address:string]: boolean} = {}
    watchAddresses.forEach(address => {
        misses[address.address] = 0
        hasSuccess[address.address] = false
    })

    //Get last 20 epochs
    //Get consecutive miss count for each provider
    for (var i = 0; i < 20; i++) {
        var epoch : ProviderHistory = await mongo.getProviderHistory(latestSeenEpoch - i)
        if (epoch == undefined) { continue; } //Skip on mongo failure or missing epoch
        if (epoch.revealed == undefined || epoch.submitted == undefined) { continue; } // Skip on incomplete info
        watchAddresses.forEach(providerSetting => {
            if (epoch.submitted.includes(providerSetting.address) && epoch.revealed.includes(providerSetting.address)) {
                //Successful epoch
                hasSuccess[providerSetting.address] = true
            } else if (!hasSuccess[providerSetting.address]) {
                misses[providerSetting.address]++
            }
        })
    }

    watchAddresses.forEach(providerSetting => {
        var missed     = misses[providerSetting.address]
        var alertAfter = providerSetting.alertAfter
        var maxAlerts  = providerSetting.maxAlerts
        //Alert if they've missed some multiple of their set alert
        //Do not alert if we've already sent their max # of alerts
        if (missed > 0 && missed % alertAfter == 0 && missed <= maxAlerts * alertAfter) {
            alertMissedSubmitsTo(providerSetting, missed)
        }

        console.log(providerSetting.address + " missed " + missed); 
    })
}



export async function doCheckRPCHealth(watchIPs : NodeSettings[], epoch: number) {
    await Promise.allSettled(watchIPs.map(ip => {
        fetch(`http://${ip.ip}:${ip.port}${ip.health}`)
            .then((val : any) => { if (val.status !== 200) { alertNodeUnreachable(ip, val); } else { return val };})
            .then((val : any) => val.text())
            .then((val : string) => JSON.parse(val))
            .then((val: Result) => verifyRPCSettings(ip, val))
            .then((val: NodeHealth) => mongo.updateNodeHealth(epoch, val))
            .catch((e : Error) => console.log("Error checking rpc health: ", e))
    }))
}

/*
 *
 *  Helper Functions
 * 
 */

function verifyRPCSettings(settings: NodeSettings, response: Result) : NodeHealth {
    var isHealthy : boolean = response.healthy
    var peers : number = response.checks.network.message.connectedPeers
    if (!isHealthy || peers < settings.minPeers) {
        alertNodeHealth(<NodeHealth>{ip: settings.ip, healthy: isHealthy, peers: peers}, settings)
    }
    console.log(settings.ip, isHealthy, peers, settings.minPeers)
    return <NodeHealth>{ip: settings.ip, healthy: isHealthy, peers: peers}
}

async function alertNodeUnreachable(ip: NodeSettings, val : any) {
    //TODO: Implement
    console.log("Got a status code ", val.status, " from IP ", ip, ": ", await val.text())
}

async function alertNodeHealth(health: NodeHealth, settings: NodeSettings) {
    var isHealthy : string = health.healthy ? "Healthy" : "Unhealthy"
    var message = health.ip + " was found to be " + isHealthy + " and is connected to " + health.peers + " peers (your set minimum is " + settings.minPeers + ")"
    if (settings.phone != "")    { sendTextAlert(message, settings.phone) }
    if (settings.email != "")    { sendEmailAlert(message, settings.email) }
    if (settings.telegram != "") { sendTelegramAlert(message, settings.telegram) }
    console.log(message)
}

function alertMissedSubmitsTo(settings: ProviderSettings, missed: number) {
    var message = "Detected " + missed + " missed epochs on address " + settings.address + ". Check your provider at your convenience."
    if (settings.phone != "")    { sendTextAlert(message, settings.phone) }
    if (settings.email != "")    { sendEmailAlert(message, settings.email) }
    if (settings.telegram != "") { sendTelegramAlert(message, settings.telegram) }
    console.log(message)
}