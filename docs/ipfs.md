## Start IPFS server

```bash
npm run ipfs:start
```

## Configuration

```bash
npm run ipfs:exec -- config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"*\"]"
npm run ipfs:exec -- config --json API.HTTPHeaders.Access-Control-Allow-Credentials "[\"true\"]"
npm run ipfs:exec -- config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"PUT\", \"GET\", \"POST\"]"
npm run ipfs:exec -- config Addresses.Swarm '["/ip4/0.0.0.0/tcp/4001", "/ip4/0.0.0.0/tcp/8081/ws", "/ip6/::/tcp/4001"]' --json
npm run ipfs:exec -- config --bool Swarm.EnableRelayHop true
npm run ipfs:exec -- config --bool Swarm.EnableAutoRelay true
```