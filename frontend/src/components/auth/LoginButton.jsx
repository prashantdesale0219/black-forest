'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { User, LogOut, ChevronDown } from 'lucide-react';
import LoginModal from './login';
import { getAuthToken, getUserData, clearAuthCookies } from '../../lib/cookieUtils';

const   LoginButton = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = getAuthToken();
    const userData = getUserData();
    
    if (token && userData) {
      setIsLoggedIn(true);
      setUser(userData);
    }
  }, []);

  const handleLogout = () => {
    clearAuthCookies();
    setIsLoggedIn(false);
    setUser(null);
    setShowDropdown(false);
    // Dispatch custom event for navbar to detect login status change
    window.dispatchEvent(new Event('loginStatusChanged'));
    toast.success('Logged out successfully!');
    router.push('/');
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (isLoggedIn && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 text-white px-4 py-2 rounded-full transition-colors "
        >
          <User className="w-4 h-4" />
          <span>{user.firstName}</span>
          <ChevronDown 
            className={`w-4 h-4 transition-transform duration-200 ${
              showDropdown ? 'transform rotate-180' : ''
            }`} 
          />
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="py-2">
              <Link
                href="/dashboard"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setShowDropdown(false)}
              >
                <User className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={openModal}
        className="text-white px-6 py-2 rounded-full transition-colors"
      >
        Sign In
      </button>
      <LoginModal isOpen={isModalOpen} onClose={closeModal} initialMode="login" />
    </>
  );
};

export default LoginButton;