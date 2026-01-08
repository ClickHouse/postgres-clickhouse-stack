[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# PostgreSQL + ClickHouse = The default Open Data Stack

A practical open source data stack for transactional and analytical workloads.

## Overview

This project provides a ready-to-use data stack built on PostgreSQL and ClickHouse.

PostgreSQL acts as the system of record for transactional workloads, while ClickHouse is used for analytical queries and reporting. Data is continuously synchronized from PostgreSQL to ClickHouse using PeerDB via change data capture (CDC). The pg_clickhouse extension is included to allow PostgreSQL to offload analytical queries to ClickHouse transparently.

The stack is designed for applications that use PostgreSQL as a source of truth and need fast analytics as datasets grow, without rewriting the application or introducing complex data pipelines.

## What this stack includes

### PostgreSQL
- OLTP database
- Source of truth for application data
- Comes with the pg_clickhouse extension pre-installed

### ClickHouse
- OLAP database
- Optimized for large-scale aggregations and reporting queries

### PeerDB
- CDC-based replication from PostgreSQL to ClickHouse

## Why this setup

PostgreSQL is an excellent choice as a primary database for an application, but analytical queries such as dashboards, reports, and ad-hoc exploration become slower and more expensive as data volumes increase. Using a purpose-built analytical database such as ClickHouse is a better fit for these use cases.

This stack separates concerns:
- PostgreSQL handles transactions, writes, and point queries.
- ClickHouse handles aggregations and analytical workloads.
- PeerDB keeps both systems in sync in near real time.
- pg_clickhouse allows PostgreSQL to transparently offload eligible queries to ClickHouse.

The result is a simple architecture that scales analytics without disrupting the application.

## Typical workflow

1. An application writes all data to PostgreSQL.
2. PeerDB streams changes from PostgreSQL to ClickHouse using CDC.
3. Analytical tables are maintained in ClickHouse.
4. Reporting and analytics queries run on ClickHouse.
5. When using pg_clickhouse, some analytical queries issued to PostgreSQL are automatically offloaded to ClickHouse.

From the application’s point of view, PostgreSQL remains the primary interface.

## Getting started

### Prerequisites

**Required**
- Docker Engine with Docker Compose

### Start the Stack

```bash
./start.sh
```

This will start the following services:
- PostgreSQL (port 5432)
- ClickHouse (ports 9000, 8123)
- PeerDB UI (port 3000)

### Access the services

- PeerDB UI: http://localhost:3000
- ClickHouse UI: http://localhost:8123/play
- ClickHouse Client: `clickhouse client --host 127.0.0.1 --port 9000`
- PostgreSQL: `psql -h localhost -p 5432 -U admin -d postgres` (password: `password`)

## Sample application 

The project includes a sample expense-tracking application to demonstrate the stack.

The application is built with Next.js and uses PostgreSQL as its primary database. It allows you to create expenses and view an analytics dashboard. On first startup, it seeds one million rows of sample data into PostgreSQL.

Initially, the analytics dashboard queries PostgreSQL directly and takes several seconds to load. Using this stack, data can be synchronized from PostgreSQL to ClickHouse via PeerDB, and analytical queries offloaded from PostgreSQL to ClickHouse using pg_clickhouse, reducing dashboard load times to milliseconds.

### Prerequisites

**Required**
- Node.js 20+ and npm
- PostgreSQL client tools 

### Start the application

```bash
cd sample
./start_sample.sh
```

Note that loading the sample data into PostgreSQL on the first run can take several minutes.

This will start the sample application at http://localhost:3001

### Stop the application

```bash
docker compose down --volumes --remove-orphans
```

### Set Up Data Replication

Run the migration script to migrate the data from PostgreSQL to ClickHouse using PeerDB and configure the ClickHouse Foreign Data Wrapper to offload the queries from PostgreSQL to ClickHouse using pg_clickhouse.

```bash
cd sample
./migrate_data.sh
```

This will:
- Create the ClickHouse database
- Configure PeerDB peers
- Start data synchronization from PostgreSQL to ClickHouse
- Configure the ClickHouse Foreign Data Wrapper

Refresh the [analytics dashboard](http://localhost:3001/analytics) and you should see the load time drop from several seconds to milliseconds.
