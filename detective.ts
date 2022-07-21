import { Result, RPCHealthResponse } from "./abi/interfaces"
import { doRestart, sendEmailAlert, sendTextAlert } from "./alerts/alerts"

const JSONdb = require('simple-json-db')
const fetch = require('node-fetch')

var watching = new JSONdb('./data/watching.json')
var settings = new JSONdb('./data/settings.json')
var history  = new JSONdb('./data/history.json')

/*
 *
 *  Main Health Checks
 * 
 */

export function doCheckSubmits(watchAddresses : string[], latestSeenEpoch : number) {
    watchAddresses.forEach(address =>{
        var missedLast = 0;
        var alertAfter = settings.get(address)["alertAfter"]

        console.log("checking on " , address, alertAfter)
        for (var i = 0; i < 20; i++) {
            if (!history.has(latestSeenEpoch - i)) { continue; }
            if (!history.get(latestSeenEpoch - i).includes(address)) {
                missedLast++;
            } else {
                //Only interested in consecutive misses, not all misses
                break;
            }
        }

        //Want to send max of 3 alerts, after each N misses they configured //&& 
        if (missedLast > 0 && missedLast % alertAfter == 0 && missedLast <= 3 * alertAfter) {
            alertMissedSubmitsTo(address, missedLast);
        }
        console.log(address + " missed " + missedLast); 
    })
}



export async function doCheckRPCHealth(watchIPs : string[]) {
    await Promise.allSettled(watchIPs.map(ip => {
        fetch("http://" + ip + ":9650/ext/health")
            .then((val : any) => { if (val.status !== 200) { alertNodeOffline(ip, val); } else { return val };})
            .then((val : any) => val.text())
            .then((val : string) => JSON.parse(val))
            .then((val: Result) => verifyRPCSettings(ip, val))
            .catch((e : Error) => console.log("Error checking rpc health: ", e))
    }))
}

/*
 *
 *  Helper Functions
 * 
 */

function verifyRPCSettings(ip: string, response: Result) {
    console.log(response)
    var minimumPeers = settings.get(ip)["minimumPeers"]
    var isHealthy : boolean = response.healthy
    var peers : number = response.checks.network.message.connectedPeers
    if (!isHealthy || peers < minimumPeers) {
        alertNodeHealth(ip, isHealthy, peers, minimumPeers)
    }
}

async function alertNodeOffline(ip: string, val : any) {
    //TODO: Implement
    console.log("Got a status code ", val.status, " from IP ", ip, ": ", await val.text())
}

async function alertNodeHealth(ip:string, healthy:boolean, peers:number, minimumPeers:number) {
    //TODO: Implement alert
    var isHealthy : string = healthy ? "Healthy" : "Unhealthy"
    console.log(ip, " was found to be " + isHealthy + " and is connected to " + peers + " peers (your set minimum is ", minimumPeers, ")")
}

function alertMissedSubmitsTo(address: string, missed: number) {
    var message = "Detected " + missed + " missed epochs on address " + address + ". Check your provider at your convenience. Thanks!"
    var phone = settings.get(address)['phone']
    var email = settings.get(address)['email']
    var retry = settings.get(address)['restart']
    //TODO: Remove text alerts in favor of telegram alerts
    if (phone != "") { sendTextAlert(message, phone) }
    if (email != "") { sendEmailAlert(message, email) }
    if (typeof retry !== "undefined" && retry !== "") { doRestart() }
}

doCheckRPCHealth(["3.132.128.11"])