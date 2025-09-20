import React from 'react';
import HeaderComponent from '../components/HeaderComponent';
import './MainLayout.css'; 

const MainLayout = ({ children, showUserInfo = true }) => {
    return (
        <>
            <HeaderComponent showUserInfo={showUserInfo} />
            <main className="content">
                {children}
            </main>
        </>
    );
};

export default MainLayout;
