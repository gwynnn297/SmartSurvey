import React from 'react';
import HeaderComponent from '../components/HeaderComponent';

const MainLayout = ({ children, showUserInfo = true }) => {
    return (
        <>
            <HeaderComponent showUserInfo={showUserInfo} />
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </>
    );
};

export default MainLayout;
