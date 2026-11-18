# Rocket Launcher MCP server (stdio). Used by MCP directories (e.g. Glama) to start the server and list its tools.
FROM node:22-slim
ENV NODE_ENV=production
RUN npm install -g rocket-launcher-mcp@0.2.6 && npm cache clean --force
ENTRYPOINT ["rocket-launcher-mcp"]
