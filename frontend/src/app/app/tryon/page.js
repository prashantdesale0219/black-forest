'use client';
import React from 'react';
import DashboardHeader from '../../../components/dashboard/DashboardHeader';
import Sidebar from '../../../components/dashboard/Sidebar';
import TryOnInterface from '../../../components/dashboard/TryOnInterface';
import DashboardErrorBoundary from '../../../components/dashboard/DashboardErrorBoundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function TryOnPage() {
  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="flex">
          <Sidebar activeTab="tryon" />
          <main className="flex-1 p-4">
            <TryOnInterface />
          </main>
        </div>
        <ToastContainer position="bottom-right" autoClose={5000} />
      </div>
    </DashboardErrorBoundary>
  );
}