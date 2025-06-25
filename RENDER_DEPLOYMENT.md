# Deploy to Render - Simple & WebSocket-Friendly

## Why Render?
- ✅ **Excellent WebSocket support** (no configuration needed)
- ✅ **Simple deployment** (just connect GitHub repo)
- ✅ **Free tier** (perfect for testing)
- ✅ **Auto-deploys** on git push
- ✅ **Built-in health checks**
- ✅ **No complex configuration files**

## Quick Deployment Steps:

### 1. Push Your Code to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Use these settings:
   - **Name**: `quotation-app-be`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`

### 3. Add Environment Variables
In Render dashboard, add these environment variables:
- `NODE_ENV` = `production`
- `MONGODB_URI` = `your-mongodb-connection-string`
- `JWT_SECRET` = `your-jwt-secret`
- `JWT_EXPIRE` = `30d`
- `JWT_COOKIE_EXPIRE` = `30`
- `MAX_USER_ROLE_USERS` = `3`

### 4. Deploy!
- Click "Create Web Service"
- Render will automatically deploy your app
- You'll get a URL like: `https://quotation-app-be.onrender.com`

## Alternative: Fly.io (If you prefer CLI)

### 1. Install Fly CLI
```bash
# macOS
brew install flyctl

# Or download from https://fly.io/docs/getting-started/installing-flyctl/
```

### 2. Login and Deploy
```bash
fly auth login
fly launch
# Follow the prompts, it will create fly.toml automatically
fly deploy
```

## Alternative: DigitalOcean App Platform

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create → Apps
3. Connect GitHub repo
4. Choose Node.js
5. Set environment variables
6. Deploy

## Why These Are Better Than Railway:

### Render:
- **WebSocket support**: Native, no configuration
- **Deployment**: One-click GitHub integration
- **Debugging**: Clear logs and error messages
- **Reliability**: Stable platform, fewer edge cases

### Fly.io:
- **Performance**: Global edge deployment
- **WebSocket**: Full support with persistent connections
- **Scaling**: Easy horizontal scaling
- **Docker**: Consistent deployment environment

### DigitalOcean:
- **Simplicity**: Straightforward interface
- **Integration**: Managed databases available
- **Support**: Excellent documentation
- **Pricing**: Transparent, predictable costs

## Recommended: Start with Render
It's the easiest to get started and has excellent WebSocket support out of the box.
