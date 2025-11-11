'use client';

import { useState } from 'react';
import Link from 'next/link';
import ExpenseForm from '@/components/ExpenseForm';
import Toast from '@/components/Toast';

export default function Home() {
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleExpenseSubmit = async (expense: {
    description: string;
    amount: number;
    category: string;
    date: string;
  }) => {
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expense),
      });

      if (!response.ok) {
        throw new Error('Failed to create expense');
      }

      const result = await response.json();
      console.log('Expense created:', result);
      
      showToast('Expense added successfully!', 'success');
    } catch (error) {
      console.error('Error creating expense:', error);
      showToast('Failed to add expense. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Expense Tracker
          </h1>
          <Link 
            href="/analytics" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            View Analytics
          </Link>
        </div>
        <ExpenseForm onSubmit={handleExpenseSubmit} />
        
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
        />
      </div>
    </div>
  );
}
