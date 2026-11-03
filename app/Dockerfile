# Static web build of the Expo app, served by nginx.
FROM node:22-alpine AS build
WORKDIR /app
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx expo export --platform web
# Stamp the service worker with this build, so installed apps notice the deploy and offer Update.
RUN sed -i "s/__BUILD__/$(date -u +%Y%m%d%H%M%S)/" dist/sw.js

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
