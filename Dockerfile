FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /home/pptruser/app

COPY --chown=pptruser:pptruser package*.json ./


USER root
RUN mkdir -p /home/pptruser/app/node_modules \
    && chown -R pptruser:pptruser /home/pptruser/app
USER pptruser

RUN npm install

ENV PUPPETEER_CACHE_DIR=/home/pptruser/app/.cache/puppeteer

# Install Chrome into the specified cache directory
RUN npx puppeteer browsers install chrome

COPY --chown=pptruser:pptruser . .

EXPOSE 9090

CMD ["node", "src/server.js"]

