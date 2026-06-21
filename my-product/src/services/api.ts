// src/services/api.ts
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000', // Change this to your FastAPI backend URL if different
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach JWT token to requests if it exists in localStorage
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API; // This allows "import API from ..."