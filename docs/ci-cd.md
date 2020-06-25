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
```

- run docker-compose 

```
docker-compose up -d
```

### Stop local environment

```
docker-compose down
```
