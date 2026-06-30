// src/services/api.ts
import axios from 'axios';

const API = axios.create({
  baseURL: 'https://api.primepiptrade.com',
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