const https = require('https');

const PRODUCT_MAP = {
  'prod_UJrzQCsMsqwz5i': 'plictor-work',
};

function stripeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      path,
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://plictor.com',
  };

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'Invalid session' }) };
  }

  try {
    const session = await stripeRequest(
      `/v1/checkout/sessions/${sessionId}?expand[]=line_items.data.price.product`
    );

    if (session.error) {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'Session not found' }) };
    }

    if (session.payment_status !== 'paid') {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Payment not completed' }) };
    }

    const lineItems = (session.line_items && session.line_items.data) || [];
    const purchased = lineItems
      .map(item => item.price && item.price.product && PRODUCT_MAP[item.price.product.id])
      .filter(Boolean);

    if (purchased.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'No recognized products' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ valid: true, products: purchased })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ valid: false, error: 'Verification failed' }) };
  }
};
