# Expense Tracker

A full-stack expense tracking application built with Next.js, TypeScript, Tailwind CSS, and PostgreSQL. Features a modern UI with toast notifications, analytics dashboard, and support for millions of expense records.

## Features

- ✨ **Modern UI** - Clean, responsive design with Tailwind CSS
- 📊 **Analytics Dashboard** - Comprehensive expense analytics with charts and statistics
- 🔔 **Toast Notifications** - User-friendly notifications instead of browser alerts
- 💰 **Smart Form** - Quick-add buttons for common amounts ($5, $10, $15, $20)
- 🏷️ **Category Tracking** - Organize expenses by predefined categories
- ⚡ **High Performance** - Handles millions of records with optimized queries
- 🎨 **Theme Support** - Basic dark/light theme detection (body styling only)

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL 17
- **Database Driver**: node-postgres (pg)
- **Development**: Docker Compose for local PostgreSQL

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd pg-expense-example
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up the Database

Start PostgreSQL using Docker Compose:

```bash
docker-compose up -d
```

This will:
- Start PostgreSQL 17 on port 5432
- Create a database named `expense_db`
- Use default credentials (postgres/postgres)
- Initialize the expenses table via `init.sql`

### 4. Configure Environment Variables

The app uses `.env.local` for database configuration (already created):

```bash
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=expense_db
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Seeding

To populate the database with synthetic data for testing:

```bash
npm run seed
```

**Note**: This creates **5 billion** synthetic expense records. It will take several hours to complete. Monitor progress in the terminal.

The seeding script generates realistic:
- Expense descriptions by category
- Amount ranges appropriate for each category
- Random dates over the last 2 years
- Proper category distribution

## API Endpoints

### Expenses

- `POST /api/expenses` - Create a new expense
  ```json
  {
    "description": "Lunch",
    "amount": 15.50,
    "category": "Food & Dining",
    "date": "2024-01-15"
  }
  ```

- `GET /api/expenses` - List expenses with optional filters
  - Query params: `startDate`, `endDate`, `category`

- `GET /api/expenses/stats` - Get expense analytics
  - Returns: total overview, category breakdown, monthly trends, daily activity

## Project Structure

```
├── app/
│   ├── api/expenses/          # API routes
│   ├── analytics/             # Analytics page
│   ├── page.tsx              # Home page with expense form
│   └── layout.tsx            # Root layout
├── components/
│   ├── ExpenseForm.tsx       # Expense input form
│   └── Toast.tsx            # Toast notification system
├── lib/
│   └── db.ts               # Database connection
├── scripts/
│   └── seed-database.js    # Database seeding script
├── docker-compose.yml      # PostgreSQL setup
├── init.sql               # Database schema
└── .env.local            # Environment variables
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run seed` - Seed database with synthetic data

## Database Schema

### Expenses Table

```sql
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Categories

The application supports these expense categories:

- Food & Dining
- Transportation
- Shopping
- Entertainment
- Bills & Utilities
- Healthcare
- Travel
- Education
- Other

## Development Notes

### Database Performance

- Uses connection pooling with `node-postgres`
- Optimized queries for analytics across millions of records
- Batch processing for efficient data insertion

### UI/UX Features

- Form validation with immediate feedback
- Toast notifications for success/error states
- Quick-add buttons for common expense amounts
- Responsive design for mobile and desktop
- Load time indicators for analytics

## Troubleshooting

### Database Connection Issues

1. Ensure Docker is running: `docker ps`
2. Check PostgreSQL container: `docker-compose logs postgres`
3. Verify environment variables in `.env.local`

### Seeding Issues

- For large datasets (5B records), ensure adequate disk space
- Monitor system resources during seeding
- Seeding can be interrupted and resumed (checks existing count)

### Performance

- Analytics queries are optimized but may take time with very large datasets
- Consider adding database indexes for specific query patterns
- Use connection pooling limits appropriate for your system

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests (if applicable)
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request
