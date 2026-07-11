# /nginx/Dockerfile
# ANFA Nginx Proxy - Statically configured for HTTP/2 and SSE optimization
# No dynamic reloading via docker.sock to eliminate container escape risks

FROM nginx:1.25-alpine

# Security: Run as non-root user
RUN addgroup -S nginx-group && adduser -S nginx-user -G nginx-group

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy static configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create necessary directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    chown -R nginx-user:nginx-group /var/cache/nginx /var/log/nginx

# Security hardening: Remove unnecessary tools
RUN rm -rf /usr/bin/wget /usr/bin/curl /bin/busybox

EXPOSE 80 443

USER nginx-user

CMD ["nginx", "-g", "daemon off;"]
