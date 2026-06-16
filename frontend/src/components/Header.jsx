import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button, Dropdown } from 'antd'
import { UserOutlined, LogoutOutlined, HistoryOutlined, LineChartOutlined, CrownOutlined } from '@ant-design/icons'

function Header({ user, onLogin, onRegister, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()

  const userMenuItems = [
    { key: 'profile', icon: <HistoryOutlined />, label: '训练记录', onClick: () => navigate('/profile') },
    { key: 'vip', icon: <CrownOutlined />, label: 'VIP会员', onClick: () => navigate('/vip') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: onLogout },
  ]

  const navItems = [
    { path: '/', label: '开始训练' },
    { path: '/community', label: '社区' },
    // { path: '/vip', label: 'VIP' },
    { path: '/profile', label: '我的记录', needLogin: true },
  ]

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <LineChartOutlined className="logo-icon" />
          <span className="logo-text">TradeTrainer</span>
        </Link>

        <nav className="header-nav">
          {navItems.map(item => {
            if (item.needLogin && !user) return null
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="header-actions">
          {user ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <button className="user-btn">
                <div className="user-avatar">
                  <UserOutlined />
                </div>
                <span className="user-name">{user.username}</span>
              </button>
            </Dropdown>
          ) : (
            <div className="auth-btns">
              <Button type="text" className="login-btn" onClick={onLogin}>登录</Button>
              <Button type="primary" className="register-btn" onClick={onRegister}>注册</Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
