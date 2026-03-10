const { Pool } = require('pg');
const { from: copyFrom } = require('pg-copy-streams');
const { Readable } = require('stream');
const os = require('os');

const CONCURRENCY = parseInt(process.env.SEED_CONCURRENCY, 10) || os.cpus().length;
const BATCH_SIZE = 50000;

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: CONCURRENCY,
});

const categories = [
  'Food & Dining', 'Transportation', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Healthcare', 'Travel', 'Education', 'Other'
];

const descriptions = {
  'Food & Dining': ['Lunch at cafe', 'Grocery shopping', 'Coffee', 'Dinner out', 'Pizza delivery', 'Fast food', 'Restaurant meal', 'Breakfast', 'Snacks', 'Takeout'],
  'Transportation': ['Gas station', 'Uber ride', 'Bus fare', 'Train ticket', 'Parking fee', 'Car maintenance', 'Taxi', 'Metro card', 'Bridge toll', 'Airport shuttle'],
  'Shopping': ['Clothing', 'Electronics', 'Home goods', 'Books', 'Shoes', 'Online purchase', 'Gift', 'Tools', 'Furniture', 'Accessories'],
  'Entertainment': ['Movie tickets', 'Concert', 'Streaming service', 'Video games', 'Sports event', 'Theater show', 'Museum', 'Amusement park', 'Mini golf', 'Bowling'],
  'Bills & Utilities': ['Electric bill', 'Internet', 'Phone bill', 'Water bill', 'Insurance', 'Rent', 'Credit card payment', 'Loan payment', 'Subscription', 'Bank fee'],
  'Healthcare': ['Doctor visit', 'Pharmacy', 'Dental checkup', 'Eye exam', 'Prescription', 'Hospital', 'Physical therapy', 'Medical test', 'Vitamins', 'First aid'],
  'Travel': ['Hotel', 'Flight', 'Car rental', 'Travel insurance', 'Luggage', 'Tourist attraction', 'Travel guide', 'Currency exchange', 'Visa fee', 'Vacation'],
  'Education': ['Course fee', 'Books', 'School supplies', 'Tuition', 'Online class', 'Workshop', 'Certification', 'Training', 'Educational software', 'Seminar'],
  'Other': ['Miscellaneous', 'Cash withdrawal', 'ATM fee', 'Charity donation', 'Pet expenses', 'Home repair', 'Cleaning supplies', 'Personal care', 'Garden supplies', 'Storage']
};

const amountRanges = {
  'Food & Dining': [5, 145], 'Transportation': [3, 197], 'Shopping': [10, 490],
  'Entertainment': [8, 292], 'Bills & Utilities': [25, 775], 'Healthcare': [20, 980],
  'Travel': [50, 1950], 'Education': [30, 1170], 'Other': [5, 245]
};

const now = Date.now();
const twoYearsAgo = now - 2 * 365.25 * 24 * 60 * 60 * 1000;
const dateRange = now - twoYearsAgo;

function generateTsvBatch(count) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const cat = categories[(Math.random() * categories.length) | 0];
    const desc = descriptions[cat][(Math.random() * descriptions[cat].length) | 0];
    const [min, span] = amountRanges[cat];
    const amount = (Math.round((min + Math.random() * span) * 100) / 100).toFixed(2);
    const date = new Date(twoYearsAgo + Math.random() * dateRange).toISOString().slice(0, 10);
    lines.push(desc + '\t' + amount + '\t' + cat + '\t' + date + '\n');
  }
  return lines.join('');
}

function copyBatch(client, count) {
  return new Promise((resolve, reject) => {
    const stream = client.query(copyFrom('COPY expenses (description, amount, category, date) FROM STDIN'));
    const data = generateTsvBatch(count);
    const readable = Readable.from([data]);
    readable.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function seedDatabase() {
  const targetRows = parseInt(process.env.SEED_EXPENSE_ROWS, 10) || 10000000;

  console.log('Starting database seeding: ' + targetRows.toLocaleString() + ' rows (' + CONCURRENCY + ' workers, COPY mode)');

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM expenses');
    const currentCount = parseInt(countResult.rows[0].count);
    console.log('Current expense count: ' + currentCount.toLocaleString());

    if (currentCount >= targetRows) {
      console.log('Database already has sufficient data. Skipping seed.');
      return;
    }

    const rowsToInsert = targetRows - currentCount;
    const batchesToInsert = Math.ceil(rowsToInsert / BATCH_SIZE);

    console.log('Inserting ' + rowsToInsert.toLocaleString() + ' rows in ' + batchesToInsert.toLocaleString() + ' batches...');

    const startTime = Date.now();
    let completedBatches = 0;

    async function insertBatch(batchIndex) {
      const count = Math.min(BATCH_SIZE, rowsToInsert - (batchIndex * BATCH_SIZE));
      const client = await pool.connect();
      try {
        await copyBatch(client, count);
      } finally {
        client.release();
      }

      completedBatches++;
      if (completedBatches % 10 === 0 || completedBatches === batchesToInsert) {
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rowsDone = completedBatches * BATCH_SIZE;
        const progress = ((completedBatches / batchesToInsert) * 100).toFixed(1);
        const rate = Math.round(rowsDone / elapsedSec).toLocaleString();
        const remaining = batchesToInsert - completedBatches;
        const eta = remaining > 0 ? Math.round(remaining * (elapsedSec / completedBatches)) : 0;
        console.log('Progress: ' + progress + '% - ' + rowsDone.toLocaleString() + ' rows - ' + rate + ' rows/s - ' + elapsedSec.toFixed(1) + 's elapsed - ETA: ' + eta + 's');
      }
    }

    const batches = Array.from({ length: batchesToInsert }, (_, i) => i);
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(insertBatch));
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const finalResult = await pool.query('SELECT COUNT(*) FROM expenses');
    const finalCount = parseInt(finalResult.rows[0].count);

    console.log('Seeding completed!');
    console.log('Total rows: ' + finalCount.toLocaleString());
    console.log('Time taken: ' + totalTime + 's (' + (totalTime / 60).toFixed(1) + ' min)');
    console.log('Average: ' + Math.round(rowsToInsert / totalTime).toLocaleString() + ' rows/second');

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
