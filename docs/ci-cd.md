# Arbor developmet setup

### Requirements 

- [docker](https://docs.docker.com/install/)
- [docker-compose](https://docs.docker.com/compose/install/)
- [kompose](https://kompose.io/installation/)
- [git-secret](https://git-secret.io/installation) (optional)

### Run local environment

- create .env file with environment configuration

```
DOCKER_TAG=latest
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

- login to Docker Hub

```
> docker login
Username: XXXXX
Password: XXXXX
Authenticating with existing credentials...
Login Succeeded
```

- resolve docker-compose variables

```
docker-compose config > docker-compose-resolved.yaml
```

- start up k8s deployments

```
kompose up --file docker-compose-resolved.yaml
```

### Manage git-secrets (optional)

- configure `${GITHUB_REF}` environment

```
git-secret reveal
vim .gitsecret/envs/${GITHUB_REF}
```