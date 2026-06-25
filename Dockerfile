# Base image with Node.js
FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency files first
COPY package*.json ./
COPY requirements.txt ./

# Install dependencies
RUN npm install
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy the rest of the application files
COPY . .

# Start the application
CMD ["npm", "start"]
