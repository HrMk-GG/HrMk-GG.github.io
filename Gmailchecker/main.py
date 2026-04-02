import os
import re
from flask import Flask, render_template_string
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

app = Flask(__name__)

# Gmailの読み取り権限
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)

def get_latest_code():
    service = get_gmail_service()
    results = service.users().messages().list(userId='me', maxResults=1).execute()
    messages = results.get('messages', [])

    if not messages:
        return "メールが見つかりません", "N/A"

    msg = service.users().messages().get(userId='me', id=messages[0]['id']).execute()
    snippet = msg.get('snippet', '')
    
    # 5桁または6桁の数字を抽出
    code_match = re.search(r'\b\d{5,6}\b', snippet)
    code = code_match.group() if code_match else "番号なし"
    
    return snippet, code

@app.route('/')
def index():
    content, code = get_latest_code()
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <title>最新コード自動取得</title>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="30"> <style>
            body {{ font-family: sans-serif; text-align: center; background: #f0f2f5; padding-top: 50px; }}
            .card {{ background: white; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }}
            h1 {{ color: #1a73e8; }}
            .code {{ font-size: 48px; font-weight: bold; color: #d93025; letter-spacing: 5px; }}
            .info {{ color: #5f6368; margin-top: 20px; max-width: 400px; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h1>最新の認証番号</h1>
            <div class="code">{code}</div>
            <p class="info">内容: {content}</p>
            <p style="font-size: 12px; color: #999;">30秒ごとに自動更新中... ✨</p>
        </div>
    </body>
    </html>
    '''
    return render_template_string(html)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
