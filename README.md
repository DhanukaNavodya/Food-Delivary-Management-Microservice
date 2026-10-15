# Food Delivery Docker Compose Demo

Five Node.js/Express microservices behind an Nginx API Gateway, backed by MongoDB Atlas, orchestrated with Docker Compose. Each service owns its own database (database-per-service), authenticates requests with a shared JWT secret, and talks to other services over the Docker network.

## Architecture

```text
Client / Postman
       |
       v
API Gateway (Nginx) :8080
       |
       +--> Auth Service       :5001  --> auth_db
       +--> Restaurant Service :5002  --> restaurant_db
       +--> Order Service      :5003  --> order_db      (calls Restaurant + Customer)
       +--> Delivery Service   :5004  --> delivery_db   (calls Order + Restaurant)
       +--> Customer Service   :5005  --> customer_db
                                              |
                                        MongoDB Atlas (mernapp cluster)
```

## Project structure

```text
food-delivery-docker-compose-demo/
├── .github/workflows/deploy.yml   # CI/CD: build images → ECR → ECS
├── api-gateway/
│   ├── Dockerfile
│   ├── nginx.conf                 # used on AWS ECS (services on 127.0.0.1)
│   └── nginx.local.conf           # used by docker-compose (service names)
├── services/
│   ├── auth-service/
│   ├── restaurant-service/
│   ├── order-service/
│   ├── delivery-service/
│   └── customer-service/
├── docker-compose.yml
├── DEPLOYMENT.md                  # AWS deployment guide
└── README.md
```

Every service follows the same layout:

```text
services/<service>/
├── Dockerfile
├── package.json
├── .env.example             # copy to .env
└── src/
    ├── server.js            # connects to MongoDB, starts HTTP server, graceful shutdown
    ├── app.js               # Express app (helmet, morgan), router mounting
    ├── config/              # env config + MongoDB connection (with retry)
    ├── models/              # Mongoose schemas
    ├── controllers/         # request handlers / business logic
    ├── routes/              # Express routers + /health, /db-check, /api/docs
    ├── docs/                # Swagger (OpenAPI) spec
    ├── middleware/          # JWT auth, role checks, error handling
    └── utils/               # ApiError, pagination, roles, service client
```

## Run the complete system

Each service reads its own `services/<service>/.env`. Create them once from the examples and fill in `MONGO_URI` and `JWT_SECRET` (use the same `JWT_SECRET` in every service):

```powershell
copy services\auth-service\.env.example services\auth-service\.env
copy services\restaurant-service\.env.example services\restaurant-service\.env
copy services\order-service\.env.example services\order-service\.env
copy services\delivery-service\.env.example services\delivery-service\.env
copy services\customer-service\.env.example services\customer-service\.env

docker compose up --build -d
docker compose ps
```

Useful commands:

```powershell
docker compose logs -f                 # all logs
docker compose logs -f order-service   # one service
docker compose down                    # stop and remove the containers
```

Check everything through the gateway:

- Gateway: `http://localhost:8080/health`
- Service health: `http://localhost:8080/api/health/{auth|restaurant|order|delivery|customer}`
- Database check: `http://localhost:8080/api/db-check/{auth|restaurant|order|delivery|customer}`
- Swagger docs: `http://localhost:8080/api/docs/{auth|restaurants|orders|deliveries|customers}/`

## Roles and seeded data

| Role | Can do |
|---|---|
| `CUSTOMER` | manage own profile/addresses, place/edit/cancel own orders, track own deliveries |
| `RESTAURANT_OWNER` | manage own restaurants and menus, progress orders for their restaurants, request deliveries, view stats |
| `DELIVERY_AGENT` | see the open delivery pool, self-assign, mark picked up / delivered / failed |
| `ADMIN` | everything, including user management |

