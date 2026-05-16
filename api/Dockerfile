FROM node:20-alpine

# node_modules at /app (common ancestor of /app/api and /app/packages)
# so Node ESM resolution finds packages from both subtrees.
WORKDIR /app

RUN echo '{ \
  "name":"export-api", \
  "version":"1.0.0", \
  "type":"module", \
  "dependencies":{ \
    "express":"^4.18.2", \
    "cors":"^2.8.6", \
    "js-yaml":"^4.1.1", \
    "pdfkit":"^0.18.0", \
    "svg-to-pdfkit":"^0.1.8", \
    "@freesewing/core":"next", \
    "@freesewing/config":"next", \
    "@freesewing/models":"next", \
    "@freesewing/utils":"next", \
    "@freesewing/plugin-theme":"next", \
    "@freesewing/plugin-i18n":"next", \
    "@freesewing/plugin-bust":"next", \
    "@freesewing/plugin-annotations":"next", \
    "@freesewing/aaron":"next", \
    "@freesewing/albert":"next", \
    "@freesewing/bee":"next", \
    "@freesewing/bella":"next", \
    "@freesewing/benjamin":"next", \
    "@freesewing/bent":"next", \
    "@freesewing/bibi":"next", \
    "@freesewing/bob":"next", \
    "@freesewing/breanna":"next", \
    "@freesewing/brian":"next", \
    "@freesewing/bruce":"next", \
    "@freesewing/carlita":"next", \
    "@freesewing/carlton":"next", \
    "@freesewing/cathrin":"next", \
    "@freesewing/charlie":"next", \
    "@freesewing/cornelius":"next", \
    "@freesewing/diana":"next", \
    "@freesewing/florence":"next", \
    "@freesewing/florent":"next", \
    "@freesewing/hi":"next", \
    "@freesewing/holmes":"next", \
    "@freesewing/hortensia":"next", \
    "@freesewing/huey":"next", \
    "@freesewing/hugo":"next", \
    "@freesewing/jaeger":"next", \
    "@freesewing/jane":"next", \
    "@freesewing/lily":"next", \
    "@freesewing/lucy":"next", \
    "@freesewing/lumina":"next", \
    "@freesewing/lumira":"next", \
    "@freesewing/lunetius":"next", \
    "@freesewing/noble":"next", \
    "@freesewing/octoplushy":"next", \
    "@freesewing/onyx":"next", \
    "@freesewing/opal":"next", \
    "@freesewing/otis":"next", \
    "@freesewing/paco":"next", \
    "@freesewing/penelope":"next", \
    "@freesewing/sandy":"next", \
    "@freesewing/shelly":"next", \
    "@freesewing/shin":"next", \
    "@freesewing/simon":"next", \
    "@freesewing/simone":"next", \
    "@freesewing/skully":"next", \
    "@freesewing/sven":"next", \
    "@freesewing/tamiko":"next", \
    "@freesewing/teagan":"next", \
    "@freesewing/tiberius":"next", \
    "@freesewing/titan":"next", \
    "@freesewing/trayvon":"next", \
    "@freesewing/tristan":"next", \
    "@freesewing/uma":"next", \
    "@freesewing/umbra":"next", \
    "@freesewing/wahid":"next", \
    "@freesewing/walburga":"next", \
    "@freesewing/waralee":"next", \
    "@freesewing/yuri":"next" \
  } \
}' > package.json

RUN npm install --no-audit

COPY packages/react/components/Editor/lib/export/ ./packages/react/components/Editor/lib/export/
COPY api/export-pattern.mjs api/measurements.json api/plugin-tiler.mjs ./api/

EXPOSE 9001

WORKDIR /app/api
CMD ["node", "export-pattern.mjs"]
