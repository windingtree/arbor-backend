# Development Environment Setup

## Repository

`develop` is the main development branch

Install dependencies

```
npm install
```

## Copy configuration files

Required set of files (`./modules/config/lib`):

- 1st-party.json
- 3rd-party.json
- config_aggregator.json
- config.json

Create `.env` file

```
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=arboruser
MYSQL_PASSWORD=arborpassword
MYSQL_DATABASE=arbordb
```

## DB config

Be sure that DB section in the config file `./modules/config/lib/1st-party.json` looks like

```
"db": {
    "username": "arboruser",
    "password": "arborpassword",
    "database": "arbordb",
    "host": "localhost",
    "dialect": "mysql",
    "dialectOptions": {},
    "pool": {
        "max": 5,
        "min": 0,
        "acquire": 30000,
        "idle": 10000
    },
    "logging": false
}
```

## MySQL setup

Create `docker-compose.yaml` in the root repository folder:

```
version: "3.4"

services:
    mysql:
        image: mysql
        container_name: arbor_mysql
        restart: unless-stopped
        environment:
            MYSQL_USER: arboruser
            MYSQL_PASSWORD: arborpassword
            MYSQL_DATABASE: arbordb
            MYSQL_ROOT_PASSWORD: root
            MYSQL_TCP_PORT: 3306
        ports:
            - 3306:3306
```

Start container:

```bash
$ docker-compose up
```

Try to connect to MySql using any client, for example, with `Sequeler`.
If you will get error like:
`Authentication plugin 'caching_sha2_password' cannot be loaded`

Follow these instructions

```
$ docker exec -it CONTAINER_ID bash
```

then log into mysql as root

```
mysql --user=root --password

```
Enter the password for root (Default is 'root') Finally Run:

```
mysql> CREATE USER 'localuser'@'%' IDENTIFIED BY '<password>';
Query OK, 0 rows affected (0.02 sec)

mysql> GRANT ALL PRIVILEGES ON *.* TO 'localuser'@'%';

```

## Seed database

```
$ npx sequelize-cli db:migrate --url 'mysql:arboruser:arborpassword@localhost:3306/arbordbnew'
```

## Scrap OrgId data

```
$ node ./services/cli/scrapeEnvirement.js
```

## Start server

```
$ npm start
```

Server will be available at http://localhost:3333

## API root

`http://localhost:3333/api/v1/`

## Create new database

```
mysql -u root -p
CREATE DATABASE newdb
USE newdb
GRANT ALL privileges on newdb.* to arboruser;
FLUSH PRIVILEGES;
```