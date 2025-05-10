// Cloudflare Worker 主处理脚本
export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // 静态文件路由
      if (path === '/' || path === '/index.html') {
        return serveStaticFile('index.html', env);
      } else if (path === '/login.html') {
        return serveStaticFile('login.html', env);
      } else if (path === '/blog.html') {
        return serveStaticFile('blog.html', env);
      } else if (path === '/chat.html') {
        return serveStaticFile('chat.html', env);
      }
      
      // API路由
      if (path.startsWith('/api')) {
        return handleAPIRequest(request, env, url);
      }
      
      // WebSocket路由
      if (path === '/api/chat') {
        return handleWebSocket(request, env);
      }
      
      // 默认返回404
      return new Response('Not Found', { status: 404 });
    }
  };
  
  // 处理静态文件
  async function serveStaticFile(filename, env) {
    const file = await env.ASSETS.get(filename);
    if (!file) {
      return new Response('File not found', { status: 404 });
    }
    
    return new Response(file, {
      headers: { 'Content-Type': getContentType(filename) }
    });
  }
  
  // 获取内容类型
  function getContentType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const types = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    };
    
    return types[extension] || 'text/plain';
  }
  
  // 处理API请求
  async function handleAPIRequest(request, env, url) {
    const path = url.pathname;
    const method = request.method;
    
    // 认证检查
    if (path === '/api/auth/check') {
      return handleAuthCheck(request, env);
    }
    
    // 登录
    if (path === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env);
    }
    
    // 注册
    if (path === '/api/auth/register' && method === 'POST') {
      return handleRegister(request, env);
    }
    
    // 退出登录
    if (path === '/api/auth/logout' && method === 'POST') {
      return handleLogout(request, env);
    }
    
    // 博客相关API
    if (path === '/api/blogs' && method === 'GET') {
      return handleGetBlogs(env);
    }
    
    if (path === '/api/blogs' && method === 'POST') {
      return handleCreateBlog(request, env);
    }
    
    // 聊天历史
    if (path === '/api/chat/history' && method === 'GET') {
      return handleGetChatHistory(env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
  
  // 认证检查
  async function handleAuthCheck(request, env) {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return jsonResponse({ loggedIn: false });
    }
    
    const username = await env.KV.get(`session:${sessionId}`);
    if (!username) {
      return jsonResponse({ loggedIn: false });
    }
    
    return jsonResponse({ 
      loggedIn: true,
      username
    });
  }
  
  // 处理登录
  async function handleLogin(request, env) {
    const { username, password } = await request.json();
    
    // 验证用户
    const storedPassword = await env.KV.get(`user:${username}:password`);
    if (!storedPassword || storedPassword !== password) {
      return jsonResponse({ 
        success: false,
        message: '用户名或密码错误'
      }, 401);
    }
    
    // 创建会话
    const sessionId = generateSessionId();
    await env.KV.put(`session:${sessionId}`, username, { expirationTtl: 86400 }); // 24小时
    
    return jsonResponse({ 
      success: true,
      sessionId
    }, {
      headers: {
        'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      }
    });
  }
  
  // 处理注册
  async function handleRegister(request, env) {
    const { username, password } = await request.json();
    
    // 验证用户名
    if (!username || username.length < 3) {
      return jsonResponse({
        success: false,
        field: 'username',
        message: '用户名至少需要3个字符'
      }, 400);
    }
    
    // 验证密码
    if (!password || password.length < 6) {
      return jsonResponse({
        success: false,
        field: 'password',
        message: '密码至少需要6个字符'
      }, 400);
    }
    
    // 检查用户名是否已存在
    const userExists = await env.KV.get(`user:${username}:password`);
    if (userExists) {
      return jsonResponse({
        success: false,
        field: 'username',
        message: '用户名已存在'
      }, 400);
    }
    
    // 保存用户
    await env.KV.put(`user:${username}:password`, password);
    
    // 创建会话
    const sessionId = generateSessionId();
    await env.KV.put(`session:${sessionId}`, username, { expirationTtl: 86400 }); // 24小时
    
    return jsonResponse({ 
      success: true,
      sessionId
    }, {
      headers: {
        'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      }
    });
  }
  
  // 处理退出登录
  async function handleLogout(request, env) {
    const sessionId = getSessionId(request);
    if (sessionId) {
      await env.KV.delete(`session:${sessionId}`);
    }
    
    return jsonResponse({ 
      success: true
    }, {
      headers: {
        'Set-Cookie': `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
      }
    });
  }
  
  // 获取博客列表
  async function handleGetBlogs(env) {
    const blogs = await env.KV.get('blogs', { type: 'json' }) || [];
    return jsonResponse(blogs);
  }
  
  // 创建博客
  async function handleCreateBlog(request, env) {
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return jsonResponse({ 
        success: false,
        message: '请先登录'
      }, 401);
    }
    
    const username = await env.KV.get(`session:${sessionId}`);
    if (!username) {
      return jsonResponse({ 
        success: false,
        message: '请先登录'
      }, 401);
    }
    
    const { title, content } = await request.json();
    if (!title || !content) {
      return jsonResponse({ 
        success: false,
        message: '标题和内容不能为空'
      }, 400);
    }
    
    // 获取现有博客
    const blogs = await env.KV.get('blogs', { type: 'json' }) || [];
    
    // 添加新博客
    const newBlog = {
      id: generateId(),
      title,
      content,
      author: username,
      createdAt: new Date().toISOString()
    };
    
    blogs.unshift(newBlog);
    
    // 保存博客
    await env.KV.put('blogs', JSON.stringify(blogs));
    
    return jsonResponse({ 
      success: true,
      blog: newBlog
    });
  }
  
  // 获取聊天历史
  async function handleGetChatHistory(env) {
    const messages = await env.KV.get('chat_messages', { type: 'json' }) || [];
    return jsonResponse(messages);
  }
  
  // 处理WebSocket连接
  async function handleWebSocket(request, env) {
    // 检查是否支持WebSocket
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }
    
    // 检查会话
    const sessionId = getSessionId(request);
    if (!sessionId) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const username = await env.KV.get(`session:${sessionId}`);
    if (!username) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // 创建WebSocket对
    const [client, server] = Object.values(new WebSocketPair());
    
    // 处理WebSocket消息
    server.accept();
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // 验证消息
        if (!message.content || typeof message.content !== 'string') {
          return;
        }
        
        // 创建完整消息
        const fullMessage = {
          sender: username,
          content: message.content,
          timestamp: new Date().toISOString()
        };
        
        // 广播消息给所有客户端
        await broadcastMessage(env, fullMessage, server);
        
        // 保存消息到历史
        const messages = await env.KV.get('chat_messages', { type: 'json' }) || [];
        messages.push(fullMessage);
        
        // 限制历史消息数量
        if (messages.length > 100) {
          messages.shift();
        }
        
        await env.KV.put('chat_messages', JSON.stringify(messages));
        
      } catch (error) {
        console.error('处理WebSocket消息错误:', error);
      }
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  
  // 广播消息给所有客户端
  async function broadcastMessage(env, message, currentServer) {
    // 在实际生产环境中，您需要使用Durable Objects或其他机制来跟踪所有连接的客户端
    // 这里简化处理，只发送给当前服务器
    if (currentServer.readyState === WebSocket.OPEN) {
      currentServer.send(JSON.stringify(message));
    }
  }
  
  // 辅助函数：生成会话ID
  function generateSessionId() {
    return crypto.randomUUID();
  }
  
  // 辅助函数：生成ID
  function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  // 辅助函数：从请求中获取会话ID
  function getSessionId(request) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    
    if (!sessionCookie) return null;
    return sessionCookie.split('=')[1];
  }
  
  // 辅助函数：返回JSON响应
  function jsonResponse(data, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    
    return new Response(JSON.stringify(data), {
      ...options,
      headers
    });
  }