import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// 请求拦截器：添加token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 认证相关
export const authAPI = {
  register: (username, password) =>
    api.post('/auth/register', { username, password }),
  login: (username, password) =>
    api.post('/auth/login', `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }),
  getMe: () => api.get('/auth/me'),
}

// 数据相关
export const dataAPI = {
  searchStocks: (q) => api.get('/stocks/search', { params: { q } }),
  getMarket: (date) => api.get('/market', { params: { date } }),
  getStockHistory: (stockCode, endDate, days = 0) =>
    api.get('/stock/history', { params: { stock_code: stockCode, end_date: endDate, days } }),
  getStockPrice: (stockCode, date) =>
    api.get('/stock/price', { params: { stock_code: stockCode, date } }),
  getTradingDays: (startDate) =>
    api.get('/trading-days', { params: { start_date: startDate } }),
  randomStart: () => api.get('/random-start'),
}

// 训练记录相关
export const sessionAPI = {
  save: (data) => api.post('/sessions', data),
  getAll: () => api.get('/sessions'),
  batchDelete: (ids) => api.post('/sessions/delete', { ids }),
}

// VIP相关
export const vipAPI = {
  getStatus: () => api.get('/user/status'),
  activateVip: () => api.post('/user/activate-vip'),
  checkTraining: () => api.get('/training/check'),
}

// 社区相关
export const communityAPI = {
  getPosts: (page = 1) => api.get('/community/posts', { params: { page } }),
  getPost: (id) => api.get(`/community/posts/${id}`),
  createPost: (data) => api.post('/community/posts', data),
}

export default api
