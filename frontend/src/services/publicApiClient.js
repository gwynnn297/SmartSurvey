import axios from 'axios';

// Public HTTP client không cần authentication
const publicApiClient = axios.create({
    baseURL: 'http://localhost:8080',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export { publicApiClient };