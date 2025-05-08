const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load env vars
dotenv.config();

// Load models
const User = require('./models/User');
const Inventory = require('./models/Inventory');
const Customer = require('./models/Customer');
const Quotation = require('./models/Quotation');
const Sale = require('./models/Sale');
const Supplier = require('./models/Supplier');
const PurchaseOrder = require('./models/PurchaseOrder');
const PurchaseReceiving = require('./models/PurchaseReceiving');
const Branch = require('./models/Branch');
const StockTransfer = require('./models/StockTransfer');

// Connect to DB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Sample data
const branches = [
  {
    name: 'Main Branch',
    address: '123 Main Street, Makati City, Metro Manila, Philippines',
    contactNumber: '(02) 8123-4567',
    manager: 'Juan Dela Cruz',
    email: 'main@example.com',
    isActive: true
  },
  {
    name: 'North Branch',
    address: '456 North Avenue, Quezon City, Metro Manila, Philippines',
    contactNumber: '(02) 8765-4321',
    manager: 'Maria Santos',
    email: 'north@example.com',
    isActive: true
  },
  {
    name: 'South Branch',
    address: '789 South Road, Alabang, Muntinlupa City, Philippines',
    contactNumber: '(02) 8987-6543',
    manager: 'Pedro Reyes',
    email: 'south@example.com',
    isActive: true
  }
];

// Users will be created after branches with proper references
const users = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    password: 'password123'
    // Admin users will not have a specific branch reference
  },
  {
    name: 'Regular User',
    email: 'user@example.com',
    role: 'user',
    password: 'password123'
    // Branch will be assigned after branches are created
  }
];

const inventoryItems = [
  {
    itemCode: 'ITM001',
    name: 'Laptop Computer',
    description: 'High-performance laptop with 16GB RAM and 512GB SSD',
    category: 'Electronics',
    unit: 'piece',
    costPrice: 800,
    sellingPrice: 1200,
    quantity: 25,
    reorderLevel: 5
  },
  {
    itemCode: 'ITM002',
    name: 'Office Desk',
    description: 'Sturdy office desk with drawers',
    category: 'Furniture',
    unit: 'piece',
    costPrice: 150,
    sellingPrice: 250,
    quantity: 15,
    reorderLevel: 3
  },
  {
    itemCode: 'ITM003',
    name: 'Office Chair',
    description: 'Ergonomic office chair with adjustable height',
    category: 'Furniture',
    unit: 'piece',
    costPrice: 80,
    sellingPrice: 150,
    quantity: 30,
    reorderLevel: 5
  },
  {
    itemCode: 'ITM004',
    name: 'Printer',
    description: 'Color laser printer with wireless connectivity',
    category: 'Electronics',
    unit: 'piece',
    costPrice: 200,
    sellingPrice: 350,
    quantity: 10,
    reorderLevel: 2
  },
  {
    itemCode: 'ITM005',
    name: 'Smartphone',
    description: '6.5-inch smartphone with 128GB storage',
    category: 'Electronics',
    unit: 'piece',
    costPrice: 400,
    sellingPrice: 700,
    quantity: 20,
    reorderLevel: 4
  }
];

const customers = [
  {
    name: 'ABC Corporation',
    contactPerson: 'John Smith',
    phone: '123-456-7890',
    address: '123 Business Ave, Makati, Metro Manila, 1200, Philippines',
    taxId: '123-456-789',
    customerType: 'business'
  },
  {
    name: 'XYZ Enterprises',
    contactPerson: 'Jane Doe',
    phone: '987-654-3210',
    address: '456 Commerce St, Quezon City, Metro Manila, 1100, Philippines',
    taxId: '987-654-321',
    customerType: 'business'
  },
  {
    name: 'Maria Santos',
    phone: '555-123-4567',
    address: '789 Residential Blvd, Pasig, Metro Manila, 1600, Philippines',
    customerType: 'individual'
  }
];

