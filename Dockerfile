# Use a Node.js base image with a specified version
FROM node:16

# Create a directory to hold the application code inside the container
WORKDIR /app

# Copy the entire application to the container
COPY package.json .
COPY ./dist .

# Install PM2 globally
RUN npm install pm2 -g
RUN npm install

# Start the application using PM2
CMD ["pm2-runtime", "index.js"]
