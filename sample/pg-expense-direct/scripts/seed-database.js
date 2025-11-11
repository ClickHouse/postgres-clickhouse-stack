const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'expense_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

const categories = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Travel',
  'Education',
  'Other'
];

const descriptions = {
  'Food & Dining': [
    'Lunch at cafe', 'Grocery shopping', 'Coffee', 'Dinner out', 'Pizza delivery',
    'Fast food', 'Restaurant meal', 'Breakfast', 'Snacks', 'Takeout'
  ],
  'Transportation': [
    'Gas station', 'Uber ride', 'Bus fare', 'Train ticket', 'Parking fee',
    'Car maintenance', 'Taxi', 'Metro card', 'Bridge toll', 'Airport shuttle'
  ],
  'Shopping': [
    'Clothing', 'Electronics', 'Home goods', 'Books', 'Shoes',
    'Online purchase', 'Gift', 'Tools', 'Furniture', 'Accessories'
  ],
  'Entertainment': [
    'Movie tickets', 'Concert', 'Streaming service', 'Video games', 'Sports event',
    'Theater show', 'Museum', 'Amusement park', 'Mini golf', 'Bowling'
  ],
  'Bills & Utilities': [
    'Electric bill', 'Internet', 'Phone bill', 'Water bill', 'Insurance',
    'Rent', 'Credit card payment', 'Loan payment', 'Subscription', 'Bank fee'
  ],
  'Healthcare': [
    'Doctor visit', 'Pharmacy', 'Dental checkup', 'Eye exam', 'Prescription',
    'Hospital', 'Physical therapy', 'Medical test', 'Vitamins', 'First aid'
  ],
  'Travel': [
    'Hotel', 'Flight', 'Car rental', 'Travel insurance', 'Luggage',
    'Tourist attraction', 'Travel guide', 'Currency exchange', 'Visa fee', 'Vacation'
  ],
  'Education': [
    'Course fee', 'Books', 'School supplies', 'Tuition', 'Online class',
    'Workshop', 'Certification', 'Training', 'Educational software', 'Seminar'
  ],
  'Other': [
    'Miscellaneous', 'Cash withdrawal', 'ATM fee', 'Charity donation', 'Pet expenses',
    'Home repair', 'Cleaning supplies', 'Personal care', 'Garden supplies', 'Storage'
  ]
};

// Generate random amount based on category
function getRandomAmount(category) {
  const ranges = {
    'Food & Dining': { min: 5, max: 150 },
    'Transportation': { min: 3, max: 200 },
    'Shopping': { min: 10, max: 500 },
    'Entertainment': { min: 8, max: 300 },
    'Bills & Utilities': { min: 25, max: 800 },
    'Healthcare': { min: 20, max: 1000 },
    'Travel': { min: 50, max: 2000 },
    'Education': { min: 30, max: 1200 },
    'Other': { min: 5, max: 250 }
  };
  
  const range = ranges[category];
  return (Math.random() * (range.max - range.min) + range.min).toFixed(2);
}

// Generate random date within the last 2 years
function getRandomDate() {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 2);
  const end = new Date();
  
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString().split('T')[0];
}

// Generate a batch of expenses
function generateExpenseBatch(batchSize) {
  const expenses = [];
  
  for (let i = 0; i < batchSize; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const description = descriptions[category][Math.floor(Math.random() * descriptions[category].length)];
    const amount = getRandomAmount(category);
    const date = getRandomDate();
    
    expenses.push([description, parseFloat(amount), category, date]);
  }
  
  return expenses;
}

async function seedDatabase() {
  // Use a reasonable default (1,000,000 rows) and allow override via SEED_EXPENSE_ROWS env var
  const DEFAULT_TARGET_ROWS = 1000000;
  const targetRows = parseInt(process.env.SEED_EXPENSE_ROWS, 10) || DEFAULT_TARGET_ROWS;
  const batchSize = 1000; // Smaller batch size to avoid parameter limits
  const totalBatches = Math.ceil(targetRows / batchSize);
  
  console.log(`Starting database seeding: ${targetRows.toLocaleString()} rows in ${totalBatches.toLocaleString()} batches`);
  if (targetRows > 10000000) {
    console.log('Warning: Seeding a very large number of rows may take a long time and consume significant disk space.');
  }
  
  try {
    // Check current row count
    const countResult = await pool.query('SELECT COUNT(*) FROM expenses');
    const currentCount = parseInt(countResult.rows[0].count);
    console.log(`Current expense count: ${currentCount}`);
    
    if (currentCount >= targetRows) {
      console.log('Database already has sufficient data. Skipping seed.');
      return;
    }
    
    const rowsToInsert = targetRows - currentCount;
    const batchesToInsert = Math.ceil(rowsToInsert / batchSize);
    
    console.log(`Inserting ${rowsToInsert.toLocaleString()} additional rows in ${batchesToInsert.toLocaleString()} batches...`);
    
    const startTime = Date.now();
    
    for (let batch = 0; batch < batchesToInsert; batch++) {
      const currentBatchSize = Math.min(batchSize, rowsToInsert - (batch * batchSize));
      const expenses = generateExpenseBatch(currentBatchSize);
      
      // Use regular INSERT with smaller chunks to avoid parameter limits
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Break the batch into smaller chunks of 100 rows (400 parameters each)
        for (let i = 0; i < expenses.length; i += 100) {
          const chunk = expenses.slice(i, i + 100);
          const values = [];
          const placeholders = [];
          
          chunk.forEach((expense, index) => {
            const offset = index * 4;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            values.push(...expense);
          });
          
          const query = `
            INSERT INTO expenses (description, amount, category, date) 
            VALUES ${placeholders.join(', ')}
          `;
          
          await client.query(query, values);
        }
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
      // Progress reporting
      const completed = batch + 1;
      const progress = ((completed / batchesToInsert) * 100).toFixed(3);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rowsInserted = completed * batchSize;
      const rate = (rowsInserted / (elapsed / 60)).toFixed(0); // rows per minute
      
      if (completed % 1000 === 0 || completed === batchesToInsert) {
        const eta = batchesToInsert > completed ? 
          Math.round((batchesToInsert - completed) * (elapsed / completed / 60)) : 0;
        console.log(`Progress: ${completed.toLocaleString()}/${batchesToInsert.toLocaleString()} batches (${progress}%) - ${elapsed}s elapsed - ${rate} rows/min - ETA: ${eta}min`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Final count
    const finalResult = await pool.query('SELECT COUNT(*) FROM expenses');
    const finalCount = parseInt(finalResult.rows[0].count);
    
    console.log(`✅ Seeding completed!`);
    console.log(`Total rows: ${finalCount.toLocaleString()}`);
    console.log(`Time taken: ${totalTime} seconds (${(totalTime / 60).toFixed(1)} minutes)`);
    console.log(`Average: ${(rowsToInsert / totalTime).toFixed(0)} rows/second`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };