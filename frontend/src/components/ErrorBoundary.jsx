import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#cf1322' }}>页面渲染出错</h2>
          <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>
            {this.state.error?.message || '未知错误'}
          </pre>
          <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            style={{ marginTop: 16, padding: '8px 24px', cursor: 'pointer' }}>
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
