/*
 *      RPC Health Response
 *
 */

import { Document, WithId } from "mongodb";

export interface RPCHealthResponse {
    jsonrpc: string;
    result:  Result;
    id:      number;
}

export interface Result {
    checks:  Checks;
    healthy: boolean;
}

export interface Checks {
    C:            C;
    P:            C;
    X:            X;
    bootstrapped: Bootstrapped;
    network:      Network;
    router:       Router;
}

export interface C {
    message:   CMessage;
    timestamp: Date;
    duration:  number;
}

export interface CMessage {
    consensus: PurpleConsensus;
    vm:        VM | null;
}

export interface PurpleConsensus {
    longestRunningBlock: string;
    outstandingBlocks:   number;
}

export interface VM {
    percentConnected: number;
}

export interface X {
    message:   XMessage;
    timestamp: Date;
    duration:  number;
}

export interface XMessage {
    consensus: FluffyConsensus;
    vm:        null;
}

export interface FluffyConsensus {
    outstandingVertices: number;
    snowstorm:           Snowstorm;
}

export interface Snowstorm {
    outstandingTransactions: number;
}

export interface Bootstrapped {
    message:   any[];
    timestamp: Date;
    duration:  number;
}

export interface Network {
    message:   NetworkMessage;
    timestamp: Date;
    duration:  number;
}

export interface NetworkMessage {
    connectedPeers:           number;
    sendFailRate:             number;
    timeSinceLastMsgReceived: string;
    timeSinceLastMsgSent:     string;
}

export interface Router {
    message:   RouterMessage;
    timestamp: Date;
    duration:  number;
}

export interface RouterMessage {
    longestRunningRequest: string;
    outstandingRequests:   number;
}


/*
 *  Internal Interfaces
 *
 */

export interface NodeHealth extends WithId<Document> {
    ip: string,
    healthy: boolean,
    peers: number
}

export interface NodeSettings extends WithId<Document> {
    ip: string
    port: string
    health: string,
    minPeers: number,
    maxAlerts: number,
    password: string
}

export interface ProviderSettings extends WithId<Document> {
    address: string,
    alertAfter: number,
    maxAlerts: number,
    email: string,
    phone: string,
    password: string

}

export interface ProviderHistory extends WithId<Document> {
    epoch: number,
    submitted: string[],
    revealed: string[]
}