FROM node:22-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy the rest of the source
COPY . .

# Build the Vite app
RUN npm run build

# Install serve globally to serve the built files
RUN npm install -g serve

EXPOSE 3000

CMD ["sh", "-c", "serve dist -p ${PORT:-3000} --single"]
