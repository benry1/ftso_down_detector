import { ethers } from "ethers";
import { hasOnlyExpressionInitializer } from "typescript";
import { sendTextAlert, sendEmailAlert, doRestart } from "./alerts/alerts"
import { doCheckSubmits } from "./detective";

// const ethers = require('ethers');
require('dotenv').config();
const abi = require('./abi/abi.ts')
const JSONdb = require('simple-json-db')

//TODO: Make this extendible (add your own rpc)
const url  = "http://" + process.env.rpcIp + ":9650/ext/bc/C/rpc"
const rpc = new ethers.providers.JsonRpcProvider(url);

const PriceSubmitterAddress = "0x1000000000000000000000000000000000000003";
const VoterWhitelisterAddress = "0xa76906EfBA6dFAe155FfC4c0eb36cDF0A28ae24D";

var watching = new JSONdb('./data/watching.json')
var settings = new JSONdb('./data/settings.json')
var history  = new JSONdb('./data/history.json')

var watchAddresses : string[] = watching.get("addresses");

var latestSeenEpoch : number = 0;
var epochProcessingComplete : boolean = true;
var lastEventTimestamp : number = Date.now();

async function detect() {
    initialize()

    //Loop forever after setup
    console.log("Entering main loop")
    while(true) {
        //Start checking previous epoch 30s after all reveals complete
        if (!epochProcessingComplete && (Date.now() - lastEventTimestamp > 30_000)) {
            //Check each address
            doCheckSubmits(watchAddresses, latestSeenEpoch)
            console.log("Processed last epoch!")
            epochProcessingComplete = true;

            //Update watchlist
            watching = new JSONdb("./data/watching.json")
            watchAddresses = watching.get("addresses");
            console.log(watchAddresses)

            //TODO: Health check RPCs
        }

        await sleep(1000);
        //Failsafe if events stop coming for 5 minutes
        if (Date.now() - lastEventTimestamp > 300_000) { process.exit(1) }
    }
}

function initialize() {
    //Setup
    console.log("Initializing...")
    console.log("Watching addresses ", watchAddresses)
    var priceSubmitterContract = new ethers.Contract(PriceSubmitterAddress, abi.PriceSubmitterAbi, rpc);

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
}

function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

detect()
