FROM node:18-alpine

# Install ffmpeg for audio conversion
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose uploads for persistence
VOLUME ["/app/uploads"]
EXPOSE 3001

ENV PORT=3001
CMD ["node", "index.js"]
