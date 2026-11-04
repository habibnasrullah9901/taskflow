FROM node:20-alpine AS fe
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install
COPY frontend ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend ./
COPY database /app/database
COPY --from=fe /fe/dist /app/frontend/dist
ENV NODE_ENV=production UPLOAD_DIR=/data/uploads
EXPOSE 3001
CMD ["node","server.js"]
