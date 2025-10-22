# DEPLOYMENT.md

# Deployment Guide

This guide covers deploying the Budget Analyzer Client to various hosting platforms.

## Environment Variables

Before deploying, ensure you have the following environment variables configured:
```env
VITE_API_BASE_URL=https://your-api-domain.com
VITE_USE_MOCK_DATA=false
```

## Build for Production
```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

## Vercel Deployment

### Method 1: Vercel CLI
```bash
npm install -g vercel
vercel
```

### Method 2: Git Integration

1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add environment variables in the Vercel dashboard
7. Deploy

### vercel.json Configuration
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

## Netlify Deployment

### netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Deploy via CLI
```bash
npm install -g netlify-cli
netlify deploy --prod
```

## AWS S3 + CloudFront

### 1. Build the app
```bash
npm run build
```

### 2. Create S3 bucket
```bash
aws s3 mb s3://your-bucket-name
```

### 3. Upload files
```bash
aws s3 sync dist/ s3://your-bucket-name
```

### 4. Configure S3 for static hosting
```bash
aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html
```

### 5. Create CloudFront distribution

- Origin: Your S3 bucket
- Default Root Object: `index.html`
- Error Pages: 403 → `/index.html` (for SPA routing)

## Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Build and run
```bash
docker build -t budget-analyzer-web .
docker run -p 8080:80 budget-analyzer-web
```

## Performance Checklist

- [ ] Enable gzip/brotli compression
- [ ] Set proper cache headers
- [ ] Use CDN for static assets
- [ ] Enable HTTP/2
- [ ] Configure security headers
- [ ] Set up monitoring (Sentry, LogRocket)

## Post-Deployment

1. Test all routes work correctly
2. Verify API integration
3. Check error handling
4. Test on mobile devices
5. Run Lighthouse audit
6. Monitor error rates