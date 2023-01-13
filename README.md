This project contains two apps

## Detective
- A daemon script that continuously monitors FTSO price submissions and reveals
- Will send alerts based on settings chosen by the provider

## WebUI
- A (very) simple UI, where providers can opt in to alerts and update their preferences

## Setup
Set up for a mongo database with 4 collections:
1. providerSettings - where you register a provider to be tracked
2. providerHistory - submit history
3. nodeSettings - where you register an RPC to be tracked
4. nodeHistory - health history

Run 'npm install' with node v16 or above. \
Start the app with something like: `npx ts-node detective/main.ts`

### providerSettings schema
>{
>   "address": "0xd9200cc419bde28b169ad8c904d2687a15a4bf9f",  //Address to monitor
>   "alertAfter": 3,  // Number of missed epochs that will trigger an alert
>   "phone": "+12678646663",  
>   "maxAlerts": 5 // Max # of consecutive alerts to send
>}

>{
>    "minPeers": 19,  //Minimum number of peers that will not trigger an alert
>    "maxAlerts": 3,  //Consecutive times to send the alert
>    "health": "/ext/health",  //Health endpoint
>    "ip": "127.0.0.1",
>    "port": "9650",
>    "phone": "+12678646663"
>}