const suppliers = [
  {
    name: 'Tech Supplies Inc.',
    contactPerson: 'Robert Chen',
    email: 'robert@techsupplies.com',
    phone: '123-789-4560',
    address: {
      street: '456 Tech Avenue',
      city: 'Makati',
      state: 'Metro Manila',
      postalCode: '1200',
      country: 'Philippines'
    },
    taxId: '456-789-123',
    paymentTerms: 'Net 30',
    notes: 'Preferred supplier for electronics',
    isActive: true
  },
  {
    name: 'Office Furniture Co.',
    contactPerson: 'Lisa Wong',
    email: 'lisa@officefurniture.com',
    phone: '987-321-6540',
    address: {
      street: '789 Industrial Park',
      city: 'Pasig',
      state: 'Metro Manila',
      postalCode: '1600',
      country: 'Philippines'
    },
    taxId: '789-123-456',
    paymentTerms: 'Net 45',
    notes: 'Bulk discounts available',
    isActive: true
  },
  {
    name: 'General Merchandise Ltd.',
    contactPerson: 'Michael Garcia',
    email: 'michael@generalmerch.com',
    phone: '555-789-1234',
    address: {
      street: '123 Supply Street',
      city: 'Quezon City',
      state: 'Metro Manila',
      postalCode: '1100',
      country: 'Philippines'
    },
    taxId: '555-888-999',
    paymentTerms: 'Net 15',
    notes: 'Wide range of office supplies',
    isActive: true
  }
];

// Import data into DB
const importData = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await Inventory.deleteMany();
    await Customer.deleteMany();
    await Quotation.deleteMany();
    await Sale.deleteMany();
    await Supplier.deleteMany();
    await PurchaseOrder.deleteMany();
    await PurchaseReceiving.deleteMany();
    await Branch.deleteMany();
    await StockTransfer.deleteMany();

    console.log('Data cleared...');
    
    // Create branches
    const createdBranches = await Branch.create(branches);
    console.log(`${createdBranches.length} branches created`);

    // Create users with branch references
    // First, prepare user data with branch references
    const usersWithBranches = users.map((user, index) => {
      // For regular users, assign a specific branch
      if (user.role === 'user') {
        // Find the Main Branch
        const mainBranch = createdBranches.find(branch => branch.name === 'Main Branch');
        return {
          ...user,
          branch: mainBranch._id
        };
      }
      // Admin users don't need a specific branch
      return user;
    });
    
    const createdUsers = await User.create(usersWithBranches);
    console.log(`${createdUsers.length} users created`);

    // Create inventory items with branch references
    const inventoryWithBranches = inventoryItems.map((item, index) => {
      // Distribute items across branches (cycling through branches if needed)
      const branchIndex = index % createdBranches.length;
      return {
        ...item,
        branch: createdBranches[branchIndex]._id
      };
    });
    
    const createdInventory = await Inventory.create(inventoryWithBranches);
    console.log(`${createdInventory.length} inventory items created`);

    // Create customers
    const createdCustomers = await Customer.create(customers);
    console.log(`${createdCustomers.length} customers created`);

    // Create a sample quotation
    const adminUser = createdUsers.find(user => user.role === 'admin');
    const customer = createdCustomers[0];
    const items = [
      {
        inventory: createdInventory[0]._id,
        description: createdInventory[0].name,
        quantity: 2,
        unitPrice: createdInventory[0].sellingPrice,
        discount: 0,
        tax: 0,
        total: 2 * createdInventory[0].sellingPrice
      },
      {
        inventory: createdInventory[1]._id,
        description: createdInventory[1].name,
        quantity: 3,
        unitPrice: createdInventory[1].sellingPrice,
        discount: 0,
        tax: 0,
        total: 3 * createdInventory[1].sellingPrice
      }
    ];

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);

    const quotation = await Quotation.create({
      quotationNumber: `Q-${Date.now()}`,
      customer: customer._id,
      items,
      subtotal,
      taxAmount: 0,
      discountAmount: 0,
      total: subtotal,
      status: 'sent',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      notes: 'Sample quotation for testing',
      terms: 'Payment due within 30 days',
      createdBy: adminUser._id
    });

    console.log('Sample quotation created');

    // Create a sample sale
    const sale = await Sale.create({
      saleNumber: `S-${Date.now()}`,
      customer: customer._id,
      branch: createdBranches[0]._id, // Add the branch field (Main Branch)
      items: [
        {
          inventory: createdInventory[2]._id,
          description: createdInventory[2].name,
          quantity: 1,
          unitPrice: createdInventory[2].sellingPrice,
          discount: 0,
          tax: 0,
          total: createdInventory[2].sellingPrice
        }
      ],
      subtotal: createdInventory[2].sellingPrice,
      taxAmount: 0,
      discountAmount: 0,
      total: createdInventory[2].sellingPrice,
      status: 'paid',
      paymentMethod: 'cash',
      amountPaid: createdInventory[2].sellingPrice,
      balance: 0,
      createdBy: adminUser._id
    });

    console.log('Sample sale created');

    // Create suppliers
    const createdSuppliers = await Supplier.create(suppliers);
    console.log(`${createdSuppliers.length} suppliers created`);

    // Create a sample purchase order
    const supplier = createdSuppliers[0]; // Tech Supplies Inc.
    const poItems = [
      {
        inventory: createdInventory[0]._id, // Laptop
        name: createdInventory[0].name,
        quantity: 5,
        unitPrice: createdInventory[0].costPrice,
        total: 5 * createdInventory[0].costPrice,
        receivedQuantity: 0
      },
      {
        inventory: createdInventory[3]._id, // Printer
        name: createdInventory[3].name,
        quantity: 3,
        unitPrice: createdInventory[3].costPrice,
        total: 3 * createdInventory[3].costPrice,
        receivedQuantity: 0
      }
    ];

    const poSubtotal = poItems.reduce((acc, item) => acc + item.total, 0);

