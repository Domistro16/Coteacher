FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN npm ci --include=dev && npm run check:types && npm run typecheck && chown node:node /app
USER node
ENV COTEACHER_PUBLIC=true
ENV PORT=8787
EXPOSE 8787
CMD ["npm", "run", "delivery:start"]
