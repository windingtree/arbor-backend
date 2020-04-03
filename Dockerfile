FROM node:10-alpine3.10

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN apk add --no-cache \
			--virtual build-dependencies \
			python-dev \
			build-base \
			wget \
			git && \
	yarn install && \
	apk del build-dependencies

# Add app source
COPY . .

CMD [ "node", "server.js" ]