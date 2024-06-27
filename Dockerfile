FROM node:alpine
WORKDIR /usr/src/app
COPY . /usr/src/app/
RUN npm i -g typescript
RUN npm i -g tsx
RUN npm install
CMD ["tsx", "index.ts"]