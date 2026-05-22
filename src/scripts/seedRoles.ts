import mongoose from 'mongoose';
import "dotenv/config";
import Role from '../models/Role';

const roles = [
  {
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Complete system access and management.',
    isSystemRole: true,
    permissions: ['all'],
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full business and user management.',
    isSystemRole: true,
    permissions: ['manage_users', 'manage_vendors', 'manage_orders'],
  },
  {
    name: 'vendor_admin',
    displayName: 'Vendor Administrator',
    description: 'Full management of vendor-specific data and branches.',
    isSystemRole: true,
    permissions: ['manage_vendor', 'manage_branches', 'manage_staff', 'manage_products'],
  },
  {
    name: 'branch_admin',
    displayName: 'Branch Administrator',
    description: 'Management of a specific branch and its operations.',
    isSystemRole: true,
    permissions: ['manage_branch', 'manage_branch_staff', 'manage_branch_orders'],
  },
  {
    name: 'staff',
    displayName: 'Staff',
    description: 'Internal operational access.',
    isSystemRole: true,
    permissions: ['view_orders', 'update_order_status'],
  },
  {
    name: 'rider',
    displayName: 'Delivery Rider',
    description: 'Access to delivery tasks and updates.',
    isSystemRole: true,
    permissions: ['view_assigned_orders', 'update_delivery_status'],
  },
  {
    name: 'customer',
    displayName: 'Customer',
    description: 'Standard end-user access.',
    isSystemRole: true,
    permissions: ['place_order', 'view_own_orders'],
  },
];

const seedRoles = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/dohez';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for seeding roles...');

    for (const roleData of roles) {
      await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      console.log(`Role seeded: ${roleData.name}`);
    }

    console.log('Role seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
};

seedRoles();
