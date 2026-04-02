import os
import re
import time
from flask import Flask, render_template_string
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

app = Flask(__name__)

# Gmailの読み取り権限（これがないとメールが見れないよ！）
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    creds = None
    # 2回目以降は、自動で作られる token.json を使ってログインをスキップするよ！
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # ログインが必要な場合
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # credentials.json（さっきの鍵）を使ってログイン画面を出す
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # ログイン情報を保存して、次回から自動ログインできるようにする
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            
    return build('gmail', 'v1', credentials=creds)

def get_latest_code():
    try:
        service = get_gmail_service()
        # 最新のメール1通だけを取得
        results = service.users().messages().list(userId='me', maxResults=1).execute()
        messages = results.get('messages', [])

        if not messages:
            return "メールが1通もありません", "なし"

        # メールの本文（スニペット）を取得
        msg = service.users().messages().get(userId='me', id=messages[0]['id']).execute()
        snippet = msg.get('snippet', '')
        
        # 5桁または6桁の数字（認証コードによくある形式）を正規表現で探すよ！
        code_match = re.search(r'\b\d{5,6}\b', snippet)
        code = code_match.group() if code_match else "番号が見つかりません"
        
        return snippet, code
    except Exception as e:
        return f"エラーが発生したよ: {e}", "エラー"

# サイトの見た目（HTML）
@app.route('/')
def index():
    content, code = get_latest_code()
    
    # ここにHTML/CSSを直接書いてるよ！
    html = f'''
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="30"> <title>最新認証コード自動取得</title>
        <style>
            body {{
                font-family: 'Helvetica Neue', Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                color: #fff;
            }}
            .container {{
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                text-align: center;
                border: 1px solid rgba(255,255,255,0.2);
                max-width: 500px;
            }}
            h1 {{ font-size: 24px; margin-bottom: 20px; opacity: 0.9; }}
            .code-display {{
                font-size: 64px;
                font-weight: bold;
                background: #fff;
                color: #764ba2;
                padding: 20px;
                border-radius: 15px;
                margin: 20px 0;
                letter-spacing: 8px;
                box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
            }}
            .snippet {{
                font-size: 14px;
                color: rgba(255,255,255,0.8);
                line-height: 1.6;
                background: rgba(0,0,0,0.2);
                padding: 15px;
                border-radius: 10px;
                text-align: left;
            }}
            .status {{
                margin-top: 20px;
                font-size: 12px;
                opacity: 0.6;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📩 最新の認証コード</h1>
            <div class="code-display">{code}</div>
            <div class="snippet">
                <strong>最新メールの内容:</strong><br>
                {content}
            </div>
            <div class="status">30秒ごとに自動で更新中... ✨</div>
        </div>
    </body>
    </html>
    '''
    return render_template_string(html)

if __name__ == '__main__':
    # 自分のPCで動かす（ポート5000番）
    app.run(debug=True, port=5000)