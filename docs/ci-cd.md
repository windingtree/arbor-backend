# Garden developmet setup

### Install Docker for Mac, enabled Kubernetes and kubectl helm manager

https://docs.garden.io/guides/local-kubernetes#docker-for-desktop

```
brew install kubernetes-cli
brew install kubernetes-helm
```

### Install Garden

https://docs.garden.io/installation

```
brew tap garden-io/garden
brew install garden-cli
```

### Run development console [with hot reload]

https://docs.garden.io/guides/development-workflows

```
garden dev [--hot]
```