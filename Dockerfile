FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory if it doesn't exist
RUN mkdir -p /app/data

# Set environment
ENV NODE_ENV=production

# Run the bot
CMD ["node", "dist/index.js"]
