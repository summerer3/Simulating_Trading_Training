import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Modal, Form, Input, message } from 'antd'
import { authAPI } from './api'
import Header from './components/Header'
import SetupPage from './pages/SetupPage'
import TradingPage from './pages/TradingPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import CommunityPage from './pages/CommunityPage'
import VipPage from './pages/VipPage'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  // 交易页面隐藏Header
  const hideHeader = location.pathname === '/trading'

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authAPI.getMe().then(res => {
        setUser(res.data)
      }).catch(() => {
        localStorage.removeItem('token')
      })
    }
  }, [])

  const handleLogin = async (values) => {
    try {
      const res = await authAPI.login(values.username, values.password)
      localStorage.setItem('token', res.data.access_token)
      setUser({ username: res.data.username })
      setShowLogin(false)
      loginForm.resetFields()
      message.success('登录成功')
    } catch (err) {
      message.error(err.response?.data?.detail || '登录失败')
    }
  }

  const handleRegister = async (values) => {
    try {
      const res = await authAPI.register(values.username, values.password)
      localStorage.setItem('token', res.data.access_token)
      setUser({ username: res.data.username })
      setShowRegister(false)
      registerForm.resetFields()
      message.success('注册成功')
    } catch (err) {
      message.error(err.response?.data?.detail || '注册失败')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    message.info('已退出登录')
    navigate('/')
  }

  return (
    <div className="app-container">
      {!hideHeader && (
        <Header
          user={user}
          onLogin={() => setShowLogin(true)}
          onRegister={() => setShowRegister(true)}
          onLogout={handleLogout}
        />
      )}

      <main className={hideHeader ? '' : 'main-content'}>
        <Routes>
          <Route path="/" element={<SetupPage user={user} />} />
          <Route path="/trading" element={<TradingPage user={user} />} />
          <Route path="/history" element={<HistoryPage user={user} />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          <Route path="/community" element={<CommunityPage user={user} />} />
          <Route path="/vip" element={<VipPage user={user} />} />
        </Routes>
      </main>

      <Modal title="登录" open={showLogin} onCancel={() => setShowLogin(false)} footer={null} centered>
        <Form form={loginForm} onFinish={handleLogin} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input size="large" placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <button type="submit" className="btn-primary-full">登录</button>
          </Form.Item>
          <div className="modal-switch">
            还没有账号？<a onClick={() => { setShowLogin(false); setShowRegister(true) }}>立即注册</a>
          </div>
        </Form>
      </Modal>

      <Modal title="注册" open={showRegister} onCancel={() => setShowRegister(false)} footer={null} centered>
        <Form form={registerForm} onFinish={handleRegister} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2, message: '用户名至少2个字符' }]}>
            <Input size="large" placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <button type="submit" className="btn-primary-full">注册</button>
          </Form.Item>
          <div className="modal-switch">
            已有账号？<a onClick={() => { setShowRegister(false); setShowLogin(true) }}>去登录</a>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default App
