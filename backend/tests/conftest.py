import json, os, pytest, httpx
from dotenv import load_dotenv

@pytest.fixture(scope="session", autouse=True)
def auto_purge_test_orders_after_session():
    """Autouse session fixture to clean up all test orders after running pytest."""
    yield
    load_dotenv('backend/.env')
    
    # 1. Supabase cleanup
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY')
    if url and key:
        try:
            from supabase import create_client
            sb = create_client(url, key)
            sb.table('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        except Exception:
            pass

    # 2. orders_items.json cleanup
    items_file = 'backend/app/orders_items.json'
    if os.path.exists(items_file):
        try:
            with open(items_file, 'w') as f:
                json.dump({}, f)
        except Exception:
            pass

    # 3. Upstash Redis cleanup
    redis_url = os.environ.get('UPSTASH_REDIS_REST_URL')
    redis_token = os.environ.get('UPSTASH_REDIS_REST_TOKEN')
    if redis_url and redis_token:
        try:
            headers = {'Authorization': f'Bearer {redis_token}'}
            httpx.post(f'{redis_url}/set/cloud:orders_list', headers=headers, json=json.dumps([]))
            httpx.post(f'{redis_url}/set/seller:orders_queue', headers=headers, json=json.dumps([]))
            keys_res = httpx.get(f'{redis_url}/keys/*', headers=headers).json()
            if isinstance(keys_res, dict) and 'result' in keys_res and isinstance(keys_res['result'], list):
                for k in keys_res['result']:
                    if 'order' in str(k).lower():
                        httpx.get(f'{redis_url}/del/{k}', headers=headers)
        except Exception:
            pass
