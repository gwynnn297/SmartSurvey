import React from 'react';
import HeaderComponent from '../components/HeaderComponent';
import Sidebar from '../components/Sidebar';
import './MainLayout.css';

const MainLayout = ({ children, showUserInfo = true, surveyId = null, surveyTitle = null, surveyDescription = null }) => {
    return (
        <>
            <HeaderComponent
                showUserInfo={showUserInfo}
                surveyId={surveyId}
                surveyTitle={surveyTitle}
                surveyDescription={surveyDescription}
            />
            <Sidebar />
            <main className="content">
                {children}
            </main>
        </>
    );
};

export default MainLayout;
