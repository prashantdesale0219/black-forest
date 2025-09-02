'use client';
import React from 'react';
import DashboardHeader from '../../../components/dashboard/DashboardHeader';
import Sidebar from '../../../components/dashboard/Sidebar';
import ModelManagement from '../../../components/dashboard/ModelManagement';
import DashboardErrorBoundary from '../../../components/dashboard/DashboardErrorBoundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ModelsPage() {
  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="flex">
          <Sidebar activeTab="models" />
          <main className="flex-1 p-4">
            <ModelManagement />
          </main>
        </div>
        <ToastContainer position="bottom-right" autoClose={5000} />
      </div>
    </DashboardErrorBoundary>
  );
}