import { ethers } from "ethers";
import { syncBuiltinESMExports } from "module";

// const ethers = require('ethers');
require('dotenv').config();
const abi = require('./abi/abi.ts')
const JSONdb = require('simple-json-db')

//TODO: Make this extendible (add your own rpc)
const url1 : string = "http://18.220.145.160:9650/ext/bc/C/rpc"
const url2  = "http://3.132.128.10:9650/ext/bc/C/rpc"
const rpc1 = new ethers.providers.JsonRpcProvider(url1);
const rpc2 = new ethers.providers.JsonRpcProvider(url2);

const PriceSubmitterAddress = "0x1000000000000000000000000000000000000003";
const VoterWhitelisterAddress = "0xa76906EfBA6dFAe155FfC4c0eb36cDF0A28ae24D";

const watching = new JSONdb('./data/watching.json')
const settings = new JSONdb('./data/settings.json')
const history  = new JSONdb('./data/history.json')

var watchAddresses : string[] = watching.get("addresses");

var latestSeenEpoch : number = 0;
var epochProcessingComplete : boolean = true;
var lastEventTimestamp : number = Date.now();

function alertTo(address: string, missed: number) {
    console.log("Mock alert to ", address);
    console.log(settings.get(address));
    console.log("Missed epochs: ", missed);
}

async function detect() {
    //Setup
    console.log("Initializing...")
    console.log("Watching addresses ", watchAddresses)
    var priceSubmitterContract = new ethers.Contract(PriceSubmitterAddress, abi.PriceSubmitterAbi, rpc1);

    console.log("Listening for submits and reveals...")
    priceSubmitterContract.on(priceSubmitterContract.filters.PriceHashesSubmitted(), (submitter: string, _epochId: ethers.BigNumber, ftsos : object, hashes: object[], timestamp: ethers.BigNumber) => {
        var epochId = _epochId.toNumber()
        console.log("Got price hash from ", submitter, epochId, timestamp.toNumber())

        //Update history db with this address for this epoch
        if (!history.has(epochId)) { history.set(epochId, []) }
        var thisEpoch : string[] = history.get(epochId)
        thisEpoch.push(submitter)
        history.set(epochId, thisEpoch)
    })

    priceSubmitterContract.on(priceSubmitterContract.filters.PricesRevealed(), (submitter: string, epochId: ethers.BigNumber, ftsos: object, prices: object[], timestamp: ethers.BigNumber) =>{
        //Set the latest epoch ID, and signal we haven't processed it yet
        latestSeenEpoch = epochId.toNumber();
        epochProcessingComplete = false;
        lastEventTimestamp = Date.now();
        console.log("Got a reveal event from ", submitter);
    })

    //Loop forever after setup
    console.log("Entering main loop")
    while(true) {
        //Start checking previous epoch 30s after all reveals complete
        if (!epochProcessingComplete && (Date.now() - lastEventTimestamp > 30_000)) {
            //Check each address
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
                    alertTo(address, missedLast);
                }
                console.log(address + " missed " + missedLast); 
            })
            console.log("Processed last epoch!")
            epochProcessingComplete = true;

            //TODO: Update watchlist
            //TODO: Health check RPCs
        }

        await sleep(1000);
        //Failsafe if events stop coming for 5 minutes
        if (Date.now() - lastEventTimestamp > 300_000) { process.exit(1) }
    }
}

function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

detect()
