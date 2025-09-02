'use client';
import React, { useState } from 'react';
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import Sidebar from '../../components/dashboard/Sidebar';
import ModelManagement from '../../components/dashboard/ModelManagement';
import GarmentManagement from '../../components/dashboard/GarmentManagement';
import SceneManagement from '../../components/dashboard/SceneManagement';
import TryOnInterface from '../../components/dashboard/TryOnInterface';
import DashboardErrorBoundary from '../../components/dashboard/DashboardErrorBoundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'models':
        return <ModelManagement />;
      case 'garments':
        return <GarmentManagement />;
      case 'scenes':
        return <SceneManagement />;
      case 'tryon':
        return <TryOnInterface />;
      default:
        return (
          <div className="max-w-7xl mx-auto p-6 w-full">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to FashionX Dashboard</h1>
              <p className="text-gray-600">
                Create models, upload garments, design scenes, and try on virtual clothes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <DashboardCard 
                title="Models" 
                description="Create and manage your virtual models"
                icon="👤"
                onClick={() => setActiveTab('models')}
              />
              <DashboardCard 
                title="Garments" 
                description="Upload and organize your clothing items"
                icon="👕"
                onClick={() => setActiveTab('garments')}
              />
              <DashboardCard 
                title="Scenes" 
                description="Create backgrounds for your try-on sessions"
                icon="🖼️"
                onClick={() => setActiveTab('scenes')}
              />
              <DashboardCard 
                title="Try-On" 
                description="Virtually try clothes on your models"
                icon="✨"
                onClick={() => setActiveTab('tryon')}
              />
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Getting Started</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-blue-100 text-blue-800 font-bold rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">1</div>
                  <div>
                    <h3 className="font-medium text-gray-900">Create or upload a model</h3>
                    <p className="text-gray-600 mt-1">Start by creating a virtual model or uploading your own image.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-blue-100 text-blue-800 font-bold rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">2</div>
                  <div>
                    <h3 className="font-medium text-gray-900">Upload garments</h3>
                    <p className="text-gray-600 mt-1">Add clothing items you want to try on.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-blue-100 text-blue-800 font-bold rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">3</div>
                  <div>
                    <h3 className="font-medium text-gray-900">Create scenes (optional)</h3>
                    <p className="text-gray-600 mt-1">Add background scenes for a more immersive experience.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-blue-100 text-blue-800 font-bold rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5">4</div>
                  <div>
                    <h3 className="font-medium text-gray-900">Start virtual try-on</h3>
                    <p className="text-gray-600 mt-1">Combine models, garments, and scenes to create your virtual try-on.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="flex">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          <main className="flex-1 p-4">
            {renderContent()}
          </main>
        </div>
        <ToastContainer position="bottom-right" autoClose={5000} />
      </div>
    </DashboardErrorBoundary>
  );
}

const DashboardCard = ({ title, description, icon, onClick }) => {
  return (
    <div 
      className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};