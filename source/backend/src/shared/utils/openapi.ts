// Hand-maintained OpenAPI 3 description of the API, served at /docs.
/* eslint-disable @typescript-eslint/no-explicit-any */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const envelope = (data: any = {}) => ({
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['SUCCESS'] },
    message: { type: 'string' },
    data,
    errors: { type: 'null' },
  },
});
const paginated = (item: string) =>
  envelope({
    type: 'object',
    properties: {
      items: { type: 'array', items: ref(item) },
      nextCursor: { type: 'string', nullable: true, description: 'Pass as ?cursor= for the next page; null on the last page' },
      hasMore: { type: 'boolean' },
      limit: { type: 'integer' },
    },
  });
const ok = (description: string, schema: any, status = '200') => ({
  [status]: { description, content: { 'application/json': { schema } } },
});
const errors = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [String(c), { $ref: `#/components/responses/E${c}` }]));
const body = (schema: any) => ({ required: true, content: { 'application/json': { schema } } });
const pathId = (name: string) => ({ name, in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
const query = (name: string, schema: any, description?: string) => ({ name, in: 'query', required: false, schema, description });
const pagination = [
  query('cursor', { type: 'string' }, 'Opaque cursor from the previous page (keyset pagination; omit for the first page)'),
  query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
];
const dateRange = [query('dateFrom', { type: 'string', format: 'date' }, 'Inclusive, UTC'), query('dateTo', { type: 'string', format: 'date' }, 'Inclusive, UTC')];
const secured = { security: [{ bearerAuth: [] }] };

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'POS Backend API',
    version: '1.0.0',
    description:
      'Multi-outlet POS API. All responses use the envelope `{ status, message, data, errors }`. ' +
      'Authenticate with `POST /api/auth/login` and send `Authorization: Bearer <accessToken>`.',
  },
  servers: [{ url: '/' }],
  tags: ['auth', 'outlets', 'users', 'menu', 'inventory', 'sales', 'reports', 'health'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    responses: {
      E400: errorResponse('Malformed request'),
      E401: errorResponse('Missing, invalid, expired or revoked token'),
      E403: errorResponse('Role or outlet scope not allowed'),
      E404: errorResponse('Not found'),
      E409: errorResponse('Conflict (duplicate, insufficient stock)'),
      E422: errorResponse('Validation failed'),
      E429: errorResponse('Rate limit exceeded'),
      E503: errorResponse('Database unavailable'),
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['FAIL'] },
          message: { type: 'string' },
          data: { type: 'null' },
          errors: { type: 'object', additionalProperties: { type: 'string' }, nullable: true },
        },
      },
      Tokens: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } },
      Outlet: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' }, address: { type: 'string', nullable: true }, createdAt: { type: 'string', format: 'date-time' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          role: { type: 'string', enum: ['hqadmin', 'outletadmin', 'superadmin'] },
          outletId: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      MenuItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          basePrice: { type: 'string', example: '4.50' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      OutletMenuItem: {
        allOf: [
          ref('MenuItem'),
          { type: 'object', properties: { outletPrice: { type: 'string', nullable: true, description: 'Override; null = basePrice' }, isActive: { type: 'boolean' } } },
        ],
      },
      InventoryRow: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          outletId: { type: 'integer' },
          menuItemId: { type: 'integer' },
          itemName: { type: 'string' },
          stock: { type: 'integer' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Sale: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          outletId: { type: 'integer' },
          receiptNumber: { type: 'string', description: 'Sequential per outlet, gap-free' },
          totalAmount: { type: 'string', example: '12.75' },
          createdBy: { type: 'integer', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SaleItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          saleId: { type: 'integer' },
          menuItemId: { type: 'integer' },
          quantity: { type: 'integer' },
          priceAtSale: { type: 'string' },
          itemName: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': { get: { tags: ['health'], summary: 'Liveness', responses: ok('Process is up', envelope()) } },
    '/health/ready': { get: { tags: ['health'], summary: 'Readiness (database, redis)', responses: { ...ok('Ready', envelope()), ...errors(503) } } },

    '/api/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Log in',
        requestBody: body({ type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } }),
        responses: { ...ok('Access + refresh tokens', envelope(ref('Tokens'))), ...errors(401, 422, 429) },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['auth'],
        summary: 'Rotate tokens (a refresh token works once; reuse revokes all sessions)',
        requestBody: body({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
        responses: { ...ok('New token pair', envelope(ref('Tokens'))), ...errors(401, 422, 429) },
      },
    },
    '/api/auth/logout': { post: { tags: ['auth'], summary: 'Revoke the current session', ...secured, responses: { ...ok('Logged out', envelope({ type: 'null' })), ...errors(401) } } },

    '/api/outlets': {
      get: { tags: ['outlets'], summary: 'List outlets (HQ/superadmin)', ...secured, parameters: pagination, responses: { ...ok('Outlets', paginated('Outlet')), ...errors(401, 403, 422) } },
      post: {
        tags: ['outlets'],
        summary: 'Create outlet (HQ/superadmin)',
        ...secured,
        requestBody: body({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, address: { type: 'string' } } }),
        responses: { ...ok('Created', envelope(ref('Outlet')), '201'), ...errors(401, 403, 409, 422) },
      },
    },

    '/api/users': {
      get: { tags: ['users'], summary: 'List users (superadmin)', ...secured, parameters: pagination, responses: { ...ok('Users', paginated('User')), ...errors(401, 403, 422) } },
      post: {
        tags: ['users'],
        summary: 'Create user (superadmin)',
        ...secured,
        requestBody: body({
          type: 'object',
          required: ['username', 'password', 'role'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string', minLength: 8 },
            role: { type: 'string', enum: ['hqadmin', 'outletadmin', 'superadmin'] },
            outletId: { type: 'integer', description: 'Required for outletadmin' },
          },
        }),
        responses: { ...ok('Created', envelope(ref('User')), '201'), ...errors(401, 403, 409, 422) },
      },
    },

    '/api/menu': {
      get: { tags: ['menu'], summary: 'List master menu (HQ/superadmin)', ...secured, parameters: pagination, responses: { ...ok('Menu items', paginated('MenuItem')), ...errors(401, 403, 422) } },
      post: {
        tags: ['menu'],
        summary: 'Create master menu item (HQ/superadmin)',
        ...secured,
        requestBody: body({
          type: 'object',
          required: ['name', 'basePrice'],
          properties: { name: { type: 'string' }, description: { type: 'string' }, basePrice: { type: 'string', example: '4.50' } },
        }),
        responses: { ...ok('Created', envelope(ref('MenuItem')), '201'), ...errors(401, 403, 409, 422) },
      },
    },
    '/api/menu/assign': {
      post: {
        tags: ['menu'],
        summary: 'Assign item to outlet, optionally overriding price (HQ/superadmin)',
        ...secured,
        requestBody: body({
          type: 'object',
          required: ['outletId', 'menuItemId'],
          properties: { outletId: { type: 'integer' }, menuItemId: { type: 'integer' }, price: { type: 'string', example: '4.95' }, isActive: { type: 'boolean', default: true } },
        }),
        responses: { ...ok('Assignment', envelope()), ...errors(401, 403, 422) },
      },
    },
    '/api/menu/outlet/{outletId}': {
      get: {
        tags: ['menu'],
        summary: 'Menu assigned to an outlet (outlet admins: own outlet only)',
        ...secured,
        parameters: [pathId('outletId'), ...pagination],
        responses: { ...ok('Outlet menu', paginated('OutletMenuItem')), ...errors(401, 403, 422) },
      },
    },

    '/api/inventory': {
      put: {
        tags: ['inventory'],
        summary: 'Set stock for an item at an outlet',
        ...secured,
        requestBody: body({
          type: 'object',
          required: ['outletId', 'menuItemId', 'stock'],
          properties: {
            outletId: { type: 'integer' },
            menuItemId: { type: 'integer' },
            stock: { type: 'integer', minimum: 0 },
            expectedStock: { type: 'integer', minimum: 0, description: 'Optional: reject with 409 if stock changed since it was read' },
          },
        }),
        responses: { ...ok('Updated row', envelope(ref('InventoryRow'))), ...errors(401, 403, 409, 422) },
      },
    },
    '/api/inventory/adjust': {
      post: {
        tags: ['inventory'],
        summary: 'Add or remove stock atomically (stock = stock + delta; never below 0)',
        ...secured,
        requestBody: body({
          type: 'object',
          required: ['outletId', 'menuItemId', 'delta'],
          properties: { outletId: { type: 'integer' }, menuItemId: { type: 'integer' }, delta: { type: 'integer', description: 'Non-zero; negative removes stock' } },
        }),
        responses: { ...ok('Updated row', envelope(ref('InventoryRow'))), ...errors(401, 403, 409, 422) },
      },
    },
    '/api/inventory/outlet/{outletId}': {
      get: { tags: ['inventory'], summary: 'Stock for an outlet', ...secured, parameters: [pathId('outletId'), ...pagination], responses: { ...ok('Stock', paginated('InventoryRow')), ...errors(401, 403, 422) } },
    },

    '/api/sales': {
      post: {
        tags: ['sales'],
        summary: 'Create a sale (atomic: price check, stock deduction, receipt number)',
        ...secured,
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 100 }, description: 'Retries with the same key return the original sale' }],
        requestBody: body({
          type: 'object',
          required: ['items'],
          properties: {
            outletId: { type: 'integer', description: 'Required for HQ/superadmin; ignored for outlet admins' },
            items: {
              type: 'array',
              minItems: 1,
              items: { type: 'object', required: ['menuItemId', 'quantity'], properties: { menuItemId: { type: 'integer' }, quantity: { type: 'integer', minimum: 1 } } },
            },
          },
        }),
        responses: {
          ...ok(
            'Created',
            envelope({ type: 'object', properties: { sale: ref('Sale'), items: { type: 'array', items: ref('SaleItem') }, receiptNumber: { type: 'string' }, totalAmount: { type: 'string' } } }),
            '201',
          ),
          '200': { description: 'Idempotent replay of an existing sale (header Idempotent-Replayed: true)' },
          ...errors(401, 403, 409, 422),
        },
      },
    },
    '/api/sales/outlet/{outletId}': {
      get: { tags: ['sales'], summary: 'Sales for an outlet, newest first', ...secured, parameters: [pathId('outletId'), ...pagination], responses: { ...ok('Sales', paginated('Sale')), ...errors(401, 403, 422) } },
    },
    '/api/sales/{saleId}': {
      get: {
        tags: ['sales'],
        summary: 'Sale with line items (receipt)',
        ...secured,
        parameters: [pathId('saleId')],
        responses: { ...ok('Sale', envelope({ allOf: [ref('Sale'), { type: 'object', properties: { items: { type: 'array', items: ref('SaleItem') } } }] })), ...errors(401, 403, 404) },
      },
    },

    '/api/reports/revenue-by-outlet': {
      get: {
        tags: ['reports'],
        summary: 'Total revenue per outlet (HQ: all outlets; outlet admin: own)',
        ...secured,
        parameters: dateRange,
        responses: {
          ...ok(
            'Revenue',
            envelope({
              type: 'object',
              properties: {
                totalRevenue: { type: 'number' },
                items: {
                  type: 'array',
                  items: { type: 'object', properties: { outletId: { type: 'integer' }, outletName: { type: 'string' }, transactionCount: { type: 'integer' }, totalRevenue: { type: 'number' } } },
                },
              },
            }),
          ),
          ...errors(401, 422),
        },
      },
    },
    '/api/reports/outlet/{outletId}/summary': {
      get: {
        tags: ['reports'],
        summary: 'Transaction count and revenue for an outlet',
        ...secured,
        parameters: [pathId('outletId'), ...dateRange],
        responses: {
          ...ok('Summary', envelope({ type: 'object', properties: { outletId: { type: 'integer' }, transactionCount: { type: 'integer' }, totalRevenue: { type: 'number' } } })),
          ...errors(401, 403, 422),
        },
      },
    },
    '/api/reports/outlet/{outletId}/top-items': {
      get: {
        tags: ['reports'],
        summary: 'Top selling items for an outlet (default 5)',
        ...secured,
        parameters: [pathId('outletId'), ...dateRange, query('limit', { type: 'integer', minimum: 1, maximum: 20, default: 5 })],
        responses: {
          ...ok(
            'Top items',
            envelope({
              type: 'object',
              properties: {
                outletId: { type: 'integer' },
                items: {
                  type: 'array',
                  items: { type: 'object', properties: { menuItemId: { type: 'integer' }, name: { type: 'string' }, quantitySold: { type: 'integer' }, revenue: { type: 'number' } } },
                },
              },
            }),
          ),
          ...errors(401, 403, 422),
        },
      },
    },
  },
};
