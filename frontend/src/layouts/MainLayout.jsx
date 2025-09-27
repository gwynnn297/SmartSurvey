import React from 'react';
import HeaderComponent from '../components/HeaderComponent';
import Sidebar from '../components/Sidebar';
import './MainLayout.css';

const MainLayout = ({ children, showUserInfo = true }) => {
    return (
        <>
            <HeaderComponent showUserInfo={showUserInfo} />
            <Sidebar />
            <main className="content">
                {children}
            </main>
        </>
    );
};

export default MainLayout;
