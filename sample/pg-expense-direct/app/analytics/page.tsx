'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QueryTiming {
  label: string;
  ms: number;
}

interface ExpenseStats {
  backend: string;
  queryTimings: QueryTiming[];
  total: {
    count: number;
    amount: number;
  };
  byCategory: Array<{
    category: string;
    count: number;
    total: number;
  }>;
  byMonth: Array<{
    month: string;
    count: number;
    total: number;
  }>;
  daily: Array<{
    date: string;
    count: number;
    total: number;
  }>;
}

const card = "bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800";
const heading = "text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center";
const label = "text-gray-700 dark:text-gray-300 font-medium";
const value = "font-bold text-lg text-gray-900 dark:text-gray-100";
const subtle = "text-sm font-medium text-gray-700 dark:text-gray-400";
const muted = "text-gray-500 dark:text-gray-400 font-medium";

export default function Analytics() {
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState<number | null>(null);

  const fetchStats = async () => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/expenses/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
      setLoadTime(Date.now() - startTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setSwitching(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const [switchError, setSwitchError] = useState<string | null>(null);

  const toggleBackend = async () => {
    setSwitching(true);
    setSwitchError(null);
    const isClickHouse = stats?.backend.includes('ClickHouse');
    const res = await fetch('/api/backend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend: isClickHouse ? 'postgres' : 'clickhouse' }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSwitchError(data.error);
      setSwitching(false);
      return;
    }
    await fetchStats();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Expense Analytics</h1>
          <div className={`${card} p-12 text-center`}>
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-4">Loading analytics...</div>
            <div className="text-gray-500 dark:text-gray-400">Querying PostgreSQL — this may take a while with large datasets.</div>
            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Tip: migrate to ClickHouse to speed this up!</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            &larr; Back to Home
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Expense Analytics</h1>
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <button
              onClick={toggleBackend}
              disabled={switching}
              className={`px-3 py-1 rounded-full text-sm font-bold cursor-pointer disabled:opacity-50 ${
                stats.backend.includes('ClickHouse')
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}
            >
              {switching ? 'Switching...' : stats.backend} ↔
            </button>
            {switchError && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                {switchError}
              </span>
            )}
            {loadTime && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                Total: {loadTime.toLocaleString()}ms
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {stats.total.count.toLocaleString()} rows
            </span>
          </div>
          {stats.queryTimings && (
            <div className={`mt-3 ${card} p-4`}>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Query Performance</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.queryTimings.map((t) => (
                  <div key={t.label} className="text-center">
                    <div className={`text-lg font-bold ${t.ms > 1000 ? 'text-red-600' : t.ms > 100 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {t.ms.toLocaleString()}ms
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className={`${card} p-6`}>
            <h2 className={heading}>
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              Total Overview
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className={label}>Total Expenses:</span>
                <span className={value}>{stats.total.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className={label}>Total Amount:</span>
                <span className="font-bold text-lg text-emerald-600">
                  ${stats.total.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className={label}>Average per Expense:</span>
                <span className={value}>
                  ${stats.total.count > 0 ? (stats.total.amount / stats.total.count).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className={`${card} p-6`}>
            <h2 className={heading}>
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
              Top Category
            </h2>
            {stats.byCategory.length > 0 ? (
              <div className="space-y-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.byCategory[0].category}
                </div>
                <div className={label}>
                  ${stats.byCategory[0].total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({stats.byCategory[0].count.toLocaleString()} expenses)
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full"
                    style={{
                      width: `${(stats.byCategory[0].total / stats.total.amount) * 100}%`
                    }}
                  ></div>
                </div>
                <div className={subtle}>
                  {((stats.byCategory[0].total / stats.total.amount) * 100).toFixed(1)}% of total spending
                </div>
              </div>
            ) : (
              <div className={muted}>No expenses yet</div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className={`${card} p-6 mb-8`}>
          <h2 className={heading}>
            <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
            Spending by Category
          </h2>
          {stats.byCategory.length > 0 ? (
            <div className="space-y-6">
              {stats.byCategory.map((category, index) => (
                <div key={category.category} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">{category.category}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">
                      ${category.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({category.count.toLocaleString()} expenses)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full bg-gradient-to-r ${
                        index === 0 ? 'from-indigo-500 to-indigo-600' :
                        index === 1 ? 'from-emerald-500 to-emerald-600' :
                        index === 2 ? 'from-orange-500 to-orange-600' :
                        index === 3 ? 'from-pink-500 to-pink-600' :
                        index === 4 ? 'from-cyan-500 to-cyan-600' :
                        'from-gray-500 to-gray-600'
                      }`}
                      style={{
                        width: `${(category.total / stats.total.amount) * 100}%`
                      }}
                    ></div>
                  </div>
                  <div className={subtle}>
                    {((category.total / stats.total.amount) * 100).toFixed(1)}% of total spending
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={muted}>No expenses to analyze</div>
          )}
        </div>

        {/* Monthly Trends */}
        <div className={`${card} p-6 mb-8`}>
          <h2 className={heading}>
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
            Monthly Spending
          </h2>
          {stats.byMonth.length > 0 ? (
            <div className="space-y-4">
              {stats.byMonth.map((month) => (
                <div key={month.month} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 rounded-lg hover:shadow-md transition-shadow">
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {new Date(month.month).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </span>
                  <div className="text-right">
                    <div className="font-bold text-lg text-emerald-600">${month.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className={subtle}>{month.count.toLocaleString()} expenses</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={muted}>No monthly data available</div>
          )}
        </div>

        {/* Recent Daily Activity */}
        <div className={`${card} p-6`}>
          <h2 className={heading}>
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
            Recent Daily Activity
          </h2>
          {stats.daily.length > 0 ? (
            <div className="space-y-3">
              {stats.daily.slice(0, 10).map((day) => (
                <div key={day.date} className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 rounded-lg hover:shadow-md transition-all">
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-lg text-orange-600 dark:text-orange-400">{'$'}{day.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-gray-700 dark:text-gray-300 ml-3 font-medium">({day.count.toLocaleString()})</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={muted}>No daily data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
