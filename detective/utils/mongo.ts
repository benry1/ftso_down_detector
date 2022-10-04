import { Collection, MongoClient } from "mongodb";
import { NodeHealth, NodeSettings, ProviderHistory, ProviderSettings } from "../abi/interfaces";
require('dotenv').config()

export class Mongo {
    client: MongoClient;
    
    addrSettings  : Collection;
    nodeSettings  : Collection;
    addrHistory   : Collection;
    nodeHistory   : Collection;

    constructor(url: string) {
        this.client = new MongoClient(url)
    }

    async initialize() {
        await this.client.connect()
        this.addrSettings = this.client.db(process.env.dbName!).collection("providerSettings")
        this.nodeSettings = this.client.db(process.env.dbName!).collection("nodeSettings")
        this.addrHistory  = this.client.db(process.env.dbName!).collection("providerHistory")
        this.nodeHistory  = this.client.db(process.env.dbName!).collection("nodeHistory")
    }

    /*
     *      Watching Functions
     *
     */

    async getWatchAddresses() : Promise<ProviderSettings[]> {
        try {
            return (await this.addrSettings.find({}).toArray()) as ProviderSettings[]
        } catch (e) {
            console.error("[MONGODB] Failed to read provider watchlist: ", e)
        }
        return Array()
    }

    async getWatchNodes() : Promise<NodeSettings[]> {
        try {
            return (await this.nodeSettings.find({}).toArray()) as NodeSettings[]
        } catch (e) {
            console.error("[MONGODB] Failed to read node watchlist: ", e)
        }
        return Array()
    }

    /*
     *      History Functions
     *
     */ 

    async updateSubmits(epochNumber: number, submitter: string) {
        try {
            await this.addrHistory.updateOne({epoch: epochNumber}, { $set: {epoch: epochNumber}, $push : { "submitted" : submitter }}, { upsert: true})
        } catch (e) {
            console.error("[MONGODB] Failed to write history: ", e)
        }
    }

    async updateReveals(epochNumber: number, submitter: string) {
        try {
            await this.addrHistory.updateOne({epoch: epochNumber}, { $set: {epoch: epochNumber}, $push : { "revealed" : submitter }}, { upsert: true})
        } catch (e) {
            console.error("[MONGODB] Failed to write history: ", e)
        }
    }

    async getProviderHistory(epochNumber: number) : Promise<ProviderHistory> {
        try {
            return await this.addrHistory.findOne({epoch: epochNumber}) as ProviderHistory
        } catch (e) {
            console.error("[MONGODB] Failed to read history: ", e)
        }
        return <ProviderHistory>{}
    }

    async updateNodeHealth(epochNumber: number, health: NodeHealth) {
        try {
            await this.nodeHistory.insertOne({epoch: epochNumber, ip: health.ip, healthy: health.healthy, peers: health.peers})
        } catch (e) {
            console.error("[MONGODB] Failed to write node health: ", e)
        }
    }

    async getNodeHealthHistory(epochNumber: number, ip: string, numEpochs: number) : Promise<NodeHealth[]> {
        var healths : NodeHealth[] = Array()
        try {
            for (var i = 0; i < numEpochs; i++) {
                var thisEpochHealth = (await this.nodeHistory.findOne({epoch: epochNumber - 1, ip: ip})) as NodeHealth
                if (thisEpochHealth !== null && thisEpochHealth !== undefined) {
                    healths.push(thisEpochHealth)
                }
            }
        } catch (e) {
            console.error("[MONGODB] Failed to read node health: ", e)
        }
        return healths;
    }

    /*
     *      Mongo Health Functions
     *
     */ 

    async cleanHistory(currentEpoch: number, length: number) {
        try {
            await this.nodeHistory.deleteMany({epoch: { $lt: currentEpoch - length}})
            await this.addrHistory.deleteMany({epoch: { $lt: currentEpoch - length}})
        } catch (e) {
            console.error("[MONGODB] Failed to clean history:", e)
        }
    }

}