- An admin is created on first start: `admin@fooddelivery.local` / `Admin@123` (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- Two sample restaurants with menus are seeded when the restaurant DB is empty (`SEED_DATA=false` to disable).

Send the token from register/login as `Authorization: Bearer <token>`.

## API reference (via gateway, `http://localhost:8080`)

List endpoints are paginated: `?page=1&limit=20` → `{ data: [...], pagination: { page, limit, total, totalPages } }`.

### Auth — `/api/auth`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/register` | public | `{ name, email, password, role? }` (role: CUSTOMER, RESTAURANT_OWNER, DELIVERY_AGENT) |
| POST | `/login` | public | `{ email, password }` → `{ user, token }` |
| GET | `/verify` | auth | validates a token |
| GET / PUT | `/me` | auth | view / update own name & email |
| PATCH | `/me/password` | auth | `{ currentPassword, newPassword }` |
| GET / POST | `/users` | admin | list (`?role=&search=&isActive=`) / create any role |
| GET / PUT / DELETE | `/users/:id` | admin | |

### Customers — `/api/customers` (`:id` may be `me`)

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/` | admin | `?search=` |
| POST | `/` | customer, admin | create profile `{ phone, addresses? }` (name/email default from token) |
| GET / PUT / DELETE | `/:id` | owner, admin | |
| GET / POST | `/:id/addresses` | owner, admin | `{ label, street, city, postalCode, isDefault }` |
| PUT / DELETE | `/:id/addresses/:addressId` | owner, admin | |

### Restaurants — `/api/restaurants`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/` | public | `?search=&cuisine=&city=&isOpen=&ownerId=` |
| GET | `/:id` | public | `?includeMenu=true` |
| POST | `/` | owner, admin | `{ name, cuisine, description, address, phone, deliveryFee, minOrderAmount, ... }` |
| PUT / DELETE | `/:id` | owning owner, admin | delete also removes the menu |
| PATCH | `/:id/status` | owning owner, admin | `{ isOpen: true/false }` |
| GET | `/:id/menu` | public | `?category=&available=&search=&ids=` |
| GET | `/:id/menu/:itemId` | public | |
| POST | `/:id/menu` | owning owner, admin | `{ name, price, category, description, isAvailable }` |
| PUT / DELETE | `/:id/menu/:itemId` | owning owner, admin | |

### Orders — `/api/orders`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/` | customer, admin | `{ restaurantId, items: [{ menuItemId, quantity }], deliveryAddress?, notes?, paymentMethod? }` |
| GET | `/` | auth | scoped by role; `?status=&restaurantId=&customerId=` |
| GET | `/stats` | owner, admin | counts and revenue by status |
| GET | `/:id` | auth (scoped) | |
| PUT | `/:id` | customer, admin | edit address/notes/payment while `PENDING` |
| PATCH | `/:id/status` | role-based | `{ status, note? }` |
| PATCH | `/:id/cancel` | customer, owner, admin | `{ reason? }` — only while PENDING/CONFIRMED |
| DELETE | `/:id` | admin | |

Prices are always taken from the Restaurant Service — clients only send item ids and quantities. If no `deliveryAddress` is given, the customer's default address is used.

Order workflow:

```text
PENDING -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
   \__________\__________> CANCELLED
```

### Deliveries — `/api/deliveries`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/` | owner, admin | `{ orderId, notes?, estimatedDeliveryTime? }` |
| GET | `/` | auth (scoped) | agents: own deliveries, or `?available=true` for the open pool |
| GET | `/order/:orderId` | auth (scoped) | track delivery for an order |
| GET | `/:id` | auth (scoped) | |
| PUT | `/:id` | admin | notes / ETA / addresses |
| PATCH | `/:id/assign` | agent (self), admin (`{ driverId, driverName }`) | |
| PATCH | `/:id/status` | assigned agent, admin | `{ status, note? }` |
| DELETE | `/:id` | admin | |

Delivery workflow: `PENDING -> ASSIGNED -> PICKED_UP -> DELIVERED` (or `FAILED` / `CANCELLED`). `PICKED_UP` moves the order to `OUT_FOR_DELIVERY` and `DELIVERED` moves it to `DELIVERED`; if the Order Service rejects the change (e.g. the order is not `READY_FOR_PICKUP` yet) the delivery is not updated.

## Example flow

1. `POST /api/auth/register` as a CUSTOMER, RESTAURANT_OWNER and DELIVERY_AGENT; keep each token.
2. Customer: `POST /api/customers` with an address.
3. Owner: `POST /api/restaurants`, then `POST /api/restaurants/:id/menu` for a few items.
4. Customer: `POST /api/orders` with `restaurantId` and `items`.
5. Owner: `PATCH /api/orders/:id/status` → `CONFIRMED`, then `PREPARING`; `POST /api/deliveries` with the `orderId`.
6. Agent: `GET /api/deliveries?available=true`, then `PATCH /api/deliveries/:id/assign`.
7. Owner: `PATCH /api/orders/:id/status` → `READY_FOR_PICKUP`.
8. Agent: `PATCH /api/deliveries/:id/status` → `PICKED_UP`, then `DELIVERED`.
9. Customer: `GET /api/orders/:id` shows `DELIVERED` with full `statusHistory`.

## Running a service without Docker

```powershell
cd services\order-service
copy .env.example .env
npm install
npm run dev
```

Set `MONGO_URI` in `.env` to your Atlas connection string, including the service's database name (e.g. `.../order_db?retryWrites=true&w=majority`). Change service URLs such as `RESTAURANT_SERVICE_URL` to `http://localhost:<port>`.

## Direct service URLs

Service ports stay exposed so you can compare direct access with gateway access.

| Service | Port | Direct URL |
|---|---:|---|
| API Gateway | 8080 | http://localhost:8080 |
| Auth Service | 5001 | http://localhost:5001/health |
| Restaurant Service | 5002 | http://localhost:5002/health |
| Order Service | 5003 | http://localhost:5003/health |
| Delivery Service | 5004 | http://localhost:5004/health |
| Customer Service | 5005 | http://localhost:5005/health |

Each service also has `/db-check` and Swagger docs at `/api/docs`.

## Docker networking

With docker-compose, all containers join `food-delivery-network` and reach each other by service name (`http://order-service:5003`), so the gateway uses `api-gateway/nginx.local.conf`.

On AWS ECS all containers run in one task and share `localhost`, so the gateway image's own `nginx.conf` uses `127.0.0.1:<port>`.

## Deploying to AWS

See [DEPLOYMENT.md](DEPLOYMENT.md). On every push to `main`, GitHub Actions builds the images, pushes them to Amazon ECR and redeploys the Amazon ECS (Fargate) service.
