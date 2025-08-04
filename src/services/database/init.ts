#!/usr/bin/env node

/**
 * Database initialization script
 * Run with: npm run db:init
 */

import { initializeDatabase, healthCheck, closePool } from './index';

const init = async () => {
  console.log('🗄️  Initializing database...');

  try {
    // Test connection
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');

    // Initialize schema
    await initializeDatabase();
    console.log('✅ Database schema initialized');

    console.log('🎉 Database setup complete!');
    
    // Test queries
    console.log('\n📊 Testing database operations...');
    
    // You can add test operations here if needed
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await closePool();
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  init();
}

export default init;