import { lazy } from 'react';

// Lazy load components for better performance
const HomePage = lazy(() => import('../pages/home/HomePage'));
const LoginPage = lazy(() => import('../pages/login/LoginPage'));
const Register = lazy(() => import('../pages/register/Register'));
const Dashboard = lazy(() => import('../pages/dashboard/DashboardPage'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword/ForgotPassword'));
const CreateAI = lazy(() => import('../pages/Survey/CreateAI'));
const CreateSurvey = lazy(() => import('../pages/Survey/CreateSurvey'));
const Profile = lazy(() => import('../pages/Profile/Profile'));
const ChangePassword = lazy(() => import('../pages/ChangePassword/ChangePassword'));

export const routes = [
    {
        path: "/",
        element: HomePage,
        public: true
    },
    {
        path: "/login",
        element: LoginPage,
        public: true
    },
    {
        path: "/register",
        element: Register,
        public: true
    },
    {
        path: "/forgot-password",
        element: ForgotPassword,
        public: true
    },
    {
        path: "/dashboard",
        element: Dashboard,
        public: false
    },
    {
        path: "/create-ai",
        element: CreateAI,
        public: false
    },
    {
        path: "/survey/create",
        element: CreateSurvey,
        public: false
    },
    {
        path: "/create-survey",
        element: CreateSurvey,
        public: false
    },
    {
        path: "/profile",
        element: Profile,
        public: false
    },
    {
        path: "/change-password",
        element: ChangePassword,
        public: false
    }
];

export default routes;

