FROM node:22-alpine
WORKDIR /app

# Install dependencies (source is mounted as a volume at runtime)
COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 3000
CMD ["npm", "run", "dev"]
