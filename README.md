# Quotation App Backend

Backend API for the Quotation App with MongoDB database integration.

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file in the root directory with the following variables:

```
NODE_ENV=development8000
MONGODB_URI=mongodb://localhost:27017/quotation-app
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
```

### MongoDB Setup

#### Option 1: Local MongoDB Installation

1. Install MongoDB Community Edition on your local machine:
   - [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)

2. Start MongoDB service:
   - On Windows: Start the MongoDB service from the Services console
   - On macOS/Linux: `sudo systemctl start mongod` or `brew services start mongodb-community`

3. Verify MongoDB is running using our connection check script:
   ```bash
   npm run check-db
   ```
   This script will attempt to connect to MongoDB and display connection information or troubleshooting tips if the connection fails.

4. The default connection string in the `.env` file is set to connect to a local MongoDB instance:
   ```
   MONGODB_URI=mongodb://localhost:27017/quotation-app
   ```

#### Option 2: MongoDB Atlas (Cloud)

1. Create a free MongoDB Atlas account at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

2. Create a new cluster

3. Click on "Connect" and select "Connect your application"

4. Copy the connection string and replace the placeholder values with your username and password

5. Update the `.env` file with your MongoDB Atlas connection string:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/quotation-app?retryWrites=true&w=majority
   ```

### Running the Server

#### Safe Start (Recommended)

```bash
npm run start-safe
```

This will first check your MongoDB connection and then start the server only if the connection is successful. This is the recommended way to start the server, especially for new users.

#### Development Mode

```bash
npm run dev
```

This will start the server with nodemon, which automatically restarts the server when changes are detected.

#### Production Mode

```bash
npm start
```

The server will run on the port specified in the `.env` file (default: 8000).

### Seeding the Database

To populate the database with sample data for testing:

```bash
npm run seed
```

This will create:
- 2 users (admin@example.com and user@example.com, both with password "password123")
- 5 inventory items
- 3 customers
- 1 sample quotation
- 1 sample sale

To clear all data from the database:

```bash
npm run seed:delete
```

## API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/updatedetails` - Update user details
- `PUT /api/v1/auth/updatepassword` - Update password

### Inventory Endpoints

- `GET /api/v1/inventory` - Get all inventory items
- `GET /api/v1/inventory/:id` - Get single inventory item
- `POST /api/v1/inventory` - Create new inventory item
- `PUT /api/v1/inventory/:id` - Update inventory item
- `DELETE /api/v1/inventory/:id` - Delete inventory item

### Customer Endpoints

- `GET /api/v1/customers` - Get all customers
- `GET /api/v1/customers/:id` - Get single customer
- `POST /api/v1/customers` - Create new customer
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer

### Quotation Endpoints

- `GET /api/v1/quotations` - Get all quotations
- `GET /api/v1/quotations/:id` - Get single quotation
- `POST /api/v1/quotations` - Create new quotation
- `PUT /api/v1/quotations/:id` - Update quotation
- `DELETE /api/v1/quotations/:id` - Delete quotation
- `POST /api/v1/quotations/:id/convert` - Convert quotation to sale

### Sales Endpoints

- `GET /api/v1/sales` - Get all sales
- `GET /api/v1/sales/:id` - Get single sale
- `POST /api/v1/sales` - Create new sale
- `PUT /api/v1/sales/:id` - Update sale
- `DELETE /api/v1/sales/:id` - Delete sale
- `PUT /api/v1/sales/:id/payment` - Update payment status

### Dashboard Endpoints

- `GET /api/v1/dashboard/summary` - Get dashboard summary
- `GET /api/v1/dashboard/recent-sales` - Get recent sales
- `GET /api/v1/dashboard/low-stock` - Get low stock items

## Deployment

This backend is ready for deployment on Vercel. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set up environment variables in Vercel dashboard
4. Deploy

## Database Schema

The application uses MongoDB with Mongoose for data modeling. The main collections are:

- Users
- Inventory
- Customers
- Quotations
- Sales

Refer to the models directory for detailed schema information.

## Project Structure

```
├── config/              # Configuration files
├── controllers/         # Route controllers
├── middleware/          # Custom middleware
├── models/             # Mongoose models
├── routes/             # API routes
├── utils/              # Utility functions
├── server.js           # Main application file
├── vercel.json         # Vercel deployment configuration
└── DEPLOYMENT.md       # Deployment guide
```
