import { doRestart, sendEmailAlert, sendTextAlert } from "./alerts/alerts"

const JSONdb = require('simple-json-db')

var watching = new JSONdb('./data/watching.json')
var settings = new JSONdb('./data/settings.json')
var history  = new JSONdb('./data/history.json')

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

export function doCheckRPCHealth(watchIPs : string[]) {
    //TODO: Impl
}