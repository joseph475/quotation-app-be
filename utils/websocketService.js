const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map to store client connections with user info
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    try {
      // Extract token from query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        console.log('WebSocket connection rejected: No token provided');
        ws.close(1008, 'No token provided');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        console.log('WebSocket connection rejected: Invalid user');
        ws.close(1008, 'Invalid user');
        return;
      }

      // Generate connection ID
      const connectionId = `${user._id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Store client connection with user info
      this.clients.set(ws, {
        user,
        connectionId,
        connectedAt: new Date()
      });

      console.log(`WebSocket connected: ${user.email} (${user.role}) - Connection ID: ${connectionId}`);

      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'connection_id',
        data: { connectionId }
      });

      // Set up message handlers
      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws);
      });

      // Send heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendToClient(ws, { type: 'heartbeat' });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      const clientInfo = this.clients.get(ws);

      if (!clientInfo) {
        return;
      }

      console.log(`WebSocket message from ${clientInfo.user.email}:`, data);

      switch (data.type) {
        case 'heartbeat_response':
          // Client responded to heartbeat
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(ws) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      console.log(`WebSocket disconnected: ${clientInfo.user.email} - Connection ID: ${clientInfo.connectionId}`);
      this.clients.delete(ws);
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message) {
    this.clients.forEach((clientInfo, ws) => {
      this.sendToClient(ws, message);
    });
  }

  /**
   * Send message to specific user roles
   */
  broadcastToRoles(message, roles = []) {
    this.clients.forEach((clientInfo, ws) => {
      if (roles.includes(clientInfo.user.role)) {
        this.sendToClient(ws, message);
      }
    });
  }

  /**
   * Send message to admin users only
   */
  broadcastToAdmins(message) {
    this.broadcastToRoles(message, ['admin']);
  }

  /**
   * Send quotation created event
   */
  notifyQuotationCreated(quotationData) {
    const message = {
      type: 'quotation_created',
      data: quotationData,
      timestamp: new Date().toISOString()
    };

    // Notify admin users about new quotations
    this.broadcastToAdmins(message);
    console.log('Broadcasted quotation_created event to admin users');
  }

  /**
   * Send quotation updated event
   */
  notifyQuotationUpdated(quotationData) {
    const message = {
      type: 'quotation_updated',
      data: quotationData,
      timestamp: new Date().toISOString()
    };

    // Notify admin users about quotation updates
    this.broadcastToAdmins(message);
    console.log('Broadcasted quotation_updated event to admin users');
  }

  /**
   * Send quotation status changed event
   */
  notifyQuotationStatusChanged(quotationData) {
    const message = {
      type: 'quotation_status_changed',
      data: quotationData,
      timestamp: new Date().toISOString()
    };

    // Notify all connected users about status changes
    this.broadcast(message);
    console.log('Broadcasted quotation_status_changed event to all users');
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      totalConnections: this.clients.size,
      connectionsByRole: {},
      connections: []
    };

    this.clients.forEach((clientInfo, ws) => {
      const role = clientInfo.user.role;
      stats.connectionsByRole[role] = (stats.connectionsByRole[role] || 0) + 1;
      
      stats.connections.push({
        connectionId: clientInfo.connectionId,
        userEmail: clientInfo.user.email,
        userRole: clientInfo.user.role,
        connectedAt: clientInfo.connectedAt,
        status: ws.readyState === WebSocket.OPEN ? 'open' : 'closed'
      });
    });

    return stats;
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

module.exports = webSocketService;