const purchaseOrder = await PurchaseOrder.create({
  orderNumber: `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
  supplier: supplier._id,
  branch: createdBranches[0]._id, // Add the Main Branch
  orderDate: new Date(),
  expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  status: 'Approved',
  items: poItems,
  subtotal: poSubtotal,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: poSubtotal,
  notes: 'Sample purchase order for testing',
  createdBy: adminUser._id
});

    console.log('Sample purchase order created');

    // Create a sample purchase receiving (partial receiving)
    const receivingItems = [
      {
        purchaseOrderItem: purchaseOrder.items[0]._id,
        inventory: purchaseOrder.items[0].inventory,
        name: purchaseOrder.items[0].name,
        quantityOrdered: purchaseOrder.items[0].quantity,
        quantityReceived: 3, // Partial receiving
        previouslyReceived: 0,
        notes: 'Received in good condition'
      }
    ];

    // Update the purchase order with received quantities
    purchaseOrder.items[0].receivedQuantity = 3;
    // Use 'Approved' instead of 'Partial' since 'Partial' is not a valid enum value
    purchaseOrder.status = 'Approved';
    await purchaseOrder.save();

    const purchaseReceiving = await PurchaseReceiving.create({
      receivingNumber: `GR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      purchaseOrder: purchaseOrder._id,
      branch: createdBranches[0]._id, // Add the Main Branch
      supplier: supplier._id,
      receivingDate: new Date(),
      items: receivingItems,
      status: 'Completed',
      notes: 'Sample purchase receiving for testing',
      createdBy: adminUser._id
    });

    console.log('Sample purchase receiving created');

    // Update inventory quantities based on receiving
    const laptop = await Inventory.findById(createdInventory[0]._id);
    laptop.quantity += 3; // Add the received quantity
    await laptop.save();

    // Create sample stock transfers
    const stockTransfers = [
      {
        transferNumber: `ST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        itemId: createdInventory[0]._id, // Laptop
        fromBranch: createdBranches[0].name, // Main Branch
        fromBranchId: createdBranches[0]._id,
        toBranch: createdBranches[1].name, // North Branch
        toBranchId: createdBranches[1]._id,
        quantity: 2,
        transferDate: new Date(),
        notes: 'Sample stock transfer for testing',
        status: 'Completed',
        createdBy: adminUser._id
      },
      {
        transferNumber: `ST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        itemId: createdInventory[1]._id, // Office Desk
        fromBranch: createdBranches[1].name, // North Branch
        fromBranchId: createdBranches[1]._id,
        toBranch: createdBranches[2].name, // South Branch
        toBranchId: createdBranches[2]._id,
        quantity: 1,
        transferDate: new Date(),
        notes: 'Urgent transfer needed',
        status: 'Pending',
        createdBy: adminUser._id
      },
      {
        transferNumber: `ST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        itemId: createdInventory[2]._id, // Office Chair
        fromBranch: createdBranches[2].name, // South Branch
        fromBranchId: createdBranches[2]._id,
        toBranch: createdBranches[0].name, // Main Branch
        toBranchId: createdBranches[0]._id,
        quantity: 3,
        transferDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        notes: 'Chairs needed for new employees',
        status: 'Completed',
        createdBy: adminUser._id
      }
    ];

    const createdStockTransfers = await StockTransfer.create(stockTransfers);
    console.log(`${createdStockTransfers.length} stock transfers created`);

    console.log('Data import complete!');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Delete all data
const deleteData = async () => {
  try {
    await User.deleteMany();
    await Inventory.deleteMany();
    await Customer.deleteMany();
    await Quotation.deleteMany();
    await Sale.deleteMany();
    await Supplier.deleteMany();
    await PurchaseOrder.deleteMany();
    await PurchaseReceiving.deleteMany();
    await Branch.deleteMany();
    await StockTransfer.deleteMany();

    console.log('Data destroyed...');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

// Process command line arguments
if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  deleteData();
} else {
  console.log('Please provide proper command: -i (import) or -d (delete)');
  process.exit();
}
