FROM node:10-jessie-slim

RUN apt-get update -y && apt-get install -y git

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN yarn install
# If you are building your code for production
# RUN npm ci --only=production

# Add app source
COPY . .

CMD [ "node", "server.js" ]