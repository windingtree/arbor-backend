## Build container

```bash
npm run ipfs:build
```

## Start IPFS server

```bash
npm run ipfs:start
```

## Configuration

```bash
npm run exec -- config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"*\"]"
npm run exec -- config --json API.HTTPHeaders.Access-Control-Allow-Credentials "[\"true\"]"
npm run exec -- config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"PUT\", \"GET\", \"POST\"]"
npm run exec -- config Addresses.Swarm '["/ip4/0.0.0.0/tcp/4001", "/ip4/0.0.0.0/tcp/8081/ws", "/ip6/::/tcp/4001"]' --json
npm run exec -- config --bool Swarm.EnableRelayHop true
npm run exec -- config --bool Swarm.EnableAutoNATService true
npm run exec -- config --bool Swarm.EnableAutoRelay true
```