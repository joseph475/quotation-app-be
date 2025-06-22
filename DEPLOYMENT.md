# Vercel Deployment Guide

This backend is now ready for deployment on Vercel. Follow these steps to deploy:

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a MongoDB Atlas cluster for production database
3. **Environment Variables**: Prepare your production environment variables

## Environment Variables

Set these environment variables in your Vercel project dashboard:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/quotation-app
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
PORT=3000
```

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from project root:
   ```bash
   vercel
   ```

4. Follow the prompts and set up environment variables when asked.

### Option 2: Deploy via Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your repository
5. Configure environment variables in the project settings
6. Deploy

## Important Notes

- **Database**: Make sure your MongoDB Atlas cluster allows connections from anywhere (0.0.0.0/0) or configure Vercel's IP ranges
- **CORS**: The current CORS configuration allows all origins. Consider restricting this in production
- **Environment Variables**: Never commit `.env` files. Use Vercel's environment variable settings
- **Function Timeout**: Set to 30 seconds for database operations
- **Cold Starts**: First request after inactivity may be slower due to serverless nature

## API Endpoints

Once deployed, your API will be available at:
- Base URL: `https://your-project-name.vercel.app`
- Health Check: `https://your-project-name.vercel.app/`
- Auth: `https://your-project-name.vercel.app/api/v1/auth/*`
- All other endpoints: `https://your-project-name.vercel.app/api/v1/*`

## Monitoring

- Check deployment logs in Vercel dashboard
- Monitor function invocations and errors
- Set up alerts for critical issues

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Timeout**
   - Ensure MongoDB Atlas allows Vercel connections
   - Check connection string format
   - Verify network access settings

2. **Environment Variables Not Found**
   - Double-check variable names in Vercel dashboard
   - Ensure variables are set for production environment

3. **Function Timeout**
   - Optimize database queries
   - Consider increasing maxDuration in vercel.json

4. **CORS Issues**
   - Update CORS configuration for your frontend domain
   - Check preflight request handling

## Security Checklist

- [ ] Strong JWT secret set
- [ ] MongoDB connection secured
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] Error messages don't expose sensitive data
- [ ] Rate limiting implemented (consider adding)
- [ ] Input validation in place

## Performance Optimization

- Database connection pooling is handled by Mongoose
- Consider implementing caching for frequently accessed data
- Monitor cold start times and optimize if needed
- Use MongoDB indexes for better query performance
