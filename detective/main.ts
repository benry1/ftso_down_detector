import { ethers } from "ethers";
import { Collection, MongoClient } from "mongodb";
import { NodeSettings, ProviderSettings } from "./abi/interfaces";
import { doCheckRPCHealth, doCheckSubmits } from "./detective";
import { mongo, setMongo } from "./utils/global";
import { Mongo } from "./utils/mongo"

// const ethers = require('ethers');
require('dotenv').config();
const abi = require('./abi/abi.ts')

const trustedNode1  = `ws://${process.env.node1}:9650/ext/bc/C/ws`
const trustedNode2 = `ws://${process.env.node2}:9650/ext/bc/C/ws`
const rpc1 = new ethers.providers.WebSocketProvider(trustedNode1);
const rpc2 = new ethers.providers.WebSocketProvider(trustedNode2)

const PriceSubmitterAddress = "0x1000000000000000000000000000000000000003";

var watchAddresses : ProviderSettings[] = Array()
var watchNodes     : NodeSettings[]     = Array()

var latestSeenEpoch : number = 0;
var epochProcessingComplete : boolean = true;
var lastRevealTimestamp : number = Date.now();

//We only want to write each address to the db once
//Even when both connections see it.
var submitCache : {[epoch:number]:string[]} = {}
var revealCache : {[epoch:number]:string[]} = {}

async function detect() {
    await initialize()

    //Loop forever after setup
    console.log("Entering main loop")
    while(true) {
        //Start checking previous epoch 30s after all reveals complete
        if (!epochProcessingComplete && (Date.now() - lastRevealTimestamp > 30_000)) {
            //Update Watchlists
            watchAddresses = await mongo.getWatchAddresses()
            watchNodes     = await mongo.getWatchNodes()

            //Check each address
            doCheckSubmits(watchAddresses, latestSeenEpoch)

            //Check each node
            doCheckRPCHealth(watchNodes, latestSeenEpoch)

            //Clear last epoch cache
            delete submitCache[latestSeenEpoch]
            delete revealCache[latestSeenEpoch]

            //Clean old data from mongo
            mongo.cleanHistory(latestSeenEpoch, 100)
            
            console.log("Processed last epoch!")
            epochProcessingComplete = true;
            
            console.log(watchAddresses.map(settings=>settings.address))
            console.log(watchNodes.map(settings=>settings.ip))
        }

        await sleep(1000);
        //Failsafe if events stop coming for 5 minutes
        if (Date.now() - lastRevealTimestamp > 300_000) { process.exit(1) }
    }
}

async function initialize() {
    //Setup
    console.log("Initializing...")
    setMongo(new Mongo(process.env.mongoURI!))
    await mongo.initialize()
    watchAddresses = await mongo.getWatchAddresses();
    watchNodes     = await mongo.getWatchNodes();
    
    console.log("Watching addresses ", watchAddresses.map(settings => settings.address))
    console.log("Wathing Nodes", watchNodes.map(settings => settings.ip))
    //Creating a listener on two RPCs for parity
    //If at least one sees the submit, it went through
    var priceSubmitterContract1;
    var priceSubmitterContract2;

    console.log("Listening for submits and reveals...")
    if (process.env.network == "SONGBIRD") {
        priceSubmitterContract1 = new ethers.Contract(PriceSubmitterAddress, abi.PriceSubmitterAbi, rpc1);
        priceSubmitterContract2 = new ethers.Contract(PriceSubmitterAddress, abi.PriceSubmitterAbi, rpc2);
        priceSubmitterContract1.on(priceSubmitterContract1.filters.PriceHashesSubmitted(), handleHashSubmitted_songbird)
        priceSubmitterContract2.on(priceSubmitterContract2.filters.PriceHashesSubmitted(), handleHashSubmitted_songbird)
        priceSubmitterContract1.on(priceSubmitterContract1.filters.PricesRevealed(), handlePriceRevealed_songbird)
        priceSubmitterContract2.on(priceSubmitterContract2.filters.PricesRevealed(), handlePriceRevealed_songbird)
    } else if (process.env.network == "FLARE") {
        priceSubmitterContract1 = new ethers.Contract(PriceSubmitterAddress, abi.PriceSubmitterAbi_Flare, rpc1);
        priceSubmitterContract2 = new ethers.Contract(PriceSubmitterAddress, abi.PriceSubmitterAbi_Flare, rpc2);
        priceSubmitterContract1.on(priceSubmitterContract1.filters.HashSubmitted(), handleHashSubmitted_flare)
        priceSubmitterContract2.on(priceSubmitterContract2.filters.HashSubmitted(), handleHashSubmitted_flare)
        priceSubmitterContract1.on(priceSubmitterContract1.filters.PricesRevealed(), handlePriceRevealed_flare)
        priceSubmitterContract2.on(priceSubmitterContract2.filters.PricesRevealed(), handlePriceRevealed_flare)
    }
}

function handleHashSubmitted_songbird(submitter: string, _epochId: ethers.BigNumber, ftsos : object, hashes: object[], timestamp: ethers.BigNumber) {
    handleHashSubmitted(submitter, _epochId.toNumber(), timestamp.toNumber())
}
function handleHashSubmitted_flare(submitter: string, _epochId: ethers.BigNumber, hash: object, timestamp: ethers.BigNumber) {
    handleHashSubmitted(submitter, _epochId.toNumber(), timestamp.toNumber())
}

function handleHashSubmitted(submitter: string, epochId: number, timestamp: number) {
    submitter = submitter.toLowerCase()

    if (watchAddresses.filter(settings => settings.address == submitter).length > 0) {
        console.log("Got price hash from ", submitter, epochId, timestamp)
    }

    //Update history db with this address for this epoch
    if (submitCache[epochId] == undefined) { 
        submitCache[epochId] = Array() 
        console.log("Began getting submits for ", epochId)
    }
    if (!submitCache[epochId].includes(submitter)) {
        submitCache[epochId].push(submitter)
        mongo.updateSubmits(epochId, submitter)
    }
}

function handlePriceRevealed_songbird(submitter: string, _epochId: ethers.BigNumber, ftsos : object, hashes: object[], timestamp: ethers.BigNumber) {
    handlePriceRevealed(submitter, _epochId.toNumber(), timestamp.toNumber())
}
function handlePriceRevealed_flare(submitter: string, _epochId: ethers.BigNumber, ftsos: object[], prices: ethers.BigNumber[], randoms: ethers.BigNumber[], timestamp: ethers.BigNumber) {
    handlePriceRevealed(submitter, _epochId.toNumber(), timestamp.toNumber())
}

function handlePriceRevealed(submitter: string, epochId: number, timestamp: number) {
      //Set the latest epoch ID, and signal we haven't processed it yet
      submitter = submitter.toLowerCase()
      latestSeenEpoch = epochId
  
      epochProcessingComplete = false;
      lastRevealTimestamp = Date.now();
      if (watchAddresses.filter(settings => settings.address == submitter).length > 0) {
          console.log("Got a reveal event from ", submitter);
      }
  
      //Update history db with this address for this epoch
      if (revealCache[epochId] == undefined) { 
          revealCache[epochId] = Array() 
          console.log("Began getting reveals for ", epochId)
      }
      if (!revealCache[epochId].includes(submitter)) {
          revealCache[epochId].push(submitter)
          mongo.updateReveals(epochId, submitter)
      }
}

function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

detect()
