import React from 'react';
import HeaderComponent from '../components/HeaderComponent';

const MainLayout = ({ children, showUserInfo = true }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <HeaderComponent showUserInfo={showUserInfo} />
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
};

export default MainLayout;
