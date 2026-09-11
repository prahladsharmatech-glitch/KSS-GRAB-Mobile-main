import { test, expect } from '@playwright/test';

test.describe('Cloud DB Integration & Teardown Verification', () => {

  const BACKEND_URL = 'http://127.0.0.1:8000/api';

  test('Fetch products from cloud API endpoint', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/products`);
    expect(response.status()).toBe(200);

    const products = await response.json();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty('id');
    expect(products[0]).toHaveProperty('name');
    expect(products[0]).toHaveProperty('price');
  });

  test('Create test order in Cloud DB and verify persistence', async ({ request }) => {
    // 1. Authenticate to obtain JWT token
    const testPhone = '+919999988888';
    await request.post(`${BACKEND_URL}/auth/send-otp`, { data: { phone: testPhone } });
    const verifyRes = await request.post(`${BACKEND_URL}/auth/verify`, {
      data: { phone: testPhone, otp: '947347' },
    });
    const authData = await verifyRes.json();
    const token = authData.access_token || 'demo-token';

    const orderPayload = {
      customer_phone: testPhone,
      customer_name: 'Playwright Test User',
      delivery_address: '123 Cloud DB Test Lane, Bengaluru',
      items: [
        {
          id: 'prod-playwright-db-1',
          name: 'Playwright Organic Test Honey',
          price: 150.0,
          qty: 1,
        },
      ],
    };

    const createRes = await request.post(`${BACKEND_URL}/orders`, {
      data: orderPayload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect([200, 201]).toContain(createRes.status());
    const orderData = await createRes.json();

    expect(orderData).toHaveProperty('id');
    expect(orderData.status).toBe('placed');
    expect(orderData.subtotal).toBe(150.0);
    expect(orderData.total_amount).toBeGreaterThanOrEqual(150.0);
    expect(orderData).toHaveProperty('delivery_otp');

    // Fetch order list for user
    const listRes = await request.get(`${BACKEND_URL}/orders?phone=%2B919999988888`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(listRes.status()).toBe(200);
    const userOrders = await listRes.json();
    const ordersList = Array.isArray(userOrders) ? userOrders : (userOrders.orders || []);
    const found = ordersList.find((o: any) => o.id === orderData.id);
    expect(found).toBeDefined();
  });

});
