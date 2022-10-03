import { Mongo } from "./mongo";

export let mongo : Mongo;
export function setMongo(client: Mongo) {
    mongo = client;
}