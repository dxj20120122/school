import requests
import json
import os
from datetime import datetime, timedelta

# Cloudflare API配置
# CF_API_TOKEN = os.getenv('z0ltKcvM0JTlKzlIJ6kX4-7t8jGtOaJ6Wl5tkVcK')  # 使用标准命名
# CF_ACCOUNT_ID = os.getenv('d5138aae215d7b432c81f3e46945696c')
CF_API_TOKEN = os.getenv('CF_API_TOKEN')
CF_ACCOUNT_ID = os.getenv('CF_ACCOUNT_ID')
WORKER_NAME = 'hanwen-school-worker'
KV_NAMESPACE_NAME = 'HANWEN_SCHOOL_STORE'

def setup_cloudflare_backend():
    headers = {
        'Authorization': f'Bearer {CF_API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # 1. 创建KV命名空间
    print("创建KV命名空间...")
    kv_response = requests.post(
        f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces',
        headers=headers,
        json={'title': KV_NAMESPACE_NAME}
    )
    
    if kv_response.status_code != 200:
        print(f"创建KV命名空间失败: {kv_response.text}")
        return False
    
    kv_namespace_id = kv_response.json()['result']['id']
    print(f"KV命名空间创建成功，ID: {kv_namespace_id}")
    
    # 2. 上传Worker脚本
    print("上传Worker脚本...")
    
    # 读取Worker脚本
    with open('worker.js', 'r') as f:
        worker_script = f.read()
    
    worker_response = requests.put(
        f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/workers/scripts/{WORKER_NAME}',
        headers=headers,
        files={
            'script.js': worker_script,
            'metadata': (None, json.dumps({
                'body_part': 'script.js',
                'bindings': [
                    {
                        'type': 'kv_namespace',
                        'name': 'KV',
                        'namespace_id': kv_namespace_id
                    }
                ]
            }), 'application/json')
        }
    )
    
    if worker_response.status_code != 200:
        print(f"上传Worker脚本失败: {worker_response.text}")
        return False
    
    print("Worker脚本上传成功")
    
    # 3. 配置Worker路由
    print("配置Worker路由...")
    route_response = requests.post(
        f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/workers/routes',
        headers=headers,
        json={
            'pattern': 'school.moujie.dpdns.org/*',
            'script': WORKER_NAME
        }
    )
    
    if route_response.status_code != 200:
        print(f"配置Worker路由失败: {worker_response.text}")
        return False
    
    print("Worker路由配置成功")
    
    # 4. 上传前端静态文件
    print("上传前端静态文件...")
    static_files = ['index.html', 'login.html', 'blog.html', 'chat.html']
    
    for file_name in static_files:
        with open(file_name, 'r') as f:
            file_content = f.read()
        
        file_response = requests.put(
            f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{kv_namespace_id}/values/{file_name}',
            headers=headers,
            data=file_content
        )
        
        if file_response.status_code != 200:
            print(f"上传文件 {file_name} 失败: {file_response.text}")
            continue
        
        print(f"文件 {file_name} 上传成功")
    
    print("所有前端文件上传完成")
    
    # 5. 初始化一些测试数据
    print("初始化测试数据...")
    
    # 测试博客文章
    test_blogs = [
        {
            'id': 'blog1',
            'title': '欢迎来到翰文学校育才分校官网',
            'content': '这是由学生自主开发的校园交流平台，欢迎大家使用！',
            'author': 'admin',
            'createdAt': (datetime.now() - timedelta(days=2)).isoformat()
        },
        {
            'id': 'blog2',
            'title': '如何使用校园博客功能',
            'content': '点击"写博客"按钮即可发布你的第一篇文章，分享你的学习心得和生活感悟。',
            'author': 'admin',
            'createdAt': (datetime.now() - timedelta(days=1)).isoformat()
        }
    ]
    
    blogs_response = requests.put(
        f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{kv_namespace_id}/values/blogs',
        headers=headers,
        json=test_blogs
    )
    
    if blogs_response.status_code != 200:
        print(f"初始化博客数据失败: {blogs_response.text}")
    else:
        print("博客数据初始化成功")
    
    # 测试聊天消息
    test_messages = [
        {
            'sender': 'admin',
            'content': '大家好！欢迎使用全校交流功能！',
            'timestamp': (datetime.now() - timedelta(hours=2)).isoformat()
        },
        {
            'sender': 'testuser',
            'content': '这个功能太棒了！',
            'timestamp': (datetime.now() - timedelta(hours=1)).isoformat()
        }
    ]
    
    messages_response = requests.put(
        f'https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{kv_namespace_id}/values/chat_messages',
        headers=headers,
        json=test_messages
    )
    
    if messages_response.status_code != 200:
        print(f"初始化聊天数据失败: {messages_response.text}")
    else:
        print("聊天数据初始化成功")
    
    print("所有配置完成！")
    return True

if __name__ == '__main__':
    if not CF_API_TOKEN or not CF_ACCOUNT_ID:
        print("请设置CF_API_TOKEN和CF_ACCOUNT_ID环境变量")
        exit(1)
    
    if setup_cloudflare_backend():
        print("🎉 芜湖市翰文学校育才分校官网后端配置成功！")
    else:
        print("❌ 配置过程中出现错误，请检查日志")