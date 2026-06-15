FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# Add resilient npm network settings because the environment has intermittent ECONNRESET errors.
RUN npm config set fetch-retries 8 \
	&& npm config set fetch-retry-mintimeout 20000 \
	&& npm config set fetch-retry-maxtimeout 180000 \
	&& npm config set registry https://registry.npmjs.org/ \
	&& npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
