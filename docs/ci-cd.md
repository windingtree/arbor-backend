# Arbor developmet setup

### Requirements 

- [docker](https://docs.docker.com/install/)
- [docker-compose](https://docs.docker.com/compose/install/)
- [helm](https://kompose.io/installation/)
- [helm-secret](https://git-secret.io/installation) (optional)

### Run local environment

- create .env file with environment configuration

```
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=arboruser
MYSQL_PASSWORD=arborpassword
MYSQL_DATABASE=arbordb
DOMAIN_NAME=api.kubernetes.local
```

- run docker-compose 

```
docker-compose -f docker-compose.yaml -f docker-compose.db.yaml up -d
```

### Stop local environment

```
docker-compose -f docker-compose.yaml -f docker-compose.db.yaml down
```

### Deploy to K8S

- add gruntwork helm repo to your library 

```
helm repo add gruntwork https://helmcharts.gruntwork.io
```

- Run the deployment

```
helm upgrade --install -f values.default.yaml --value containerImage.tag=latest arbor-backend gruntwork/k8s-service
```

### Manage helm-secrets (optional)